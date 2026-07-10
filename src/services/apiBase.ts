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

export function normalizeGatewayApiBase(rawBase: string | undefined, fallback: string, prefix: string, directPorts: readonly string[] = []) {
  const raw = trimTrailingSlash((rawBase ?? fallback).trim());
  if (!raw) return trimTrailingSlash(fallback);

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

