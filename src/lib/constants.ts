export const PLAN_IDS = ['free', 'pro', 'pro_max'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_LABELS: Record<PlanId, string> = {
  free: 'FREE',
  pro: 'PRO',
  pro_max: 'PRO MAX',
};

export const USER_ROLES = ['user', 'operator', 'admin', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  user: '일반 유저',
  operator: '운영자',
  admin: '관리자',
  super_admin: '최고 관리자',
};

export const PRIVILEGED_ROLES = ['operator', 'admin', 'super_admin'] as const;
export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];

export function isPrivilegedRole(role: string | null | undefined): boolean {
  return role != null && (PRIVILEGED_ROLES as readonly string[]).includes(role);
}

export const FULL_ADMIN_ROLES = ['super_admin'] as const;
export type FullAdminRole = (typeof FULL_ADMIN_ROLES)[number];

export function isFullAdminRole(role: string | null | undefined): boolean {
  return role != null && (FULL_ADMIN_ROLES as readonly string[]).includes(role);
}

export const USER_STATUSES = ['active', 'banned', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: '활성',
  banned: '정지',
  deleted: '삭제됨',
};

export const IDENTITY_PROVIDERS = ['none', 'phone', 'ars', 'riot', 'kakao'] as const;
export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

export const IDENTITY_PROVIDER_LABELS: Record<IdentityProvider, string> = {
  none: '미인증',
  phone: '휴대폰',
  ars: 'ARS',
  riot: 'Riot',
  kakao: '카카오',
};

export const SEASON_STATUSES = ['draft', 'registration', 'point_collection', 'tournament', 'ended'] as const;
export type SeasonStatus = (typeof SEASON_STATUSES)[number] | 'active';

export const SEASON_STATUS_LABELS: Partial<Record<SeasonStatus, string>> = {
  draft: '준비중',
  registration: '모집중',
  point_collection: '점수 집계중',
  tournament: '토너먼트',
  ended: '종료',
};

export const ACTIVE_SEASON_STATUSES: readonly SeasonStatus[] = [
  'active',
  'registration',
  'point_collection',
  'tournament',
];

export const GUILD_STATUSES = ['active', 'locked', 'disbanded', 'banned'] as const;
export type GuildStatus = (typeof GUILD_STATUSES)[number];

export const GUILD_STATUS_LABELS: Record<GuildStatus, string> = {
  active: '활성',
  locked: '잠금',
  disbanded: '해체됨',
  banned: '정지',
};

export const GUILD_MEMBER_ROLES = ['owner', 'manager', 'member'] as const;
export type GuildMemberRole = (typeof GUILD_MEMBER_ROLES)[number];

export const GUILD_MEMBER_ROLE_LABELS: Record<GuildMemberRole, string> = {
  owner: '길드장',
  manager: '운영진',
  member: '길드원',
};

export const GUILD_MEMBER_STATUSES = ['active', 'left', 'kicked', 'banned'] as const;
export type GuildMemberStatus = (typeof GUILD_MEMBER_STATUSES)[number];

export const GUILD_MEMBER_STATUS_LABELS: Record<GuildMemberStatus, string> = {
  active: '활동중',
  left: '탈퇴',
  kicked: '강제 탈퇴',
  banned: '정지',
};

export const LOG_KINDS = ['qlCoin', 'guildActions', 'guildPoints'] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export const LOG_KIND_LABELS: Record<LogKind, string> = {
  qlCoin: 'QL 코인 로그',
  guildActions: '길드 행동 로그',
  guildPoints: '길드 포인트 로그',
};

export const QL_COIN_LOG_TYPES = [
  'PRO_MONTHLY_GRANT',
  'PRO_MAX_MONTHLY_GRANT',
  'ADMIN_GRANT',
  'ADMIN_REVOKE',
  'SHOP_USE',
  'REFUND',
] as const;

export const GUILD_ACTIONS = [
  'GUILD_CREATED',
  'GUILD_JOINED',
  'GUILD_LEFT',
  'MEMBER_KICKED',
  'GUILD_DISBANDED',
] as const;

export const CURRENCY_TYPES = ['qlcoin'] as const;
export type CurrencyType = (typeof CURRENCY_TYPES)[number];

export const CURRENCY_LABELS: Record<CurrencyType, string> = {
  qlcoin: 'QL 코인',
};

export const BILLING_ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'CANCELED_INTERNAL',
  'MANUAL_REFUND_REQUIRED',
  'REFUNDED',
  'CANCELED',
] as const;
export type BillingOrderStatus = (typeof BILLING_ORDER_STATUSES)[number];

export const BILLING_ORDER_STATUS_LABELS: Record<BillingOrderStatus, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
  EXPIRED: '만료',
  CANCELED_INTERNAL: '내부 취소',
  MANUAL_REFUND_REQUIRED: '수동 환불 필요',
  REFUNDED: '환불 완료',
  CANCELED: '취소 완료',
};

export const BILLING_PAYMENT_STATUSES = ['PAID', 'MANUAL_REFUND_REQUIRED', 'CANCELED', 'FAILED'] as const;
export type BillingPaymentStatus = (typeof BILLING_PAYMENT_STATUSES)[number];

export const BILLING_PAYMENT_STATUS_LABELS: Record<BillingPaymentStatus, string> = {
  PAID: '결제 완료',
  MANUAL_REFUND_REQUIRED: '수동 환불 필요',
  CANCELED: '취소됨',
  FAILED: '실패',
};

export const SUBSCRIPTION_TIERS = ['FREE', 'PRO', 'ADMIN'] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  FREE: 'FREE',
  PRO: 'PRO',
  ADMIN: 'ADMIN',
};

export const NOTICE_TYPES = ['info', 'warning', 'event', 'maintenance'] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  info: '안내',
  warning: '주의',
  event: '이벤트',
  maintenance: '점검',
};

export const ITEM_CURRENCIES = ['qlcoin', 'krw', 'none'] as const;
export type ItemCurrency = (typeof ITEM_CURRENCIES)[number];

export const ITEM_CURRENCY_LABELS: Record<ItemCurrency, string> = {
  qlcoin: 'QL 코인',
  krw: '원(KRW)',
  none: '무료/없음',
};

export const ADMIN_AUDIT_ACTION_LABELS: Record<string, string> = {
  'user.create': '유저 생성',
  'user.update': '유저 정보 수정',
  'user.access.update': '유저 접근 권한 수정',
  'user.delete': '유저 완전 삭제',
  'user.memo': '유저 메모',
  'user.qlcoin.grant': 'QL 코인 지급',
  'user.qlcoin.revoke': 'QL 코인 차감',
  'guild.create': '길드 생성',
  'guild.update': '길드 수정',
  'guild.delete': '길드 삭제',
  'guild.owner': '길드장 변경',
  'guild.member.add': '길드원 추가',
  'guild.member.kick': '길드원 강제 탈퇴',
  'guild.points.grant': '길드 포인트 지급',
  'guild.emblem.update': '길드 엠블럼 수정',
  'guild.emblem.remove': '길드 엠블럼 제거',
  'guild.settings.update': '길드 설정 수정',
  'guild.score_settings.update': '길드 스코어 설정 수정',
  'frontend.route_access.update': '프론트 입장 권한 수정',
  'season.create': '시즌 생성',
  'season.update': '시즌 수정',
  'item.grant': '아이템 지급',
  'item.revoke': '아이템 회수',
  'item.create': '아이템 생성',
  'item.update': '아이템 수정',
  'item.delete': '아이템 삭제',
  'notice.create': '공지 생성',
  'notice.update': '공지 수정',
  'notice.delete': '공지 삭제',
  'system.maintenance': '서버 점검',
  'billing.order.expire': '결제 주문 만료',
  'billing.order.refund': '결제 환불',
  'billing.order.cancel': '결제 주문 취소',
  'subscription.grant': 'PRO 수동 지급',
  'subscription.extend': 'PRO 수동 연장',
  'subscription.subtract': 'PRO 일수 차감',
  'subscription.revoke': 'PRO 수동 회수',
  'qstargram.post.status': 'Q스타그램 게시글 상태 변경',
  'qstargram.report.status': 'Q스타그램 신고 상태 변경',
};

export function adminAuditActionLabel(action: string): string {
  return ADMIN_AUDIT_ACTION_LABELS[action] ?? action;
}
