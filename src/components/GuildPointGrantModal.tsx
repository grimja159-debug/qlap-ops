import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from './Modal';
import { NumberField, TextAreaField } from './Field';
import { InlineMessage } from './InlineMessage';
import { ConfirmButton } from './ConfirmButton';
import { guildApi, type GuildAddPointsResult } from '../services/guildApi';
import { errorToMessage } from '../lib/apiError';
import { formatNumber } from '../lib/format';
import type { Guild } from '../types/guild';

interface GuildPointGrantModalProps {
  guild: Guild | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (result: GuildAddPointsResult) => void;
}

export function GuildPointGrantModal({ guild, open, onClose, onSuccess }: GuildPointGrantModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="길드 포인트 추가" size="md">
      {guild && <GrantForm key={guild.guildId} guild={guild} onClose={onClose} onSuccess={onSuccess} />}
    </Modal>
  );
}

function GrantForm({
  guild,
  onClose,
  onSuccess,
}: {
  guild: Guild;
  onClose: () => void;
  onSuccess: (result: GuildAddPointsResult) => void;
}) {
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState('');

  const grantMut = useMutation({
    mutationFn: () => guildApi.addPoints(guild.guildId, { amount, reason: reason.trim() }),
    onSuccess: (result) => {
      onSuccess(result);
      setReason('');
    },
  });

  const invalidAmount = !Number.isFinite(amount) || amount < 1 || !Number.isInteger(amount);
  const disabled = invalidAmount || reason.trim() === '' || grantMut.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border border-zinc-700/60 bg-zinc-800/40 p-3 text-sm">
        <p className="font-medium text-zinc-200">{guild.name}</p>
        <p className="mt-1 text-xs text-zinc-500">
          현재 총 포인트 <span className="font-mono text-zinc-300">{formatNumber(guild.totalGuildPoint)}</span>
        </p>
      </div>

      <NumberField label="추가 포인트" value={amount} min={1} max={100000000} step={1} onChange={setAmount} required />
      <TextAreaField
        label="사유"
        value={reason}
        rows={3}
        maxLength={300}
        onChange={setReason}
        placeholder="예: 이벤트 보상, 운영 보정"
        required
      />

      <InlineMessage kind="warning">
        길드 포인트 지급은 Server DB 원장과 감사 로그에 남습니다. 지급 후 원장/랭킹 반영 상태를 확인하세요.
      </InlineMessage>

      <div className="flex items-center gap-3">
        <ConfirmButton
          tone="primary"
          confirmLabel="포인트 지급 확정"
          disabled={disabled}
          onConfirm={() => grantMut.mutate()}
        >
          {grantMut.isPending ? '추가 중...' : '포인트 추가'}
        </ConfirmButton>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
        >
          닫기
        </button>
      </div>

      {grantMut.isSuccess && grantMut.data && (
        <InlineMessage kind="success">
          {formatNumber(grantMut.data.amount)}점 추가 완료 · 총 {formatNumber(grantMut.data.afterTotal)}
        </InlineMessage>
      )}
      {grantMut.isError && <InlineMessage kind="error">{errorToMessage(grantMut.error)}</InlineMessage>}
    </div>
  );
}
