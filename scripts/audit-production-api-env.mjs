import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const ENV_FILES = [".env.production"];
const FORBIDDEN_PRODUCTION_ENV = [
  "VITE_GSS_API_BASE_URL",
  "VITE_QLAP_SERVICES_API_BASE_URL",
  "VITE_QLAP_GUILD_API_BASE_URL",
  "VITE_TOURNAMENT_API_BASE_URL",
  "VITE_ROFL_API_BASE_URL",
  "VITE_QLAP_MOCK_API_BASE_URL",
];

function parseEnvFile(filePath) {
  const values = new Map();
  if (!existsSync(filePath)) return values;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    values.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
  }
  return values;
}

function isLocalBase(value) {
  if (!value) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(value);
}

function loadEnv() {
  const merged = new Map();
  const loaded = [];
  for (const file of ENV_FILES) {
    const absolute = resolve(ROOT, file);
    if (!existsSync(absolute)) continue;
    loaded.push(file);
    for (const [key, value] of parseEnvFile(absolute)) merged.set(key, value);
  }
  return { loaded, merged };
}

const { loaded, merged } = loadEnv();
const apiBase = merged.get("VITE_API_BASE_URL") ?? "";
const forbiddenPresent = FORBIDDEN_PRODUCTION_ENV.filter((key) => {
  const value = merged.get(key);
  return value && value.trim();
});
const localApiBase = isLocalBase(apiBase);

console.log("qlap-ops production API env audit");
console.log(`loadedEnvFiles=${loaded.length ? loaded.join(",") : "-"}`);
console.log(`VITE_API_BASE_URL=${apiBase || "(source-fallback)"}`);
console.log(`forbiddenPerServiceApiEnv=${forbiddenPresent.length ? forbiddenPresent.join(",") : "-"}`);

if (localApiBase) {
  console.error("FAIL: production VITE_API_BASE_URL must not point to localhost.");
  process.exitCode = 1;
}

if (forbiddenPresent.length > 0) {
  console.error("FAIL: production must use the shared gateway root or source fallbacks. Remove per-service API envs.");
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log("PASS: qlap-ops production API env is gateway-safe.");
  if (loaded.length === 0) {
    console.log("NOTE: .env.production is absent; production build relies on source fallbacks under https://api.qlapgg.com/{prefix}.");
  }
}
