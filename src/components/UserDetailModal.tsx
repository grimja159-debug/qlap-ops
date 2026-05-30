import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { QueryState } from './QueryState';
import { StatusBadge } from './StatusBadge';
import { CopyableId } from './CopyableId';
import { ConfirmButton } from './ConfirmButton';
import { InlineMessage } from './InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { TextField, SelectField } from './Field';
import { ToggleSwitch } from './ToggleSwitch';
import { EconomyChangeForm } from './EconomyChangeForm';
import { ItemGrantForm } from './ItemGrantForm';
import { DataTable, type Column } from './DataTable';
import { userApi } from '../services/userApi';
import { logApi } from '../services/logApi';
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
import { formatDateTime, formatNumber, formatSignedNumber } from '../lib/format';
import type { AdminUser, UserAccessProfilePatch } from '../types/user';
import type { CurrencyLog } from '../types/log';

/**
 * 유저 상세/관리 모달.
 *
 * [구성] 운영자가 한 사용자에 대해 할 수 있는 거의 모든 작업을 탭으로 모았다.
 *  - 정보/수정 : 프로필 조회 + 권한(role)/요금제(plan)/본인인증/Riot 정보 수정 + 계정 정지/해제
 *  - 재화/아이템 : 코인·티켓 지급/차감, 아이템 지급
 *  - 활동 로그 : 이 UID 의 QL코인/GM티켓 로그(uid 필터)
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
            {tab === 'info' && <InfoTab key={String(user.updatedAt ?? user.uid)} user={user} />}
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

function InfoTab({ user }: { user: AdminUser }) {
  const qc = useQueryClient();

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

  const mutation = useMutation({
    mutationFn: (patch: UserAccessProfilePatch) => userApi.updateProfile(user.uid, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user', user.uid] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
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
                disabled={mutation.isPending}
                onConfirm={() => mutation.mutate({ status: 'banned' })}
              >
                계정 정지
              </ConfirmButton>
            ) : (
              <ConfirmButton
                tone="primary"
                confirmLabel="해제 확정"
                disabled={mutation.isPending}
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
        <Info label="GM 티켓">{formatNumber(user.gmTiketBalance)}</Info>
        <Info label="가입일">{formatDateTime(user.createdAt)}</Info>
        <Info label="수정일">{formatDateTime(user.updatedAt)}</Info>
        <Info label="최근 활동">{formatDateTime(user.lastSeenAt)}</Info>
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
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ role, plan })}
          className="mt-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
        >
          권한/요금제 저장
        </button>
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
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Riot 계정</h3>
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

/* ───────────────────────── 활동 로그 탭 ───────────────────────── */

function LogsTab({ uid }: { uid: string }) {
  const ql = useQuery({
    queryKey: ['logs', 'qlCoin', uid],
    queryFn: () => logApi.qlCoin({ uid, limit: 50 }),
  });
  const gm = useQuery({
    queryKey: ['logs', 'gmTiket', uid],
    queryFn: () => logApi.gmTiket({ uid, limit: 50 }),
  });

  const columns: Column<CurrencyLog>[] = [
    { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'type', header: '유형', render: (r) => <span className="text-xs text-zinc-400">{r.type}</span> },
    {
      key: 'amount',
      header: '변동',
      render: (r) => (
        <span className={r.amount >= 0 ? 'text-emerald-400 font-mono text-xs' : 'text-red-400 font-mono text-xs'}>
          {formatSignedNumber(r.amount)}
        </span>
      ),
    },
    { key: 'after', header: '잔액', render: (r) => <span className="font-mono text-xs text-zinc-300">{formatNumber(r.afterBalance)}</span> },
    { key: 'reason', header: '사유', render: (r) => <span className="text-xs text-zinc-400">{r.reason}</span> },
    { key: 'by', header: '처리자', render: (r) => <CopyableId value={r.createdBy} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">QL 코인 로그</h3>
        <QueryState isLoading={ql.isLoading} error={ql.error}>
          <DataTable columns={columns} data={ql.data ?? []} rowKey={(r) => r.id} emptyMessage="코인 로그 없음" />
        </QueryState>
      </div>
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">GM 티켓 로그</h3>
        <QueryState isLoading={gm.isLoading} error={gm.error}>
          <DataTable columns={columns} data={gm.data ?? []} rowKey={(r) => r.id} emptyMessage="티켓 로그 없음" />
        </QueryState>
      </div>
      <p className="text-xs text-zinc-600">
        ※ 권한/상태/요금제 변경 이력과 아이템 지급 이력은 별도 조회 API가 없어 여기에 표시되지 않습니다(ADMIN_GUIDE 참고).
      </p>
    </div>
  );
}
