#!/usr/bin/env node

const userAgent = String(process.env.npm_config_user_agent || "").toLowerCase();
const execPath = String(process.env.npm_execpath || "").toLowerCase();
const lifecycleEvent = String(process.env.npm_lifecycle_event || "");
const allowedOverride = process.env.QLAP_ALLOW_WRONG_PACKAGE_MANAGER === "1";

const isNpm =
  userAgent.startsWith("npm/") ||
  execPath.includes("npm-cli");

if (allowedOverride || isNpm) {
  process.exit(0);
}

console.error("[PACKAGE_MANAGER_GUARD] qlap-ops is npm-authoritative.");
console.error("[PACKAGE_MANAGER_GUARD] Use npm.cmd ci or npm.cmd install instead of pnpm/yarn install.");
console.error(
  `[PACKAGE_MANAGER_GUARD] lifecycle=${lifecycleEvent || "-"} userAgent=${userAgent || "-"} execPath=${execPath || "-"}`
);
process.exit(1);
