import { ApiError } from '../services/api';

/**
 * react-query 결과의 로딩/에러 상태를 일관되게 보여주는 래퍼.
 *
 * [왜] 모든 페이지가 "불러오는 중 / 에러 메시지 / 권한 없음"을 똑같이 처리해야 하는데,
 * 이를 복붙하면 표현이 제각각이 된다. 한 곳에서 ApiError 의 errorCode 까지 해석해 보여준다.
 */
interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  /** 데이터가 있으면 children 렌더. */
  children: React.ReactNode;
  loadingText?: string;
}

function describeError(error: unknown): { title: string; detail: string } {
  if (error instanceof ApiError) {
    // 운영자가 자주 만날 코드들은 친절한 한글 안내로 바꿔준다.
    if (error.status === 401 || error.errorCode === 'LOGIN_REQUIRED') {
      return { title: '로그인이 필요합니다', detail: '세션이 만료되었을 수 있습니다. 다시 로그인하세요.' };
    }
    if (error.status === 403 || error.errorCode === 'ADMIN_REQUIRED') {
      return { title: '권한이 없습니다', detail: '이 작업에는 운영자 이상 권한이 필요합니다.' };
    }
    if (error.errorCode === 'NETWORK_ERROR') {
      return { title: '서버에 연결할 수 없습니다', detail: error.message };
    }
    return { title: `오류 (${error.errorCode})`, detail: error.message };
  }
  return { title: '알 수 없는 오류', detail: error instanceof Error ? error.message : String(error) };
}

export function QueryState({ isLoading, error, children, loadingText }: QueryStateProps) {
  if (isLoading) {
    return <div className="text-sm text-zinc-500 py-6 text-center">{loadingText ?? '불러오는 중...'}</div>;
  }
  if (error) {
    const { title, detail } = describeError(error);
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <p className="text-sm font-medium text-red-400">{title}</p>
        <p className="text-xs text-zinc-400 mt-1 break-all">{detail}</p>
      </div>
    );
  }
  return <>{children}</>;
}
