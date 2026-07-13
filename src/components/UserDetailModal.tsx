import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { QueryState } from './QueryState';
import { StatusBadge } from './StatusBadge';
import { CopyableId } from './CopyableId';
import { ConfirmButton } from './ConfirmButton';
import { InlineMessage } from './InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { TextField, TextAreaField, SelectField } from './Field';
import { ToggleSwitch } from './ToggleSwitch';
import { EconomyChangeForm } from './EconomyChangeForm';
import { ItemGrantForm } from './ItemGrantForm';
import { DataTable, type Column } from './DataTable';
import { userApi } from '../services/userApi';
import { logApi } from '../services/logApi';
import { useAuth } from '../contexts/auth';
import {
  PLAN_IDS,
  PLAN_LABELS,
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  IDENTITY_PROVIDERS,
  IDENTITY_PROVIDER_LABELS,
} from '../lib/constants';
import { userStatusTone, planTone } from '../lib/statusTone';
import { formatDateTime, formatNumber, formatSignedNumber, type IsoDateLike } from '../lib/format';
import type {
  AdminUser,
  UserAccessProfilePatch,
  UserDataDiagnostics,
  UserFirestoreMirrorOutboxRow,
  UserPersonalScoreMirrorRetryResult,
} from '../types/user';

/**
 * 유저 상세/관리 모달.
 *
 * [구성] 운영자가 한 사용자에 대해 할 수 있는 거의 모든 작업을 탭으로 모았다.
 *  - 정보/수정 : 프로필 조회 + 권한(role)/요금제(plan)/본인인증/Riot 정보 수정 + 계정 정지/해제
 *  - 재화/아이템 : 코인·티켓 지급/차감, 아이템 지급
 *  - 활동 로그 : 이 UID 의 QL코인 로그(uid 필터)
 *
 * 데이터 소스는 GET /api/admin/users/:uid 단 하나로 두고, 변경 후에는 쿼리를 무효화해
 * 항상 서버 최신값을 다시 받아 표시한다(로컬에서 낙관적으로 끼워맞추지 않는다).
 */
interface UserDetailModalProps {
  uid: string;
  open: boolean;
  onClose: () => void;
}

type Tab = 'info' | 'economy' | 'logs';

const TABS: { key: Tab; label: string }[] = [
  { key: 'info', label: '정보 / 수정' },
  { key: 'economy', label: '재화 · 아이템' },
  { key: 'logs', label: '활동 로그' },
];

const PLAN_OPTIONS = PLAN_IDS.map((p) => ({ value: p, label: PLAN_LABELS[p] }));
const ROLE_OPTIONS = USER_ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }));
const IDENTITY_OPTIONS = IDENTITY_PROVIDERS.map((p) => ({
  value: p,
  label: IDENTITY_PROVIDER_LABELS[p],
}));

function identityBadgeLabel(user: AdminUser): string {
  if (!user.identityVerified) return '미인증';
  if (user.identityProvider === 'kakao') return '카카오 인증자';
  const providerLabel = IDENTITY_PROVIDER_LABELS[user.identityProvider] ?? user.identityProvider;
  return `${providerLabel} 인증`;
}

export function UserDetailModal({ uid, open, onClose }: UserDetailModalProps) {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['user', uid],
    queryFn: () => userApi.get(uid),
    enabled: open,
  });

  const [tab, setTab] = useState<Tab>('info');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={user ? user.displayName ?? user.email ?? uid : '유저 상세'}
      headerRight={
        user && (
          <StatusBadge label={USER_STATUS_LABELS[user.status]} tone={userStatusTone(user.status)} />
        )
      }
    >
      <QueryState isLoading={isLoading} error={error}>
        {user && (
          <div className="flex flex-col gap-4">
            {/* 탭 헤더 */}
            <div className="flex gap-1 border-b border-zinc-700/60">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={
                    tab === t.key
                      ? 'px-3 py-2 text-sm text-violet-300 border-b-2 border-violet-500 -mb-px'
                      : 'px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300'
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* key 에 updatedAt 을 줘서, 저장 후 재조회되면 InfoTab 이 리마운트되어 폼이 최신값으로 초기화된다. */}
            {tab === 'info' && <InfoTab key={String(user.updatedAt ?? user.uid)} user={user} onClose={onClose} />}
            {tab === 'economy' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
                    재화 지급 / 차감
                  </h3>
                  <EconomyChangeForm presetUid={uid} lockUid />
                </div>
                <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
                    아이템 지급
                  </h3>
                  <ItemGrantForm presetUid={uid} lockUid />
                </div>
              </div>
            )}
            {tab === 'logs' && <LogsTab uid={uid} />}
          </div>
        )}
      </QueryState>
    </Modal>
  );
}

/* ───────────────────────── 정보/수정 탭 ───────────────────────── */

function InfoTab({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const { me } = useAuth();
  const isSelf = me?.uid === user.uid;

  // 수정 폼 로컬 상태. props(user)에서 초기화한다.
  // 저장 후에는 user 쿼리가 무효화→재조회되며, 부모가 InfoTab 에 key(updatedAt)를 주어
  // 컴포넌트를 리마운트하므로 이 상태도 서버 최신값으로 자연스럽게 재초기화된다.
  // (useEffect 로 props→state 를 동기화하면 cascading render 라 React 가 권장하지 않는다.)
  const [role, setRole] = useState(user.role);
  const [plan, setPlan] = useState(user.plan);
  const [identityVerified, setIdentityVerified] = useState(user.identityVerified);
  const [identityProvider, setIdentityProvider] = useState(user.identityProvider);
  const [riotId, setRiotId] = useState(user.riotId ?? '');
  const [gameName, setGameName] = useState(user.gameName ?? '');
  const [tagLine, setTagLine] = useState(user.tagLine ?? '');
  const [puuid, setPuuid] = useState(user.puuid ?? '');

  const [confirmation, setConfirmation] = useState('');
  const [memo, setMemo] = useState(user.memo ?? '');
  const [mirrorRetryReason, setMirrorRetryReason] = useState('ADMIN_RETRY_PERSONAL_SCORE_MIRROR');
  const roleChanged = role !== user.role;
  const diagnosticsQuery = useQuery({
    queryKey: ['user-data-diagnostics', user.uid],
    queryFn: () => userApi.diagnostics(user.uid),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (patch: UserAccessProfilePatch) => userApi.updateProfile(user.uid, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user', user.uid] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const memoMut = useMutation({
    mutationFn: () => userApi.updateMemo(user.uid, memo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user', user.uid] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const mirrorRetryMut = useMutation({
    mutationFn: (write: boolean) =>
      userApi.retryPersonalScoreMirror(user.uid, {
        write,
        reason: mirrorRetryReason,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-data-diagnostics', user.uid] });
      void diagnosticsQuery.refetch();
    },
  });

  // 완전 삭제(하드): 성공하면 유저 문서가 사라지므로 모달을 닫는다.
  const deleteMut = useMutation({
    mutationFn: (phrase: string) => userApi.remove(user.uid, phrase),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
  });

  // 빈 문자열은 null 로 보내 백엔드가 필드를 비우도록 한다.
  const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

  return (
    <div className="flex flex-col gap-4">
      {/* 계정 상태 / 정지·해제 */}
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">계정 상태</h3>
            <StatusBadge label={USER_STATUS_LABELS[user.status]} tone={userStatusTone(user.status)} />
          </div>
          <div className="flex items-center gap-2">
            {user.status !== 'banned' ? (
              <ConfirmButton
                tone="danger"
                confirmLabel="정지 확정"
                disabled={mutation.isPending || isSelf}
                onConfirm={() => mutation.mutate({ status: 'banned' })}
              >
                계정 정지
              </ConfirmButton>
            ) : (
              <ConfirmButton
                tone="primary"
                confirmLabel="해제 확정"
                disabled={mutation.isPending || isSelf}
                onConfirm={() => mutation.mutate({ status: 'active' })}
              >
                정지 해제
              </ConfirmButton>
            )}
          </div>
        </div>
      </div>

      {/* 기본 정보(읽기 전용) */}
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <Info label="UID">
          <CopyableId value={user.uid} full />
        </Info>
        <Info label="이메일">{user.email ?? '–'}</Info>
        <Info label="닉네임">{user.displayName ?? '–'}</Info>
        <Info label="요금제">
          <StatusBadge label={PLAN_LABELS[user.plan]} tone={planTone(user.plan)} />
        </Info>
        <Info label="QL 코인">{formatNumber(user.qlCoinBalance)}</Info>
        <Info label="본인인증">
          <StatusBadge
            label={identityBadgeLabel(user)}
            tone={user.identityVerified ? 'success' : 'neutral'}
          />
        </Info>
        <Info label="가입일">{formatDateTime(user.createdAt)}</Info>
        <Info label="수정일">{formatDateTime(user.updatedAt)}</Info>
        <Info label="최근 활동">{formatDateTime(user.lastSeenAt)}</Info>
      </div>

      <UserDataDiagnosticsPanel
        diagnostics={diagnosticsQuery.data}
        isLoading={diagnosticsQuery.isLoading}
        error={diagnosticsQuery.error}
        mirrorRetryReason={mirrorRetryReason}
        onMirrorRetryReasonChange={setMirrorRetryReason}
        onMirrorRetryDryRun={() => mirrorRetryMut.mutate(false)}
        onMirrorRetryWrite={() => mirrorRetryMut.mutate(true)}
        mirrorRetryPending={mirrorRetryMut.isPending}
        mirrorRetryResult={mirrorRetryMut.data}
        mirrorRetryError={mirrorRetryMut.error}
      />

      {/* 운영 메모(CS) */}
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">운영 메모 (CS)</h3>
        <TextAreaField label="메모" value={memo} onChange={setMemo} rows={3} placeholder="이 유저에 대한 운영 메모(최대 2000자)" />
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            disabled={memoMut.isPending}
            onClick={() => memoMut.mutate()}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
          >
            메모 저장
          </button>
          {memoMut.isSuccess && <InlineMessage kind="success">메모 저장됨</InlineMessage>}
          {memoMut.isError && <InlineMessage kind="error">{errorToMessage(memoMut.error)}</InlineMessage>}
        </div>
      </div>

      {/* 권한 / 요금제 수정 */}
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">권한 / 요금제</h3>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="권한(role)" value={role} onChange={(v) => setRole(v as typeof role)} options={ROLE_OPTIONS} />
          <SelectField label="요금제(plan)" value={plan} onChange={(v) => setPlan(v as typeof plan)} options={PLAN_OPTIONS} />
        </div>
        <button
          type="button"
          disabled={mutation.isPending || (isSelf && roleChanged)}
          onClick={() => mutation.mutate({ role, plan })}
          className="mt-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
        >
          권한/요금제 저장
        </button>
        {isSelf && roleChanged && (
          <InlineMessage kind="warning">본인 계정의 role 변경은 잠금 사고 방지를 위해 차단됩니다.</InlineMessage>
        )}
      </div>

      {/* 본인인증 */}
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">본인인증</h3>
        <div className="flex items-center gap-6">
          <ToggleSwitch checked={identityVerified} onChange={setIdentityVerified} label="인증 완료" />
          <SelectField
            label="인증 수단"
            value={identityProvider}
            onChange={(v) => setIdentityProvider(v as typeof identityProvider)}
            options={IDENTITY_OPTIONS}
            className="w-40"
          />
        </div>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ identityVerified, identityProvider })}
          className="mt-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
        >
          본인인증 저장
        </button>
      </div>

      {/* Riot 계정 정보 */}
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Riot 계정</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={user.riotId ? 'Riot ID 있음' : 'Riot ID 없음'} tone={user.riotId ? 'success' : 'warning'} />
            <StatusBadge label={user.puuid ? 'PUUID 있음' : 'PUUID 없음'} tone={user.puuid ? 'success' : 'warning'} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Riot ID" value={riotId} onChange={setRiotId} placeholder="이름#태그" />
          <TextField label="gameName" value={gameName} onChange={setGameName} />
          <TextField label="tagLine" value={tagLine} onChange={setTagLine} />
          <TextField label="puuid" value={puuid} onChange={setPuuid} />
        </div>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              riotId: orNull(riotId),
              gameName: orNull(gameName),
              tagLine: orNull(tagLine),
              puuid: orNull(puuid),
            })
          }
          className="mt-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
        >
          Riot 정보 저장
        </button>
      </div>

      <div className="h-4">
        {mutation.isSuccess && <InlineMessage kind="success">저장되었습니다.</InlineMessage>}
        {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
      </div>

      {/* 위험 구역: 계정 삭제 */}
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <h3 className="text-xs font-medium text-red-300 uppercase tracking-wide mb-3">계정 삭제</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-zinc-400">
              소프트 삭제: 상태를 ‘삭제됨’으로 변경(문서 보존, 복구 가능)
            </span>
            {user.status !== 'deleted' ? (
              <ConfirmButton
                tone="neutral"
                confirmLabel="삭제됨 처리 확정"
                disabled={mutation.isPending || isSelf}
                onConfirm={() => mutation.mutate({ status: 'deleted' })}
              >
                소프트 삭제
              </ConfirmButton>
            ) : (
              <StatusBadge label="이미 삭제됨" tone="neutral" />
            )}
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <TextField
              label="완전 삭제 확인 문구"
              value={confirmation}
              onChange={setConfirmation}
              hint="정확히 DELETE USER 입력 · 복구 불가"
              className="min-w-[220px]"
            />
            <ConfirmButton
              tone="danger"
              confirmLabel="영구 삭제 확정"
              disabled={deleteMut.isPending || confirmation !== 'DELETE USER' || isSelf}
              onConfirm={() => deleteMut.mutate(confirmation)}
            >
              완전 삭제
            </ConfirmButton>
          </div>
          {isSelf && <InlineMessage kind="warning">본인 계정의 정지/삭제는 관리자 세션 잠금 방지를 위해 차단됩니다.</InlineMessage>}
          <p className="text-xs text-zinc-600">
            ※ 운영자/관리자 권한 계정과 본인 계정은 완전 삭제가 거부됩니다. 길드 멤버십 문서는 함께 삭제되지 않습니다.
          </p>
          {deleteMut.isError && <InlineMessage kind="error">{errorToMessage(deleteMut.error)}</InlineMessage>}
        </div>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <div className="text-zinc-300 mt-0.5">{children}</div>
    </div>
  );
}

/* ───────────────────────── 통합 활동 타임라인 탭 ───────────────────────── */

function diagnosticsTone(status: string | null | undefined): 'success' | 'info' | 'accent' | 'warning' | 'danger' | 'neutral' {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'SENT' || normalized === 'MIRRORED' || normalized === 'IMPORTED') return 'success';
  if (normalized === 'PENDING' || normalized === 'OUTBOX_PENDING' || normalized === 'NOT_MIRRORED') return 'warning';
  if (normalized === 'FAILED' || normalized === 'DEAD') return 'danger';
  if (normalized === 'OK') return 'success';
  if (normalized === 'CAUTION') return 'warning';
  if (normalized === 'DANGER') return 'danger';
  if (normalized === 'UNVERIFIED') return 'neutral';
  return 'neutral';
}

function rankText(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '-';
  const row = value as Record<string, unknown>;
  const tier = typeof row.tier === 'string' ? row.tier : null;
  const division = typeof row.division === 'string' ? row.division : null;
  const lp = typeof row.lp === 'number' && Number.isFinite(row.lp) ? row.lp : null;
  return [tier, division, lp == null ? null : `${formatNumber(lp)} LP`].filter(Boolean).join(' ') || '-';
}

function outboxCountsLabel(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  return entries.length > 0 ? entries.map(([key, value]) => `${key} ${formatNumber(value)}`).join(' · ') : '없음';
}

function UserDataDiagnosticsPanel({
  diagnostics,
  isLoading,
  error,
  mirrorRetryReason,
  onMirrorRetryReasonChange,
  onMirrorRetryDryRun,
  onMirrorRetryWrite,
  mirrorRetryPending,
  mirrorRetryResult,
  mirrorRetryError,
}: {
  diagnostics: UserDataDiagnostics | undefined;
  isLoading: boolean;
  error: unknown;
  mirrorRetryReason: string;
  onMirrorRetryReasonChange: (value: string) => void;
  onMirrorRetryDryRun: () => void;
  onMirrorRetryWrite: () => void;
  mirrorRetryPending: boolean;
  mirrorRetryResult: UserPersonalScoreMirrorRetryResult | undefined;
  mirrorRetryError: unknown;
}) {
  const outboxColumns: Column<UserFirestoreMirrorOutboxRow>[] = [
    {
      key: 'status',
      header: '상태',
      render: (row) => <StatusBadge label={row.status} tone={diagnosticsTone(row.status)} />,
    },
    {
      key: 'targetPath',
      header: '대상',
      render: (row) => <span className="text-xs text-zinc-400 break-all">{row.targetPath ?? '-'}</span>,
    },
    {
      key: 'attempts',
      header: '시도',
      render: (row) => <span className="font-mono text-xs">{formatNumber(row.attempts)}</span>,
    },
    {
      key: 'createdAt',
      header: '생성',
      render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'sentAt',
      header: '전송',
      render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.sentAt)}</span>,
    },
    {
      key: 'lastError',
      header: '오류',
      render: (row) => <span className="text-xs text-red-300 break-all">{row.lastError ?? '-'}</span>,
    },
  ];

  return (
    <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-medium text-cyan-200 uppercase tracking-wide">Server DB / Legacy Mirror 진단</h3>
          <p className="mt-1 text-xs text-zinc-500">
            쓰기 없이 Server DB 원장, 개인 점수, legacy mirror outbox 상태만 조회합니다. 이 화면은 Firestore 직접 쓰기를 실행하지 않습니다.
          </p>
        </div>
        {diagnostics && <span className="text-[11px] text-zinc-500">checked {formatDateTime(diagnostics.checkedAt)}</span>}
      </div>

      <QueryState isLoading={isLoading} error={error}>
        {diagnostics && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded border border-zinc-700/60 bg-zinc-900/40 p-3">
                <p className="text-xs text-zinc-500">personal_scores</p>
                {diagnostics.personalScore.exists ? (
                  <div className="mt-2 space-y-1 text-xs text-zinc-300">
                    <StatusBadge
                      label={diagnostics.personalScore.firestoreMirrorStatus ?? 'UNKNOWN'}
                      tone={diagnosticsTone(diagnostics.personalScore.firestoreMirrorStatus)}
                    />
                    <StatusBadge
                      label={diagnostics.personalScore.puuidPresent ? 'PUUID 있음' : 'PUUID 없음'}
                      tone={diagnostics.personalScore.puuidPresent ? 'success' : 'warning'}
                    />
                    <p>점수 {formatNumber(diagnostics.personalScore.finalScore)}</p>
                    <p>Riot {diagnostics.personalScore.riotId ?? '-'}</p>
                    <p>rank {rankText(diagnostics.personalScore.rank)}</p>
                    <p>source {diagnostics.personalScore.source ?? '-'}</p>
                    <p>updated {formatDateTime(diagnostics.personalScore.updatedAt)}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-300">Server DB 개인 점수 없음</p>
                )}
              </div>

              <div className="rounded border border-zinc-700/60 bg-zinc-900/40 p-3">
                <p className="text-xs text-zinc-500">wallet ledger</p>
                {diagnostics.wallet.exists ? (
                  <div className="mt-2 space-y-1 text-xs text-zinc-300">
                    <p>qlapcoin {formatNumber(diagnostics.wallet.qlapcoinBalance)}</p>
                    <p>pending {formatNumber(diagnostics.wallet.pendingQlapcoinBalance)}</p>
                    <p>version {formatNumber(diagnostics.wallet.version)}</p>
                    <p>updated {formatDateTime(diagnostics.wallet.updatedAt)}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-300">Server DB 지갑 없음</p>
                )}
              </div>

              <div className="rounded border border-zinc-700/60 bg-zinc-900/40 p-3">
                <p className="text-xs text-zinc-500">server_user_profiles</p>
                {diagnostics.serverProfile.exists ? (
                  <div className="mt-2 space-y-1 text-xs text-zinc-300">
                    <StatusBadge
                      label={diagnostics.serverProfile.firestoreMirrorStatus ?? 'UNKNOWN'}
                      tone={diagnosticsTone(diagnostics.serverProfile.firestoreMirrorStatus)}
                    />
                    <p>{diagnostics.serverProfile.role ?? '-'} · {diagnostics.serverProfile.plan ?? '-'}</p>
                    <p>status {diagnostics.serverProfile.status ?? '-'}</p>
                    <p>updated {formatDateTime(diagnostics.serverProfile.updatedAt)}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-300">Server DB 프로필 없음</p>
                )}
              </div>

              <div className="rounded border border-zinc-700/60 bg-zinc-900/40 p-3">
                <p className="text-xs text-zinc-500">linked accounts</p>
                {diagnostics.linkedAccounts.exists ? (
                  <div className="mt-2 space-y-1 text-xs text-zinc-300">
                    <StatusBadge
                      label={diagnostics.linkedAccounts.firestoreMirrorStatus ?? 'UNKNOWN'}
                      tone={diagnosticsTone(diagnostics.linkedAccounts.firestoreMirrorStatus)}
                    />
                    <p>Discord {diagnostics.linkedAccounts.discordLinked ? '연동' : '-'}</p>
                    <p>Kakao {diagnostics.linkedAccounts.kakaoLinked ? '연동' : '-'}</p>
                    <p>Riot {diagnostics.linkedAccounts.riotLinked ? '연동' : '-'}</p>
                    <p>updated {formatDateTime(diagnostics.linkedAccounts.updatedAt)}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-300">Server DB 연동 계정 없음</p>
                )}
              </div>
            </div>

            <div className="rounded border border-zinc-700/60 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-300">personal_score legacy mirror outbox</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {outboxCountsLabel(diagnostics.firestoreMirrorOutbox.counts)}
                    {' · '}
                    last sent {formatDateTime(diagnostics.firestoreMirrorOutbox.lastSentAt)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 rounded border border-zinc-700/60 bg-zinc-950/30 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <TextField
                    label="재시도 사유"
                    value={mirrorRetryReason}
                    onChange={onMirrorRetryReasonChange}
                    className="min-w-[260px] flex-1"
                  />
                  <button
                    type="button"
                    disabled={mirrorRetryPending}
                    onClick={onMirrorRetryDryRun}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    retry dry-run
                  </button>
                  <ConfirmButton
                    tone="primary"
                    confirmLabel="outbox reset write"
                    disabled={mirrorRetryPending}
                    onConfirm={onMirrorRetryWrite}
                  >
                    outbox reset
                  </ConfirmButton>
                </div>
                <p className="text-xs text-zinc-500">
                  FAILED/DEAD personal_score legacy mirror outbox만 PENDING으로 되돌립니다. Firestore 직접 write는 여기서 실행하지 않습니다. write=true도 Server DB outbox reset만 수행합니다.
                </p>
                {mirrorRetryResult ? (
                  <InlineMessage kind={mirrorRetryResult.write ? 'success' : 'info'}>
                    matched {formatNumber(mirrorRetryResult.matched)} · reset {formatNumber(mirrorRetryResult.reset)} · write {String(mirrorRetryResult.write)} · firestoreWrite {String(mirrorRetryResult.firestoreWrite ?? false)}
                  </InlineMessage>
                ) : null}
                {mirrorRetryError ? <InlineMessage kind="error">{errorToMessage(mirrorRetryError)}</InlineMessage> : null}
              </div>
              <div className="mt-3">
                <DataTable
                  columns={outboxColumns}
                  data={diagnostics.firestoreMirrorOutbox.recent}
                  rowKey={(row) => String(row.outboxId ?? `${row.targetPath}-${row.createdAt}`)}
                  emptyMessage="legacy mirror outbox 이력이 없습니다"
                />
              </div>
              <p className="mt-2 text-xs text-zinc-600">
                payload_json, token, provider 원문 ID는 표시하지 않습니다. 실패 원인 확인에 필요한 상태와 오류만 표시합니다.
              </p>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}

interface ActivityRow {
  id: string;
  createdAt: IsoDateLike;
  kind: 'coin' | 'guildAction' | 'guildPoint';
  label: string;
  amount: number | null;
  detail: string;
  by: string | null;
}

const ACTIVITY_KIND_LABELS: Record<ActivityRow['kind'], string> = {
  coin: 'QL 코인',
  guildAction: '길드 행동',
  guildPoint: '길드 점수',
};

function activityMillis(value: IsoDateLike): number {
  if (!value) return 0;
  const t = typeof value === 'number' ? value : Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function LogsTab({ uid }: { uid: string }) {
  const ql = useQuery({ queryKey: ['logs', 'qlCoin', uid], queryFn: () => logApi.qlCoin({ uid, limit: 50 }) });
  const ga = useQuery({ queryKey: ['logs', 'guildActions', uid], queryFn: () => logApi.guildActions({ uid, limit: 50 }) });
  const gp = useQuery({ queryKey: ['logs', 'guildPoints', uid], queryFn: () => logApi.guildPoints({ uid, limit: 50 }) });

  const isLoading = ql.isLoading || ga.isLoading || gp.isLoading;
  const error = ql.error ?? ga.error ?? gp.error;

  const rows: ActivityRow[] = useMemo(() => {
    const out: ActivityRow[] = [];
    for (const r of ql.data ?? [])
      out.push({ id: `c_${r.id}`, createdAt: r.createdAt, kind: 'coin', label: r.type, amount: r.amount, detail: r.reason ?? '', by: r.createdBy ?? null });
    for (const r of ga.data ?? [])
      out.push({ id: `a_${r.id}`, createdAt: r.createdAt, kind: 'guildAction', label: r.action, amount: null, detail: r.guildId ?? '', by: null });
    for (const r of gp.data ?? [])
      out.push({ id: `p_${r.id}`, createdAt: r.createdAt, kind: 'guildPoint', label: r.source ?? '점수', amount: typeof r.point === 'number' ? r.point : null, detail: r.guildId ?? '', by: null });
    return out.sort((a, b) => activityMillis(b.createdAt) - activityMillis(a.createdAt));
  }, [ql.data, ga.data, gp.data]);

  const columns: Column<ActivityRow>[] = [
    { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    {
      key: 'kind',
      header: '구분',
      render: (r) => <span className="text-xs text-zinc-400 bg-zinc-700/60 px-1.5 py-0.5 rounded">{ACTIVITY_KIND_LABELS[r.kind]}</span>,
    },
    { key: 'label', header: '내용', render: (r) => <span className="text-xs text-zinc-300">{r.label}</span> },
    {
      key: 'amount',
      header: '변동',
      render: (r) =>
        r.amount == null ? (
          <span className="text-zinc-600 text-xs">–</span>
        ) : (
          <span className={r.amount >= 0 ? 'text-emerald-400 font-mono text-xs' : 'text-red-400 font-mono text-xs'}>
            {formatSignedNumber(r.amount)}
          </span>
        ),
    },
    { key: 'detail', header: '상세', render: (r) => <span className="text-xs text-zinc-400 break-all">{r.detail || '–'}</span> },
    { key: 'by', header: '처리자', render: (r) => <CopyableId value={r.by} /> },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">코인·티켓·길드 행동·길드 점수 로그를 시간순으로 합쳤습니다(각 최대 50건).</p>
      <QueryState isLoading={isLoading} error={error}>
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="활동 내역이 없습니다" />
      </QueryState>
      <p className="text-xs text-zinc-600">
        ※ 권한/상태/요금제 변경 등 운영자 행동 이력은 «감사 로그» 페이지(admin_audit_logs)에서 확인하세요.
      </p>
    </div>
  );
}
