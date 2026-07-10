/**
 * 라우트 코드 스플리팅(React.lazy) 시 페이지 청크를 내려받는 동안 보여줄 폴백.
 *
 * [왜] 사이드바/헤더는 그대로 둔 채 본문 영역에만 표시되도록 AdminLayout 의
 *  <main> 안 <Suspense fallback> 으로 쓴다. 톤은 QueryState 의 "불러오는 중..."
 *  과 맞춰 콘솔 전반의 로딩 표현을 일관되게 유지한다.
 */
export function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
      <span className="inline-flex items-center gap-2">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-400" />
        불러오는 중...
      </span>
    </div>
  );
}
