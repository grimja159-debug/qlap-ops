/**
 * 접근 권한 플래그 타입.
 *
 * user_access 컬렉션의 boolean 플래그 3종.
 * (QLapServices API/src/modules/access/accessService.ts)
 *   - guildCreate : 길드 생성 허용
 *   - guildManage : 길드 관리 허용
 *   - aiReport    : AI 리포트 사용 허용
 *
 * 엔드포인트:
 *   GET  /api/admin/access          → { ok, accessList, count }
 *   GET  /api/admin/access/:uid      → { ok, access }
 *   POST /api/admin/access/update    → { ok, access }   본문: { uid, guildCreate?, guildManage?, aiReport? }
 *
 * 주의: role/plan/status 같은 "사용자 권한"은 여기가 아니라
 *       PATCH /api/admin/users/:uid/access(UserAccessProfilePatch)에서 다룬다.
 */
import type { IsoDate } from './common';

export const ACCESS_FLAG_KEYS = ['guildCreate', 'guildManage', 'aiReport'] as const;
export type AccessFlagKey = (typeof ACCESS_FLAG_KEYS)[number];

export const ACCESS_FLAG_LABELS: Record<AccessFlagKey, string> = {
  guildCreate: '길드 생성',
  guildManage: '길드 관리',
  aiReport: 'AI 리포트',
};

export interface UserAccess {
  uid: string;
  guildCreate: boolean;
  guildManage: boolean;
  aiReport: boolean;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

export interface AccessUpdateRequest {
  uid: string;
  guildCreate?: boolean;
  guildManage?: boolean;
  aiReport?: boolean;
}
