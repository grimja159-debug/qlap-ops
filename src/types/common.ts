/**
 * 여러 도메인이 공유하는 공통 타입.
 */
import type { IsoDateLike } from '../lib/format';

/** 백엔드가 ISO 문자열로 직렬화해 내려주는 날짜 필드(없으면 null). */
export type IsoDate = IsoDateLike;

/**
 * 운영자가 재화/아이템을 지급·차감할 때 항상 함께 보내야 하는 사유.
 * 백엔드가 reason(1~300자, 필수)을 검증하므로 폼에서도 필수로 다룬다.
 */
export interface ReasonInput {
  reason: string;
}
