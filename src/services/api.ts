import { normalizeGatewayApiBase } from './apiBase';

const BASE_URL = normalizeGatewayApiBase(
  import.meta.env.VITE_QLAP_SERVICES_API_BASE_URL,
  'http://localhost:8080/services',
  'services',
  ['6100'],
);

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export function getApiBaseUrl() {
  return BASE_URL;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;

  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

export interface ApiEnvelope {
  ok: true;
  [key: string]: unknown;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers: Record<string, string> = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
    });
  } catch (networkError) {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      networkError instanceof Error
        ? `서버에 연결할 수 없습니다: ${networkError.message}`
        : '서버에 연결할 수 없습니다.',
    );
  }

  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = null;
    }
  }

  if (!res.ok || (body != null && body.ok === false)) {
    const errorCode = (body?.errorCode as string) ?? `HTTP_${res.status}`;
    const message = (body?.message as string) ?? res.statusText ?? '요청을 처리하지 못했습니다.';
    throw new ApiError(res.status, errorCode, message);
  }

  return (body ?? {}) as T;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  postForm: <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) }),
};
