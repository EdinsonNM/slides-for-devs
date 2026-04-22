import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const iconsDir = path.join(repoRoot, "public", "simple-icons");

/** Metadatos canónicos (título + hex de marca) desde el paquete `simple-icons`. */
function loadMetaBySlug() {
  const map = new Map();
  try {
    const raw = fs.readFileSync(
      path.join(repoRoot, "node_modules", "simple-icons", "data", "simple-icons.json"),
      "utf8",
    );
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return map;
    for (const x of arr) {
      if (!x || typeof x.slug !== "string") continue;
      const slug = x.slug.trim().toLowerCase();
      const title = typeof x.title === "string" && x.title.trim() ? x.title.trim() : slug;
      const hex = typeof x.hex === "string" && /^[0-9A-Fa-f]{6}$/.test(x.hex.trim()) ? x.hex.trim() : null;
      map.set(slug, { title, hex });
    }
  } catch {
    // Sin node_modules o JSON.
  }
  return map;
}

const metaBySlug = loadMetaBySlug();

const files = fs
  .readdirSync(iconsDir)
  .filter((f) => f.toLowerCase().endsWith(".svg"))
  .sort((a, b) => a.localeCompare(b, "en"));

const out = { version: 1, icons: [] };

for (const file of files) {
  const slug = path.basename(file, path.extname(file)).trim().toLowerCase();
  if (!slug) continue;
  const id = `si:${slug}`;
  const meta = metaBySlug.get(slug);
  const label = meta?.title ?? slug.replace(/-/g, " ");
  const entry = { id, path: file, label };
  if (meta?.hex) entry.hex = meta.hex;
  out.icons.push(entry);
}

fs.writeFileSync(path.join(iconsDir, "manifest.json"), JSON.stringify(out, null, 2), "utf8");
console.log("wrote", out.icons.length, "entries to public/simple-icons/manifest.json");
