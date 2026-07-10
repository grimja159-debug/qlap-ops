/**
 * user_access 컬렉션의 기능 플래그.
 *
 * role/plan/status 같은 계정 권한은 여기서 다루지 않고
 * PATCH /api/admin/users/:uid/access 에서 관리한다.
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
