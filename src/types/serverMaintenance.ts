export interface ServerMaintenanceSettings {
  enabled: boolean;
  liveCwCreateDisabled: boolean;
  liveCwJoinDisabled: boolean;
  message: string;
  maintenanceStartsAt: string | null;
  maintenanceEndsAt: string | null;
  policyVersion: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export type ServerMaintenancePatch = Partial<
  Pick<
    ServerMaintenanceSettings,
    | 'enabled'
    | 'liveCwCreateDisabled'
    | 'liveCwJoinDisabled'
    | 'message'
    | 'maintenanceStartsAt'
    | 'maintenanceEndsAt'
  >
>;
