import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const iconsDir = path.join(repoRoot, "public", "simple-icons");

/** Títulos canónicos desde el paquete `simple-icons` (opcional). */
function loadTitleBySlug() {
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
      map.set(slug, title);
    }
  } catch {
    // Sin node_modules o JSON: solo etiquetas derivadas del slug.
  }
  return map;
}

const titleBySlug = loadTitleBySlug();

const files = fs
  .readdirSync(iconsDir)
  .filter((f) => f.toLowerCase().endsWith(".svg"))
  .sort((a, b) => a.localeCompare(b, "en"));

const out = { version: 1, icons: [] };

for (const file of files) {
  const slug = path.basename(file, path.extname(file)).trim().toLowerCase();
  if (!slug) continue;
  const id = `si:${slug}`;
  const label = titleBySlug.get(slug) ?? slug.replace(/-/g, " ");
  out.icons.push({ id, path: file, label });
}

fs.writeFileSync(path.join(iconsDir, "manifest.json"), JSON.stringify(out, null, 2), "utf8");
console.log("wrote", out.icons.length, "entries to public/simple-icons/manifest.json");
