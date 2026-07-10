import { api } from './api';
import type { SupportCreateInput, SupportRequest, SupportStatus, SupportType } from '../types/support';

function endpoint(type: SupportType): string {
  return type === 'inquiry' ? '/api/support/inquiries' : '/api/support/declarations';
}

function adminEndpoint(type: SupportType): string {
  return type === 'inquiry' ? '/api/admin/support/inquiries' : '/api/admin/support/declarations';
}

function toFormData(input: SupportCreateInput): FormData {
  const form = new FormData();
  form.set('title', input.title);
  form.set('content', input.content);
  if (input.attachment) form.set('attachment', input.attachment);
  return form;
}

export const supportApi = {
  create: (type: SupportType, input: SupportCreateInput) =>
    api.postForm<{ request: SupportRequest }>(endpoint(type), toFormData(input)).then((r) => r.request),

  list: (type: SupportType, status: SupportStatus | 'all' = 'all') => {
    const params = new URLSearchParams({ limit: '100' });
    if (status !== 'all') params.set('status', status);
    return api.get<{ requests: SupportRequest[] }>(`${adminEndpoint(type)}?${params.toString()}`).then((r) => r.requests);
  },

  updateStatus: (id: string, status: SupportStatus) =>
    api
      .patch<{ request: SupportRequest }>(`/api/admin/support/requests/${encodeURIComponent(id)}/status`, { status })
      .then((r) => r.request),

  attachmentUrl: (type: SupportType, requestId: string, attachmentId: string) =>
    api.get<{ url: string; expiresIn: number }>(
      `/api/support/${type === 'inquiry' ? 'inquiries' : 'declarations'}/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}/url`,
    ),
};
