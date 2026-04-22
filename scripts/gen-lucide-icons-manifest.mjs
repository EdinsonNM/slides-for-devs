import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "public", "lucide-icons");

function labelFromSlug(slug) {
  return slug
    .split(/[-_]/)
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ""))
    .join(" ");
}

const files = fs
  .readdirSync(root)
  .filter((f) => f.toLowerCase().endsWith(".svg"))
  .sort((a, b) => a.localeCompare(b, "en"));

const out = { version: 1, icons: [] };

for (const file of files) {
  const slug = path.basename(file, path.extname(file)).trim();
  if (!slug) continue;
  const id = `li:${slug.toLowerCase()}`;
  const jsonPath = path.join(root, `${slug}.json`);
  let category = "Lucide";
  if (fs.existsSync(jsonPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      if (Array.isArray(j.categories) && typeof j.categories[0] === "string") {
        const c = j.categories[0].trim();
        if (c) category = c.charAt(0).toUpperCase() + c.slice(1);
      }
    } catch {
      // ignorar JSON inválido
    }
  }
  out.icons.push({
    id,
    path: file,
    label: labelFromSlug(slug),
    category,
  });
}

fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(out, null, 2), "utf8");
console.log("wrote", out.icons.length, "entries to public/lucide-icons/manifest.json");
