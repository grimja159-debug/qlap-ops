/**
 * 도메인 상수 — 백엔드(QLapServices API)와 1:1로 일치해야 하는 enum 값 모음.
 *
 * [왜 이 파일이 존재하는가]
 *  - 페이지/컴포넌트 곳곳에 'pro_max', 'banned' 같은 문자열을 하드코딩하면
 *    백엔드가 값을 바꿨을 때 어디를 고쳐야 하는지 추적이 불가능해진다.
 *  - 여기 한 곳에만 정의해두고 전부 import 하면, 값이 바뀌어도 한 곳만 수정하면 된다.
 *  - 각 값의 출처(백엔드 파일)를 주석으로 남겨, 백엔드와 동기화가 깨졌을 때
 *    바로 비교할 수 있게 한다.
 *
 * 출처:
 *  - QLapServices API/src/domain/access.ts        (PLAN_IDS, USER_ROLES, USER_STATUSES, IDENTITY_PROVIDERS)
 *  - QLapServices API/src/modules/guilds/guildTypes.ts (GUILD_SEASON_STATUSES, GUILD_STATUSES, GUILD_MEMBER_ROLES 등)
 */

/* ─────────────────────────── 사용자(plan / role / status) ─────────────────────────── */

/** 요금제. 백엔드 PLAN_IDS 와 동일. */
export const PLAN_IDS = ['free', 'pro', 'pro_max'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_LABELS: Record<PlanId, string> = {
  free: 'FREE',
  pro: 'PRO',
  pro_max: 'PRO MAX',
};

/** 사용자 권한(role). 백엔드 USER_ROLES 와 동일. */
export const USER_ROLES = ['user', 'operator', 'admin', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  user: '일반 사용자',
  operator: '운영자',
  admin: '관리자',
  super_admin: '최고 관리자',
};

/**
 * 운영/관리자 API를 호출할 수 있는 권한 목록.
 * 백엔드 PRIVILEGED_ROLES(= isOperatorProfile 통과 조건)와 반드시 같아야 한다.
 * 이 값으로 어드민 콘솔 진입 여부를 판단한다.
 */
export const PRIVILEGED_ROLES = ['operator', 'admin', 'super_admin'] as const;
export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];

export function isPrivilegedRole(role: string | null | undefined): boolean {
  return role != null && (PRIVILEGED_ROLES as readonly string[]).includes(role);
}

/** 계정 상태. 백엔드 USER_STATUSES 와 동일. ('suspended'는 백엔드에 존재하지 않는다.) */
export const USER_STATUSES = ['active', 'banned', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: '활성',
  banned: '정지',
  deleted: '삭제됨',
};

/** 본인인증 수단. 백엔드 IDENTITY_PROVIDERS 와 동일. */
export const IDENTITY_PROVIDERS = ['none', 'phone', 'ars', 'riot'] as const;
export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

export const IDENTITY_PROVIDER_LABELS: Record<IdentityProvider, string> = {
  none: '미인증',
  phone: '휴대폰',
  ars: 'ARS',
  riot: 'Riot',
};

/* ─────────────────────────── 시즌 ─────────────────────────── */

/** 시즌 상태. 백엔드 GUILD_SEASON_STATUSES 와 동일. */
export const SEASON_STATUSES = [
  'draft',
  'registration',
  'point_collection',
  'tournament',
  'ended',
] as const;
export type SeasonStatus = (typeof SEASON_STATUSES)[number];

export const SEASON_STATUS_LABELS: Record<SeasonStatus, string> = {
  draft: '준비중',
  registration: '모집중',
  point_collection: '점수 집계중',
  tournament: '토너먼트',
  ended: '종료',
};

/**
 * "현재 진행중"으로 간주하는 시즌 상태.
 * 백엔드 getActiveSeason() 이 status in [registration, point_collection, tournament] 로 보는 것과 맞춘다.
 */
export const ACTIVE_SEASON_STATUSES: readonly SeasonStatus[] = [
  'registration',
  'point_collection',
  'tournament',
];

/* ─────────────────────────── 길드 ─────────────────────────── */

/** 길드 상태. 백엔드 GUILD_STATUSES 와 동일. */
export const GUILD_STATUSES = ['active', 'locked', 'disbanded', 'banned'] as const;
export type GuildStatus = (typeof GUILD_STATUSES)[number];

export const GUILD_STATUS_LABELS: Record<GuildStatus, string> = {
  active: '활성',
  locked: '잠김',
  disbanded: '해체됨',
  banned: '정지',
};

/** 길드원 역할. 백엔드 GUILD_MEMBER_ROLES 와 동일. */
export const GUILD_MEMBER_ROLES = ['owner', 'manager', 'member'] as const;
export type GuildMemberRole = (typeof GUILD_MEMBER_ROLES)[number];

export const GUILD_MEMBER_ROLE_LABELS: Record<GuildMemberRole, string> = {
  owner: '길드장',
  manager: '운영진',
  member: '길드원',
};

/** 길드원 상태. 백엔드 GUILD_MEMBER_STATUSES 와 동일. */
export const GUILD_MEMBER_STATUSES = ['active', 'left', 'kicked', 'banned'] as const;
export type GuildMemberStatus = (typeof GUILD_MEMBER_STATUSES)[number];

export const GUILD_MEMBER_STATUS_LABELS: Record<GuildMemberStatus, string> = {
  active: '활동중',
  left: '탈퇴',
  kicked: '강제탈퇴',
  banned: '정지',
};

/* ─────────────────────────── 재화 / 로그 ─────────────────────────── */

/**
 * 운영 로그 컬렉션 키.
 * 백엔드 LOG_COLLECTIONS(guildFirestoreService.ts) 의 키와 동일하며,
 * GET /api/admin/logs/:key 의 :key 로 그대로 사용된다.
 */
export const LOG_KINDS = ['gmTiket', 'qlCoin', 'guildActions', 'guildPoints'] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export const LOG_KIND_LABELS: Record<LogKind, string> = {
  qlCoin: 'QL 코인 로그',
  gmTiket: 'GM 티켓 로그',
  guildActions: '길드 행동 로그',
  guildPoints: '길드 점수 로그',
};

/** GM 티켓 로그 타입. 백엔드 GM_TIKET_LOG_TYPES 와 동일. */
export const GM_TIKET_LOG_TYPES = [
  'PRO_MONTHLY_GRANT',
  'PRO_MAX_MONTHLY_GRANT',
  'GUILD_CREATE_USE',
  'GUILD_JOIN_USE',
  'ADMIN_GRANT',
  'ADMIN_REVOKE',
  'REFUND',
] as const;

/** QL 코인 로그 타입. 백엔드 QL_COIN_LOG_TYPES 와 동일. */
export const QL_COIN_LOG_TYPES = [
  'PRO_MONTHLY_GRANT',
  'PRO_MAX_MONTHLY_GRANT',
  'ADMIN_GRANT',
  'ADMIN_REVOKE',
  'SHOP_USE',
  'REFUND',
] as const;

/** 길드 행동 로그 액션. 백엔드 GUILD_ACTIONS 와 동일. */
export const GUILD_ACTIONS = [
  'GUILD_CREATED',
  'GUILD_JOINED',
  'GUILD_LEFT',
  'MEMBER_KICKED',
  'GUILD_DISBANDED',
] as const;

/** 어드민이 직접 다루는 재화 종류(지급/차감 폼에서 사용). */
export const CURRENCY_TYPES = ['qlcoin', 'gmticket'] as const;
export type CurrencyType = (typeof CURRENCY_TYPES)[number];

export const CURRENCY_LABELS: Record<CurrencyType, string> = {
  qlcoin: 'QL 코인',
  gmticket: 'GM 티켓',
};
