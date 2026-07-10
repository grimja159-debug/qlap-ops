export interface GuildPrizeSettings {
  visible: boolean;
  amountKrw: number | null;
  revenueSharePercent: number | null;
  buttonLabel: string;
  detailUrl: string | null;
  updatedAt: string | null;
  updatedBy?: string | null;
}

export type GuildPrizeUpdate = Partial<
  Pick<GuildPrizeSettings, 'visible' | 'amountKrw' | 'revenueSharePercent' | 'buttonLabel' | 'detailUrl'>
>;
