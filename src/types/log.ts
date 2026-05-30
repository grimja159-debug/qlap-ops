/**
 * 운영 로그 타입.
 *
 * 엔드포인트 (QLapServices API/src/modules/guilds/guildRoutes.ts):
 *   GET /api/admin/logs/gmTiket?uid=&guildId=&seasonId=&type=&limit=   → { ok, gmTiketLogs }
 *   GET /api/admin/logs/qlCoin?...                                     → { ok, qlCoinLogs }
 *   GET /api/admin/logs/guildActions?...                              → { ok, guildActions }
 *   GET /api/admin/logs/guildPoints?...                               → { ok, guildPoints }
 *
 * [운영 로그로서의 한계 — 솔직하게 문서화]
 *  - 재화 로그(gmTiket/qlCoin)에는 createdBy(=조작한 운영자 uid)가 있어
 *    "누가 언제 얼마를" 추적이 가능하다. 이것이 가장 신뢰할 만한 감사 로그다.
 *  - 반면 role/status/plan/access 변경은 별도 감사 컬렉션에 기록되지 않는다
 *    (대상 문서의 updatedBy 만 갱신). 그래서 "모든 관리자 행동"을 한 곳에서
 *    보려면 백엔드에 admin_audit_logs 컬렉션/엔드포인트가 필요하다.
 *  - → ADMIN_GUIDE.md "필요한 추가 API" 참고.
 */
import type { IsoDate } from './common';

/** GM 티켓 / QL 코인 공통 재화 로그. 운영자 추적 핵심은 createdBy. */
export interface CurrencyLog {
  id: string;
  uid: string;
  amount: number;
  type: string;
  reason: string;
  beforeBalance: number;
  afterBalance: number;
  seasonId?: string | null;
  guildId?: string | null;
  createdAt: IsoDate;
  createdBy: string; // 변경을 일으킨 주체(운영자 uid 또는 system / 본인 uid)
}

/** 로그 조회 필터(쿼리스트링). */
export interface LogFilter {
  uid?: string;
  guildId?: string;
  seasonId?: string;
  type?: string;
  limit?: number;
}
