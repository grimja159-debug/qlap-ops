import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const envPath = resolve(repoRoot, '.env');
const distDir = join(repoRoot, 'dist');
const localGatewayBaseUrl = trimTrailingSlash(process.env.QLAP_OPS_GATEWAY_BASE_URL || 'http://127.0.0.1:8080');
const localOpsBaseUrl = trimTrailingSlash(process.env.QLAP_OPS_FRONTEND_BASE_URL || 'http://127.0.0.1:5173');
const expectedProductionApiBaseUrl = trimTrailingSlash(process.env.QLAP_OPS_PRODUCTION_API_BASE_URL || 'https://api.qlapgg.com');
const forbiddenApiEnvNames = [
  'VITE_GSS_API_BASE_URL',
  'VITE_QLAP_SERVICES_API_BASE_URL',
  'VITE_QLAP_GUILD_API_BASE_URL',
  'VITE_TOURNAMENT_API_BASE_URL',
  'VITE_ROFL_API_BASE_URL',
  'VITE_QLAP_MOCK_API_BASE_URL',
];
const forbiddenGatewayTokens = [
  'ngrok-free.dev',
  'bleach-unshipped',
  'localhost:6100',
  'localhost:4500',
  'localhost:4200',
  'localhost:4300',
  'localhost:4700',
  '127.0.0.1:6100',
  '127.0.0.1:4500',
  '127.0.0.1:4200',
  '127.0.0.1:4300',
  '127.0.0.1:4700',
  ...forbiddenApiEnvNames,
];

const checks = [];
const add = (status, name, detail = '') => {
  checks.push({ status, name, detail });
  const line = `[${status}] ${name}${detail ? ` - ${detail}` : ''}`;
  if (status === 'FAIL') {
    console.error(line);
  } else {
    console.log(line);
  }
};

console.log('[qlap-ops-admin-frontend-readiness-smoke] start');
console.log(`repo=${repoRoot}`);
console.log(`gateway=${localGatewayBaseUrl}`);
console.log(`opsFrontend=${localOpsBaseUrl}`);
console.log(`expectedProductionApi=${expectedProductionApiBaseUrl}`);

const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : new Map();
const apiBase = env.get('VITE_API_BASE_URL') || '(source-fallback)';
add('PASS', 'shared API gateway configuration', redactUrl(apiBase));

const envForbidden = [...env.entries()]
  .filter(([name]) => /^VITE_/.test(name))
  .filter(([name, value]) => forbiddenApiEnvNames.includes(name) || hasForbiddenGatewayToken(value || ''));
if (envForbidden.length === 0) {
  add('PASS', 'forbidden direct/proxy env absent', '-');
} else {
  add('FAIL', 'forbidden direct/proxy env absent', envForbidden.map(([name, value]) => `${name}=${redactUrl(value)}`).join(', '));
}

const sourceFiles = listFiles(join(repoRoot, 'src')).filter((file) => /\.(ts|tsx)$/.test(file));
const sourceText = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const forbiddenSourceTokens = ['ngrok-free.dev', 'bleach-unshipped'];
const forbiddenSourceFound = forbiddenSourceTokens.filter((token) => sourceText.includes(token));
if (forbiddenSourceFound.length === 0) {
  add('PASS', 'forbidden source gateway tokens absent', '-');
} else {
  add('FAIL', 'forbidden source gateway tokens absent', forbiddenSourceFound.join(', '));
}

const forbiddenApiEnvSourceFound = forbiddenApiEnvNames.filter((token) => sourceText.includes(token));
if (forbiddenApiEnvSourceFound.length === 0) {
  add('PASS', 'forbidden per-service env names absent from app source', '-');
} else {
  add('FAIL', 'forbidden per-service env names absent from app source', forbiddenApiEnvSourceFound.join(', '));
}

const distFiles = existsSync(distDir) ? listFiles(distDir).filter((file) => /\.(js|css|html)$/.test(file)) : [];
if (distFiles.length === 0) {
  add('WARN', 'dist bundle scan', 'dist not found; run npm run build for bundle-level token scan');
} else {
  const distText = distFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
  const forbiddenDistFound = forbiddenGatewayTokens.filter((token) => distText.includes(token));
  if (forbiddenDistFound.length === 0) {
    add('PASS', 'forbidden gateway tokens absent from dist', `${distFiles.length} file(s)`);
  } else {
    add('FAIL', 'forbidden gateway tokens absent from dist', forbiddenDistFound.join(', '));
  }

  if (distText.includes(expectedProductionApiBaseUrl)) {
    add('PASS', 'production API gateway embedded in dist', expectedProductionApiBaseUrl);
  } else {
    add('FAIL', 'production API gateway embedded in dist', `${expectedProductionApiBaseUrl} not found`);
  }
}

const requiredRoutes = ['/admin/live-cw', '/admin/users', '/admin/access', '/admin/db-inspector'];
const missingRoutes = requiredRoutes.filter((route) => !sourceText.includes(route));
if (missingRoutes.length === 0) {
  add('PASS', 'required admin routes present', requiredRoutes.join(', '));
} else {
  add('FAIL', 'required admin routes present', `missing ${missingRoutes.join(', ')}`);
}

const requiredLiveCwApiPaths = [
  '/api/admin/live-cw/discord/servers',
  '/api/admin/live-cw/rewards/monitor',
  '/api/admin/live-cw/penalties/users',
  '/api/admin/live-cw/server-db-monitor',
];
const missingLiveCwApiPaths = requiredLiveCwApiPaths.filter((path) => !sourceText.includes(path));
if (missingLiveCwApiPaths.length === 0) {
  add('PASS', 'Live CW admin monitor API paths present', requiredLiveCwApiPaths.length.toString());
} else {
  add('FAIL', 'Live CW admin monitor API paths present', `missing ${missingLiveCwApiPaths.join(', ')}`);
}

await expectJsonOk('Services health via gateway', `${localGatewayBaseUrl}/services/api/health`, (body) => body?.ok === true);
await expectJsonOk('ROFL health via gateway', `${localGatewayBaseUrl}/rofl/api/health`, (body) => body?.ok === true);
await expectJsonOk('Guild health via gateway', `${localGatewayBaseUrl}/guild/api/health`, (body) => body?.ok === true);
await expectJsonOk('Billing health via gateway', `${localGatewayBaseUrl}/api/billing/health`, (body) => body?.ok === true);
await expectStatus('ROFL admin Live CW guard via gateway', `${localGatewayBaseUrl}/rofl/api/admin/live-cw/discord/servers`, 401);
await expectStatus('Services admin users guard via gateway', `${localGatewayBaseUrl}/services/api/admin/users?limit=1`, 401);

const opsRoute = await fetchText(`${localOpsBaseUrl}/admin/live-cw`);
if (opsRoute.status === 200 && opsRoute.text.includes('<div id="root"></div>')) {
  add('PASS', 'local qlap-ops /admin/live-cw route', `HTTP ${opsRoute.status}`);
} else if (opsRoute.status === null) {
  add('WARN', 'local qlap-ops /admin/live-cw route', 'dev server not reachable; build/static checks still apply');
} else {
  add('WARN', 'local qlap-ops /admin/live-cw route', `HTTP ${opsRoute.status}`);
}

const fail = checks.filter((check) => check.status === 'FAIL').length;
const warn = checks.filter((check) => check.status === 'WARN').length;
const pass = checks.filter((check) => check.status === 'PASS').length;
console.log('[SUMMARY]');
console.log(JSON.stringify({
  ok: fail === 0,
  pass,
  warn,
  fail,
  gateway: localGatewayBaseUrl,
  opsFrontend: localOpsBaseUrl,
  checkedSourceFiles: sourceFiles.length,
  checkedDistFiles: distFiles.length,
  note: 'No Authorization token is used or printed by this smoke.',
}, null, 2));

if (fail > 0) {
  process.exit(1);
}

function parseEnv(raw) {
  const result = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    result.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
  }
  return result;
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(fullPath));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

async function expectJsonOk(name, url, predicate) {
  const result = await request(url);
  if (!result.ok || result.status !== 200) {
    add('FAIL', name, `expected HTTP 200 got ${result.status ?? 'ERR'} ${result.error || ''}`.trim());
    return;
  }
  if (!predicate(result.body)) {
    add('FAIL', name, 'unexpected JSON body');
    return;
  }
  add('PASS', name, `HTTP ${result.status}`);
}

async function expectStatus(name, url, expectedStatus) {
  const result = await request(url);
  if (result.status === expectedStatus) {
    add('PASS', name, `HTTP ${result.status}`);
    return;
  }
  add('FAIL', name, `expected HTTP ${expectedStatus} got ${result.status ?? 'ERR'} ${result.error || ''}`.trim());
}

async function request(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: null, body: null, error: String(error?.message || error) };
  }
}

async function fetchText(url) {
  try {
    const response = await fetch(url);
    return { status: response.status, text: await response.text() };
  } catch (error) {
    return { status: null, text: '', error: String(error?.message || error) };
  }
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function redactUrl(value) {
  return String(value || '').replace(/([?&](?:token|key|secret)=)[^&]+/gi, '$1[REDACTED]');
}

function hasForbiddenGatewayToken(value) {
  return forbiddenGatewayTokens.some((token) => String(value || '').includes(token));
}
