export type SupportType = 'inquiry' | 'declaration';
export type SupportStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

export interface SupportAttachment {
  id: string;
  r2Key?: string | null;
  url?: string | null;
  filename?: string | null;
  contentType?: string | null;
  size?: number | null;
}

export interface SupportRequest {
  id: string;
  type: SupportType;
  title: string;
  content: string;
  status: SupportStatus;
  authorUid: string;
  authorEmail: string | null;
  authorDisplayName: string | null;
  attachments: SupportAttachment[];
  createdAt: string | null;
  updatedAt: string | null;
  handledBy?: string | null;
  storageSource?: 'server_db' | 'firestore_fallback' | string | null;
  serverDbSource?: string | null;
  serverDbMirrorStatus?: string | null;
  serverDbCreatedAt?: string | null;
  serverDbUpdatedAt?: string | null;
}

export interface SupportCreateInput {
  title: string;
  content: string;
  attachment?: File | null;
}
