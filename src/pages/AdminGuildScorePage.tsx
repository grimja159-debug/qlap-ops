import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { NumberField, SelectField, TextField } from '../components/Field';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { ConfirmButton } from '../components/ConfirmButton';
import { InlineMessage } from '../components/InlineMessage';
import { guildScoreApi } from '../services/guildScoreApi';
import { errorToMessage } from '../lib/apiError';
import {
  GUILD_SCORE_MODE_LABELS,
  RANK_SCORE_MODE_LABELS,
  type GuildScoreMode,
  type GuildScoreSettings,
  type RankInput,
  type RankScoreMode,
} from '../types/guildScore';

const APPRENTICE = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'] as const;
const DIVISIONS = ['IV', 'III', 'II', 'I'] as const;
const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER'] as const;
const ALL_TIERS = [...APPRENTICE, ...APEX];

const TIER_LABEL: Record<string, string> = {
  IRON: '아이언',
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플래티넘',
  EMERALD: '에메랄드',
  DIAMOND: '다이아몬드',
  MASTER: '마스터',
  GRANDMASTER: '그랜드마스터',
  CHALLENGER: '챌린저',
};

const num = (value: number) => (Number.isFinite(value) ? value : 0);

export function AdminGuildScorePage() {
  const settingsQuery = useQuery({ queryKey: ['guild-score-settings'], queryFn: guildScoreApi.getSettings });

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
        {settingsQuery.data && <ScoreSettingsEditor key={settingsQuery.data.version} initial={settingsQuery.data} />}
      </QueryState>
    </div>
  );
}

function ScoreSettingsEditor({ initial }: { initial: GuildScoreSettings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<GuildScoreSettings>(initial);

  const saveMut = useMutation({
    mutationFn: () => guildScoreApi.updateSettings(form),
    onSuccess: (saved) => {
      setForm(saved);
      void qc.invalidateQueries({ queryKey: ['guild-score-settings'] });
    },
  });

  const setTier = (key: string, value: number) => setForm((prev) => ({ ...prev, tiers: { ...prev.tiers, [key]: num(value) } }));
  const setBonus = (key: string, value: number) =>
    setForm((prev) => ({ ...prev, masterPlusLpBonus: { ...prev.masterPlusLpBonus, [key]: num(value) } }));
  const toggleLpTier = (tier: string) =>
    setForm((prev) => ({
      ...prev,
      lpBonusAppliesTo: prev.lpBonusAppliesTo.includes(tier)
        ? prev.lpBonusAppliesTo.filter((item) => item !== tier)
        : [...prev.lpBonusAppliesTo, tier],
    }));

  const bonusBrackets = useMemo(
    () => Object.keys(form.masterPlusLpBonus).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
    [form.masterPlusLpBonus],
  );
  const hasChanges = JSON.stringify(form) !== JSON.stringify(initial);
  const invalidRoster = !Number.isFinite(form.guildRosterSize) || form.guildRosterSize < 1 || form.guildRosterSize > 50;
  const noLpBonusTier = form.lpBonusAppliesTo.length === 0;

  return (
    <>
      <PageSection
        title="계산 방식"
        description="멤버 전투력, 길드 점수 합산 방식, 대표 로스터 크기를 설정합니다."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField
            label="멤버 점수 계산"
            value={form.rankScoreMode}
            onChange={(value) => setForm((prev) => ({ ...prev, rankScoreMode: value as RankScoreMode }))}
            options={Object.entries(RANK_SCORE_MODE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            label="길드 점수 계산"
            value={form.guildScoreMode}
            onChange={(value) => setForm((prev) => ({ ...prev, guildScoreMode: value as GuildScoreMode }))}
            options={Object.entries(GUILD_SCORE_MODE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <NumberField
            label="대표 로스터 인원"
            value={form.guildRosterSize}
            min={1}
            max={50}
            step={1}
            onChange={(value) => setForm((prev) => ({ ...prev, guildRosterSize: Math.max(1, num(value)) }))}
            hint="대표 로스터가 부족하면 상위 점수 멤버로 자동 보완합니다."
          />
        </div>
      </PageSection>

      <PageSection title="LP 보너스 적용 티어" description="선택한 티어에만 최고 LP 구간 보너스를 더합니다. 보통 마스터 이상에 적용합니다.">
        <div className="flex flex-wrap gap-1.5">
          {ALL_TIERS.map((tier) => {
            const on = form.lpBonusAppliesTo.includes(tier);
            return (
              <button
                key={tier}
                type="button"
                onClick={() => toggleLpTier(tier)}
                className={
                  on
                    ? 'rounded border border-violet-500/60 bg-violet-600/20 px-2.5 py-1 text-xs text-violet-200'
                    : 'rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300'
                }
              >
                {TIER_LABEL[tier] ?? tier}
              </button>
            );
          })}
        </div>
        {noLpBonusTier && <InlineMessage kind="warning">LP 보너스 적용 티어가 비어 있습니다. 의도한 설정인지 확인하세요.</InlineMessage>}
      </PageSection>

      <PageSection title="티어 기본 점수" description="일반 티어는 디비전별로, 마스터 이상은 단일 기본 점수로 관리합니다.">
        <div className="flex flex-col gap-2">
          {APPRENTICE.map((tier) => (
            <div key={tier} className="grid grid-cols-[80px_repeat(4,1fr)] items-center gap-2">
              <span className="text-xs text-zinc-400">{TIER_LABEL[tier]}</span>
              {DIVISIONS.map((division) => {
                const key = `${tier}_${division}`;
                return (
                  <div key={key} className="flex items-center gap-1">
                    <span className="w-6 text-right text-[11px] text-zinc-600">{division}</span>
                    <input
                      type="number"
                      value={form.tiers[key] ?? 0}
                      onChange={(event) => setTier(key, event.target.value === '' ? 0 : Number(event.target.value))}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          ))}
          <div className="grid grid-cols-[80px_repeat(4,1fr)] items-center gap-2 border-t border-zinc-800 pt-1">
            {APEX.map((tier) => (
              <div key={tier} className="col-span-1 flex flex-col gap-1">
                <span className="text-[11px] text-zinc-500">{TIER_LABEL[tier]}</span>
                <input
                  type="number"
                  value={form.tiers[tier] ?? 0}
                  onChange={(event) => setTier(tier, event.target.value === '' ? 0 : Number(event.target.value))}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      </PageSection>

      <PageSection title="마스터+ LP 보너스 구간" description="LP가 속한 가장 높은 구간의 보너스를 기본 점수에 더합니다.">
        <div className="grid max-h-80 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {bonusBrackets.map((bracket) => (
            <div key={bracket} className="flex items-center gap-1.5">
              <span className="w-20 text-right font-mono text-[11px] text-zinc-500">{bracket}</span>
              <input
                type="number"
                value={form.masterPlusLpBonus[bracket] ?? 0}
                onChange={(event) => setBonus(bracket, event.target.value === '' ? 0 : Number(event.target.value))}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        title="기준점 자동 보정"
        description="지정한 티어를 기준점으로 고정하고, 기준점 사이의 기본 점수를 자동 보간해 계산에 적용합니다. 저장된 원본 점수표는 유지됩니다."
      >
        <div className="grid items-end gap-3 md:grid-cols-3">
          <ToggleSwitch
            checked={form.anchorCorrection.enabled}
            onChange={(value) => setForm((prev) => ({ ...prev, anchorCorrection: { ...prev.anchorCorrection, enabled: value } }))}
            label="자동 보정 사용"
          />
          <TextField
            label="기준점 목록 (쉼표 구분)"
            value={form.anchorCorrection.anchors.join(', ')}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                anchorCorrection: {
                  ...prev.anchorCorrection,
                  anchors: value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean),
                },
              }))
            }
            placeholder="예: DIAMOND_I, MASTER, CHALLENGER"
            hint="입력한 기준점의 점수는 그대로 두고 사이 구간만 계산 때 보정합니다."
          />
          <NumberField
            label="보정 maxGap"
            value={form.anchorCorrection.maxGap}
            min={0}
            step={1}
            onChange={(value) => setForm((prev) => ({ ...prev, anchorCorrection: { ...prev.anchorCorrection, maxGap: num(value) } }))}
            hint="0이면 선형 보간만 적용합니다."
          />
        </div>
      </PageSection>

      <div className="flex flex-wrap items-center gap-3">
        <ConfirmButton
          tone="primary"
          confirmLabel="점수표 저장 확정"
          disabled={saveMut.isPending || !hasChanges || invalidRoster}
          onConfirm={() => saveMut.mutate()}
        >
          설정 저장
        </ConfirmButton>
        <button
          type="button"
          disabled={!hasChanges || saveMut.isPending}
          onClick={() => setForm(initial)}
          className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
        >
          변경 취소
        </button>
        {!hasChanges && <InlineMessage kind="info">저장할 변경 사항이 없습니다.</InlineMessage>}
        {invalidRoster && <InlineMessage kind="error">대표 로스터 인원은 1~50명이어야 합니다.</InlineMessage>}
        {saveMut.isSuccess && <InlineMessage kind="success">저장되었습니다. 다음 점수 계산부터 반영됩니다.</InlineMessage>}
        {saveMut.isError && <InlineMessage kind="error">{errorToMessage(saveMut.error)}</InlineMessage>}
      </div>

      <PreviewPanel settings={form} />
    </>
  );
}

function PreviewPanel({ settings }: { settings: GuildScoreSettings }) {
  const [solo, setSolo] = useState<RankInput>({ tier: 'DIAMOND', division: 'I', lp: 80 });
  const [flex, setFlex] = useState<RankInput>({ tier: 'UNRANKED', division: '', lp: 0 });

  const previewMut = useMutation({
    mutationFn: () =>
      guildScoreApi.preview({
        settings,
        solo: solo.tier && solo.tier !== 'UNRANKED' ? solo : null,
        flex: flex.tier && flex.tier !== 'UNRANKED' ? flex : null,
      }),
  });

  const result = previewMut.data;

  return (
    <PageSection title="미리보기 / 테스트 계산" description="현재 편집 중인 설정으로 계산합니다. 저장하지 않아도 결과를 볼 수 있습니다.">
      <div className="grid gap-3 md:grid-cols-2">
        <RankPicker label="솔로 랭크" rank={solo} onChange={setSolo} />
        <RankPicker label="자유 랭크" rank={flex} onChange={setFlex} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => previewMut.mutate()}
          disabled={previewMut.isPending}
          className="rounded bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {previewMut.isPending ? '계산 중...' : '계산'}
        </button>
        {previewMut.isError && <InlineMessage kind="error">{errorToMessage(previewMut.error)}</InlineMessage>}
      </div>

      {result && (
        <div className="mt-3 grid gap-3 rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-4 text-sm md:grid-cols-3">
          <Stat label="솔로 점수" value={result.soloRankScore} sub={`${result.solo.tierKey ?? '-'} (기본 ${result.solo.tierBaseScore}+LP ${result.solo.lpBonus})`} />
          <Stat label="자유 점수" value={result.flexRankScore} sub={`${result.flex.tierKey ?? '-'} (기본 ${result.flex.tierBaseScore}+LP ${result.flex.lpBonus})`} />
          <Stat label="멤버 전투력" value={result.memberScore} highlight sub={RANK_SCORE_MODE_LABELS[result.rankScoreMode]} />
        </div>
      )}
    </PageSection>
  );
}

function RankPicker({ label, rank, onChange }: { label: string; rank: RankInput; onChange: (rank: RankInput) => void }) {
  const isApex = (APEX as readonly string[]).includes(rank.tier);
  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3">
      <p className="mb-2 text-xs text-zinc-400">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <SelectField
          label="티어"
          value={rank.tier}
          onChange={(value) => onChange({ ...rank, tier: value })}
          options={[{ value: 'UNRANKED', label: '언랭/없음' }, ...ALL_TIERS.map((tier) => ({ value: tier, label: TIER_LABEL[tier] }))]}
        />
        <SelectField
          label="디비전"
          value={rank.division ?? ''}
          onChange={(value) => onChange({ ...rank, division: value })}
          options={[{ value: '', label: '-' }, ...DIVISIONS.map((division) => ({ value: division, label: division }))]}
          disabled={isApex || rank.tier === 'UNRANKED'}
        />
        <NumberField label="LP" value={rank.lp ?? 0} min={0} step={1} onChange={(value) => onChange({ ...rank, lp: num(value) })} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={highlight ? 'font-mono text-lg font-semibold text-violet-300' : 'font-mono text-lg text-zinc-200'}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-600">{sub}</p>}
    </div>
  );
}
