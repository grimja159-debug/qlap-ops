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
