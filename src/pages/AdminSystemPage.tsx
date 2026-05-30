import { useQuery } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { StatusBadge } from '../components/StatusBadge';
import { NotImplementedNotice } from '../components/NotImplementedNotice';
import { systemApi } from '../services/systemApi';
import { serviceStatusTone } from '../lib/statusTone';
import { formatDateTime } from '../lib/format';

/**
 * 시스템 페이지.
 *
 * 실제로 가능한 것: 어드민 콘솔이 의존하는 QLapServices API 헬스 체크(GET /api/health).
 * 30초마다 자동 갱신하고, 실패하면 offline 로 표시한다(가짜 상태/지연 수치 만들지 않음).
 *
 * 유지보수 모드 토글, 다중 서비스 상태판은 백엔드 API 가 없어 제공하지 않는다.
 */
export function AdminSystemPage() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: systemApi.checkHealth,
    refetchInterval: 30000,
  });

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <PageSection
        title="서비스 상태"
        right={
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded disabled:opacity-50"
          >
            {isFetching ? '확인 중...' : '새로고침'}
          </button>
        }
      >
        {data && (
          <div className="flex items-center justify-between p-3 rounded-md bg-zinc-900/60 border border-zinc-700/40">
            <div>
              <p className="text-sm font-medium text-zinc-200">{data.name}</p>
              <p className="text-xs text-zinc-600">
                마지막 확인: {formatDateTime(data.checkedAt)}
                {data.version ? ` · v${data.version}` : ''}
                {data.environment ? ` · ${data.environment}` : ''}
              </p>
              {data.detail && <p className="text-xs text-red-400 mt-1">{data.detail}</p>}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-zinc-500">지연</p>
                <p className="text-sm font-mono font-semibold text-zinc-300">
                  {data.latencyMs != null ? `${data.latencyMs}ms` : '–'}
                </p>
              </div>
              <StatusBadge
                label={data.status === 'online' ? '정상' : data.status === 'degraded' ? '불안정' : '오프라인'}
                tone={serviceStatusTone(data.status)}
              />
            </div>
          </div>
        )}
      </PageSection>

      <NotImplementedNotice
        title="유지보수 모드 / 다중 서비스 모니터링"
        reason="유지보수 모드 토글과 여러 백엔드(GSS 등)의 상태를 한 화면에서 보는 기능은 대응 API 가 없습니다. 어드민 콘솔은 자신이 직접 호출하는 QLapServices API 만 헬스 체크할 수 있습니다."
        endpoints={[
          { method: 'GET', path: '/api/admin/system/state', note: '유지보수 모드 + 서비스별 상태 종합' },
          { method: 'POST', path: '/api/admin/system/maintenance', note: '유지보수 모드 on/off { enabled }' },
        ]}
      />
    </div>
  );
}
