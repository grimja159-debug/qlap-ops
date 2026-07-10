import { ApiError } from '../services/api';

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  children: React.ReactNode;
  loadingText?: string;
}

function describeError(error: unknown): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.errorCode === 'LOGIN_REQUIRED') {
      return { title: '로그인이 필요합니다', detail: '세션이 만료되었을 수 있습니다. 다시 로그인하세요.' };
    }
    if (error.status === 403 || error.errorCode === 'ADMIN_REQUIRED' || error.errorCode === 'SUPER_ADMIN_REQUIRED') {
      return { title: '권한이 없습니다', detail: '이 작업에는 관리자 권한이 필요합니다.' };
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
    return <div className="py-6 text-center text-sm text-zinc-500">{loadingText ?? '불러오는 중...'}</div>;
  }
  if (error) {
    const { title, detail } = describeError(error);
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <p className="text-sm font-medium text-red-400">{title}</p>
        <p className="mt-1 break-all text-xs text-zinc-400">{detail}</p>
      </div>
    );
  }
  return <>{children}</>;
}
