import clsx from 'clsx';

/**
 * 범용 테이블.
 * - columns: 열 정의(헤더 + 셀 렌더 함수)
 * - onRowClick: 지정하면 행 전체가 클릭 가능해진다(유저 목록 → 상세 열기 등).
 * - loading/empty 상태를 직접 처리해, 페이지마다 같은 코드를 반복하지 않게 한다.
 */
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  emptyMessage,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-700/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700/60 bg-zinc-800/80">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap',
                  col.width,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-700/40">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                불러오는 중...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                {emptyMessage ?? '데이터가 없습니다'}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  'bg-zinc-800/30 hover:bg-zinc-700/30 transition-colors',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={clsx('px-4 py-2.5 text-zinc-300', col.width)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
