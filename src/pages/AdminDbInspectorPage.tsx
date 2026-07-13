import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { ApiError } from '../services/api';
import {
  dbInspectorApi,
  getDbInspectorDebugEndpoint,
  type AnyDbInspector,
  type AnyDbInspectorRow,
  type DbInspectorSource,
} from '../services/dbInspectorApi';

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

function shortId(value: string | null | undefined): string {
  if (!value) return '-';
  return value.length > 24 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

function formatBytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDurationSeconds(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const minutes = Math.floor(value / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function statusTone(status: string | null | undefined) {
  if (!status) return 'neutral' as const;
  const normalized = status.toLowerCase();
  if (['open', 'active', 'in_progress', 'approved', 'paid', 'posted', 'sent', 'finished'].includes(normalized)) return 'success' as const;
  if (['draft', 'pending', 'failed'].includes(normalized)) return 'warning' as const;
  if (['cancelled', 'rejected', 'dead', 'deleted', 'banned'].includes(normalized)) return 'danger' as const;
  return 'info' as const;
}

function rowGroup(row: AnyDbInspectorRow): string {
  return 'collection' in row ? row.collection : row.table;
}

function rowUid(row: AnyDbInspectorRow): string | null {
  return 'uid' in row ? row.uid : null;
}

function rowStatus(row: AnyDbInspectorRow): string | null {
  return row.status ?? null;
}

function rowAmount(row: AnyDbInspectorRow): string {
  if ('amount' in row && typeof row.amount === 'number') return row.amount.toLocaleString();
  return '-';
}

function rowBalance(row: AnyDbInspectorRow): string {
  if ('balanceAfter' in row && typeof row.balanceAfter === 'number') return row.balanceAfter.toLocaleString();
  return '-';
}

function rowLinkedText(row: AnyDbInspectorRow): string[] {
  if ('tournamentId' in row) {
    return [`tournament: ${shortId(row.tournamentId)}`, `guild: ${shortId(row.guildId)}`, `user: ${shortId(row.uid)}`];
  }
  return [`uid: ${shortId(row.uid)}`, `type: ${row.type ?? '-'}`, `source: ${row.source ?? '-'}`];
}

function payloadSummary(payload: Record<string, unknown>): string {
  const candidates = ['display_name', 'displayName', 'title', 'name', 'riot_id', 'riotId', 'guildName', 'teamName', 'status', 'type', 'source'];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return Object.keys(payload).slice(0, 4).join(', ') || 'payload';
}

function inspectorErrorHint(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.errorCode === 'NOT_FOUND' || error.status === 404) {
    return '게이트웨이 prefix(/services 또는 /tournament), PM2 서버 재시작, 백엔드 라우트 마운트 상태를 확인하세요.';
  }
  if (error.errorCode === 'NETWORK_ERROR' || error.status === 0) {
    return '8080 gateway/proxy, Cloudflare tunnel 또는 로컬 API 서버가 켜져 있는지 확인하세요.';
  }
  if (error.status === 401 || error.errorCode === 'LOGIN_REQUIRED') {
    return '보호 라우트는 살아있습니다. 관리자 로그인 세션이 필요합니다.';
  }
  if (error.status === 403 || error.errorCode === 'ADMIN_REQUIRED' || error.errorCode === 'SUPER_ADMIN_REQUIRED') {
    return 'API 라우트는 살아있지만 현재 계정에 관리자 권한이 부족합니다.';
  }
  return null;
}

function InspectorTable({ rows }: { rows: AnyDbInspectorRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-500">
        선택한 조건에 맞는 DB row가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-700 bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
        <p className="text-sm font-semibold text-zinc-200">엑셀식 DB 표</p>
        <p className="text-xs text-zinc-500">가로로 밀어서 보고, row id 위에 마우스를 올리면 전체값을 확인할 수 있습니다.</p>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="min-w-[1180px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400 shadow-[0_1px_0_#3f3f46]">
          <tr>
            <th className="w-12 border-r border-zinc-800 px-2 py-2 text-center">#</th>
            <th className="border-r border-zinc-800 px-3 py-2 text-left">묶음</th>
            <th className="border-r border-zinc-800 px-3 py-2 text-left">row id</th>
            <th className="border-r border-zinc-800 px-3 py-2 text-left">상태</th>
            <th className="border-r border-zinc-800 px-3 py-2 text-left">UID / 연결값</th>
            <th className="border-r border-zinc-800 px-3 py-2 text-right">변화량</th>
            <th className="border-r border-zinc-800 px-3 py-2 text-right">잔액</th>
            <th className="border-r border-zinc-800 px-3 py-2 text-left">내용 힌트</th>
            <th className="px-3 py-2 text-left">수정시각</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${rowGroup(row)}:${row.id}:${rowUid(row) ?? ''}`}
              className="align-top odd:bg-zinc-950 even:bg-zinc-900/45 hover:bg-violet-500/10"
            >
              <td className="border-r border-t border-zinc-800 bg-zinc-900/70 px-2 py-2 text-center font-mono text-xs text-zinc-500">
                {index + 1}
              </td>
              <td className="border-r border-t border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300">{rowGroup(row)}</td>
              <td className="border-r border-t border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300" title={row.id}>
                {shortId(row.id)}
              </td>
              <td className="border-r border-t border-zinc-800 px-3 py-2">
                <StatusBadge label={rowStatus(row) ?? 'none'} tone={statusTone(rowStatus(row))} />
              </td>
              <td className="border-r border-t border-zinc-800 px-3 py-2 text-xs text-zinc-400">
                {rowLinkedText(row).map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </td>
              <td className="border-r border-t border-zinc-800 px-3 py-2 text-right font-mono text-xs text-zinc-300">
                {rowAmount(row)}
              </td>
              <td className="border-r border-t border-zinc-800 px-3 py-2 text-right font-mono text-xs text-emerald-300">
                {rowBalance(row)}
              </td>
              <td className="border-r border-t border-zinc-800 px-3 py-2 text-zinc-300">{payloadSummary(row.payload)}</td>
              <td className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">{formatDate(row.updatedAt ?? row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function ServicesSqliteHealthPanel({ inspector }: { inspector: AnyDbInspector }) {
  if (!('sqliteHealth' in inspector)) return null;
  const health = inspector.sqliteHealth;
  const backup = health.latestBackup;
  const items = [
    ['DB', formatBytes(health.dbSizeBytes), health.dbPath],
    ['WAL', formatBytes(health.walSizeBytes), health.walPath],
    ['SHM', formatBytes(health.shmSizeBytes), health.shmPath],
    ['journal', health.journalMode ?? '-', 'PRAGMA journal_mode'],
    ['sync', health.synchronous ?? '-', 'PRAGMA synchronous'],
    ['busy', health.busyTimeoutMs == null ? '-' : `${health.busyTimeoutMs}ms`, 'PRAGMA busy_timeout'],
    ['foreign', health.foreignKeys == null ? '-' : String(health.foreignKeys), 'PRAGMA foreign_keys'],
    ['pages', health.pageCount == null || health.pageSize == null ? '-' : `${health.pageCount.toLocaleString()} × ${health.pageSize}`, 'page_count × page_size'],
  ];

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-200">SQLite 운영 상태</p>
          <p className="mt-1 text-xs text-zinc-500">운영 DB를 수정하지 않고 quick_check, WAL 크기, PRAGMA 값을 읽기 전용으로 확인합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge label={health.status} tone={health.status === 'OK' ? 'success' : 'warning'} />
          <span className="text-xs text-zinc-500">{formatDate(health.checkedAt)}</span>
        </div>
      </div>

      {health.warnings.length > 0 && (
        <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {health.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-xs text-zinc-500">quick_check</p>
          <p className="mt-1 font-mono text-sm text-emerald-300">{health.quickCheck ?? '-'}</p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-xs text-zinc-500">integrity_check(1)</p>
          <p className="mt-1 font-mono text-sm text-emerald-300">{health.integrityCheck ?? '-'}</p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-xs text-zinc-500">DB 크기</p>
          <p className="mt-1 font-mono text-sm text-zinc-200">{formatBytes(health.dbSizeBytes)}</p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-xs text-zinc-500">WAL 크기</p>
          <p className="mt-1 font-mono text-sm text-zinc-200">{formatBytes(health.walSizeBytes)}</p>
        </div>
      </div>

      <div className="mt-3 rounded border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-zinc-500">SQLite 백업 상태</p>
            <p className="mt-1 text-sm font-semibold text-zinc-200">
              {backup.latestModifiedAt ? `${formatDurationSeconds(backup.ageSeconds)} · ${formatBytes(backup.latestSizeBytes)}` : '백업 없음'}
            </p>
            <p className="mt-1 truncate font-mono text-[11px] text-zinc-500" title={backup.latestPath ?? backup.backupRoot}>
              {backup.latestPath ?? backup.backupRoot}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label={backup.status === 'OK' ? 'backup OK' : 'backup WARN'} tone={backup.status === 'OK' ? 'success' : 'warning'} />
            <span className="text-xs text-zinc-500">경고 기준 {backup.warnAgeHours}시간</span>
          </div>
        </div>
        {backup.warning && <p className="mt-2 text-xs text-amber-300">{backup.warning}</p>}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {items.map(([label, value, title]) => (
          <div key={label} title={title} className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
            <p className="text-[11px] text-zinc-500">{label}</p>
            <p className="mt-1 truncate font-mono text-xs text-zinc-300">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDbInspectorPage() {
  const [source, setSource] = useState<DbInspectorSource>('services');
  const [group, setGroup] = useState<string | null>(null);
  const [id, setId] = useState('');
  const [uid, setUid] = useState('');
  const [limit, setLimit] = useState(50);
  const [copied, setCopied] = useState(false);

  const inspectorQuery = useQuery<AnyDbInspector>({
    queryKey: ['admin-db-inspector', source, group, id.trim(), uid.trim(), limit],
    queryFn: () =>
      source === 'services'
        ? dbInspectorApi.getServices({ table: group, id: id.trim() || null, uid: uid.trim() || null, limit })
        : dbInspectorApi.getTournament({ collection: group, id: id.trim() || null, limit }),
  });

  const inspector = inspectorQuery.data ?? null;
  const debugEndpoint = getDbInspectorDebugEndpoint(source);
  const debugHint = inspectorErrorHint(inspectorQuery.error);
  const groups = useMemo(() => {
    if (!inspector) return [];
    if ('tables' in inspector) {
      return inspector.tables.map((item) => ({ key: item.table, label: item.label, count: item.count }));
    }
    return inspector.collections.map((item) => ({ key: item.collection, label: item.label, count: item.count }));
  }, [inspector]);
  const selectedGroup = group ?? (inspector && ('selectedTable' in inspector ? inspector.selectedTable : inspector.selectedCollection)) ?? '';
  const activeGroup = groups.find((item) => item.key === selectedGroup);

  async function copyXml() {
    if (!inspector?.xml) return;
    await navigator.clipboard.writeText(inspector.xml);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  }

  function changeSource(next: DbInspectorSource) {
    setSource(next);
    setGroup(null);
    setId('');
    setUid('');
  }

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <PageSection
        title="DB / XML 보기"
        description="서버 DB에 저장된 유저, 코인, 멸망전 데이터를 표와 XML로 쉽게 확인합니다. legacy mirror outbox는 진단용이며, 이 화면은 수정이나 Firestore write를 하지 않습니다."
        right={
          <button
            type="button"
            onClick={() => void inspectorQuery.refetch()}
            disabled={inspectorQuery.isFetching}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            {inspectorQuery.isFetching ? '새로고침 중...' : '새로고침'}
          </button>
        }
      >
        <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-zinc-400">API 진단</p>
              <p className="mt-1 break-all font-mono text-xs text-zinc-500">{debugEndpoint}</p>
            </div>
            <StatusBadge
              label={source === 'services' ? '유저/코인 DB' : '멸망전 DB'}
              tone={source === 'services' ? 'info' : 'warning'}
            />
          </div>
          {debugHint && <p className="mt-2 text-xs text-amber-300">{debugHint}</p>}
        </div>

        <QueryState isLoading={inspectorQuery.isLoading} error={inspectorQuery.error}>
          {inspector && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => changeSource('services')}
                  className={`rounded border px-3 py-1.5 text-sm ${
                    source === 'services' ? 'border-violet-500 bg-violet-500/15 text-violet-200' : 'border-zinc-700 text-zinc-400'
                  }`}
                >
                  유저 / 코인 DB
                </button>
                <button
                  type="button"
                  onClick={() => changeSource('tournament')}
                  className={`rounded border px-3 py-1.5 text-sm ${
                    source === 'tournament' ? 'border-violet-500 bg-violet-500/15 text-violet-200' : 'border-zinc-700 text-zinc-400'
                  }`}
                >
                  멸망전 DB
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">저장소</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-200">{inspector.service}</p>
                  <p className="mt-1 text-xs text-emerald-300">{inspector.storage}</p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">전체 row</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-100">{inspector.totalRows.toLocaleString()}</p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">현재 묶음</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-200">{activeGroup?.label ?? selectedGroup}</p>
                  <p className="mt-1 text-xs text-zinc-500">{activeGroup?.count.toLocaleString() ?? 0} rows</p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">DB 파일</p>
                  <p className="mt-2 break-all font-mono text-xs text-zinc-300">{inspector.dbPath}</p>
                </div>
              </div>

              <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="text-sm font-semibold text-zinc-200">쉽게 보는 법</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {inspector.guide.map((item) => (
                    <div key={item.title} className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
                      <p className="text-xs font-semibold text-violet-300">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <ServicesSqliteHealthPanel inspector={inspector} />

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_140px]">
                <label className="text-xs text-zinc-400">
                  DB 묶음
                  <select
                    value={selectedGroup}
                    onChange={(event) => setGroup(event.target.value || null)}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                  >
                    {groups.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label} ({item.count})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-400">
                  row id 검색
                  <input
                    value={id}
                    onChange={(event) => setId(event.target.value)}
                    placeholder="비우면 목록"
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  UID 필터
                  <input
                    value={uid}
                    onChange={(event) => setUid(event.target.value)}
                    placeholder={source === 'services' ? '선택 사항' : 'Services 전용'}
                    disabled={source !== 'services'}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 disabled:opacity-40"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  표시 개수
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={limit}
                    onChange={(event) => setLimit(Math.min(Math.max(Number(event.target.value) || 50, 1), 200))}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                  />
                </label>
              </div>

              <InspectorTable rows={inspector.rows} />

              <div className="rounded-md border border-zinc-800 bg-zinc-950/50">
                <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">XML 구조</p>
                    <p className="text-xs text-zinc-500">표에서 보기 어려운 안쪽 데이터를 펼친 모양입니다. 민감값은 마스킹됩니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyXml()}
                    className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    {copied ? '복사됨' : 'XML 복사'}
                  </button>
                </div>
                <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5 text-zinc-300">
                  {inspector.xml}
                </pre>
              </div>
            </div>
          )}
        </QueryState>
      </PageSection>
    </div>
  );
}

export default AdminDbInspectorPage;
