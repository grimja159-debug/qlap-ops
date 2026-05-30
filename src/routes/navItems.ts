/**
 * 네비게이션 메뉴 정의 — 사이드바와 헤더 제목이 공유하는 단일 소스.
 *
 * [왜 한 곳에] 메뉴 라벨/경로가 사이드바·헤더·라우터 세 군데에 흩어지면
 * 하나를 바꿀 때 나머지를 빠뜨리기 쉽다. 경로/라벨을 여기 모아 동기화를 보장한다.
 */
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  group: string;
}

/** 사이드바 그룹 표시 순서. */
export const NAV_GROUP_ORDER = ['개요', '사용자', '게임', '운영'] as const;

export const NAV_ITEMS: NavItem[] = [
  { path: '/admin', label: '대시보드', icon: '⬛', group: '개요' },

  { path: '/admin/users', label: '유저 관리', icon: '👥', group: '사용자' },
  { path: '/admin/access', label: '접근 권한', icon: '🔐', group: '사용자' },
  { path: '/admin/economy', label: '재화 관리', icon: '💰', group: '사용자' },

  { path: '/admin/guilds', label: '길드 관리', icon: '🏰', group: '게임' },
  { path: '/admin/seasons', label: '시즌 관리', icon: '🗓️', group: '게임' },
  { path: '/admin/items', label: '상점/아이템', icon: '📦', group: '게임' },

  { path: '/admin/notice', label: '공지 관리', icon: '📢', group: '운영' },
  { path: '/admin/logs', label: '운영 로그', icon: '📜', group: '운영' },
  { path: '/admin/system', label: '시스템', icon: '⚙️', group: '운영' },
];

/** 경로 → 제목 매핑(헤더용). */
export const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.path, item.label]),
);
