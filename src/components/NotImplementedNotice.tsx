/**
 * "백엔드 API 미구현" 안내 패널.
 *
 * [왜 가짜로 구현하지 않고 이걸 보여주나]
 *  요구사항은 더미 데이터/하드코딩 제거다. 백엔드에 엔드포인트가 없는 기능을
 *  가짜로 동작하는 척 만들면 운영자가 "처리됐다"고 오해해 사고가 난다.
 *  대신 어떤 API가 있어야 이 기능이 켜지는지 정확히 명세해, 그대로 백엔드에
 *  구현하면 연결만 하면 되도록 한다(요구사항 #2: 필요한 API 정리).
 */
interface NeededEndpoint {
  method: string;
  path: string;
  note: string;
}

interface NotImplementedNoticeProps {
  title: string;
  reason: string;
  endpoints: NeededEndpoint[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-blue-400',
  PATCH: 'text-amber-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
};

export function NotImplementedNotice({ title, reason, endpoints }: NotImplementedNoticeProps) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-400 text-sm">⚠</span>
        <h2 className="text-sm font-semibold text-amber-300">{title}</h2>
        <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">백엔드 API 필요</span>
      </div>
      <p className="text-xs text-zinc-400 mb-4 leading-relaxed">{reason}</p>

      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
        이 기능을 켜려면 아래 API가 필요합니다
      </p>
      <div className="flex flex-col gap-1.5">
        {endpoints.map((ep) => (
          <div
            key={`${ep.method} ${ep.path}`}
            className="rounded bg-zinc-900/60 border border-zinc-700/50 px-3 py-2"
          >
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className={METHOD_COLORS[ep.method] ?? 'text-zinc-400'}>{ep.method}</span>
              <span className="text-zinc-300">{ep.path}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{ep.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
