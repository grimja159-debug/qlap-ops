import { api, buildQuery, getApiBaseUrl } from './api';
import { getTournamentApiBaseUrl, tournamentAdminApi, type TournamentDbInspector } from './tournamentAdminApi';

export type DbInspectorSource = 'services' | 'tournament';

export interface ServicesDbTableSummary {
  table: string;
  label: string;
  count: number;
  latestCreatedAt: string | null;
  latestUpdatedAt: string | null;
}

export interface ServicesDbInspectorRow {
  table: string;
  id: string;
  uid: string | null;
  status: string | null;
  type: string | null;
  amount: number | null;
  balanceAfter: number | null;
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  payload: Record<string, unknown>;
}

export interface ServicesDbInspector {
  service: 'QLapServices';
  storage: 'server-db';
  dbPath: string;
  generatedAt: string;
  selectedTable: string;
  selectedId: string | null;
  selectedUid: string | null;
  limit: number;
  totalRows: number;
  tables: ServicesDbTableSummary[];
  rows: ServicesDbInspectorRow[];
  sqliteHealth: ServicesSqliteHealth;
  xml: string;
  guide: Array<{ title: string; description: string }>;
}

export interface ServicesSqliteHealth {
  checkedAt: string;
  dbPath: string;
  dbSizeBytes: number | null;
  walPath: string;
  walSizeBytes: number | null;
  shmPath: string;
  shmSizeBytes: number | null;
  journalMode: string | null;
  synchronous: string | null;
  foreignKeys: number | null;
  busyTimeoutMs: number | null;
  pageCount: number | null;
  pageSize: number | null;
  quickCheck: string | null;
  integrityCheck: string | null;
  latestBackup: ServicesSqliteBackupStatus;
  status: 'OK' | 'WARN';
  warnings: string[];
}

export interface ServicesSqliteBackupStatus {
  label: 'shared';
  backupRoot: string;
  latestPath: string | null;
  latestSizeBytes: number | null;
  latestModifiedAt: string | null;
  ageSeconds: number | null;
  warnAgeHours: number;
  status: 'OK' | 'WARN';
  warning: string | null;
}

export type AnyDbInspector = TournamentDbInspector | ServicesDbInspector;
export type AnyDbInspectorRow = TournamentDbInspector['rows'][number] | ServicesDbInspectorRow;

type Envelope<T> = T & { ok?: boolean };

export function getDbInspectorDebugEndpoint(source: DbInspectorSource): string {
  if (source === 'services') {
    return `${getApiBaseUrl()}/api/admin/db-inspector/services`;
  }
  return `${getTournamentApiBaseUrl()}/api/admin/db-inspector/tournament`;
}

export const dbInspectorApi = {
  getTournament: (params: { collection?: string | null; id?: string | null; limit?: number }) =>
    tournamentAdminApi.getDbInspector(params),

  getServices: (params: { table?: string | null; id?: string | null; uid?: string | null; limit?: number }) =>
    api
      .get<Envelope<{ inspector: ServicesDbInspector }>>(
        `/api/admin/db-inspector/services${buildQuery({
          table: params.table || undefined,
          id: params.id || undefined,
          uid: params.uid || undefined,
          limit: params.limit ?? 50,
        })}`,
      )
      .then((response) => response.inspector),
};
