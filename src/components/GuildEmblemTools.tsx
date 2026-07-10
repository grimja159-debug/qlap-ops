import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ConfirmButton } from './ConfirmButton';
import { InlineMessage } from './InlineMessage';
import { TextField } from './Field';
import { guildApi } from '../services/guildApi';
import { errorToMessage } from '../lib/apiError';
import type { Guild } from '../types/guild';

const MAX_EMBLEM_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function EmblemImage({
  src,
  name,
  className,
}: {
  src: string | null | undefined;
  name: string;
  className: string;
}) {
  const [failedImage, setFailedImage] = useState<{ src: string | null; failed: boolean }>({
    src: null,
    failed: false,
  });
  const failed = failedImage.failed && failedImage.src === (src ?? null);

  if (!src || failed) {
    return (
      <div className={`${className} grid place-items-center border border-zinc-700 bg-zinc-900 text-zinc-600`}>
        <span className="text-xs">없음</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} 엠블럼`}
      className={`${className} border border-zinc-700 bg-zinc-900 object-cover`}
      loading="lazy"
      onError={() => setFailedImage({ src: src ?? null, failed: true })}
    />
  );
}

export function GuildEmblemThumb({ guild }: { guild: Guild }) {
  return <EmblemImage src={guild.emblemUrl} name={guild.name} className="h-10 w-10 rounded" />;
}

export function GuildEmblemPreview({ guild }: { guild: Guild }) {
  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
      <div className="flex items-center gap-4">
        <EmblemImage src={guild.emblemUrl} name={guild.name} className="h-24 w-24 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-500">길드 엠블럼</p>
          <p className="mt-1 break-all text-sm text-zinc-300">{guild.emblemUrl ?? '등록된 이미지 없음'}</p>
          {guild.emblemUrl && (
            <a
              href={guild.emblemUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs text-violet-300 hover:text-violet-200"
            >
              원본 열기
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function GuildEmblemEditor({
  guild,
  onInvalidate,
}: {
  guild: Guild;
  onInvalidate: () => void;
}) {
  const guildEmblemUrl = guild.emblemUrl ?? '';
  const [draft, setDraft] = useState(() => ({
    guildId: guild.guildId,
    emblemUrl: guildEmblemUrl,
    url: guildEmblemUrl,
    fileError: null as string | null,
  }));
  const draftMatchesGuild = draft.guildId === guild.guildId && draft.emblemUrl === guildEmblemUrl;
  const url = draftMatchesGuild ? draft.url : guildEmblemUrl;
  const fileError = draftMatchesGuild ? draft.fileError : null;

  const updateDraft = (next: Partial<Pick<typeof draft, 'url' | 'fileError'>>) => {
    setDraft((current) => ({
      guildId: guild.guildId,
      emblemUrl: guildEmblemUrl,
      url: next.url ?? (draftMatchesGuild ? current.url : guildEmblemUrl),
      fileError: next.fileError === undefined ? (draftMatchesGuild ? current.fileError : null) : next.fileError,
    }));
  };

  const setUrl = (nextUrl: string) => updateDraft({ url: nextUrl });
  const setFileError = (nextError: string | null) => updateDraft({ fileError: nextError });

  const uploadMut = useMutation({
    mutationFn: (file: File) => guildApi.uploadEmblem(guild.guildId, file),
    onSuccess: (result) => {
      setUrl(result.emblemUrl ?? '');
      onInvalidate();
    },
  });

  const urlMut = useMutation({
    mutationFn: () => guildApi.updateEmblemUrl(guild.guildId, url.trim() || null),
    onSuccess: (result) => {
      setUrl(result.emblemUrl ?? '');
      onInvalidate();
    },
  });

  const removeMut = useMutation({
    mutationFn: () => guildApi.removeEmblem(guild.guildId),
    onSuccess: () => {
      setUrl('');
      onInvalidate();
    },
  });

  const busy = uploadMut.isPending || urlMut.isPending || removeMut.isPending;
  const changed = url.trim() !== (guild.emblemUrl ?? '');

  const pickFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('png, jpg, webp 이미지만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > MAX_EMBLEM_BYTES) {
      setFileError('이미지 용량은 최대 2MB입니다.');
      return;
    }
    uploadMut.mutate(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <EmblemImage src={url || guild.emblemUrl} name={guild.name} className="h-24 w-24 rounded-lg" />
        <label className="inline-flex cursor-pointer items-center rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
          파일 선택
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              pickFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        {guild.emblemUrl && (
          <a href={guild.emblemUrl} target="_blank" rel="noreferrer" className="text-xs text-violet-300 hover:text-violet-200">
            원본 열기
          </a>
        )}
      </div>

      <TextField
        label="엠블럼 URL"
        value={url}
        onChange={setUrl}
        placeholder="https://..."
        hint="파일 업로드를 쓰거나 외부 이미지 URL을 직접 저장할 수 있습니다."
        disabled={busy}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !changed}
          onClick={() => urlMut.mutate()}
          className="rounded bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {urlMut.isPending ? '저장 중...' : 'URL 저장'}
        </button>
        <ConfirmButton
          tone="danger"
          confirmLabel="제거 확정"
          disabled={busy || !guild.emblemUrl}
          onConfirm={() => removeMut.mutate()}
        >
          엠블럼 제거
        </ConfirmButton>
      </div>

      {fileError && <InlineMessage kind="error">{fileError}</InlineMessage>}
      {uploadMut.isSuccess && <InlineMessage kind="success">이미지가 업로드되었습니다.</InlineMessage>}
      {urlMut.isSuccess && <InlineMessage kind="success">엠블럼 URL이 저장되었습니다.</InlineMessage>}
      {removeMut.isSuccess && <InlineMessage kind="success">엠블럼이 제거되었습니다.</InlineMessage>}
      {uploadMut.isError && <InlineMessage kind="error">{errorToMessage(uploadMut.error)}</InlineMessage>}
      {urlMut.isError && <InlineMessage kind="error">{errorToMessage(urlMut.error)}</InlineMessage>}
      {removeMut.isError && <InlineMessage kind="error">{errorToMessage(removeMut.error)}</InlineMessage>}
    </div>
  );
}
