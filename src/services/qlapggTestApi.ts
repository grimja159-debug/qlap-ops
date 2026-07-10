import { api, buildQuery } from './api';
import type {
  ActAsResult,
  QlapggActionResult,
  QlapggExecutionLogsResponse,
  QlapggGuildJoinRequest,
  QlapggLiveCwJoinRequest,
  QlapggTestUsersResponse,
  QlapggTournamentJoinRequest,
} from '../types/testLab';

interface ListUsersOptions {
  batchId?: string;
  limit?: number;
}

interface ActAsRequest {
  uid: string;
  returnTo?: string;
}

const BASE_PATH = '/api/admin/test-lab/qlapgg';

export const qlapggTestApi = {
  listUsers: ({ batchId, limit = 300 }: ListUsersOptions = {}) =>
    api.get<QlapggTestUsersResponse>(`${BASE_PATH}/users${buildQuery({ batchId, limit })}`),
  logs: (limit = 30) =>
    api.get<QlapggExecutionLogsResponse>(`${BASE_PATH}/logs${buildQuery({ limit })}`),
  actAs: (body: ActAsRequest) => api.post<ActAsResult>(`${BASE_PATH}/impersonation-token`, body),
  guildJoin: (body: QlapggGuildJoinRequest) =>
    api.post<QlapggActionResult>(`${BASE_PATH}/guild-join`, body),
  liveCwJoin: (body: QlapggLiveCwJoinRequest) =>
    api.post<QlapggActionResult>(`${BASE_PATH}/live-cw-join`, body),
  tournamentJoin: (body: QlapggTournamentJoinRequest) =>
    api.post<QlapggActionResult>(`${BASE_PATH}/tournament-join`, body),
};
