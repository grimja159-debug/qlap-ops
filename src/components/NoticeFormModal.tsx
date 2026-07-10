import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { TextField, TextAreaField, SelectField } from './Field';
import { ToggleSwitch } from './ToggleSwitch';
import { InlineMessage } from './InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { noticeApi } from '../services/noticeApi';
import { NOTICE_TYPES, NOTICE_TYPE_LABELS, type NoticeType } from '../lib/constants';
import { isoToLocalInput, localInputToIso } from '../lib/format';
import type { Notice } from '../types/notice';

/**
 * 공지 생성/수정 모달(super_admin 전용).
 * editing 이 있으면 수정(PATCH), 없으면 생성(POST).
 */
interface NoticeFormModalProps {
  open: boolean;
  onClose: () => void;
  editing?: Notice | null;
}

const TYPE_OPTIONS = NOTICE_TYPES.map((t) => ({ value: t, label: NOTICE_TYPE_LABELS[t] }));

export function NoticeFormModal({ open, onClose, editing }: NoticeFormModalProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [type, setType] = useState<NoticeType>(editing?.type ?? 'info');
  const [active, setActive] = useState(editing?.active ?? true);
  const [pinned, setPinned] = useState(editing?.pinned ?? false);
  const [startAt, setStartAt] = useState(isoToLocalInput(editing?.startAt ?? null));
  const [endAt, setEndAt] = useState(isoToLocalInput(editing?.endAt ?? null));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        type,
        active,
        pinned,
        startAt: startAt ? localInputToIso(startAt) ?? null : null,
        endAt: endAt ? localInputToIso(endAt) ?? null : null,
      };
      return editing ? noticeApi.update(editing.id, payload) : noticeApi.create(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notices'] });
      onClose();
    },
  });

  const canSubmit = title.trim().length >= 1 && body.trim().length >= 1;

  return (
    <Modal open={open} onClose={onClose} size="lg" title={editing ? '공지 수정' : '새 공지'}>
      <div className="flex flex-col gap-3">
        <TextField label="제목" required value={title} onChange={setTitle} placeholder="공지 제목" />
        <TextAreaField label="본문" required value={body} onChange={setBody} rows={6} placeholder="공지 내용" />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="종류" value={type} onChange={(v) => setType(v as NoticeType)} options={TYPE_OPTIONS} />
          <div className="flex items-end gap-6">
            <ToggleSwitch checked={active} onChange={setActive} label="활성" />
            <ToggleSwitch checked={pinned} onChange={setPinned} label="상단 고정" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="노출 시작(선택)" type="datetime-local" value={startAt} onChange={setStartAt} />
          <TextField label="노출 종료(선택)" type="datetime-local" value={endAt} onChange={setEndAt} />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
          >
            {mutation.isPending ? '저장 중...' : editing ? '수정 저장' : '공지 생성'}
          </button>
          {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
        </div>
      </div>
    </Modal>
  );
}
