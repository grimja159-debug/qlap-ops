export interface NavItem {
  path: string;
  label: string;
  icon: string;
  group: string;
}

export const ENABLE_FRONTEND_MOCK_TEST =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_FRONTEND_MOCK_TEST === 'true';

export const NAV_GROUP_ORDER = ['개요', '사용자', '게임', '결제', '운영', '문의/신고'] as const;

export const NAV_ITEMS: NavItem[] = [
  { path: '/admin', label: '대시보드', icon: 'D', group: '개요' },

  { path: '/admin/users', label: '유저 관리', icon: 'U', group: '사용자' },
  { path: '/admin/access', label: '접근 권한', icon: 'A', group: '사용자' },
  { path: '/admin/economy', label: '재화 관리', icon: 'E', group: '사용자' },

  { path: '/admin/guilds', label: '길드 관리', icon: 'G', group: '게임' },
  { path: '/admin/guild-score', label: '길드 스코어', icon: 'S', group: '게임' },
  { path: '/admin/guild-expedition', label: '길드 원정대 설정', icon: 'V', group: '게임' },
  { path: '/admin/tournaments', label: '멸망전 관리', icon: 'T', group: '게임' },
  { path: '/admin/live-cw', label: '실시간 내전 관리', icon: 'L', group: '게임' },
  { path: '/admin/rofl-jobs', label: 'ROFL Jobs', icon: 'R', group: '게임' },
  { path: '/admin/user-score', label: '유저 점수 관리', icon: 'P', group: '게임' },
  { path: '/admin/seasons', label: '시즌 관리', icon: 'C', group: '게임' },
  { path: '/admin/test-lab', label: '테스트랩', icon: 'X', group: '게임' },
  { path: '/admin/items', label: '상점/아이템', icon: 'I', group: '게임' },

  { path: '/admin/billing', label: '결제 관리', icon: 'B', group: '결제' },
  { path: '/admin/subscriptions', label: '구독 관리', icon: 'M', group: '결제' },
  { path: '/admin/gifts', label: '관리자 선물', icon: 'G', group: '결제' },

  { path: '/admin/notice', label: '공지 관리', icon: 'N', group: '운영' },
  { path: '/admin/guild-prize', label: '길드 상금 변경', icon: 'W', group: '운영' },
  { path: '/admin/qstargram', label: 'Q스타그램 관리', icon: 'Q', group: '운영' },
  { path: '/admin/logs', label: '운영 로그', icon: 'O', group: '운영' },
  { path: '/admin/audit', label: '감사 로그', icon: 'K', group: '운영' },
  { path: '/admin/system', label: '서버 관리', icon: 'Y', group: '운영' },
  { path: '/admin/maintenance', label: '서버 점검', icon: 'M', group: '운영' },
  { path: '/admin/frontend-route-access', label: '프론트 입장권한', icon: 'P', group: '운영' },
  { path: '/admin/redis-cache', label: 'Redis 캐시 관리', icon: 'R', group: '운영' },
  { path: '/admin/firestore-hot-path', label: 'Firestore 절감', icon: 'F', group: '운영' },
  { path: '/admin/r2-artifacts', label: 'R2 아티팩트', icon: 'R', group: '운영' },
  { path: '/admin/db-inspector', label: 'DB/XML', icon: 'X', group: '운영' },

  { path: '/admin/inquiry', label: '문의', icon: 'Q', group: '문의/신고' },
  { path: '/admin/declaration', label: '신고', icon: '!', group: '문의/신고' },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { path: '/admin/qlapgg-test', label: 'QLapGG 테스트', icon: 'T', group: '테스트' },
  ...(ENABLE_FRONTEND_MOCK_TEST
    ? [{ path: '/admin/frontend-test', label: '프론트엔드 테스트', icon: 'F', group: '테스트' }]
    : []),
];

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_ITEMS, ...BOTTOM_NAV_ITEMS];

export const PAGE_TITLES: Record<string, string> = {
  ...Object.fromEntries(ALL_NAV_ITEMS.map((item) => [item.path, item.label])),
  '/admin/personal-score': '유저 점수 관리',
};
