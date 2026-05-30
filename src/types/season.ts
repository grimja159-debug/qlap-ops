/**
 * 시즌 타입.
 *
 * 엔드포인트 (QLapServices API/src/modules/guilds/guildRoutes.ts):
 *   GET   /api/admin/seasons        → { ok, seasons: Season[] }
 *   GET   /api/admin/seasons/:id     → { ok, season }
 *   POST  /api/admin/seasons         → { ok, season }   (생성: 모든 필드 필수)
 *   PATCH /api/admin/seasons/:id      → { ok, season }   (부분 수정: 보낸 필드만)
 *
 * 날짜 필드는 ISO 문자열로 주고받는다(백엔드 readTimestamp 가 new Date()로 파싱).
 * '시즌 종료'는 별도 API가 아니라 PATCH 로 status='ended' 를 보내는 것이다.
 */
import type { IsoDate } from './common';
import type { SeasonStatus } from '../lib/constants';

export interface Season {
  id: string;
  seasonId: string;
  title: string;
  status: SeasonStatus;

  // 길드 생성/가입 기간
  guildCreateStartAt: IsoDate;
  guildCreateEndAt: IsoDate;
  guildJoinStartAt: IsoDate;
  guildJoinEndAt: IsoDate;

  // 점수 집계 기간
  pointCollectStartAt: IsoDate;
  pointCollectEndAt: IsoDate;

  // 토너먼트 기간 / 진출 순위 범위
  tournamentStartAt: IsoDate;
  tournamentEndAt: IsoDate;
  tournamentRankMin: number;
  tournamentRankMax: number;

  // 참가 조건
  requireGmTiketForCreate: boolean;
  requireGmTiketForJoin: boolean;
  requireIdentityVerification: boolean;
  requireRiotAccount: boolean;

  // 상금
  prizeRevenuePercent: number;
  prizeRuleText: string;

  createdAt: IsoDate;
  updatedAt: IsoDate;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * 시즌 생성 본문. 백엔드 buildSeasonPayload(raw, false) 가 모든 필드를 필수로 검증한다.
 * 날짜는 ISO 문자열.
 */
export interface SeasonCreateRequest {
  seasonId: string; // 1~40자, [A-Za-z0-9_-]
  title: string; // 1~80자
  status: SeasonStatus;
  guildCreateStartAt: string;
  guildCreateEndAt: string;
  guildJoinStartAt: string;
  guildJoinEndAt: string;
  pointCollectStartAt: string;
  pointCollectEndAt: string;
  tournamentStartAt: string;
  tournamentEndAt: string;
  tournamentRankMin: number;
  tournamentRankMax: number;
  requireGmTiketForCreate: boolean;
  requireGmTiketForJoin: boolean;
  requireIdentityVerification: boolean;
  requireRiotAccount: boolean;
  prizeRevenuePercent: number;
  prizeRuleText: string;
}

/** 시즌 수정 본문(부분). seasonId 는 무시된다. */
export type SeasonUpdateRequest = Partial<Omit<SeasonCreateRequest, 'seasonId'>>;
