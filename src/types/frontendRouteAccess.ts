import type { PlanId, UserRole } from '../lib/constants';

export interface FrontendRoutePolicy {
  id: string;
  path: string;
  label: string;
  enabled: boolean;
  showInSidebar: boolean;
  requiresAuth: boolean;
  comingSoon: boolean;
  allowedPlans: PlanId[];
  allowedRoles: UserRole[];
  lockedMessage: string | null;
}

export interface FrontendRouteAccessSettings {
  routes: FrontendRoutePolicy[];
  policyVersion: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface FrontendRouteAccessPatch {
  routes: Array<Partial<FrontendRoutePolicy> & { id: string }>;
}
