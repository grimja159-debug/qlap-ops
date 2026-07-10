import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InlineMessage } from '../components/InlineMessage';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { TextAreaField, TextField } from '../components/Field';
import { errorToMessage } from '../lib/apiError';
import { serverMaintenanceAdminApi } from '../services/serverMaintenanceAdminApi';
import type { ServerMaintenancePatch, ServerMaintenanceSettings } from '../types/serverMaintenance';

function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', { hour12: false });
}

function buildPatch(current: ServerMaintenanceSettings, draft: ServerMaintenancePatch): ServerMaintenancePatch {
  const nextStartsAt = draft.maintenanceStartsAt ?? null;
  const nextEndsAt = draft.maintenanceEndsAt ?? null;
  const patch: ServerMaintenancePatch = {};
  if (draft.enabled !== current.enabled) patch.enabled = draft.enabled;
  if (draft.liveCwCreateDisabled !== current.liveCwCreateDisabled) patch.liveCwCreateDisabled = draft.liveCwCreateDisabled;
  if (draft.liveCwJoinDisabled !== current.liveCwJoinDisabled) patch.liveCwJoinDisabled = draft.liveCwJoinDisabled;
  if ((draft.message ?? '') !== current.message) patch.message = draft.message ?? '';
  if (nextStartsAt !== current.maintenanceStartsAt) patch.maintenanceStartsAt = nextStartsAt;
  if (nextEndsAt !== current.maintenanceEndsAt) patch.maintenanceEndsAt = nextEndsAt;
  return patch;
}

function ToggleButton({
  label,
  checked,
  onChange,
  danger,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-md border px-3 py-2 text-left text-sm transition ${
        checked
          ? danger
            ? 'border-red-500/50 bg-red-500/10 text-red-200'
            : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
          : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500'
      }`}
    >
      <span className="mr-2 font-semibold">{checked ? 'ON' : 'OFF'}</span>
      {label}
    </button>
  );
}

export function AdminServerMaintenancePage() {
  const qc = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['admin-server-maintenance'],
    queryFn: serverMaintenanceAdminApi.getSettings,
  });
  const settings = settingsQuery.data ?? null;
  const [draft, setDraft] = useState<ServerMaintenancePatch>({
    enabled: false,
    liveCwCreateDisabled: false,
    liveCwJoinDisabled: false,
    message: '',
    maintenanceStartsAt: null,
    maintenanceEndsAt: null,
  });
  const [startsAtInput, setStartsAtInput] = useState('');
  const [endsAtInput, setEndsAtInput] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!settings) return;
    setDraft({
      enabled: settings.enabled,
      liveCwCreateDisabled: settings.liveCwCreateDisabled,
      liveCwJoinDisabled: settings.liveCwJoinDisabled,
      message: settings.message,
      maintenanceStartsAt: settings.maintenanceStartsAt,
      maintenanceEndsAt: settings.maintenanceEndsAt,
    });
    setStartsAtInput(toDatetimeLocal(settings.maintenanceStartsAt));
    setEndsAtInput(toDatetimeLocal(settings.maintenanceEndsAt));
  }, [settings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pendingPatch = useMemo(() => (settings ? buildPatch(settings, draft) : {}), [draft, settings]);
  const changedCount = Object.keys(pendingPatch).length;

  const mutation = useMutation({
    mutationFn: () => serverMaintenanceAdminApi.updateSettings(pendingPatch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-server-maintenance'] }),
  });

  const createBlocked = Boolean(draft.enabled && draft.liveCwCreateDisabled);
  const joinBlocked = Boolean(draft.enabled && draft.liveCwJoinDisabled);

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <PageSection
        title="서버 점검 모드"
        description="점검 전에 새 Live CW 방 생성을 잠그고, 기존 방 진행은 유지할 수 있게 관리합니다."
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
          {settings && (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">점검 모드</p>
                <div className="mt-2">
                  <StatusBadge label={settings.enabled ? 'ON' : 'OFF'} tone={settings.enabled ? 'warning' : 'success'} />
                </div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">Live CW 방 생성</p>
                <div className="mt-2">
                  <StatusBadge label={createBlocked ? '차단됨' : '허용'} tone={createBlocked ? 'danger' : 'success'} />
                </div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">Live CW 참가</p>
                <div className="mt-2">
                  <StatusBadge label={joinBlocked ? '차단됨' : '허용'} tone={joinBlocked ? 'warning' : 'success'} />
                </div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">정책 버전</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">v{settings.policyVersion}</p>
              </div>
            </div>
          )}
        </QueryState>
      </PageSection>

      <PageSection
        title="점검 설정"
        description="점검 3시간 전에는 점검 모드와 방 생성 차단을 켜고, 참가 차단은 운영 상황에 맞게 선택하세요."
      >
        <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
          {settings && (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <ToggleButton
                  label="서버 점검 모드"
                  checked={Boolean(draft.enabled)}
                  onChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
                  danger
                />
                <ToggleButton
                  label="Live CW 새 방 생성 차단"
                  checked={Boolean(draft.liveCwCreateDisabled)}
                  onChange={(liveCwCreateDisabled) => setDraft((prev) => ({ ...prev, liveCwCreateDisabled }))}
                  danger
                />
                <ToggleButton
                  label="Live CW 참가 차단"
                  checked={Boolean(draft.liveCwJoinDisabled)}
                  onChange={(liveCwJoinDisabled) => setDraft((prev) => ({ ...prev, liveCwJoinDisabled }))}
                  danger
                />
              </div>

              <TextAreaField
                label="공지 문구"
                value={draft.message ?? ''}
                rows={3}
                maxLength={240}
                onChange={(message) => setDraft((prev) => ({ ...prev, message }))}
                hint="qlapgg 정책 응답과 차단 에러 메시지에 사용됩니다."
              />

              <div className="grid gap-3 md:grid-cols-2">
                <TextField
                  type="datetime-local"
                  label="점검 시작 예정"
                  value={startsAtInput}
                  onChange={(value) => {
                    setStartsAtInput(value);
                    setDraft((prev) => ({ ...prev, maintenanceStartsAt: fromDatetimeLocal(value) }));
                  }}
                />
                <TextField
                  type="datetime-local"
                  label="점검 종료 예정"
                  value={endsAtInput}
                  onChange={(value) => {
                    setEndsAtInput(value);
                    setDraft((prev) => ({ ...prev, maintenanceEndsAt: fromDatetimeLocal(value) }));
                  }}
                />
              </div>

              <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-400">
                <p>저장 위치: Server DB admin_settings/service_settings/serverMaintenance</p>
                <p>마지막 변경: {formatDate(settings.updatedAt)} / updatedBy: {settings.updatedBy ? '관리자 UID 저장됨' : '-'}</p>
                <p>현재 시작/종료: {formatDate(draft.maintenanceStartsAt ?? null)} - {formatDate(draft.maintenanceEndsAt ?? null)}</p>
              </div>

              {createBlocked && (
                <InlineMessage kind="info">
                  저장 후 Live CW 방 생성 API는 423 LIVE_CW_CREATE_DISABLED_FOR_MAINTENANCE로 차단됩니다.
                </InlineMessage>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={changedCount === 0 || mutation.isPending}
                  onClick={() => mutation.mutate()}
                  className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {mutation.isPending ? '저장 중...' : `변경 저장 (${changedCount})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft({
                      enabled: settings.enabled,
                      liveCwCreateDisabled: settings.liveCwCreateDisabled,
                      liveCwJoinDisabled: settings.liveCwJoinDisabled,
                      message: settings.message,
                      maintenanceStartsAt: settings.maintenanceStartsAt,
                      maintenanceEndsAt: settings.maintenanceEndsAt,
                    });
                    setStartsAtInput(toDatetimeLocal(settings.maintenanceStartsAt));
                    setEndsAtInput(toDatetimeLocal(settings.maintenanceEndsAt));
                  }}
                  className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  되돌리기
                </button>
              </div>

              {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
              {mutation.isSuccess && <InlineMessage kind="success">서버 점검 설정이 저장됐습니다.</InlineMessage>}
            </div>
          )}
        </QueryState>
      </PageSection>

      <PageSection title="운영 순서" description="서버를 내리기 전에 기존 방만 안전하게 마무리하는 권장 순서입니다.">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>점검 3시간 전: 점검 모드 ON, 새 방 생성 차단 ON.</li>
          <li>기존 모집/진행 방은 계속 결과 저장과 종료 처리를 허용.</li>
          <li>점검 30분 전: 필요하면 참가 차단 ON.</li>
          <li>남은 진행중 방의 resultDraft, finalResult, reward, archive 상태를 qlap-ops에서 확인.</li>
          <li>PM2 종료 시 Redis는 캐시이므로 내려가도 되고, 원본 상태는 Server DB에 남깁니다.</li>
        </ol>
      </PageSection>
    </div>
  );
}
