import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { PageSection } from '../components/PageSection';
import { CopyableId } from '../components/CopyableId';
import { userApi } from '../services/userApi';
import { guildApi } from '../services/guildApi';
import { seasonApi } from '../services/seasonApi';
import { logApi } from '../services/logApi';
import { systemApi } from '../services/systemApi';
import { ACTIVE_SEASON_STATUSES, SEASON_STATUS_LABELS } from '../lib/constants';
import { serviceStatusTone } from '../lib/statusTone';
import { formatRelative, formatSignedNumber } from '../lib/format';

/**
 * 대시보드 — 실제 데이터 기반 요약.
 *
 * [정직한 집계] 백엔드에 "전체 카운트" 집계 API 가 없으므로, 목록을 받아 그 길이를 보여준다.
 * 따라서 수치는 "로드된 범위(최대 100)" 기준이며, 라벨에도 그렇게 표기한다(가짜 총량 금지).
 */
export function AdminDashboardPage() {
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => userApi.list(100) });
  const guilds = useQuery({ queryKey: ['admin-guilds', { dashboard: true }], queryFn: () => guildApi.list({ limit: 100 }) });
  const seasons = useQuery({ queryKey: ['seasons'], queryFn: seasonApi.list });
  const health = useQuery({ queryKey: ['system-health'], queryFn: systemApi.checkHealth, refetchInterval: 30000 });
  const recentLogs = useQuery({ queryKey: ['logs', 'qlCoin', 'dashboard'], queryFn: () => logApi.qlCoin({ limit: 8 }) });

  const currentSeason = seasons.data?.find((s) => ACTIVE_SEASON_STATUSES.includes(s.status));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">요약</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="유저 (로드됨, ≤100)" value={users.data?.length ?? '–'} />
          <StatCard label="길드 (로드됨, ≤100)" value={guilds.data?.length ?? '–'} />
          <StatCard label="전체 시즌" value={seasons.data?.length ?? '–'} />
          <StatCard
            label="현재 시즌"
            value={currentSeason ? currentSeason.title : '없음'}
            sub={currentSeason ? SEASON_STATUS_LABELS[currentSeason.status] : undefined}
            accent
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PageSection title="서비스 상태">
          {health.data ? (
            <div className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-sm text-zinc-300 font-medium">{health.data.name}</span>
                {health.data.environment && (
                  <span className="text-xs text-zinc-600 ml-2">{health.data.environment}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 font-mono">
                  {health.data.latencyMs != null ? `${health.data.latencyMs}ms` : '–'}
                </span>
                <StatusBadge
                  label={
                    health.data.status === 'online'
                      ? '정상'
                      : health.data.status === 'degraded'
                        ? '불안정'
                        : '오프라인'
                  }
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
              <div
                key={log.id}
                className="flex items-center gap-3 py-1.5 border-b border-zinc-700/40 last:border-0"
              >
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
