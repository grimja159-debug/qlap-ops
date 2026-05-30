/**
 * 표시용 포맷 헬퍼.
 *
 * [왜 필요한가]
 *  - 백엔드는 Firestore Timestamp 를 ISO 문자열로 직렬화해서 내려준다
 *    (QLapServices API/src/modules/guilds/serializers.ts 참고).
 *  - 하지만 값이 비어 있으면 null 로 내려오므로, 화면에서 `new Date(null)` 같은
 *    런타임 오류/`Invalid Date` 가 나지 않도록 한 곳에서 방어적으로 처리한다.
 */

/** 백엔드가 내려주는 날짜 타입: ISO 문자열이거나 null/undefined. */
export type IsoDateLike = string | number | null | undefined;

function toDate(value: IsoDateLike): Date | null {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2026. 5. 30." 형태의 날짜. 값이 없으면 '–'. */
export function formatDate(value: IsoDateLike): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString('ko-KR') : '–';
}

/** "2026. 5. 30. 오후 2:13" 형태의 날짜+시각. 값이 없으면 '–'. */
export function formatDateTime(value: IsoDateLike): string {
  const date = toDate(value);
  return date ? date.toLocaleString('ko-KR') : '–';
}

/** "방금 전 / 5분 전 / 3시간 전 / 2일 전" 상대 시간. 값이 없으면 '–'. */
export function formatRelative(value: IsoDateLike): string {
  const date = toDate(value);
  if (!date) return '–';
  const diffSec = (Date.now() - date.getTime()) / 1000;
  if (diffSec < 60) return '방금 전';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}시간 전`;
  return `${Math.round(diffSec / 86400)}일 전`;
}

/** 천 단위 콤마. 숫자가 아니면 '–'. */
export function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR') : '–';
}

/** 부호를 강제로 표시 (+1,000 / -500). 로그의 증감 표시에 사용. */
export function formatSignedNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '–';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('ko-KR')}`;
}

/** 긴 UID/문서 ID 를 "abcd…wxyz" 로 축약. 표 셀에서 가독성 확보용. */
export function shortId(id: string | null | undefined, head = 6, tail = 4): string {
  if (!id) return '–';
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** datetime-local input 값(YYYY-MM-DDTHH:mm) → ISO 문자열. 빈 값이면 undefined. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** ISO 문자열 → datetime-local input 값(YYYY-MM-DDTHH:mm). 비면 ''. */
export function isoToLocalInput(value: IsoDateLike): string {
  const date = toDate(value);
  if (!date) return '';
  // 로컬 타임존 기준으로 YYYY-MM-DDTHH:mm 생성 (toISOString 은 UTC 라 -9h 밀린다)
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
