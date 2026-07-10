/**
 * 도메인 상태값 → 배지 색상(tone) 매핑.
 *
 * [왜 분리했나] 색상 결정 로직을 페이지마다 if/삼항으로 흩뿌리지 않고 한 곳에 모아,
 * 상태가 추가돼도 여기만 고치면 전 화면 색상이 일관되게 유지된다.
 */
import type {
  UserStatus,
  SeasonStatus,
  GuildStatus,
  GuildMemberStatus,
  PlanId,
  BillingOrderStatus,
  BillingPaymentStatus,
  SubscriptionTier,
} from './constants';
import type { ServiceStatus } from '../types/system';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

export function userStatusTone(status: UserStatus): Tone {
  if (status === 'active') return 'success';
  if (status === 'banned') return 'danger';
  return 'neutral'; // deleted
}

export function seasonStatusTone(status: SeasonStatus): Tone {
  switch (status) {
    case 'active':
    case 'registration':
      return 'success';
    case 'point_collection':
      return 'info';
    case 'tournament':
      return 'accent';
    case 'ended':
      return 'neutral';
    case 'draft':
    default:
      return 'warning';
  }
}

export function guildStatusTone(status: GuildStatus): Tone {
  switch (status) {
    case 'active':
      return 'success';
    case 'locked':
      return 'warning';
    case 'banned':
      return 'danger';
    case 'disbanded':
    default:
      return 'neutral';
  }
}

export function memberStatusTone(status: GuildMemberStatus): Tone {
  switch (status) {
    case 'active':
      return 'success';
    case 'banned':
    case 'kicked':
      return 'danger';
    case 'left':
    default:
      return 'neutral';
  }
}

export function planTone(plan: PlanId): Tone {
  if (plan === 'pro_max') return 'accent';
  if (plan === 'pro') return 'info';
  return 'neutral';
}

export function serviceStatusTone(status: ServiceStatus): Tone {
  if (status === 'online') return 'success';
  if (status === 'degraded') return 'warning';
  return 'danger';
}

export function billingOrderStatusTone(status: BillingOrderStatus): Tone {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'MANUAL_REFUND_REQUIRED':
      return 'warning'; // 운영자 PG 수동 환불 액션 필요
    case 'FAILED':
      return 'danger';
    case 'REFUNDED':
      return 'info';
    case 'EXPIRED':
    case 'CANCELED_INTERNAL':
    case 'CANCELED':
    default:
      return 'neutral';
  }
}

export function billingPaymentStatusTone(status: BillingPaymentStatus): Tone {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'MANUAL_REFUND_REQUIRED':
      return 'warning';
    case 'FAILED':
      return 'danger';
    case 'CANCELED':
    default:
      return 'neutral';
  }
}

export function subscriptionTierTone(tier: SubscriptionTier): Tone {
  if (tier === 'ADMIN') return 'accent';
  if (tier === 'PRO') return 'info';
  return 'neutral';
}

export function dataSourceTone(source?: string | null): Tone {
  if (source === 'server_db') return 'success';
  if (source === 'firestore_fallback') return 'warning';
  if (source === 'server_db_empty') return 'neutral';
  return 'neutral';
}

export function dataSourceLabel(source?: string | null): string {
  if (source === 'server_db') return 'Server DB';
  if (source === 'server_db_empty') return 'Server DB empty';
  if (source === 'firestore_fallback') return 'Legacy fallback';
  return source && source.trim() ? source : 'Unknown';
}

export function dataSourceTitle(input: {
  source?: string | null;
  serverDbSource?: string | null;
  serverDbMirrorStatus?: string | null;
}): string {
  const detail = [input.serverDbSource, input.serverDbMirrorStatus].filter(Boolean).join(' / ');
  if (input.source === 'firestore_fallback') {
    return detail
      ? `Legacy fallback metadata: ${detail}`
      : 'Legacy fallback metadata. Server DB is the primary source; this row came from a legacy fallback path.';
  }
  return detail || dataSourceLabel(input.source);
}
