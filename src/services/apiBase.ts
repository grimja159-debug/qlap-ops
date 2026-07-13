function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function hasPrefixPath(url: URL, prefix: string): boolean {
  const normalized = `/${prefix.replace(/^\/+|\/+$/g, '')}`;
  return url.pathname === normalized || url.pathname.startsWith(`${normalized}/`);
}

function isDirectPort(url: URL, ports: readonly string[]): boolean {
  return Boolean(url.port && ports.includes(url.port));
}

function isLocalDevBase(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(value.trim());
  }
}

export function getDevOnlyEnvValue(parts: string[]): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  return import.meta.env[parts.join('_')] as string | undefined;
}

function getSharedApiBaseEnvValue(): string | undefined {
  return import.meta.env.VITE_API_BASE_URL as string | undefined;
}

export function gatewayLocalFallback(prefix: string): string | undefined {
  return import.meta.env.DEV ? `http://localhost:8080/${prefix.replace(/^\/+/, '')}` : undefined;
}

export function normalizeGatewayApiBase(rawBase: string | undefined, fallback: string | undefined, prefix: string, directPorts: readonly string[] = []) {
  const explicitBase = import.meta.env.PROD && isLocalDevBase(rawBase) ? undefined : rawBase;
  const configuredSharedBase = getSharedApiBaseEnvValue();
  const sharedBase = import.meta.env.PROD && isLocalDevBase(configuredSharedBase) ? undefined : configuredSharedBase;
  const productionFallback = `https://api.qlapgg.com/${prefix.replace(/^\/+/, '')}`;
  const selectedFallback = import.meta.env.PROD ? productionFallback : (fallback ?? productionFallback);
  const raw = trimTrailingSlash((explicitBase ?? sharedBase ?? selectedFallback).trim());
  if (!raw) return trimTrailingSlash(selectedFallback);

  try {
    const url = new URL(raw);
    if (isDirectPort(url, directPorts) || hasPrefixPath(url, prefix)) {
      return trimTrailingSlash(url.toString());
    }

    url.pathname = `${trimTrailingSlash(url.pathname === '/' ? '' : url.pathname)}/${prefix.replace(/^\/+/, '')}`;
    return trimTrailingSlash(url.toString());
  } catch {
    if (raw.endsWith(`/${prefix}`) || raw.includes(`/${prefix}/`)) return raw;
    return `${raw}/${prefix.replace(/^\/+/, '')}`;
  }
}
