import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");
const extensions = new Set([".ts", ".tsx"]);
const skipDirs = new Set(["node_modules", "dist", ".git"]);

async function walk(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function lineNumber(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function lineAt(source, index) {
  const start = source.lastIndexOf("\n", index) + 1;
  const endIndex = source.indexOf("\n", index);
  const end = endIndex === -1 ? source.length : endIndex;
  return source.slice(start, end).trim();
}

function isSensitiveCopyable(tag) {
  return /\bfull\b/.test(tag) && /\b(uid|Uid|authorUid|actorUid|createdBy|handledBy)\b/.test(tag);
}

function isDisplaySource(relative) {
  return relative.startsWith("src/components/") || relative.startsWith("src/pages/");
}

function isRawUidDisplayLine(line) {
  const text = line.trim();
  if (!/(uid|Uid|authorUid|actorUid|targetUid|handledBy)\b/.test(text)) return false;
  if (!/[{}]|`/.test(text)) return false;
  if (/\b(shortId|maskUid|CopyableId)\b/.test(text)) return false;
  if (/\b(value|onChange|queryKey|rowKey|key|aria-label|placeholder|label)\s*=/.test(text)) return false;
  if (/\b(api|Api)\b|encodeURIComponent|mutationFn|invalidateQueries|setForm|set[A-Z]\w*\(|m\.set\(|\.map\(|\.filter\(/.test(text)) return false;
  return (
    /\?\?[^;\n]*(?:uid|Uid)\b/.test(text) ||
    /\$\{[^}]*\b(?:uid|Uid)\b[^}]*\}/.test(text) ||
    />\s*\{[^}]*\b(?:uid|Uid|authorUid|actorUid|targetUid|handledBy)\b[^}]*\}\s*</.test(text)
  );
}

async function main() {
  const files = await walk(srcDir);
  const failures = [];
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const relative = path.relative(root, file).replaceAll("\\", "/");
    const pattern = /<CopyableId\b[^>]*>/g;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const tag = match[0];
      if (!isSensitiveCopyable(tag)) continue;
      if (/\bsensitive\b/.test(tag)) continue;
      failures.push({
        file: relative,
        line: lineNumber(source, match.index),
        reason: "full UID-like CopyableId must include sensitive",
        excerpt: lineAt(source, match.index),
      });
    }
    if (isDisplaySource(relative)) {
      source.split(/\r?\n/).forEach((line, index) => {
        if (!isRawUidDisplayLine(line)) return;
        failures.push({
          file: relative,
          line: index + 1,
          reason: "raw UID-like value appears in display text; use shortId/maskUid or CopyableId sensitive",
          excerpt: line.trim(),
        });
      });
    }
  }
  const result = {
    ok: failures.length === 0,
    checkedFiles: files.length,
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[audit-sensitive-id-display] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
