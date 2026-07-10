import type { IsoDate } from './common';

export type QStargramPostStatus = 'ACTIVE' | 'HIDDEN' | 'DELETED';
export type QStargramReportStatus = 'OPEN' | 'REVIEWED' | 'RESOLVED';
export type QStargramVisibility = 'PUBLIC' | 'HOME_ONLY' | 'PRIVATE';
export type QStargramCategory =
  | 'DAILY'
  | 'PHOTO'
  | 'SHOWCASE'
  | 'LIVE_CW_REVIEW'
  | 'TOURNAMENT_REVIEW'
  | 'ETC';

export interface QStargramAdminPost {
  id: string;
  postId?: string;
  authorUid: string;
  authorDisplayName?: string | null;
  authorNickname?: string | null;
  title?: string | null;
  content: string;
  category: QStargramCategory;
  visibility: QStargramVisibility;
  showOnQStargram: boolean;
  likeCount: number;
  commentCount?: number;
  reportCount: number;
  status: QStargramPostStatus;
  imageUrls?: string[];
  imageThumbUrls?: string[];
  tags?: string[];
  createdAt: IsoDate;
  updatedAt: IsoDate;
  deletedAt?: IsoDate | null;
  moderatedBy?: string | null;
  deletedBy?: string | null;
}

export interface QStargramReport {
  id: string;
  postId: string;
  uid: string;
  reason?: string | null;
  detail?: string | null;
  status: QStargramReportStatus;
  createdAt: IsoDate;
  reviewedAt?: IsoDate | null;
  reviewedBy?: string | null;
  post?: QStargramAdminPost | null;
}

export interface QStargramAdminListParams {
  status?: string;
  category?: string;
  visibility?: string;
  authorUid?: string;
  reportedOnly?: boolean;
  q?: string;
  limit?: number;
}

export interface QStargramReportListParams {
  status?: string;
  postId?: string;
  reporterUid?: string;
  q?: string;
  limit?: number;
}

export interface QStargramStatusPatch {
  status: QStargramPostStatus;
  reason: string;
}

export interface QStargramReportStatusPatch {
  status: QStargramReportStatus;
  reason: string;
}
