import { api, buildQuery } from './api';
import type {
  QStargramAdminListParams,
  QStargramAdminPost,
  QStargramReport,
  QStargramReportListParams,
  QStargramReportStatusPatch,
  QStargramStatusPatch,
} from '../types/qstargram';

export const qstargramAdminApi = {
  listPosts: (params: QStargramAdminListParams = {}) =>
    api
      .get<{ posts: QStargramAdminPost[] }>(`/api/admin/qstargram/posts${buildQuery({ ...params })}`)
      .then((r) => r.posts),

  listReports: (params: QStargramReportListParams = {}) =>
    api
      .get<{ reports: QStargramReport[] }>(`/api/admin/qstargram/reports${buildQuery({ ...params })}`)
      .then((r) => r.reports),

  updatePostStatus: (postId: string, payload: QStargramStatusPatch) =>
    api
      .patch<{ post: QStargramAdminPost }>(
        `/api/admin/qstargram/posts/${encodeURIComponent(postId)}/status`,
        payload,
      )
      .then((r) => r.post),

  updateReportStatus: (reportId: string, payload: QStargramReportStatusPatch) =>
    api
      .patch<{ report: QStargramReport }>(
        `/api/admin/qstargram/reports/${encodeURIComponent(reportId)}/status`,
        payload,
      )
      .then((r) => r.report),
};
