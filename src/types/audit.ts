/**
 * 통합 관리자 감사 로그 타입.
 *
 * 엔드포인트(QLapServices Admin API, super_admin 전용):
 *   GET /api/admin/logs/admin-audit?action=&actorUid=&targetUid=&limit=  → { ok, adminAuditLogs }
 *
 * 재화/아이템 로그만으로는 추적되지 않던 권한/상태/요금제/접근/길드/공지/시스템 변경까지
 * 모든 admin mutation 을 한 컬렉션(admin_audit_logs)에 기록한다.
 */
import type { IsoDate } from './common';

export interface AdminAuditLog {
  id: string;
  action: string;
  actorUid: string;
  targetUid?: string | null;
  targetGuildId?: string | null;
  targetId?: string | null;
  summary?: string | null;
  changes?: Record<string, unknown> | null;
  reason?: string | null;
  createdAt: IsoDate;
}

export interface AdminAuditFilter {
  action?: string;
  actorUid?: string;
  targetUid?: string;
  targetId?: string;
  limit?: number;
}
