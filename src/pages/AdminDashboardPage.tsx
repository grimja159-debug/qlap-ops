import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { seasonApi } from '../services/seasonApi';
import { logApi } from '../services/logApi';
import { statsApi } from '../services/statsApi';
import { systemApi } from '../services/systemApi';
import {
  ACTIVE_SEASON_STATUSES,
  SEASON_STATUS_LABELS,
  PLAN_LABELS,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  type PlanId,
  type UserRole,
  type UserStatus,
} from '../lib/constants';
import { dataSourceLabel, dataSourceTone, serviceStatusTone } from '../lib/statusTone';
import { formatRelative, formatSignedNumber, formatNumber } from '../lib/format';

/**
 * 대시보드 — 실지표 기반 요약.
 *
 * 유저/길드/시즌 수치는 GET /api/admin/stats/overview 의 Server DB 집계를 우선 사용한다.
 * (과거의 "≤100 로드분" 추정이 아니다.) 헬스/최근 코인 로그/현재 시즌도 함께 보여준다.
 */
export function AdminDashboardPage() {
  const { me } = useAuth();
  const stats = useQuery({ queryKey: ['stats-overview'], queryFn: statsApi.overview });
  const seasons = useQuery({ queryKey: ['seasons'], queryFn: seasonApi.list });
  const health = useQuery({ queryKey: ['system-health'], queryFn: systemApi.checkHealth, refetchInterval: 30000 });
  const recentLogs = useQuery({ queryKey: ['logs', 'qlCoin', 'dashboard'], queryFn: () => logApi.qlCoin({ limit: 8 }) });

  const currentSeason = seasons.data?.find((s) => ACTIVE_SEASON_STATUSES.includes(s.status));
  const s = stats.data;

  return (
    <div className="flex flex-col gap-6">
      {/* 히어로 — 인사 + 서비스 상태 + 현재 시즌 */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-700/60 bg-gradient-to-br from-violet-600/15 via-zinc-900/40 to-zinc-900/20 p-5">
        <div className="pointer-events-none absolute -top-12 -right-10 h-44 w-44 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-violet-300/80">
              QLapGG 운영자 콘솔
            </p>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-zinc-50">
              안녕하세요{me?.displayName ? `, ${me.displayName}` : ''} 님 👋
            </h2>
            <p className="mt-1 text-sm text-zinc-400">실시간 집계 기반으로 서비스 현황을 한눈에 확인하세요.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-2.5 py-1 text-xs text-zinc-400">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
            {health.data && (
              <StatusBadge
                label={`${health.data.name} · ${health.data.status === 'online' ? '정상' : health.data.status === 'degraded' ? '불안정' : '오프라인'}`}
                tone={serviceStatusTone(health.data.status)}
              />
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">요약 (실집계)</h2>
        <QueryState isLoading={stats.isLoading} error={stats.error}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="전체 유저" value={s?.totalUsers ?? '–'} />
            <StatCard label="전체 길드" value={s?.totalGuilds ?? '–'} sub={s ? `활성 ${formatNumber(s.activeGuilds)}` : undefined} />
            <StatCard label="전체 시즌" value={s?.totalSeasons ?? '–'} />
            <StatCard label="신규 7일" value={s?.newUsers7d ?? '–'} />
            <StatCard label="신규 30일" value={s?.newUsers30d ?? '–'} />
            <StatCard
              label="현재 시즌"
              value={currentSeason ? currentSeason.title : '없음'}
              sub={currentSeason ? SEASON_STATUS_LABELS[currentSeason.status] : undefined}
              accent
            />
          </div>
          {s && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <StatusBadge
                label={`stats ${dataSourceLabel(s.source)}`}
                tone={dataSourceTone(s.source)}
              />
              <span>Firestore reads {formatNumber(s.firestoreReads ?? 0)}</span>
              {s.warning ? <span className="text-amber-300">{s.warning}</span> : null}
            </div>
          )}
        </QueryState>
      </div>

      {s && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <PageSection title="요금제 분포">
            <Distribution
              total={s.totalUsers}
              entries={(Object.keys(s.planCounts) as PlanId[]).map((k) => ({ label: PLAN_LABELS[k] ?? k, count: s.planCounts[k] }))}
            />
          </PageSection>
          <PageSection title="권한 분포">
            <Distribution
              total={s.totalUsers}
              entries={(Object.keys(s.roleCounts) as UserRole[]).map((k) => ({ label: USER_ROLE_LABELS[k] ?? k, count: s.roleCounts[k] }))}
            />
          </PageSection>
          <PageSection title="상태 분포">
            <Distribution
              total={s.totalUsers}
              entries={(Object.keys(s.statusCounts) as UserStatus[]).map((k) => ({ label: USER_STATUS_LABELS[k] ?? k, count: s.statusCounts[k] }))}
            />
          </PageSection>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PageSection title="서비스 상태">
          {health.data ? (
            <div className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-sm text-zinc-300 font-medium">{health.data.name}</span>
                {health.data.environment && <span className="text-xs text-zinc-600 ml-2">{health.data.environment}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 font-mono">
                  {health.data.latencyMs != null ? `${health.data.latencyMs}ms` : '–'}
                </span>
                <StatusBadge
                  label={health.data.status === 'online' ? '정상' : health.data.status === 'degraded' ? '불안정' : '오프라인'}
                  tone={serviceStatusTone(health.data.status)}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">확인 중...</p>
          )}
        </PageSection>

        <PageSection title="최근 코인 처리">
          <div className="flex flex-col gap-1.5">
            {(recentLogs.data ?? []).map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-1.5 border-b border-zinc-700/40 last:border-0">
                <span className="text-xs text-zinc-500 font-mono shrink-0 w-16">{formatRelative(log.createdAt)}</span>
                <span className="text-xs text-zinc-400 bg-zinc-700/60 px-1.5 py-0.5 rounded shrink-0">{log.type}</span>
                <span className={log.amount >= 0 ? 'text-emerald-400 text-xs font-mono' : 'text-red-400 text-xs font-mono'}>
                  {formatSignedNumber(log.amount)}
                </span>
                <span className="flex-1 min-w-0 truncate text-xs text-zinc-500">{log.reason}</span>
                <CopyableId value={log.uid} />
              </div>
            ))}
            {recentLogs.data && recentLogs.data.length === 0 && (
              <p className="text-sm text-zinc-500">최근 처리 내역이 없습니다.</p>
            )}
          </div>
        </PageSection>
      </div>
    </div>
  );
}

function Distribution({ total, entries }: { total: number; entries: { label: string; count: number }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {entries.map((e) => {
        const pct = total > 0 ? Math.round((e.count / total) * 100) : 0;
        return (
          <div key={e.label}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-zinc-400">{e.label}</span>
              <span className="text-zinc-500 font-mono">
                {formatNumber(e.count)} ({pct}%)
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-700/60 overflow-hidden">
              <div className="h-full bg-violet-500/70" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
