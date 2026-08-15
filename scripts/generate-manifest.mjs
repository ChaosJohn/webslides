import { readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const docsDir = join(scriptsDir, "..", "docs");

const SKIP = new Set([
  "manifest.json",
  "index.html",
  "viewer.html",
  "CNAME",
  ".nojekyll",
  "assets",
]);

const TYPE_ORDER = { pptx: 0, html: 1 };

const decks = [];
for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (SKIP.has(entry.name)) continue;
  if (!entry.name.endsWith(".pptx") && !entry.name.endsWith(".html")) continue;

  const stats = statSync(join(docsDir, entry.name));
  const type = entry.name.endsWith(".pptx") ? "pptx" : "html";
  decks.push({
    file: entry.name,
    type,
    size: stats.size,
    modified: stats.mtime.toISOString(),
  });
}

decks.sort((a, b) => {
  const t = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  return t !== 0 ? t : a.file.localeCompare(b.file);
});

const manifest = {
  generated: new Date().toISOString(),
  decks,
};

writeFileSync(join(docsDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest.json updated: ${decks.length} deck(s) (${decks.map((d) => d.file).join(", ") || "none"})`);