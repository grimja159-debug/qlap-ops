import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { SelectField, NumberField, TextField } from '../components/Field';
import { CopyableId } from '../components/CopyableId';
import { roflAdminApi } from '../services/roflAdminApi';
import { formatDateTime, formatNumber } from '../lib/format';
import type { AdminR2ArtifactObject } from '../types/rofl';

const PREFIX_PRESETS = [
  { value: 'outrofl/', label: 'ROFL JSON output' },
  { value: 'live-cw/', label: 'Live CW archive' },
  { value: 'qlapcoin/', label: 'QLapCoin reports' },
  { value: 'matches/', label: 'Match artifacts' },
  { value: 'support/', label: 'Support attachments' },
  { value: 'custom', label: '직접 입력' },
];

function formatBytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024).toLocaleString()} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function typeTone(type: string) {
  if (type.includes('ROFL')) return 'info' as const;
  if (type.includes('ARCHIVE')) return 'success' as const;
  if (type.includes('QLAPCOIN')) return 'warning' as const;
  return 'neutral' as const;
}

function ObjectTable({ rows }: { rows: AdminR2ArtifactObject[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-6 text-center text-sm text-zinc-500">
        해당 prefix에 표시할 private R2 object가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-950/70 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">type</th>
            <th className="px-3 py-2 text-left">object key</th>
            <th className="px-3 py-2 text-right">size</th>
            <th className="px-3 py-2 text-left">created/modified</th>
            <th className="px-3 py-2 text-left">storage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 bg-zinc-950/30">
          {rows.map((row) => (
            <tr key={row.objectKey}>
              <td className="px-3 py-2">
                <StatusBadge label={row.type} tone={typeTone(row.type)} />
              </td>
              <td className="max-w-[34rem] px-3 py-2">
                <CopyableId value={row.objectKey} full />
              </td>
              <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatBytes(row.sizeBytes)}</td>
              <td className="px-3 py-2 text-xs text-zinc-400">{formatDateTime(row.lastModified ?? undefined)}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{row.storageClass ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminR2ArtifactsPage() {
  const [preset, setPreset] = useState('outrofl/');
  const [customPrefix, setCustomPrefix] = useState('');
  const [limit, setLimit] = useState(100);
  const [continuationToken, setContinuationToken] = useState<string | null>(null);

  const prefix = useMemo(() => (preset === 'custom' ? customPrefix.trim().replace(/^\/+/, '') : preset), [customPrefix, preset]);

  const query = useQuery({
    queryKey: ['admin-r2-artifacts', prefix, limit, continuationToken],
    queryFn: () => roflAdminApi.listR2Artifacts({ prefix, limit, continuationToken }),
    enabled: prefix.length > 0,
  });

  const artifacts = query.data;

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <PageSection
        title="R2 Private Artifact Browser"
        description="ROFL JSON, Live CW archive, QLapCoin report 같은 private R2 object key를 읽기 전용으로 확인합니다. signed URL은 이 화면에서 만들지 않습니다."
        right={
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching || !prefix}
            className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            {query.isFetching ? '확인 중...' : '새로고침'}
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-[14rem_1fr_8rem]">
          <SelectField
            label="prefix preset"
            value={preset}
            onChange={(value) => {
              setPreset(value);
              setContinuationToken(null);
            }}
            options={PREFIX_PRESETS}
          />
          <TextField
            label="object prefix"
            value={prefix}
            onChange={(value) => {
              setPreset('custom');
              setCustomPrefix(value);
              setContinuationToken(null);
            }}
            placeholder="예: outrofl/"
          />
          <NumberField
            label="limit"
            min={1}
            max={500}
            value={limit}
            onChange={(value) => {
              setLimit(Math.min(Math.max(Math.trunc(value || 100), 1), 500));
              setContinuationToken(null);
            }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge label="private" tone="success" />
          <StatusBadge label="publicUrl 없음" tone="success" />
          <StatusBadge label="signed URL 미생성" tone="info" />
          {artifacts && <StatusBadge label={`${formatNumber(artifacts.count)} objects`} tone="neutral" />}
          {artifacts?.hasMore && <StatusBadge label="more" tone="warning" />}
        </div>
      </PageSection>

      <QueryState isLoading={query.isLoading} error={query.error}>
        {artifacts && (
          <PageSection
            title="Object List"
            description={`bucket=${artifacts.bucket} · prefix=${artifacts.prefix} · limit=${artifacts.limit}`}
            right={
              artifacts.hasMore ? (
                <button
                  type="button"
                  onClick={() => setContinuationToken(artifacts.nextContinuationToken)}
                  disabled={!artifacts.nextContinuationToken || query.isFetching}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:text-white disabled:opacity-50"
                >
                  다음 페이지
                </button>
              ) : undefined
            }
          >
            <ObjectTable rows={artifacts.objects} />
            {artifacts.note && <p className="mt-3 text-xs text-zinc-500">{artifacts.note}</p>}
          </PageSection>
        )}
      </QueryState>
    </div>
  );
}

export default AdminR2ArtifactsPage;
