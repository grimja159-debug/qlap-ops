import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["src"];
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".vite", ".next", "coverage"]);

const FORBIDDEN_PATTERNS = [
  { pattern: /from\s+["']firebase\/firestore["']/g, reason: "Firestore SDK import" },
  { pattern: /from\s+["']firebase\/database["']/g, reason: "Realtime Database SDK import" },
  { pattern: /from\s+["']firebase\/storage["']/g, reason: "Firebase Storage SDK import" },
  { pattern: /from\s+["']firebase\/functions["']/g, reason: "Firebase Functions client SDK import" },
  { pattern: /from\s+["']firebase\/analytics["']/g, reason: "Firebase Analytics SDK import" },
  { pattern: /from\s+["']firebase\/messaging["']/g, reason: "Firebase Messaging SDK import" },
  { pattern: /from\s+["']firebase\/remote-config["']/g, reason: "Firebase Remote Config SDK import" },
  { pattern: /from\s+["']firebase\/performance["']/g, reason: "Firebase Performance SDK import" },
  { pattern: /require\(["']firebase\/firestore["']\)/g, reason: "Firestore SDK require" },
  { pattern: /require\(["']firebase\/database["']\)/g, reason: "Realtime Database SDK require" },
  { pattern: /require\(["']firebase\/storage["']\)/g, reason: "Firebase Storage SDK require" },
  { pattern: /firebase\/compat\//g, reason: "Firebase compat SDK usage" },
  { pattern: /firebase\/compat\/firestore/g, reason: "Firestore compat SDK usage" },
  { pattern: /firebase\/compat\/database/g, reason: "Realtime Database compat SDK usage" },
  { pattern: /https:\/\/firestore\.googleapis\.com/gi, reason: "Direct Firestore REST endpoint" },
  { pattern: /https:\/\/[^"'`\s]+\.firebaseio\.com/gi, reason: "Direct Realtime Database endpoint" },
  { pattern: /https:\/\/firebasestorage\.googleapis\.com/gi, reason: "Direct Firebase Storage endpoint" },
  { pattern: /\bonSnapshot\s*\(/g, reason: "Realtime Firestore listener-like call" },
  { pattern: /\bgetFirestore\s*\(/g, reason: "Firestore client initialization-like call" },
  { pattern: /\binitializeFirestore\s*\(/g, reason: "Firestore client initialization-like call" },
  { pattern: /\bgetDatabase\s*\(/g, reason: "Realtime Database client initialization-like call" },
  { pattern: /\bgetStorage\s*\(/g, reason: "Firebase Storage client initialization-like call" },
  { pattern: /\bgetFunctions\s*\(/g, reason: "Firebase Functions client initialization-like call" },
  { pattern: /\bgetDoc\s*\(/g, reason: "Firestore document read-like call" },
  { pattern: /\bgetDocs\s*\(/g, reason: "Firestore collection read-like call" },
  { pattern: /\bcollection\s*\(/g, reason: "Firestore collection-like call" },
  { pattern: /\bsetDoc\s*\(/g, reason: "Firestore document write-like call" },
  { pattern: /\bupdateDoc\s*\(/g, reason: "Firestore document update-like call" },
  { pattern: /\bdeleteDoc\s*\(/g, reason: "Firestore document delete-like call" },
  { pattern: /\bwriteBatch\s*\(/g, reason: "Firestore batch write-like call" },
  { pattern: /\brunTransaction\s*\(/g, reason: "Firestore transaction-like call" },
];

const WARNING_PATTERNS = [
  { pattern: /firestore_fallback/g, reason: "Firestore fallback label remains; verify it is server API metadata only" },
  { pattern: /firestore-fallback/g, reason: "Firestore fallback label remains; verify it is server API metadata only" },
];

const ALLOWED_WARNING_MATCHES = new Set([
  "src/components/SupportInboxPage.tsx:41:firestore_fallback",
  "src/lib/statusTone.ts:125:firestore_fallback",
  "src/lib/statusTone.ts:133:firestore_fallback",
  "src/lib/statusTone.ts:143:firestore_fallback",
  "src/types/billing.ts:29:firestore_fallback",
  "src/types/stats.ts:8:firestore_fallback",
  "src/types/stats.ts:21:firestore_fallback",
  "src/types/support.ts:26:firestore_fallback",
]);

async function exists(dir) {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(fullPath);
  }
  return files;
}

function lineNumberFor(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function scanPattern(source, filePath, rule) {
  const matches = [];
  rule.pattern.lastIndex = 0;
  let match;
  while ((match = rule.pattern.exec(source)) !== null) {
    const relativeFile = path.relative(ROOT, filePath).replaceAll("\\", "/");
    const line = lineNumberFor(source, match.index);
    matches.push({
      file: relativeFile,
      line,
      reason: rule.reason,
      match: match[0],
    });
  }
  return matches;
}

function isAllowedWarning(warning) {
  return ALLOWED_WARNING_MATCHES.has(`${warning.file}:${warning.line}:${warning.match}`);
}

async function main() {
  const files = [];
  for (const dir of TARGET_DIRS) {
    const absolute = path.join(ROOT, dir);
    if (await exists(absolute)) await walk(absolute, files);
  }

  const violations = [];
  const warnings = [];
  const allowedWarnings = [];
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    for (const rule of FORBIDDEN_PATTERNS) {
      violations.push(...scanPattern(source, file, rule));
    }
    for (const rule of WARNING_PATTERNS) {
      for (const warning of scanPattern(source, file, rule)) {
        if (isAllowedWarning(warning)) allowedWarnings.push(warning);
        else warnings.push(warning);
      }
    }
  }

  const result = {
    ok: violations.length === 0,
    checkedFiles: files.length,
    violations,
    warnings,
    allowedWarnings: allowedWarnings.length,
  };

  console.log(JSON.stringify(result, null, 2));
  if (violations.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[audit-no-firestore-sdk] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
