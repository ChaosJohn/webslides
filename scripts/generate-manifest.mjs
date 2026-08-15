import { readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const docsDir = join(scriptsDir, "..", "docs");

const ROOT_HIDDEN = new Set([
  "index.html",
  "viewer.html",
  "mdpreview.html",
  "manifest.json",
  "CNAME",
  ".nojekyll",
  "assets",
]);

function build(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
    .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });

  return entries
    .filter((e) => !ROOT_HIDDEN.has(e.name))
    .map((e) => {
      const full = join(dir, e.name);
      if (e.isDir) {
        return { name: e.name, type: "dir", modified: statSync(full).mtime.toISOString(), children: build(full) };
      }
      const st = statSync(full);
      return { name: e.name, type: "file", size: st.size, modified: st.mtime.toISOString() };
    });
}

const manifest = {
  generated: new Date().toISOString(),
  tree: build(docsDir),
};

writeFileSync(join(docsDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const count = (nodes) =>
  nodes.reduce((n, x) => n + (x.type === "dir" ? count(x.children || []) : 1), 0);
console.log(`manifest.json updated: ${count(manifest.tree)} file(s) in tree`);