/**
 * 유저 관리 API.
 *
 * 사용 엔드포인트 (QLapServices Admin API):
 *   GET   /api/admin/users?limit=        목록(최신 일부)        → { users }
 *   GET   /api/admin/users/:uid           단건 상세              → { user }
 *   PATCH /api/admin/users/:uid/access    권한/상태/요금제/인증 수정 → { user }
 *
 * [검색에 대한 중요한 한계]
 *  백엔드 listUsers 는 limit 만 받고 q/email/riotId 검색을 지원하지 않는다.
 *  - UID 가 정확히 주어지면 get(uid) 로 단건 조회(가장 정확).
 *  - 그 외(닉네임/이메일/RiotID)는 list 로 받아온 범위 안에서 클라이언트가 필터링한다.
 *  대규모 운영을 위해서는 백엔드 검색 API가 필요하다 → ADMIN_GUIDE.md 참고.
 */
import { api, buildQuery } from './api';
import type { AdminUser, UserAccessProfilePatch } from '../types/user';

export const userApi = {
  /** 사용자 목록. 기본 100명(백엔드 limit 상한). */
  list: (limit = 100) =>
    api.get<{ users: AdminUser[] }>(`/api/admin/users${buildQuery({ limit })}`).then((r) => r.users),

  /** UID 로 단건 조회. 존재하지 않으면 ApiError(USER_NOT_FOUND, 404). */
  get: (uid: string) =>
    api.get<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(uid)}`).then((r) => r.user),

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
};
