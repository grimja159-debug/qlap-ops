import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InlineMessage } from '../components/InlineMessage';
import { NumberField, TextField } from '../components/Field';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { errorToMessage } from '../lib/apiError';
import { formatDateTime } from '../lib/format';
import { guildPrizeApi } from '../services/guildPrizeApi';
import type { GuildPrizeUpdate } from '../types/guildPrize';

export function AdminGuildPrizePage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['guild-prize-settings'],
    queryFn: () => guildPrizeApi.get(),
  });

  const [visible, setVisible] = useState(true);
  const [amountKrw, setAmountKrw] = useState(Number.NaN);
  const [revenueSharePercent, setRevenueSharePercent] = useState(Number.NaN);
  const [buttonLabel, setButtonLabel] = useState('대회 자세히 보기');
  const [detailUrl, setDetailUrl] = useState('');
  const [saved, setSaved] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!data) return;
    setVisible(data.visible !== false);
    setAmountKrw(typeof data.amountKrw === 'number' ? data.amountKrw : Number.NaN);
    setRevenueSharePercent(typeof data.revenueSharePercent === 'number' ? data.revenueSharePercent : Number.NaN);
    setButtonLabel(data.buttonLabel || '대회 자세히 보기');
    setDetailUrl(data.detailUrl ?? '');
  }, [data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mutation = useMutation({
    mutationFn: (patch: GuildPrizeUpdate) => guildPrizeApi.update(patch),
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['guild-prize-settings'] });
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  const amountValid = !Number.isFinite(amountKrw) || amountKrw >= 0;
  const revenueShareValid =
    !Number.isFinite(revenueSharePercent) || (revenueSharePercent >= 0 && revenueSharePercent <= 100);
  const canSubmit = amountValid && revenueShareValid && buttonLabel.trim().length > 0;

  const amountPreview = Number.isFinite(amountKrw)
    ? `₩ ${Math.round(amountKrw).toLocaleString('ko-KR')}`
    : '--';
  const percentPreview = Number.isFinite(revenueSharePercent)
    ? revenueSharePercent.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
    : '--';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    mutation.mutate({
      visible,
      amountKrw: Number.isFinite(amountKrw) ? Math.round(amountKrw) : null,
      revenueSharePercent: Number.isFinite(revenueSharePercent) ? revenueSharePercent : null,
      buttonLabel: buttonLabel.trim(),
      detailUrl: detailUrl.trim() || null,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageSection
        title="길드 상금 변경"
        description="qlapgg 길드 페이지의 상금 정보 카드에 표시되는 금액과 수익 비율을 관리합니다."
      >
        <QueryState isLoading={isLoading} error={error}>
          <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-700/70 bg-zinc-900/35 p-4">
                <div className="mb-4">
                  <ToggleSwitch checked={visible} onChange={setVisible} label="길드 페이지에 상금 카드 노출" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <NumberField
                    label="총 상금(KRW)"
                    required
                    min={0}
                    step={10000}
                    value={amountKrw}
                    onChange={setAmountKrw}
                    hint="비워두면 --로 표시됩니다."
                  />
                  <NumberField
                    label="수익 비율(%)"
                    required
                    min={0}
                    max={100}
                    step={0.1}
                    value={revenueSharePercent}
                    onChange={setRevenueSharePercent}
                    hint="비워두면 --로 표시됩니다."
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <TextField
                    label="버튼 문구"
                    required
                    maxLength={40}
                    value={buttonLabel}
                    onChange={setButtonLabel}
                    placeholder="대회 자세히 보기"
                  />
                  <TextField
                    label="버튼 링크"
                    value={detailUrl}
                    onChange={setDetailUrl}
                    placeholder="/tournament 또는 https://..."
                    hint="비워두면 버튼은 비활성 처리됩니다."
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!canSubmit || mutation.isPending}
                  className="rounded bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {mutation.isPending ? '저장 중...' : '상금 정보 저장'}
                </button>
                {saved && <InlineMessage kind="success">저장되었습니다.</InlineMessage>}
                {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
              </div>

              {data?.updatedAt && (
                <p className="text-xs text-zinc-500">마지막 수정: {formatDateTime(data.updatedAt)}</p>
              )}
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-zinc-950 p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-amber-400">T</span>
                <p className="text-[10px] text-amber-400">상금 정보</p>
              </div>
              <p className="mb-1 text-[10px] text-zinc-500">총 상금</p>
              <p className="text-2xl font-bold text-amber-300">{amountPreview}</p>
              <p className="mt-1 text-[9px] text-zinc-500">(수익의 {percentPreview}%)</p>
              <button
                type="button"
                disabled
                className="mt-3 w-full rounded-lg border border-amber-500/40 bg-amber-600/20 py-2 text-xs font-semibold text-amber-200 disabled:opacity-70"
              >
                {buttonLabel.trim() || '대회 자세히 보기'}
              </button>
              {!visible && <p className="mt-3 text-xs text-amber-300">현재 사용자 페이지에서는 숨김 상태입니다.</p>}
            </div>
          </form>
        </QueryState>
      </PageSection>
    </div>
  );
}
