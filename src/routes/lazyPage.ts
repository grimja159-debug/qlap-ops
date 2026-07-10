import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * named export 페이지를 React.lazy 로 코드 스플리팅하기 위한 어댑터.
 *
 * [왜] 페이지들은 default export 가 아니라 named export
 *  (`export function AdminUsersPage()`)다. React.lazy 는 `{ default }` 모듈을
 *  기대하므로, 동적 import 결과에서 해당 이름을 꺼내 default 로 매핑해 준다.
 *  덕분에 페이지 본문 코드는 각자 별도 청크로 분리되어, 첫 로드에는
 *  현재 들어간 라우트의 청크만 내려받는다(나머지는 진입 시 지연 로드).
 *
 * 사용: lazyPage(() => import('../pages/AdminUsersPage'), 'AdminUsersPage')
 */
export function lazyPage<K extends string>(
  loader: () => Promise<Record<K, ComponentType>>,
  name: K,
): LazyExoticComponent<ComponentType> {
  return lazy(() => loader().then((module) => ({ default: module[name] })));
}
