import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { TextField } from '../components/Field';
import { InlineMessage } from '../components/InlineMessage';
import { StatusBadge } from '../components/StatusBadge';
import { PLAN_IDS, PLAN_LABELS, USER_ROLES, USER_ROLE_LABELS, type PlanId, type UserRole } from '../lib/constants';
import { errorToMessage } from '../lib/apiError';
import { frontendRouteAccessApi } from '../services/frontendRouteAccessApi';
import type { FrontendRoutePolicy } from '../types/frontendRouteAccess';

function toggleList<T extends string>(rows: T[], value: T, checked: boolean): T[] {
  const set = new Set(rows);
  if (checked) set.add(value);
  else set.delete(value);
  return Array.from(set);
}

function policyKey(rows: FrontendRoutePolicy[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      id: row.id,
      enabled: row.enabled,
      showInSidebar: row.showInSidebar,
      requiresAuth: row.requiresAuth,
      comingSoon: row.comingSoon,
      allowedPlans: row.allowedPlans,
      allowedRoles: row.allowedRoles,
      lockedMessage: row.lockedMessage,
    })),
  );
}

const KEY_ROUTE_IDS = ['duo-finder', 'qlapgg-live-cw', 'ranking', 'guild', 'community'] as const;

function policyStateLabel(row: FrontendRoutePolicy): string {
  if (!row.enabled) return '잠김';
  if (row.comingSoon) return '준비중';
  return '운영중';
}

function policyStateTone(row: FrontendRoutePolicy): 'success' | 'warning' | 'danger' {
  if (!row.enabled) return 'danger';
  if (row.comingSoon) return 'warning';
  return 'success';
}

function listLabel(rows: readonly string[], emptyLabel: string): string {
  return rows.length > 0 ? rows.join(', ') : emptyLabel;
}

export function AdminFrontendRouteAccessPage() {
  const qc = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['frontend-route-access'],
    queryFn: frontendRouteAccessApi.getSettings,
  });
  const [draft, setDraft] = useState<FrontendRoutePolicy[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settingsQuery.data?.routes) setDraft(settingsQuery.data.routes);
  }, [settingsQuery.data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dirty = useMemo(
    () => Boolean(settingsQuery.data && policyKey(draft) !== policyKey(settingsQuery.data.routes)),
    [draft, settingsQuery.data],
  );

  const mutation = useMutation({
    mutationFn: () => frontendRouteAccessApi.updateSettings({ routes: draft }),
    onSuccess: (next) => {
      setDraft(next.routes);
      void qc.invalidateQueries({ queryKey: ['frontend-route-access'] });
    },
  });

  const updateRow = (id: string, patch: Partial<FrontendRoutePolicy>) => {
    setDraft((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <PageSection
        title="프론트 페이지 입장권한"
        description="qlapgg 사이드바와 페이지 진입을 plan/effectivePlan, role 기준으로 제어합니다. 실제 API 보안은 각 백엔드 권한 검사가 계속 담당합니다."
        right={
          <button
            type="button"
            onClick={() => void settingsQuery.refetch()}
            disabled={settingsQuery.isFetching}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            {settingsQuery.isFetching ? '새로고침 중...' : '새로고침'}
          </button>
        }
      >
        <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
          {settingsQuery.data && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">정책 버전</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">v{settingsQuery.data.policyVersion}</p>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">관리 페이지 수</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">{draft.length}</p>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">마지막 변경</p>
                <p className="mt-2 text-xs text-zinc-300">{settingsQuery.data.updatedAt ?? '-'}</p>
              </div>
            </div>
          )}
        </QueryState>
      </PageSection>

      <PageSection
        title="핵심 기능 상태"
        description="듀오 찾기처럼 API 승인이나 운영 준비 상태에 따라 닫아둘 수 있는 페이지를 빠르게 확인합니다."
      >
        <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {KEY_ROUTE_IDS.map((id) => {
              const row = draft.find((candidate) => candidate.id === id);
              if (!row) {
                return (
                  <div key={id} className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-100">{id}</p>
                      <StatusBadge label="정책 없음" tone="warning" />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">서버 기본 정책에 해당 ID가 없습니다.</p>
                  </div>
                );
              }

              return (
                <div key={row.id} className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">{row.label}</p>
                      <p className="mt-1 font-mono text-xs text-zinc-500">{row.path}</p>
                    </div>
                    <StatusBadge label={policyStateLabel(row)} tone={policyStateTone(row)} />
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-zinc-400">
                    <p>사이드바: {row.showInSidebar ? '표시' : '숨김'}</p>
                    <p>로그인: {row.requiresAuth ? '필요' : '불필요'}</p>
                    <p>plan: {listLabel(row.allowedPlans, '전체')}</p>
                    <p>role: {listLabel(row.allowedRoles, '전체')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </QueryState>
      </PageSection>

      <PageSection title="페이지별 정책" description="준비중 ON이면 기존 준비중 이미지를 보여주고, 활성 OFF 또는 권한 불일치도 같은 안내 화면으로 보냅니다.">
        <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
          <div className="grid gap-3">
            {draft.map((row) => (
              <div key={row.id} className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-100">{row.label}</p>
                      <StatusBadge label={row.path} tone="neutral" />
                      {!row.enabled && <StatusBadge label="잠김" tone="danger" />}
                      {row.comingSoon && <StatusBadge label="준비중" tone="warning" />}
                    </div>
                    <p className="mt-1 font-mono text-xs text-zinc-500">{row.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <ToggleSwitch checked={row.enabled} onChange={(v) => updateRow(row.id, { enabled: v })} label="활성" />
                    <ToggleSwitch checked={row.showInSidebar} onChange={(v) => updateRow(row.id, { showInSidebar: v })} label="사이드바" />
                    <ToggleSwitch checked={row.requiresAuth} onChange={(v) => updateRow(row.id, { requiresAuth: v })} label="로그인 필요" />
                    <ToggleSwitch checked={row.comingSoon} onChange={(v) => updateRow(row.id, { comingSoon: v })} label="준비중" />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
                  <div>
                    <p className="mb-2 text-xs font-medium text-zinc-500">허용 plan</p>
                    <div className="flex flex-wrap gap-2">
                      {PLAN_IDS.map((plan) => (
                        <label key={plan} className="flex items-center gap-1.5 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={row.allowedPlans.includes(plan)}
                            onChange={(e) => updateRow(row.id, { allowedPlans: toggleList(row.allowedPlans, plan, e.target.checked) as PlanId[] })}
                          />
                          {PLAN_LABELS[plan]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-zinc-500">허용 role</p>
                    <div className="flex flex-wrap gap-2">
                      {USER_ROLES.map((role) => (
                        <label key={role} className="flex items-center gap-1.5 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={row.allowedRoles.includes(role)}
                            onChange={(e) => updateRow(row.id, { allowedRoles: toggleList(row.allowedRoles, role, e.target.checked) as UserRole[] })}
                          />
                          {USER_ROLE_LABELS[role] ?? role}
                        </label>
                      ))}
                    </div>
                  </div>
                  <TextField
                    label="잠금 안내 문구"
                    value={row.lockedMessage ?? ''}
                    onChange={(lockedMessage) => updateRow(row.id, { lockedMessage: lockedMessage || null })}
                    placeholder="비워두면 기본 권한 안내를 표시합니다."
                    maxLength={180}
                  />
                </div>
              </div>
            ))}
          </div>
        </QueryState>
      </PageSection>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {mutation.isPending ? '저장 중...' : '입장권한 저장'}
        </button>
        {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
        {mutation.isSuccess && <InlineMessage kind="success">프론트 페이지 입장권한이 저장됐습니다.</InlineMessage>}
      </div>
    </div>
  );
}
