import { auth } from '../lib/firebase';
import { ApiError } from './api';
import { normalizeGatewayApiBase } from './apiBase';
import type {
  LiveCwCachePolicy,
  LiveCwCachePolicyPatch,
  RedisCacheSettingsPayload,
  RedisNamespaceBrowseResult,
  RedisNamespacePurgeResult,
} from '../types/redisCache';

const BASE_URL = normalizeGatewayApiBase(
  import.meta.env.VITE_ROFL_API_BASE_URL,
  'http://localhost:8080/rofl',
  'rofl',
  ['4500'],
);

type Envelope<T> = T & { ok?: boolean; errorCode?: string; message?: string };

async function getIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'LOGIN_REQUIRED', 'Login is required.');
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    throw new ApiError(401, 'LOGIN_REQUIRED', 'Could not read Firebase ID token.');
  }
}

async function redisAdminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const send = async (token: string) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> | undefined),
      },
    });

  let res: Response;
  try {
    res = await send(await getIdToken(false));
    if (res.status === 401) res = await send(await getIdToken(true));
  } catch (networkError) {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      networkError instanceof Error ? `Redis cache admin API connection failed: ${networkError.message}` : 'Redis cache admin API connection failed.',
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

  if (!res.ok || body?.ok === false) {
    throw new ApiError(
      res.status,
      (body?.errorCode as string | undefined) ?? `HTTP_${res.status}`,
      (body?.message as string | undefined) ?? res.statusText ?? 'Redis cache admin API request failed.',
    );
  }

  return (body ?? {}) as T;
}

export const redisCacheAdminApi = {
  getSettings: () => redisAdminRequest<Envelope<RedisCacheSettingsPayload>>('/api/admin/cache/settings'),

  browseKeys: (input: { namespace: string; limit?: number }) =>
    redisAdminRequest<Envelope<RedisNamespaceBrowseResult>>(
      `/api/admin/cache/keys?namespace=${encodeURIComponent(input.namespace)}&limit=${encodeURIComponent(String(input.limit ?? 100))}`,
    ),

  purgeNamespace: (input: { namespace: string; limit?: number; confirm?: boolean }) =>
    redisAdminRequest<Envelope<RedisNamespacePurgeResult>>('/api/admin/cache/purge', {
      method: 'POST',
      body: JSON.stringify({
        namespace: input.namespace,
        limit: input.limit ?? 100,
        confirm: input.confirm === true,
      }),
    }),

  updateSettings: (patch: LiveCwCachePolicyPatch) =>
    redisAdminRequest<Envelope<{ policy: LiveCwCachePolicy }>>('/api/admin/cache/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((res) => res.policy),
};
