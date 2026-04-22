import fs from "node:fs";
import path from "node:path";

const root = path.join("public", "amazon-icons");
const icons = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith(".svg")) icons.push(p);
  }
}

walk(root);
icons.sort();

const out = { version: 1, icons: [] };

for (const abs of icons) {
  const rel = path.relative(root, abs).split(path.sep).join("/");
  const noExt = rel.replace(/\.svg$/i, "");
  const id =
    "aws:" +
    noExt
      .toLowerCase()
      .split("/")
      .join("__")
      .replace(/\s+/g, "-");
  const label = path.basename(noExt).replace(/-/g, " ");
  out.icons.push({ id, path: rel, label });
}

fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(out, null, 2), "utf8");
console.log("wrote", out.icons.length, "entries to public/amazon-icons/manifest.json");
