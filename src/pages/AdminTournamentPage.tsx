import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmButton } from '../components/ConfirmButton';
import { DataTable, type Column } from '../components/DataTable';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/Field';
import { InlineMessage } from '../components/InlineMessage';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { errorToMessage } from '../lib/apiError';
import { formatDateTime, formatNumber, isoToLocalInput, localInputToIso } from '../lib/format';
import { tournamentAdminApi } from '../services/tournamentAdminApi';
import type {
  BracketType,
  EntryRequirement,
  EntryRequirementMode,
  Prize,
  PrizeType,
  SeedDefaultTournamentTemplatesResult,
  Tournament,
  TournamentInput,
  TournamentStatus,
  TournamentTemplate,
  TournamentTemplateInput,
} from '../types/tournament';

type TournamentTab = 'templates' | 'open' | 'manage';

const TABS: { key: TournamentTab; label: string }[] = [
  { key: 'templates', label: '템플릿 관리' },
  { key: 'open', label: '대회 열기' },
  { key: 'manage', label: '열린 대회 관리' },
];

const STATUS_OPTIONS: { value: TournamentStatus; label: string }[] = [
  { value: 'draft', label: '준비중' },
  { value: 'open', label: '모집중' },
  { value: 'in_progress', label: '진행중' },
  { value: 'finished', label: '종료' },
  { value: 'cancelled', label: '취소' },
];

const STATUS_FILTER_OPTIONS: { value: TournamentStatus | ''; label: string }[] = [
  { value: '', label: '전체 상태' },
  ...STATUS_OPTIONS,
];

const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: '준비중',
  open: '모집중',
  in_progress: '진행중',
  finished: '종료',
  cancelled: '취소',
};

const ENTRY_MODE_LABELS: Record<EntryRequirementMode, string> = {
  FREE: '무료 참가',
  TICKET: '티켓 참가',
  QLAP_COIN: 'QLapCoin 참가',
  PRO_ONLY: 'PRO 전용',
  CUSTOM: '기타 조건',
};

const PRIZE_TYPE_LABELS: Record<PrizeType, string> = {
  GUILD_POINT: '길드 포인트',
  QLAP_COIN: 'QLapCoin',
  TICKET: '이벤트/응모권 티켓',
  ITEM: '아이템',
  CASH_LIKE: '현금성 보상',
  CUSTOM: '기타 보상',
};

const BRACKET_OPTIONS: { value: BracketType; label: string }[] = [
  { value: 'single_elimination', label: '싱글 엘리미네이션' },
  { value: 'double_elimination', label: '더블 엘리미네이션' },
];

const DEFAULT_ENTRY: EntryRequirement = { mode: 'FREE', amount: 0, label: '무료 참가' };

const DEFAULT_PRIZES: Prize[] = [
  { rank: 1, type: 'GUILD_POINT', label: '길드 포인트 5000P + 추가 보상', amount: 5000, extraText: '추가 보상' },
  { rank: 2, type: 'GUILD_POINT', label: '길드 포인트 3000P', amount: 3000 },
  { rank: 3, type: 'GUILD_POINT', label: '길드 포인트 1000P', amount: 1000 },
];

function defaultTemplateForm(): TournamentTemplateInput {
  return {
    name: '',
    description: '',
    guildScoreLimit: 150,
    defaultEntryRequirement: { ...DEFAULT_ENTRY },
    defaultPrizes: DEFAULT_PRIZES.map((prize) => ({ ...prize })),
    bracketType: 'single_elimination',
    teamSize: 5,
    minGuilds: 2,
    maxGuilds: 16,
    isActive: true,
  };
}

function defaultTournamentForm(): TournamentInput {
  return {
    templateId: '',
    title: '',
    description: '',
    status: 'open',
    guildScoreLimit: 150,
    entryRequirement: { ...DEFAULT_ENTRY },
    prizes: DEFAULT_PRIZES.map((prize) => ({ ...prize })),
    bracketType: 'single_elimination',
    teamSize: 5,
    minGuilds: 2,
    maxGuilds: 16,
    registrationStartAt: '',
    registrationEndAt: '',
    tournamentStartAt: '',
    tournamentEndAt: '',
  };
}

function templateToForm(template: TournamentTemplate): TournamentTemplateInput {
  return {
    name: template.name,
    description: template.description ?? '',
    guildScoreLimit: template.guildScoreLimit,
    defaultEntryRequirement: { ...template.defaultEntryRequirement },
    defaultPrizes: template.defaultPrizes.map((prize) => ({ ...prize })),
    bracketType: template.bracketType,
    teamSize: template.teamSize,
    minGuilds: template.minGuilds,
    maxGuilds: template.maxGuilds,
    isActive: template.isActive,
  };
}

function templateToTournamentForm(template: TournamentTemplate): TournamentInput {
  return {
    templateId: template.id,
    title: template.name,
    description: template.description ?? '',
    status: 'open',
    guildScoreLimit: template.guildScoreLimit,
    entryRequirement: { ...template.defaultEntryRequirement },
    prizes: template.defaultPrizes.map((prize) => ({ ...prize })),
    bracketType: template.bracketType,
    teamSize: template.teamSize,
    minGuilds: template.minGuilds,
    maxGuilds: template.maxGuilds,
    registrationStartAt: '',
    registrationEndAt: '',
    tournamentStartAt: '',
    tournamentEndAt: '',
  };
}

function tournamentToForm(tournament: Tournament): TournamentInput {
  return {
    templateId: tournament.templateId,
    title: tournament.title,
    description: tournament.description ?? '',
    status: tournament.status,
    guildScoreLimit: tournament.guildScoreLimit,
    entryRequirement: { ...tournament.entryRequirement },
    prizes: tournament.prizes.map((prize) => ({ ...prize })),
    bracketType: tournament.bracketType,
    teamSize: tournament.teamSize,
    minGuilds: tournament.minGuilds,
    maxGuilds: tournament.maxGuilds,
    registrationStartAt: tournament.registrationStartAt ?? '',
    registrationEndAt: tournament.registrationEndAt ?? '',
    tournamentStartAt: tournament.tournamentStartAt ?? '',
    tournamentEndAt: tournament.tournamentEndAt ?? '',
  };
}

function statusTone(status: TournamentStatus): 'success' | 'accent' | 'warning' | 'danger' | 'neutral' {
  if (status === 'open') return 'success';
  if (status === 'in_progress') return 'accent';
  if (status === 'cancelled') return 'danger';
  if (status === 'draft') return 'warning';
  return 'neutral';
}

function entryLabel(entry: EntryRequirement): string {
  const base = entry.label?.trim() || ENTRY_MODE_LABELS[entry.mode];
  if (entry.amount == null || entry.amount === 0) return base;
  return `${base} (${formatNumber(entry.amount)})`;
}

function prizeSummary(prizes: Prize[]): string {
  if (!prizes.length) return '보상 없음';
  return prizes
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((prize) => `${prize.rank}위 ${prize.label}`)
    .join(' / ');
}

function validCompetitionShape(form: Pick<TournamentInput, 'title' | 'guildScoreLimit' | 'teamSize' | 'minGuilds' | 'maxGuilds' | 'prizes'>) {
  return (
    form.title.trim().length >= 2 &&
    Number.isFinite(form.guildScoreLimit) &&
    form.guildScoreLimit >= 1 &&
    Number.isFinite(form.teamSize) &&
    form.teamSize >= 1 &&
    Number.isFinite(form.minGuilds) &&
    Number.isFinite(form.maxGuilds) &&
    form.minGuilds >= 1 &&
    form.maxGuilds >= form.minGuilds &&
    form.prizes.every((prize) => prize.rank >= 1 && prize.label.trim().length > 0)
  );
}

export function AdminTournamentPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TournamentTab>('templates');
  const [editingTemplate, setEditingTemplate] = useState<TournamentTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<TournamentTemplateInput>(() => defaultTemplateForm());
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [openForm, setOpenForm] = useState<TournamentInput>(() => defaultTournamentForm());
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [tournamentForm, setTournamentForm] = useState<TournamentInput | null>(null);
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | ''>('');
  const [limit, setLimit] = useState(100);

  const templatesQuery = useQuery({ queryKey: ['tournament-templates'], queryFn: tournamentAdminApi.listTemplates });
  const tournamentsQuery = useQuery({
    queryKey: ['admin-tournaments', statusFilter, limit],
    queryFn: () => tournamentAdminApi.listTournaments({ limit, status: statusFilter }),
  });
  const publicListQuery = useQuery({ queryKey: ['public-tournaments-check'], queryFn: tournamentAdminApi.verifyPublicList });

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const tournaments = useMemo(() => tournamentsQuery.data ?? [], [tournamentsQuery.data]);
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplateId), [selectedTemplateId, templates]);

  const invalidateTournamentData = () => {
    void qc.invalidateQueries({ queryKey: ['tournament-templates'] });
    void qc.invalidateQueries({ queryKey: ['admin-tournaments'] });
    void qc.invalidateQueries({ queryKey: ['public-tournaments-check'] });
  };

  const seedMutation = useMutation({
    mutationFn: tournamentAdminApi.seedDefaultTemplates,
    onSuccess: invalidateTournamentData,
  });
  const createTemplateMutation = useMutation({
    mutationFn: tournamentAdminApi.createTemplate,
    onSuccess: (template) => {
      setEditingTemplate(null);
      setTemplateForm(defaultTemplateForm());
      setSelectedTemplateId(template.id);
      setOpenForm(templateToTournamentForm(template));
      invalidateTournamentData();
    },
  });
  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TournamentTemplateInput }) => tournamentAdminApi.updateTemplate(id, input),
    onSuccess: (template) => {
      setEditingTemplate(null);
      setTemplateForm(defaultTemplateForm());
      setSelectedTemplateId(template.id);
      setOpenForm(templateToTournamentForm(template));
      invalidateTournamentData();
    },
  });
  const openMutation = useMutation({
    mutationFn: (input: TournamentInput & { templateId: string }) => tournamentAdminApi.openFromTemplate(input),
    onSuccess: () => {
      invalidateTournamentData();
      setTab('manage');
    },
  });
  const updateTournamentMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TournamentInput }) => tournamentAdminApi.updateTournament(id, input),
    onSuccess: () => {
      setEditingTournament(null);
      setTournamentForm(null);
      invalidateTournamentData();
    },
  });
  const cancelTournamentMutation = useMutation({
    mutationFn: tournamentAdminApi.cancelTournament,
    onSuccess: invalidateTournamentData,
  });

  const handleTemplateSubmit = () => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, input: templateForm });
      return;
    }
    createTemplateMutation.mutate(templateForm);
  };

  const selectTemplateForOpen = (template: TournamentTemplate) => {
    setSelectedTemplateId(template.id);
    setOpenForm(templateToTournamentForm(template));
    setTab('open');
  };

  const handleOpenTournament = () => {
    if (!selectedTemplateId) return;
    openMutation.mutate({ ...openForm, templateId: selectedTemplateId });
  };

  const summary = useMemo(
    () => ({
      open: tournaments.filter((item) => item.status === 'open').length,
      progress: tournaments.filter((item) => item.status === 'in_progress').length,
      done: tournaments.filter((item) => item.status === 'finished' || item.status === 'cancelled').length,
    }),
    [tournaments],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">QLapGG 멸망전 관리</h2>
        <p className="text-sm text-zinc-400">
          템플릿은 유저 페이지에 바로 노출되지 않고, 템플릿으로 실제 멸망전을 열면 qlapgg 랭킹/대회 목록에 표시됩니다.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCell label="템플릿" value={formatNumber(templates.length)} />
        <StatCell label="모집중" value={formatNumber(summary.open)} tone="text-emerald-400" />
        <StatCell label="진행중" value={formatNumber(summary.progress)} tone="text-violet-300" />
        <StatCell label="종료/취소" value={formatNumber(summary.done)} tone="text-zinc-300" />
      </div>

      <PageSection
        title="작업"
        right={
          <div className="flex flex-wrap gap-1">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={
                  tab === item.key
                    ? 'rounded border border-violet-500/50 bg-violet-600/20 px-2.5 py-1 text-xs text-violet-300'
                    : 'rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300'
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      >
        {tab === 'templates' && (
          <TemplateTab
            templates={templates}
            loading={templatesQuery.isLoading}
            error={templatesQuery.error}
            editingTemplate={editingTemplate}
            form={templateForm}
            setForm={setTemplateForm}
            onEdit={(template) => {
              setEditingTemplate(template);
              setTemplateForm(templateToForm(template));
            }}
            onOpen={selectTemplateForOpen}
            onNew={() => {
              setEditingTemplate(null);
              setTemplateForm(defaultTemplateForm());
            }}
            onSubmit={handleTemplateSubmit}
            onSeed={() => seedMutation.mutate()}
            seedPending={seedMutation.isPending}
            submitPending={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            seedResult={seedMutation}
            submitResult={editingTemplate ? updateTemplateMutation : createTemplateMutation}
          />
        )}

        {tab === 'open' && (
          <OpenTournamentTab
            templates={templates}
            selectedTemplate={selectedTemplate}
            selectedTemplateId={selectedTemplateId}
            form={openForm}
            setForm={setOpenForm}
            onSelectTemplate={(templateId) => {
              const template = templates.find((item) => item.id === templateId);
              setSelectedTemplateId(templateId);
              if (template) setOpenForm(templateToTournamentForm(template));
            }}
            onSubmit={handleOpenTournament}
            pending={openMutation.isPending}
            mutation={openMutation}
          />
        )}

        {tab === 'manage' && (
          <ManageTournamentTab
            tournaments={tournaments}
            loading={tournamentsQuery.isLoading}
            error={tournamentsQuery.error}
            publicList={publicListQuery.data ?? []}
            publicListError={publicListQuery.error}
            editingTournament={editingTournament}
            form={tournamentForm}
            setForm={setTournamentForm}
            statusFilter={statusFilter}
            limit={limit}
            onStatusFilter={setStatusFilter}
            onLimit={setLimit}
            onRefresh={() => invalidateTournamentData()}
            onEdit={(tournament) => {
              setEditingTournament(tournament);
              setTournamentForm(tournamentToForm(tournament));
            }}
            onCancelEdit={() => {
              setEditingTournament(null);
              setTournamentForm(null);
            }}
            onSubmit={() => {
              if (!editingTournament || !tournamentForm) return;
              updateTournamentMutation.mutate({ id: editingTournament.id, input: tournamentForm });
            }}
            onCancelTournament={(id) => cancelTournamentMutation.mutate(id)}
            updatePending={updateTournamentMutation.isPending}
            cancelPending={cancelTournamentMutation.isPending}
            updateResult={updateTournamentMutation}
            cancelResult={cancelTournamentMutation}
          />
        )}
      </PageSection>
    </div>
  );
}

function TemplateTab({
  templates,
  loading,
  error,
  editingTemplate,
  form,
  setForm,
  onEdit,
  onOpen,
  onNew,
  onSubmit,
  onSeed,
  seedPending,
  submitPending,
  seedResult,
  submitResult,
}: {
  templates: TournamentTemplate[];
  loading: boolean;
  error: unknown;
  editingTemplate: TournamentTemplate | null;
  form: TournamentTemplateInput;
  setForm: (form: TournamentTemplateInput) => void;
  onEdit: (template: TournamentTemplate) => void;
  onOpen: (template: TournamentTemplate) => void;
  onNew: () => void;
  onSubmit: () => void;
  onSeed: () => void;
  seedPending: boolean;
  submitPending: boolean;
  seedResult: { isError: boolean; isSuccess: boolean; error: unknown; data?: SeedDefaultTournamentTemplatesResult };
  submitResult: { isError: boolean; isSuccess: boolean; error: unknown };
}) {
  const valid = validCompetitionShape({ ...form, title: form.name, prizes: form.defaultPrizes });
  const columns: Column<TournamentTemplate>[] = [
    { key: 'name', header: '템플릿', render: (row) => <span className="font-medium text-zinc-200">{row.name}</span> },
    { key: 'score', header: '점수 제한', render: (row) => <span>{formatNumber(row.guildScoreLimit)}점</span> },
    { key: 'entry', header: '참가 조건', render: (row) => <span className="text-xs text-zinc-400">{entryLabel(row.defaultEntryRequirement)}</span> },
    {
      key: 'guilds',
      header: '길드 수',
      render: (row) => <span className="text-xs text-zinc-400">{row.minGuilds}~{row.maxGuilds}</span>,
    },
    {
      key: 'active',
      header: '상태',
      render: (row) => <StatusBadge label={row.isActive ? '활성' : '비활성'} tone={row.isActive ? 'success' : 'neutral'} />,
    },
    {
      key: 'actions',
      header: '작업',
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => onEdit(row)} className="text-xs text-violet-300 hover:text-violet-200">
            수정
          </button>
          <button
            type="button"
            onClick={() => onOpen(row)}
            disabled={!row.isActive}
            className="text-xs text-emerald-300 hover:text-emerald-200 disabled:text-zinc-600"
          >
            대회 열기
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ConfirmButton tone="primary" confirmLabel="기본 템플릿 생성" disabled={seedPending} onConfirm={onSeed}>
            {seedPending ? '생성 중...' : '기본 멸망전 템플릿 생성'}
          </ConfirmButton>
          <button type="button" onClick={onNew} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
            새 템플릿 만들기
          </button>
        </div>
        {seedResult.isError && <InlineMessage kind="error">{errorToMessage(seedResult.error)}</InlineMessage>}
        {seedResult.isSuccess && seedResult.data && (
          <InlineMessage kind="success">
            기본 템플릿 반영 완료: 신규 {seedResult.data.created}개, 갱신 {seedResult.data.updated}개
          </InlineMessage>
        )}
        <QueryState isLoading={loading} error={error}>
          <DataTable columns={columns} data={templates} rowKey={(row) => row.id} emptyMessage="등록된 멸망전 템플릿이 없습니다." />
        </QueryState>
      </div>

      <SubPanel title={editingTemplate ? '템플릿 수정' : '새 템플릿'}>
        <TemplateForm form={form} setForm={setForm} />
        {!valid && <InlineMessage kind="warning">템플릿 이름, 점수 제한, 길드 수, 보상명을 확인하세요.</InlineMessage>}
        <div className="flex items-center gap-2">
          <ConfirmButton
            tone="primary"
            confirmLabel={editingTemplate ? '템플릿 수정 확정' : '템플릿 생성 확정'}
            disabled={submitPending || !valid}
            onConfirm={onSubmit}
          >
            {submitPending ? '저장 중...' : editingTemplate ? '템플릿 수정' : '템플릿 생성'}
          </ConfirmButton>
          {editingTemplate && (
            <button type="button" onClick={onNew} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
              취소
            </button>
          )}
        </div>
        {submitResult.isError && <InlineMessage kind="error">{errorToMessage(submitResult.error)}</InlineMessage>}
        {submitResult.isSuccess && <InlineMessage kind="success">템플릿 저장 완료</InlineMessage>}
      </SubPanel>
    </div>
  );
}

function OpenTournamentTab({
  templates,
  selectedTemplate,
  selectedTemplateId,
  form,
  setForm,
  onSelectTemplate,
  onSubmit,
  pending,
  mutation,
}: {
  templates: TournamentTemplate[];
  selectedTemplate: TournamentTemplate | undefined;
  selectedTemplateId: string;
  form: TournamentInput;
  setForm: (form: TournamentInput) => void;
  onSelectTemplate: (templateId: string) => void;
  onSubmit: () => void;
  pending: boolean;
  mutation: { isError: boolean; isSuccess: boolean; error: unknown; data?: Tournament };
}) {
  const valid = selectedTemplateId !== '' && validCompetitionShape(form);

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <SubPanel title="템플릿 선택">
        <SelectField
          label="템플릿"
          value={selectedTemplateId}
          onChange={onSelectTemplate}
          options={[
            { value: '', label: '템플릿 선택' },
            ...templates.filter((template) => template.isActive).map((template) => ({ value: template.id, label: template.name })),
          ]}
        />
        {selectedTemplate ? (
          <div className="space-y-1 rounded border border-zinc-700/60 bg-zinc-900/40 p-3 text-xs text-zinc-400">
            <p className="font-medium text-zinc-200">{selectedTemplate.name}</p>
            <p>점수 제한 {formatNumber(selectedTemplate.guildScoreLimit)}점</p>
            <p>참가 조건 {entryLabel(selectedTemplate.defaultEntryRequirement)}</p>
            <p>기본 보상 {prizeSummary(selectedTemplate.defaultPrizes)}</p>
          </div>
        ) : (
          <InlineMessage kind="info">템플릿을 먼저 만들거나 기본 템플릿을 생성해 주세요.</InlineMessage>
        )}
      </SubPanel>

      <SubPanel title="실제 멸망전 열기">
        <TournamentForm form={form} setForm={setForm} />
        {!valid && <InlineMessage kind="warning">템플릿, 제목, 길드 수, 보상 정보를 확인하세요.</InlineMessage>}
        <ConfirmButton tone="primary" confirmLabel="멸망전 열기 확정" disabled={pending || !valid} onConfirm={onSubmit}>
          {pending ? '여는 중...' : '멸망전 열기'}
        </ConfirmButton>
        {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
        {mutation.isSuccess && mutation.data && <InlineMessage kind="success">멸망전 생성 완료: {mutation.data.title}</InlineMessage>}
      </SubPanel>
    </div>
  );
}

function ManageTournamentTab({
  tournaments,
  loading,
  error,
  publicList,
  publicListError,
  editingTournament,
  form,
  setForm,
  statusFilter,
  limit,
  onStatusFilter,
  onLimit,
  onRefresh,
  onEdit,
  onCancelEdit,
  onSubmit,
  onCancelTournament,
  updatePending,
  cancelPending,
  updateResult,
  cancelResult,
}: {
  tournaments: Tournament[];
  loading: boolean;
  error: unknown;
  publicList: Tournament[];
  publicListError: unknown;
  editingTournament: Tournament | null;
  form: TournamentInput | null;
  setForm: (form: TournamentInput) => void;
  statusFilter: TournamentStatus | '';
  limit: number;
  onStatusFilter: (status: TournamentStatus | '') => void;
  onLimit: (limit: number) => void;
  onRefresh: () => void;
  onEdit: (tournament: Tournament) => void;
  onCancelEdit: () => void;
  onSubmit: () => void;
  onCancelTournament: (id: string) => void;
  updatePending: boolean;
  cancelPending: boolean;
  updateResult: { isError: boolean; isSuccess: boolean; error: unknown };
  cancelResult: { isError: boolean; isSuccess: boolean; error: unknown };
}) {
  const publicIds = new Set(publicList.map((item) => item.id));
  const validEdit = form != null && validCompetitionShape(form);
  const columns: Column<Tournament>[] = [
    { key: 'title', header: '대회', render: (row) => <span className="font-medium text-zinc-200">{row.title}</span> },
    { key: 'status', header: '상태', render: (row) => <StatusBadge label={STATUS_LABELS[row.status]} tone={statusTone(row.status)} /> },
    { key: 'score', header: '제한', render: (row) => <span>{formatNumber(row.guildScoreLimit)}점</span> },
    {
      key: 'guilds',
      header: '참가',
      render: (row) => <span className="text-xs text-zinc-400">{formatNumber(row.registeredGuildCount)} / {formatNumber(row.maxGuilds)}</span>,
    },
    {
      key: 'start',
      header: '시작',
      render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.tournamentStartAt)}</span>,
    },
    {
      key: 'visible',
      header: '유저 노출',
      render: (row) => <StatusBadge label={publicIds.has(row.id) ? '표시중' : '미확인'} tone={publicIds.has(row.id) ? 'success' : 'neutral'} />,
    },
    {
      key: 'actions',
      header: '작업',
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => onEdit(row)} className="text-xs text-violet-300 hover:text-violet-200">
            수정
          </button>
          <ConfirmButton
            tone="danger"
            confirmLabel="대회 취소 확정"
            disabled={cancelPending || row.status === 'cancelled' || row.status === 'finished'}
            onConfirm={() => onCancelTournament(row.id)}
          >
            취소
          </ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <SelectField label="상태 필터" value={statusFilter} onChange={(value) => onStatusFilter(value as TournamentStatus | '')} options={STATUS_FILTER_OPTIONS} className="w-40" />
          <SelectField
            label="로드 수"
            value={String(limit)}
            onChange={(value) => onLimit(Number(value))}
            options={[50, 100, 200].map((value) => ({ value: String(value), label: `${value}개` }))}
            className="w-32"
          />
          <button type="button" onClick={onRefresh} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
            새로고침
          </button>
        </div>
        {publicListError ? (
          <InlineMessage kind="warning">유저 노출 확인 API를 불러오지 못했습니다: {errorToMessage(publicListError)}</InlineMessage>
        ) : null}
        <QueryState isLoading={loading} error={error}>
          <DataTable columns={columns} data={tournaments} rowKey={(row) => row.id} emptyMessage="열린 멸망전이 없습니다." />
        </QueryState>
      </div>

      <SubPanel title={editingTournament ? '대회 수정' : '대회 상세'}>
        {editingTournament && form ? (
          <>
            <TournamentForm form={form} setForm={setForm} />
            {!validEdit && <InlineMessage kind="warning">제목, 길드 수, 보상 정보를 확인하세요.</InlineMessage>}
            <div className="flex items-center gap-2">
              <ConfirmButton tone="primary" confirmLabel="대회 수정 확정" disabled={updatePending || !validEdit} onConfirm={onSubmit}>
                {updatePending ? '저장 중...' : '대회 수정'}
              </ConfirmButton>
              <button type="button" onClick={onCancelEdit} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
                취소
              </button>
            </div>
          </>
        ) : (
          <InlineMessage kind="info">목록에서 수정할 멸망전을 선택하세요.</InlineMessage>
        )}
        {updateResult.isError && <InlineMessage kind="error">{errorToMessage(updateResult.error)}</InlineMessage>}
        {updateResult.isSuccess && <InlineMessage kind="success">대회 수정 완료</InlineMessage>}
        {cancelResult.isError && <InlineMessage kind="error">{errorToMessage(cancelResult.error)}</InlineMessage>}
        {cancelResult.isSuccess && <InlineMessage kind="success">대회 취소 완료</InlineMessage>}
      </SubPanel>
    </div>
  );
}

function TemplateForm({ form, setForm }: { form: TournamentTemplateInput; setForm: (form: TournamentTemplateInput) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="템플릿 이름" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <NumberField label="길드 점수 제한" value={form.guildScoreLimit} min={1} onChange={(guildScoreLimit) => setForm({ ...form, guildScoreLimit })} required />
        <SelectField label="브래킷" value={form.bracketType} onChange={(bracketType) => setForm({ ...form, bracketType: bracketType as BracketType })} options={BRACKET_OPTIONS} />
        <NumberField label="팀 인원" value={form.teamSize} min={1} onChange={(teamSize) => setForm({ ...form, teamSize })} />
        <NumberField label="최소 길드 수" value={form.minGuilds} min={1} onChange={(minGuilds) => setForm({ ...form, minGuilds })} />
        <NumberField label="최대 길드 수" value={form.maxGuilds} min={1} onChange={(maxGuilds) => setForm({ ...form, maxGuilds })} />
      </div>
      <TextAreaField label="설명" value={form.description ?? ''} onChange={(description) => setForm({ ...form, description })} rows={2} />
      <ToggleSwitch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} label="템플릿 활성" />
      <EntryRequirementEditor label="기본 참가 조건" value={form.defaultEntryRequirement} onChange={(defaultEntryRequirement) => setForm({ ...form, defaultEntryRequirement })} />
      <PrizeEditor prizes={form.defaultPrizes} onChange={(defaultPrizes) => setForm({ ...form, defaultPrizes })} />
    </div>
  );
}

function TournamentForm({ form, setForm }: { form: TournamentInput; setForm: (form: TournamentInput) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="대회 제목" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
        <SelectField label="상태" value={form.status} onChange={(status) => setForm({ ...form, status: status as TournamentStatus })} options={STATUS_OPTIONS} />
        <NumberField label="길드 점수 제한" value={form.guildScoreLimit} min={1} onChange={(guildScoreLimit) => setForm({ ...form, guildScoreLimit })} required />
        <NumberField label="최대 참가 길드 수" value={form.maxGuilds} min={1} onChange={(maxGuilds) => setForm({ ...form, maxGuilds })} />
        <NumberField label="최소 길드 수" value={form.minGuilds} min={1} onChange={(minGuilds) => setForm({ ...form, minGuilds })} />
        <NumberField label="팀 인원" value={form.teamSize} min={1} onChange={(teamSize) => setForm({ ...form, teamSize })} />
        <SelectField label="브래킷" value={form.bracketType} onChange={(bracketType) => setForm({ ...form, bracketType: bracketType as BracketType })} options={BRACKET_OPTIONS} />
      </div>
      <TextAreaField label="설명" value={form.description ?? ''} onChange={(description) => setForm({ ...form, description })} rows={2} />
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="모집 시작일" type="datetime-local" value={isoToLocalInput(form.registrationStartAt)} onChange={(value) => setForm({ ...form, registrationStartAt: localInputToIso(value) ?? '' })} />
        <TextField label="모집 마감일" type="datetime-local" value={isoToLocalInput(form.registrationEndAt)} onChange={(value) => setForm({ ...form, registrationEndAt: localInputToIso(value) ?? '' })} />
        <TextField label="대회 시작일" type="datetime-local" value={isoToLocalInput(form.tournamentStartAt)} onChange={(value) => setForm({ ...form, tournamentStartAt: localInputToIso(value) ?? '' })} />
        <TextField label="대회 종료일" type="datetime-local" value={isoToLocalInput(form.tournamentEndAt)} onChange={(value) => setForm({ ...form, tournamentEndAt: localInputToIso(value) ?? '' })} />
      </div>
      <EntryRequirementEditor label="참가 조건" value={form.entryRequirement} onChange={(entryRequirement) => setForm({ ...form, entryRequirement })} />
      <PrizeEditor prizes={form.prizes} onChange={(prizes) => setForm({ ...form, prizes })} />
    </div>
  );
}

function EntryRequirementEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: EntryRequirement;
  onChange: (value: EntryRequirement) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-700/60 bg-zinc-900/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <SelectField
          label="조건"
          value={value.mode}
          onChange={(mode) => {
            const nextMode = mode as EntryRequirementMode;
            onChange({
              ...value,
              mode: nextMode,
              amount: nextMode === 'FREE' ? 0 : value.amount ?? 0,
              label: value.label || ENTRY_MODE_LABELS[nextMode],
            });
          }}
          options={Object.entries(ENTRY_MODE_LABELS).map(([mode, modeLabel]) => ({ value: mode, label: modeLabel }))}
        />
        <NumberField label="참가비/수량" value={value.amount ?? 0} min={0} onChange={(amount) => onChange({ ...value, amount })} />
        <TextField label="라벨" value={value.label ?? ''} onChange={(entryLabelValue) => onChange({ ...value, label: entryLabelValue })} />
      </div>
      <TextAreaField label="설명" value={value.description ?? ''} onChange={(description) => onChange({ ...value, description })} rows={2} />
    </div>
  );
}

function PrizeEditor({ prizes, onChange }: { prizes: Prize[]; onChange: (prizes: Prize[]) => void }) {
  const updatePrize = (index: number, patch: Partial<Prize>) => {
    onChange(prizes.map((prize, prizeIndex) => (prizeIndex === index ? { ...prize, ...patch } : prize)));
  };

  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-700/60 bg-zinc-900/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">보상</p>
        <button
          type="button"
          onClick={() => onChange([...prizes, { rank: prizes.length + 1, type: 'CUSTOM', label: '', amount: 0 }])}
          className="text-xs text-violet-300 hover:text-violet-200"
        >
          보상 추가
        </button>
      </div>
      {prizes.map((prize, index) => (
        <div key={`${prize.rank}-${index}`} className="grid items-end gap-2 md:grid-cols-[80px_160px_1fr_120px_1fr_auto]">
          <NumberField label="순위" value={prize.rank} min={1} onChange={(rank) => updatePrize(index, { rank })} />
          <SelectField
            label="종류"
            value={prize.type}
            onChange={(type) => updatePrize(index, { type: type as PrizeType })}
            options={Object.entries(PRIZE_TYPE_LABELS).map(([type, typeLabel]) => ({ value: type, label: typeLabel }))}
          />
          <TextField label="라벨" value={prize.label} onChange={(label) => updatePrize(index, { label })} />
          <NumberField label="수량" value={prize.amount ?? 0} min={0} onChange={(amount) => updatePrize(index, { amount })} />
          <TextField label="추가 문구" value={prize.extraText ?? ''} onChange={(extraText) => updatePrize(index, { extraText })} />
          <button
            type="button"
            onClick={() => onChange(prizes.filter((_, prizeIndex) => prizeIndex !== index))}
            className="h-[34px] rounded bg-zinc-800 px-2 text-xs text-red-300 hover:bg-red-500/10"
          >
            삭제
          </button>
        </div>
      ))}
    </div>
  );
}

function StatCell({ label, value, tone = 'text-zinc-200' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function SubPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-700/60 bg-zinc-900/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      {children}
    </div>
  );
}
