import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * 라우트 본문용 에러 경계.
 *
 * [왜] React 에는 에러 경계용 훅이 없어 클래스 컴포넌트가 필요하다. 페이지 한 곳의
 *  렌더 오류나 lazy 청크 로드 실패가 콘솔 전체를 백지로 만들지 않도록, AdminLayout
 *  의 <main> 안에서 Outlet 을 감싼다. 사이드바/헤더는 유지된 채 본문에만 폴백을 띄운다.
 *  AdminLayout 이 현재 경로(pathname)를 key 로 넘기므로, 다른 메뉴로 이동하면
 *  경계가 새로 마운트되어 에러 상태가 자동으로 초기화된다.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 운영 중 원인 추적용. 별도 로깅 인프라가 없으므로 콘솔에만 남긴다.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm font-medium text-red-400">문제가 발생했습니다</p>
          <p className="mt-1 break-all text-xs text-zinc-400">
            {error.message || '페이지를 표시하는 중 오류가 발생했습니다.'}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-4 rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
