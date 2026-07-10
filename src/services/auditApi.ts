/**
 * 통합 관리자 감사 로그 API (super_admin 전용).
 *
 * 엔드포인트: GET /api/admin/logs/admin-audit?action=&actorUid=&targetUid=&limit=  → { adminAuditLogs }
 *
 * 재화/아이템 로그만으로는 추적되지 않던 권한/상태/요금제/접근/길드/공지/시스템 변경까지
 * 모든 admin mutation 을 한 곳에서 본다.
 */
import { api, buildQuery } from './api';
import type { AdminAuditFilter, AdminAuditLog } from '../types/audit';

export const auditApi = {
  list: (filter: AdminAuditFilter = {}) =>
    api
      .get<{ adminAuditLogs: AdminAuditLog[] }>(`/api/admin/logs/admin-audit${buildQuery({ ...filter })}`)
      .then((r) => r.adminAuditLogs),
};
