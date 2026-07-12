import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const packageJsonPath = resolve(ROOT, "package.json");
const packageLockPath = resolve(ROOT, "package-lock.json");
const pnpmLockPath = resolve(ROOT, "pnpm-lock.yaml");
const yarnLockPath = resolve(ROOT, "yarn.lock");
const bunLockPath = resolve(ROOT, "bun.lockb");
const guardPath = resolve(ROOT, "scripts", "ensure-npm-install.mjs");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const scripts = packageJson.scripts ?? {};

const result = {
  ok: true,
  packageManager: packageJson.packageManager ?? null,
  hasPackageLock: existsSync(packageLockPath),
  hasPnpmLock: existsSync(pnpmLockPath),
  hasYarnLock: existsSync(yarnLockPath),
  hasBunLock: existsSync(bunLockPath),
  hasNpmInstallGuard: existsSync(guardPath) && String(scripts.preinstall ?? "").includes("ensure-npm-install.mjs"),
  warnings: [],
  violations: [],
};

function violation(message) {
  result.ok = false;
  result.violations.push(message);
}

function warning(message) {
  result.warnings.push(message);
}

if (!String(result.packageManager ?? "").startsWith("npm@")) {
  violation("packageManager must be npm@... for qlap-ops.");
}

if (!result.hasPackageLock) {
  violation("package-lock.json is required for npm-authoritative qlap-ops installs.");
}

if (!result.hasNpmInstallGuard) {
  violation("preinstall guard scripts/ensure-npm-install.mjs is required.");
}

if (result.hasPnpmLock) {
  warning("pnpm-lock.yaml exists as a legacy secondary lockfile; do not use pnpm install. Cleanup requires explicit approval.");
}

if (result.hasYarnLock || result.hasBunLock) {
  violation("Unexpected yarn.lock or bun.lockb exists in npm-authoritative qlap-ops.");
}

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
