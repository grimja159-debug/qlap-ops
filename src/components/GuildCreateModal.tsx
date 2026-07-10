import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { InlineMessage } from './InlineMessage';
import { NumberField, TextAreaField, TextField } from './Field';
import { ConfirmButton } from './ConfirmButton';
import { guildApi, type GuildCreateInput } from '../services/guildApi';
import { errorToMessage } from '../lib/apiError';

interface GuildCreateModalProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL: GuildCreateInput = {
  seasonId: 'default',
  name: '',
  slug: '',
  ownerUid: '',
  maxMembers: 6,
  description: '',
  recruitmentMessage: '',
};

export function GuildCreateModal({ open, onClose }: GuildCreateModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<GuildCreateInput>(INITIAL);

  const mutation = useMutation({
    mutationFn: () =>
      guildApi.create({
        seasonId: form.seasonId?.trim() || 'default',
        name: form.name.trim(),
        slug: form.slug?.trim() || undefined,
        ownerUid: form.ownerUid.trim(),
        maxMembers: form.maxMembers,
        description: form.description?.trim() || undefined,
        recruitmentMessage: form.recruitmentMessage?.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-guilds'] });
    },
  });

  const valid =
    (form.seasonId?.trim() ?? '') !== '' &&
    form.name.trim().length >= 2 &&
    form.ownerUid.trim() !== '' &&
    Number.isFinite(form.maxMembers ?? 0) &&
    (form.maxMembers ?? 0) >= 1;

  return (
    <Modal open={open} onClose={onClose} size="lg" title="길드 생성">
      <div className="flex flex-col gap-3">
        <InlineMessage kind="info">
          관리자 생성은 가입권/티켓 검사를 건너뜁니다. ownerUid는 Firebase Auth와 Server DB 사용자 프로필에 존재하는 계정이어야 합니다.
        </InlineMessage>

        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="시즌 ID" value={form.seasonId ?? 'default'} onChange={(seasonId) => setForm({ ...form, seasonId })} required />
          <TextField label="길드명" value={form.name} onChange={(name) => setForm({ ...form, name })} required hint="2자 이상" />
          <TextField
            label="슬러그"
            value={form.slug ?? ''}
            onChange={(slug) => setForm({ ...form, slug })}
            hint="비우면 길드명 기준으로 자동 생성합니다."
          />
          <TextField
            label="길드장 UID"
            value={form.ownerUid}
            onChange={(ownerUid) => setForm({ ...form, ownerUid })}
            required
            hint="관리자 화면에서만 UID 입력을 허용합니다."
          />
          <NumberField label="최대 인원" value={form.maxMembers ?? 6} min={1} max={300} onChange={(maxMembers) => setForm({ ...form, maxMembers })} />
        </div>

        <TextAreaField label="소개" value={form.description ?? ''} onChange={(description) => setForm({ ...form, description })} />
        <TextAreaField label="모집 메시지" value={form.recruitmentMessage ?? ''} onChange={(recruitmentMessage) => setForm({ ...form, recruitmentMessage })} />

        <div className="flex items-center gap-3 pt-1">
          <ConfirmButton tone="primary" confirmLabel="길드 생성 확정" disabled={!valid || mutation.isPending} onConfirm={() => mutation.mutate()}>
            {mutation.isPending ? '생성 중...' : '길드 생성'}
          </ConfirmButton>
          {mutation.isSuccess && mutation.data && (
            <InlineMessage kind="success">생성 완료 · {mutation.data.name} ({mutation.data.guildId.slice(0, 8)})</InlineMessage>
          )}
          {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
        </div>
      </div>
    </Modal>
  );
}
