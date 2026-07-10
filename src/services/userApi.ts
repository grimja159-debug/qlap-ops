/**
 * 유저 관리 API.
 *
 * 사용 엔드포인트 (QLapServices Admin API):
 *   GET   /api/admin/users?limit=        목록(최신 일부)        → { users }
 *   GET   /api/admin/users/:uid           단건 상세              → { user }
 *   PATCH /api/admin/users/:uid/access    권한/상태/요금제/인증 수정 → { user }
 *
 * [운영 메모]
 *  목록/검색/완성도 리포트는 백엔드 Admin API가 처리한다.
 *  qlap-ops는 현재 로드된 행 안에서만 필터링하지 않고, cursor/search 파라미터를 서버로 전달한다.
 *  유저 완성도 리포트는 Server DB 기준 read-only이며 샘플 UID는 마스킹된 값만 표시한다.
 */
import { api, buildQuery } from './api';
import type {
  AdminUserListResult,
  AdminUser,
  UserDataDiagnostics,
  UserAccessProfilePatch,
  UserCreateInput,
  UserCreateResult,
  UserListParams,
  UserPersonalScoreMirrorRetryResult,
  UserCompletenessReport,
} from '../types/user';

export const userApi = {
  listPage: (params: UserListParams | number = {}) => {
    const p = typeof params === 'number' ? { limit: params } : params;
    return api.get<AdminUserListResult>(
      `/api/admin/users${buildQuery({
        limit: p.limit ?? 50,
        cursor: p.cursor,
        q: p.q,
        type: p.type,
        role: p.role,
        status: p.status,
        plan: p.plan,
      })}`,
    );
  },

  searchPage: (params: UserListParams = {}) =>
    api.get<AdminUserListResult>(
      `/api/admin/users/search${buildQuery({
        limit: params.limit ?? 50,
        cursor: params.cursor,
        q: params.q,
        type: params.type,
        role: params.role,
        status: params.status,
        plan: params.plan,
      })}`,
    ),

  completeness: (limit = 1000) =>
    api
      .get<{ report: UserCompletenessReport }>(`/api/admin/users/completeness${buildQuery({ limit })}`)
      .then((r) => r.report),

  /**
   * 사용자 목록 + 서버사이드 검색.
   * 숫자를 넘기면 단순 limit(기존 호출 호환), 객체를 넘기면 q/role/status/plan 필터.
   */
  list: (params: UserListParams | number = {}) => {
    return userApi.listPage(params).then((r) => r.users);
  },

  /** UID 로 단건 조회. 존재하지 않으면 ApiError(USER_NOT_FOUND, 404). */
  get: (uid: string) =>
    api.get<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(uid)}`).then((r) => r.user),

  diagnostics: (uid: string) =>
    api
      .get<{ diagnostics: UserDataDiagnostics }>(`/api/admin/users/${encodeURIComponent(uid)}/diagnostics`)
      .then((r) => r.diagnostics),

  retryPersonalScoreMirror: (uid: string, input: { write?: boolean; reason?: string } = {}) =>
    api
      .post<{ result: UserPersonalScoreMirrorRetryResult }>(
        `/api/admin/users/${encodeURIComponent(uid)}/personal-score-mirror/retry`,
        input,
      )
      .then((r) => r.result),

  /**
   * 운영자 유저 생성(super_admin 전용).
   * 백엔드는 Firebase Auth 계정을 만든 뒤 Server DB 프로필/지갑/권한/연동 정보를 생성하고,
   * Firestore mirror/outbox 상태는 진단 패널에서 별도로 확인한다.
   */
  create: (input: UserCreateInput) =>
    api
      .post<{ user: AdminUser; temporaryPassword?: string | null }>('/api/admin/users', input)
      .then((r): UserCreateResult => ({ user: r.user, temporaryPassword: r.temporaryPassword ?? null })),

  /**
   * 권한 프로필 부분 수정.
   * 권한 변경(role), 계정 정지/해제(status: 'banned'|'active'), 요금제(plan),
   * 본인인증(identityVerified/identityProvider), Riot 정보(riotId/gameName/tagLine/puuid) 정정에 사용.
   * 보낸 필드만 merge 된다.
   */
  updateProfile: (uid: string, patch: UserAccessProfilePatch) =>
    api
      .patch<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(uid)}/access`, patch)
      .then((r) => r.user),

  /** 운영자 CS 메모 작성/수정(super_admin 전용). users.memo 에 저장. */
  updateMemo: (uid: string, memo: string) =>
    api
      .patch<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(uid)}/memo`, { memo })
      .then((r) => r.user),

  /**
   * 소프트 삭제 = 상태를 'deleted' 로 변경(문서 보존, 복구 가능).
   * 기존 PATCH .../access 를 그대로 사용한다(별도 백엔드 불필요).
   */
  softDelete: (uid: string) =>
    api
      .patch<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(uid)}/access`, { status: 'deleted' })
      .then((r) => r.user),

  /**
   * 하드 삭제 = users/지갑/접근/연동 문서 제거(복구 불가). super_admin 전용.
   * confirmation === 'DELETE USER' 필요. 권한 계정/본인은 백엔드가 거부한다.
   */
  remove: (uid: string, confirmation: string) =>
    api
      .delete<{ result: { deleted: boolean; uid: string } }>(
        `/api/admin/users/${encodeURIComponent(uid)}`,
        { confirmation },
      )
      .then((r) => r.result),
};
