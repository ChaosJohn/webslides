import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const docsDir = join(scriptsDir, "..", "docs");

const ASSET_FILES = ["ws-style.css", "ws-index.js", "ws-viewer.js", "ws-mdviewer.js"];
const HTML_FILES = ["index.html", "viewer.html", "mdpreview.html"];

const hash = createHash("sha256");
for (const name of ASSET_FILES) {
  hash.update(readFileSync(join(docsDir, "assets", name)));
}
const version = hash.digest("hex").slice(0, 10);

const re = /(assets\/ws-[a-z0-9-]+\.(?:css|js))\?v=[A-Za-z0-9_-]+/g;
let changed = false;

for (const name of HTML_FILES) {
  const path = join(docsDir, name);
  const html = readFileSync(path, "utf8");
  const updated = html.replace(re, "$1?v=" + version);
  if (updated !== html) {
    writeFileSync(path, updated);
    changed = true;
    console.log(`${name}: asset version bumped to v=${version}`);
  }
}

if (!changed) {
  console.log(`no change: asset version already v=${version}`);
}