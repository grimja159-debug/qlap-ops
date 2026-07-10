import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { TextField, NumberField, SelectField, TextAreaField } from './Field';
import { ToggleSwitch } from './ToggleSwitch';
import { InlineMessage } from './InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { seasonApi } from '../services/seasonApi';
import { SEASON_STATUSES, SEASON_STATUS_LABELS, type SeasonStatus } from '../lib/constants';
import { isoToLocalInput, localInputToIso } from '../lib/format';
import type { Season, SeasonCreateRequest } from '../types/season';

/**
 * 시즌 생성 / 수정 모달.
 *
 * 백엔드 buildSeasonPayload 는 생성 시 모든 필드를 필수로 받는다(날짜 8개 포함).
 * 그래서 폼은 모든 필드를 노출하고, 날짜는 datetime-local ↔ ISO 로 변환해 전송한다.
 * 수정(PATCH)은 부분 허용이지만, 여기서는 화면의 전체 값을 그대로 보내 단순화한다
 * (seasonId 는 수정 시 무시됨).
 */
interface SeasonFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null 이면 생성 모드, 값이 있으면 그 시즌 수정 모드. */
  initial: Season | null;
}

type DateKey =
  | 'guildCreateStartAt'
  | 'guildCreateEndAt'
  | 'guildJoinStartAt'
  | 'guildJoinEndAt'
  | 'pointCollectStartAt'
  | 'pointCollectEndAt'
  | 'tournamentStartAt'
  | 'tournamentEndAt';

const DATE_GROUPS: { label: string; keys: [DateKey, DateKey] }[] = [
  { label: '길드 생성 기간', keys: ['guildCreateStartAt', 'guildCreateEndAt'] },
  { label: '길드 가입 기간', keys: ['guildJoinStartAt', 'guildJoinEndAt'] },
  { label: '점수 집계 기간', keys: ['pointCollectStartAt', 'pointCollectEndAt'] },
  { label: '토너먼트 기간', keys: ['tournamentStartAt', 'tournamentEndAt'] },
];

const STATUS_OPTIONS = SEASON_STATUSES.map((s) => ({ value: s, label: SEASON_STATUS_LABELS[s] ?? s }));

const FLAG_FIELDS: { key: keyof Season & string; label: string }[] = [
  { key: 'requireIdentityVerification', label: '본인인증 필요' },
  { key: 'requireRiotAccount', label: 'Riot 계정 필요' },
];

function buildInitialDates(initial: Season | null): Record<DateKey, string> {
  const keys: DateKey[] = [
    'guildCreateStartAt',
    'guildCreateEndAt',
    'guildJoinStartAt',
    'guildJoinEndAt',
    'pointCollectStartAt',
    'pointCollectEndAt',
    'tournamentStartAt',
    'tournamentEndAt',
  ];
  const out = {} as Record<DateKey, string>;
  for (const k of keys) out[k] = isoToLocalInput(initial?.[k] ?? null);
  return out;
}

export function SeasonFormModal({ open, onClose, initial }: SeasonFormModalProps) {
  const qc = useQueryClient();
  const isEdit = initial !== null;

  const [seasonId, setSeasonId] = useState(initial?.seasonId ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [status, setStatus] = useState<SeasonStatus>(initial?.status ?? 'draft');
  const [dates, setDates] = useState<Record<DateKey, string>>(buildInitialDates(initial));
  const [rankMin, setRankMin] = useState<number>(initial?.tournamentRankMin ?? 1);
  const [rankMax, setRankMax] = useState<number>(initial?.tournamentRankMax ?? 100);
  const [flags, setFlags] = useState({
    requireGmTiketForCreate: false,
    requireGmTiketForJoin: false,
    requireIdentityVerification: initial?.requireIdentityVerification ?? true,
    requireRiotAccount: initial?.requireRiotAccount ?? true,
  });
  const [prizePercent, setPrizePercent] = useState<number>(initial?.prizeRevenuePercent ?? 0);
  const [prizeRuleText, setPrizeRuleText] = useState(initial?.prizeRuleText ?? '');
  const [formError, setFormError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: SeasonCreateRequest) =>
      isEdit ? seasonApi.update(initial!.id, payload) : seasonApi.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seasons'] });
      onClose();
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // 날짜 변환 + 누락 검사(생성 시 8개 모두 필수).
    const isoDates = {} as Record<DateKey, string>;
    for (const group of DATE_GROUPS) {
      for (const key of group.keys) {
        const iso = localInputToIso(dates[key]);
        if (!iso) {
          setFormError('모든 기간(시작/종료)을 입력하세요.');
          return;
        }
        isoDates[key] = iso;
      }
    }
    if (!seasonId.trim() || !title.trim()) {
      setFormError('시즌 ID와 제목은 필수입니다.');
      return;
    }
    if (rankMin > rankMax) {
      setFormError('토너먼트 진출 최소 순위가 최대 순위보다 큽니다.');
      return;
    }

    mutation.mutate({
      seasonId: seasonId.trim(),
      title: title.trim(),
      status,
      ...isoDates,
      tournamentRankMin: rankMin,
      tournamentRankMax: rankMax,
      ...flags,
      prizeRevenuePercent: prizePercent,
      prizeRuleText: prizeRuleText.trim(),
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" title={isEdit ? `시즌 수정 — ${initial!.seasonId}` : '새 시즌 생성'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="시즌 ID"
            required
            value={seasonId}
            onChange={setSeasonId}
            disabled={isEdit}
            placeholder="예: 2026-s1"
            hint={isEdit ? '시즌 ID는 변경할 수 없습니다.' : '영문/숫자/_/- 1~40자'}
          />
          <TextField label="제목" required value={title} onChange={setTitle} placeholder="예: 2026 시즌 1" />
        </div>

        <SelectField
          label="상태"
          value={status}
          onChange={(v) => setStatus(v as SeasonStatus)}
          options={STATUS_OPTIONS}
          className="w-48"
        />

        {/* 기간(날짜) — 4개 그룹 × 시작/종료 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DATE_GROUPS.map((group) => (
            <div key={group.label} className="rounded border border-zinc-700/60 bg-zinc-800/40 p-3">
              <p className="text-xs text-zinc-400 mb-2">{group.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <TextField
                  label="시작"
                  type="datetime-local"
                  value={dates[group.keys[0]]}
                  onChange={(v) => setDates((d) => ({ ...d, [group.keys[0]]: v }))}
                />
                <TextField
                  label="종료"
                  type="datetime-local"
                  value={dates[group.keys[1]]}
                  onChange={(v) => setDates((d) => ({ ...d, [group.keys[1]]: v }))}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumberField label="토너먼트 진출 최소 순위" min={1} value={rankMin} onChange={setRankMin} />
          <NumberField label="토너먼트 진출 최대 순위" min={1} max={1000} value={rankMax} onChange={setRankMax} />
          <NumberField label="상금 매출 비율(%)" min={0} max={100} value={prizePercent} onChange={setPrizePercent} />
        </div>

        <div className="rounded border border-zinc-700/60 bg-zinc-800/40 p-3 grid grid-cols-2 gap-3">
          {FLAG_FIELDS.map((f) => (
            <ToggleSwitch
              key={f.key}
              label={f.label}
              checked={flags[f.key as keyof typeof flags]}
              onChange={(v) => setFlags((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </div>

        <TextAreaField label="상금 규정 설명" value={prizeRuleText} onChange={setPrizeRuleText} rows={3} />

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-5 py-2 rounded"
          >
            {mutation.isPending ? '저장 중...' : isEdit ? '수정 저장' : '시즌 생성'}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-2">
            취소
          </button>
          {formError && <InlineMessage kind="error">{formError}</InlineMessage>}
          {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
        </div>
      </form>
    </Modal>
  );
}
