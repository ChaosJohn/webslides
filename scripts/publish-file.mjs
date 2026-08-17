#!/usr/bin/env node
// 用法：
//   node scripts/publish-file.mjs <文件或目录> [--as <docs 内相对路径>] [--msg <提交信息>] [--force]
// 自动完成：git pull --rebase → 拷贝进 docs/ → git add/commit → push
import { statSync, cpSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname, basename, resolve, relative } from "node:path";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..");
const docsDir = join(repoRoot, "docs");

const RESERVED = new Set([
  "index.html",
  "viewer.html",
  "mdpreview.html",
  "manifest.json",
  "CNAME",
  ".nojekyll",
  "assets",
]);

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function sh(cmd, args) {
  return execFileSync("git", [cmd, ...args], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function parseArgs(argv) {
  const sources = [];
  let asPath = null;
  let msg = null;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--as") asPath = argv[++i];
    else if (a === "--msg") msg = argv[++i];
    else if (a === "--force") force = true;
    else if (a === "-h" || a === "--help") {
      console.log(
        "用法: node scripts/publish-file.mjs <文件或目录> [--as <docs内相对路径>] [--msg <提交信息>] [--force]\n" +
          "示例: node scripts/publish-file.mjs ~/Desktop/report.md\n" +
          "      node scripts/publish-file.mjs report.pdf --as papers/report.pdf\n" +
          "      node scripts/publish-file.mjs deck/ --as decks/deck"
      );
      process.exit(0);
    } else sources.push(a);
  }
  if (!sources.length) fail("缺少源文件/目录参数（--help 查看用法）");
  return { sources, asPath, msg, force };
}

function sanitizeRel(input) {
  if (!input) return null;
  let f = String(input).split(/[?#]/)[0].trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(f)) return null;
  f = f.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = f.split("/").filter((s) => s && s !== "." && s !== "..");
  if (!parts.length) return null;
  return parts.join("/");
}

function checkReserved(rel) {
  const first = rel.split("/")[0];
  if (RESERVED.has(first)) fail("目标路径与站点实现文件冲突，禁止覆盖：" + first);
}

function gitStatus() {
  try {
    return sh("status", ["--porcelain"]);
  } catch (e) {
    return "";
  }
}

function main() {
  const { sources, asPath, msg, force } = parseArgs(process.argv.slice(2));

  console.log("① git pull --rebase origin main");
  try {
    sh("pull", ["--rebase", "origin", "main"]);
  } catch (e) {
    fail("pull 失败：" + (e.stderr || e.message).trim());
  }

  const pre = gitStatus();
  const staged = [];
  for (const src of sources) {
    const abs = resolve(src);
    let isDir;
    try {
      isDir = statSync(abs).isDirectory();
    } catch (e) {
      fail("源文件不存在: " + src);
    }

    const name = basename(abs);
    let rel = isDir ? null : name;
    if (asPath) rel = sanitizeRel(asPath);
    if (!rel) rel = isDir ? name : name;
    rel = rel.replace(/\/+$/, "") || name;
    checkReserved(rel);

    const target = join(docsDir, rel);
    if (existsSync(target) && !force) {
      fail(`docs/${rel} 已存在，如需覆盖请加 --force`);
    }

    console.log(`② 拷贝  ${src}  →  docs/${rel}`);
    if (isDir) {
      mkdirSync(dirname(target), { recursive: true });
      cpSync(abs, target, { recursive: true });
    } else {
      mkdirSync(dirname(target), { recursive: true });
      cpSync(abs, target);
    }
    staged.push(rel);
  }

  const others = pre
    .split("\n")
    .map((l) => l.slice(3))
    .filter((p) => p && !staged.includes(p));
  if (others.length) {
    console.warn("⚠ 工作区还有其他未提交改动，本次只提交新拷贝的文件：" + others.join(", "));
  }

  const commitMsg = msg || (staged.length === 1 ? `feat: add docs/${staged[0]}` : `feat: add ${staged.length} files under docs/`);

  console.log("③ git add + 提交 + push");
  sh("add", staged.map((r) => join("docs", r)));
  sh("commit", ["-m", commitMsg]);
  sh("push", ["origin", "main"]);

  console.log("✅ 完成，已发布。提交信息: " + commitMsg);
}

main();