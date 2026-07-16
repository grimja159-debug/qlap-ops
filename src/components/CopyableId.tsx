import { memo, useState } from 'react';
import { shortId } from '../lib/format';

/**
 * UID/문서 ID 표시 + 클릭 복사.
 * [왜] 운영 중 UID 를 다른 화면/도구에 붙여넣는 일이 잦다. 매번 길게 드래그하지 않도록
 * 클릭 한 번으로 전체 값을 클립보드에 복사한다(표에는 축약형으로 보여줌).
 */
interface CopyableIdProps {
  value: string | null | undefined;
  /** true 면 전체값 표시, false(기본)면 축약. */
  full?: boolean;
  /** true 면 전체 표시 요청이어도 기본은 축약하고, 운영자가 명시적으로 펼쳐야 원문을 보여준다. */
  sensitive?: boolean;
}

export const CopyableId = memo(function CopyableId({ value, full, sensitive = false }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  if (!value) return <span className="text-zinc-600">–</span>;
  const canReveal = full === true && sensitive === true;
  const displayValue = full && (!sensitive || revealed) ? value : shortId(value);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // 클립보드 권한이 없으면 무시(표시는 그대로 유지).
    }
  };

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      <button
        type="button"
        onClick={copy}
        title="클릭하여 전체값 복사"
        className="text-zinc-500 transition-colors hover:text-violet-300"
      >
        {displayValue}
        {copied && <span className="ml-1 text-emerald-400">복사됨</span>}
      </button>
      {canReveal && (
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          className="rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-500 hover:border-violet-500/50 hover:text-violet-300"
          title={revealed ? '원문 숨기기' : '원문 보기'}
        >
          {revealed ? '숨김' : '보기'}
        </button>
      )}
    </span>
  );
});
