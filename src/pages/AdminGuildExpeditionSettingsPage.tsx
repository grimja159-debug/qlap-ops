import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InlineMessage } from '../components/InlineMessage';
import { NumberField, SelectField, TextAreaField } from '../components/Field';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { errorToMessage } from '../lib/apiError';
import { formatDateTime } from '../lib/format';
import { guildExpeditionApi } from '../services/guildExpeditionApi';
import type { ExpeditionScopeMode, ExpeditionSettings, ExpeditionUpdate } from '../types/guildExpedition';

const SCOPE_OPTIONS = [
  { value: 'ALL', label: '전체 사이트' },
  { value: 'GUILD_ONLY', label: '길드 페이지만 (/guild)' },
  { value: 'PATHS', label: '지정 경로 목록' },
] as const;

type FormState = Omit<ExpeditionSettings, 'updatedAt' | 'updatedBy' | 'guildLevelMultiplierTable' | 'buffs' | 'monsters'>;

const EMPTY_FORM: FormState = {
  enabled: false,
  dailyMaxActiveMinutes: 180,
  dailyMaxGp: 1000,
  dailyMaxQlcoin: 500,
  rewardCalcIntervalMinutes: 10,
  gpRandomMin: 10,
  gpRandomMax: 50,
  qlcoinRandomMin: 5,
  qlcoinRandomMax: 20,
  pityEnabled: true,
  pityGuaranteeMinutes: 60,
  pityGuaranteeGp: 100,
  pityGuaranteeQlcoin: 50,
  heartbeatIntervalSeconds: 20,
  maxBeatIntervalSeconds: 40,
  activityWindowSeconds: 20,
  minInteractionsPerWindow: 1,
  interactionsCapPerWindow: 200,
  scopeMode: 'ALL',
  scopePaths: [],
  guildLevelEnabled: false,
  buffsEnabled: false,
  stageLabels: [],
  statusMessages: [],
};

function toForm(data: ExpeditionSettings): FormState {
  return {
    enabled: data.enabled,
    dailyMaxActiveMinutes: data.dailyMaxActiveMinutes,
    dailyMaxGp: data.dailyMaxGp,
    dailyMaxQlcoin: data.dailyMaxQlcoin,
    rewardCalcIntervalMinutes: data.rewardCalcIntervalMinutes,
    gpRandomMin: data.gpRandomMin,
    gpRandomMax: data.gpRandomMax,
    qlcoinRandomMin: data.qlcoinRandomMin,
    qlcoinRandomMax: data.qlcoinRandomMax,
    pityEnabled: data.pityEnabled,
    pityGuaranteeMinutes: data.pityGuaranteeMinutes,
    pityGuaranteeGp: data.pityGuaranteeGp,
    pityGuaranteeQlcoin: data.pityGuaranteeQlcoin,
    heartbeatIntervalSeconds: data.heartbeatIntervalSeconds,
    maxBeatIntervalSeconds: data.maxBeatIntervalSeconds,
    activityWindowSeconds: data.activityWindowSeconds,
    minInteractionsPerWindow: data.minInteractionsPerWindow,
    interactionsCapPerWindow: data.interactionsCapPerWindow,
    scopeMode: data.scopeMode,
    scopePaths: data.scopePaths,
    guildLevelEnabled: data.guildLevelEnabled,
    buffsEnabled: data.buffsEnabled,
    stageLabels: data.stageLabels,
    statusMessages: data.statusMessages,
  };
}

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function AdminGuildExpeditionSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['expedition-settings'],
    queryFn: () => guildExpeditionApi.get(),
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [scopePathsText, setScopePathsText] = useState('');
  const [stageLabelsText, setStageLabelsText] = useState('');
  const [statusMessagesText, setStatusMessagesText] = useState('');
  const [saved, setSaved] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!data) return;
    setForm(toForm(data));
    setScopePathsText(data.scopePaths.join('\n'));
    setStageLabelsText(data.stageLabels.join('\n'));
    setStatusMessagesText(data.statusMessages.join('\n'));
  }, [data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: (patch: ExpeditionUpdate) => guildExpeditionApi.update(patch),
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['expedition-settings'] });
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  const gpRangeValid = form.gpRandomMin <= form.gpRandomMax;
  const coinRangeValid = form.qlcoinRandomMin <= form.qlcoinRandomMax;
  const numbersFinite = Object.values(form).every((v) => typeof v !== 'number' || Number.isFinite(v));
  const canSubmit = gpRangeValid && coinRangeValid && numbersFinite;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    mutation.mutate({
      ...form,
      scopePaths: linesToList(scopePathsText),
      stageLabels: linesToList(stageLabelsText),
      statusMessages: linesToList(statusMessagesText),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageSection
        title="길드 원정대 설정"
        description="qlapgg 길드 페이지의 '길드 원정대' 카드 동작과 보상 정책을 제어합니다. 모든 값은 서버에서 적용됩니다."
      >
        <QueryState isLoading={isLoading} error={error}>
          <form onSubmit={submit} className="space-y-5">
            <div className="rounded-lg border border-zinc-700/70 bg-zinc-900/35 p-4">
              <ToggleSwitch
                checked={form.enabled}
                onChange={(v) => set('enabled', v)}
                label="원정대 기능 활성화"
              />
            </div>

            <div className="rounded-lg border border-zinc-700/70 bg-zinc-900/35 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-200">보상</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <NumberField label="보상 계산 주기(분)" min={1} value={form.rewardCalcIntervalMinutes} onChange={(v) => set('rewardCalcIntervalMinutes', v)} />
                <NumberField label="하루 최대 활동시간(분)" min={0} value={form.dailyMaxActiveMinutes} onChange={(v) => set('dailyMaxActiveMinutes', v)} />
                <div />
                <NumberField label="GP 랜덤 최소" min={0} value={form.gpRandomMin} onChange={(v) => set('gpRandomMin', v)} />
                <NumberField label="GP 랜덤 최대" min={0} value={form.gpRandomMax} onChange={(v) => set('gpRandomMax', v)} hint={gpRangeValid ? undefined : '최소 ≤ 최대'} />
                <NumberField label="하루 최대 GP" min={0} value={form.dailyMaxGp} onChange={(v) => set('dailyMaxGp', v)} />
                <NumberField label="코인 랜덤 최소" min={0} value={form.qlcoinRandomMin} onChange={(v) => set('qlcoinRandomMin', v)} />
                <NumberField label="코인 랜덤 최대" min={0} value={form.qlcoinRandomMax} onChange={(v) => set('qlcoinRandomMax', v)} hint={coinRangeValid ? undefined : '최소 ≤ 최대'} />
                <NumberField label="하루 최대 코인" min={0} value={form.dailyMaxQlcoin} onChange={(v) => set('dailyMaxQlcoin', v)} />
              </div>
            </div>

            <div className="rounded-lg border border-zinc-700/70 bg-zinc-900/35 p-4">
              <div className="mb-3">
                <ToggleSwitch checked={form.pityEnabled} onChange={(v) => set('pityEnabled', v)} label="천장(최소 보장) 시스템 활성화" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <NumberField label="보장 활동시간(분)" min={0} value={form.pityGuaranteeMinutes} onChange={(v) => set('pityGuaranteeMinutes', v)} disabled={!form.pityEnabled} />
                <NumberField label="보장 GP" min={0} value={form.pityGuaranteeGp} onChange={(v) => set('pityGuaranteeGp', v)} disabled={!form.pityEnabled} />
                <NumberField label="보장 코인" min={0} value={form.pityGuaranteeQlcoin} onChange={(v) => set('pityGuaranteeQlcoin', v)} disabled={!form.pityEnabled} />
              </div>
            </div>

            <div className="rounded-lg border border-zinc-700/70 bg-zinc-900/35 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-200">heartbeat · 활동 판정</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <NumberField label="heartbeat 간격(초)" min={5} value={form.heartbeatIntervalSeconds} onChange={(v) => set('heartbeatIntervalSeconds', v)} />
                <NumberField label="heartbeat 최대 간격(초)" min={5} value={form.maxBeatIntervalSeconds} onChange={(v) => set('maxBeatIntervalSeconds', v)} hint="이보다 긴 공백은 무시" />
                <NumberField label="활동 window(초)" min={5} value={form.activityWindowSeconds} onChange={(v) => set('activityWindowSeconds', v)} />
                <NumberField label="window당 최소 상호작용" min={0} value={form.minInteractionsPerWindow} onChange={(v) => set('minInteractionsPerWindow', v)} hint="미만이면 활동 미인정" />
                <NumberField label="window당 상호작용 상한" min={1} value={form.interactionsCapPerWindow} onChange={(v) => set('interactionsCapPerWindow', v)} hint="스팸 방어" />
              </div>
            </div>

            <div className="rounded-lg border border-zinc-700/70 bg-zinc-900/35 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-200">대상 범위 · 문구</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <SelectField
                  label="누적 인정 범위"
                  value={form.scopeMode}
                  onChange={(v) => set('scopeMode', v as ExpeditionScopeMode)}
                  options={SCOPE_OPTIONS}
                />
                <TextAreaField
                  label="지정 경로 목록 (한 줄에 하나)"
                  value={scopePathsText}
                  onChange={setScopePathsText}
                  rows={3}
                  placeholder={'/guild\n/community'}
                  hint="범위가 '지정 경로'일 때만 적용"
                />
                <TextAreaField
                  label="상태 문구 (한 줄에 하나)"
                  value={statusMessagesText}
                  onChange={setStatusMessagesText}
                  rows={4}
                  placeholder={'⚔️ 기사단이 협곡 몬스터와 전투 중입니다.'}
                />
                <TextAreaField
                  label="스테이지 라벨 (한 줄에 하나)"
                  value={stageLabelsText}
                  onChange={setStageLabelsText}
                  rows={4}
                  placeholder={'협곡 진입\n전투 중'}
                />
              </div>
            </div>

            <div className="rounded-lg border border-zinc-700/70 bg-zinc-900/35 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-200">확장 (추후 — 레벨/버프/몬스터)</h3>
              <div className="flex flex-wrap gap-6">
                <ToggleSwitch checked={form.guildLevelEnabled} onChange={(v) => set('guildLevelEnabled', v)} label="길드 레벨 배수 사용" />
                <ToggleSwitch checked={form.buffsEnabled} onChange={(v) => set('buffsEnabled', v)} label="버프 배수 사용" />
              </div>
              <p className="mt-2 text-xs text-zinc-600">
                배수 테이블/버프/몬스터 데이터는 추후 확장 예정입니다. 지금은 토글만 노출됩니다.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit || mutation.isPending}
                className="rounded bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {mutation.isPending ? '저장 중...' : '원정대 설정 저장'}
              </button>
              {saved && <InlineMessage kind="success">저장되었습니다.</InlineMessage>}
              {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
            </div>

            {data?.updatedAt && (
              <p className="text-xs text-zinc-500">마지막 수정: {formatDateTime(data.updatedAt)}</p>
            )}
          </form>
        </QueryState>
      </PageSection>
    </div>
  );
}
