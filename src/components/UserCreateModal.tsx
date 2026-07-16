import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { CopyableId } from './CopyableId';
import { InlineMessage } from './InlineMessage';
import { NumberField, SelectField, TextField } from './Field';
import { ToggleSwitch } from './ToggleSwitch';
import { userApi } from '../services/userApi';
import { errorToMessage } from '../lib/apiError';
import {
  IDENTITY_PROVIDERS,
  IDENTITY_PROVIDER_LABELS,
  PLAN_IDS,
  PLAN_LABELS,
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_STATUSES,
  USER_STATUS_LABELS,
} from '../lib/constants';
import type { UserCreateInput } from '../types/user';

interface UserCreateModalProps {
  open: boolean;
  onClose: () => void;
}

const PLAN_OPTIONS = PLAN_IDS.map((p) => ({ value: p, label: PLAN_LABELS[p] }));
const ROLE_OPTIONS = USER_ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }));
const STATUS_OPTIONS = USER_STATUSES.map((s) => ({ value: s, label: USER_STATUS_LABELS[s] }));
const IDENTITY_OPTIONS = IDENTITY_PROVIDERS.map((p) => ({ value: p, label: IDENTITY_PROVIDER_LABELS[p] }));

type FormState = Required<
  Pick<
    UserCreateInput,
    | 'email'
    | 'displayName'
    | 'password'
    | 'plan'
    | 'role'
    | 'status'
    | 'identityVerified'
    | 'identityProvider'
    | 'riotId'
    | 'gameName'
    | 'tagLine'
    | 'puuid'
    | 'initialQlCoin'
  >
>;

const INITIAL: FormState = {
  email: '',
  displayName: '',
  password: '',
  plan: 'free',
  role: 'user',
  status: 'active',
  identityVerified: false,
  identityProvider: 'none',
  riotId: '',
  gameName: '',
  tagLine: '',
  puuid: '',
  initialQlCoin: 0,
};

export function UserCreateModal({ open, onClose }: UserCreateModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const trimmed = (v: string) => (v.trim() === '' ? undefined : v.trim());
      const input: UserCreateInput = {
        email: form.email.trim(),
        displayName: form.displayName.trim(),
        password: trimmed(form.password),
        plan: form.plan,
        role: form.role,
        status: form.status,
        identityVerified: form.identityVerified,
        identityProvider: form.identityProvider,
        riotId: trimmed(form.riotId),
        gameName: trimmed(form.gameName),
        tagLine: trimmed(form.tagLine),
        puuid: trimmed(form.puuid),
        initialQlCoin: form.initialQlCoin,
      };
      return userApi.create(input);
    },
    onSuccess: () => {
      setCopied(false);
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const password = form.password.trim();
  const valid =
    form.email.trim() !== '' &&
    form.displayName.trim() !== '' &&
    (password === '' || password.length >= 6);
  const result = mutation.data;

  const copyTemporaryPassword = () => {
    if (!result?.temporaryPassword) return;
    void navigator.clipboard.writeText(result.temporaryPassword).then(() => setCopied(true));
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="유저 추가">
      <div className="flex flex-col gap-3">
        <InlineMessage kind="info">
          Firebase Auth 계정을 먼저 만들고, 발급된 Auth UID로 Server DB 프로필, 지갑, 권한, 연동 정보를 생성합니다.
        </InlineMessage>

        <div className="grid md:grid-cols-2 gap-3">
          <TextField label="이메일" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
          <TextField label="닉네임" value={form.displayName} onChange={(displayName) => setForm({ ...form, displayName })} required />
          <TextField
            label="비밀번호"
            type="password"
            value={form.password}
            onChange={(nextPassword) => setForm({ ...form, password: nextPassword })}
            hint="비우면 임시 비밀번호를 자동 생성합니다"
          />
          <SelectField label="요금제" value={form.plan} onChange={(plan) => setForm({ ...form, plan: plan as FormState['plan'] })} options={PLAN_OPTIONS} />
          <SelectField label="권한(role)" value={form.role} onChange={(role) => setForm({ ...form, role: role as FormState['role'] })} options={ROLE_OPTIONS} />
          <SelectField label="상태" value={form.status} onChange={(status) => setForm({ ...form, status: status as FormState['status'] })} options={STATUS_OPTIONS} />
          <NumberField label="시작 QL 코인" value={form.initialQlCoin} min={0} max={100000000} onChange={(initialQlCoin) => setForm({ ...form, initialQlCoin })} />
        </div>

        <div className="flex items-center gap-6">
          <ToggleSwitch checked={form.identityVerified} onChange={(identityVerified) => setForm({ ...form, identityVerified })} label="본인인증 완료" />
          <SelectField label="인증 수단" value={form.identityProvider} onChange={(identityProvider) => setForm({ ...form, identityProvider: identityProvider as FormState['identityProvider'] })} options={IDENTITY_OPTIONS} className="w-40" />
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <TextField label="Riot ID" value={form.riotId} onChange={(riotId) => setForm({ ...form, riotId })} placeholder="이름#태그" />
          <TextField label="gameName" value={form.gameName} onChange={(gameName) => setForm({ ...form, gameName })} />
          <TextField label="tagLine" value={form.tagLine} onChange={(tagLine) => setForm({ ...form, tagLine })} />
          <TextField label="puuid" value={form.puuid} onChange={(puuid) => setForm({ ...form, puuid })} />
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!valid || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
            >
              {mutation.isPending ? '생성 중...' : '유저 생성'}
            </button>
            {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
          </div>

          {result && (
            <InlineMessage kind="success">
              생성 완료 · {result.user.displayName ?? result.user.email ?? '사용자'} (
              <CopyableId value={result.user.uid} full sensitive />)
              {result.temporaryPassword && (
                <span className="block mt-1">
                  임시 비밀번호 <code className="font-mono text-zinc-100">{result.temporaryPassword}</code>
                  <button type="button" onClick={copyTemporaryPassword} className="ml-2 text-violet-300 hover:text-violet-200">
                    {copied ? '복사됨' : '복사'}
                  </button>
                </span>
              )}
            </InlineMessage>
          )}
        </div>
      </div>
    </Modal>
  );
}
