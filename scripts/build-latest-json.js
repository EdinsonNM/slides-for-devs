/**
 * Construye latest.json para el updater de Tauri.
 * Lee los manifests desde manifest-*.json en el directorio indicado.
 * Uso: node scripts/build-latest-json.js <releasesBaseUrl> <tag> <dirWithManifests>
 * Ej: node scripts/build-latest-json.js https://github.com/EdinsonNM/slides-for-devs/releases/download v0.1.0 ./manifests
 */
const fs = require('fs');
const path = require('path');

const baseUrl = process.argv[2];
const tag = process.argv[3];
const dir = process.argv[4] || '.';

if (!baseUrl || !tag) {
  process.stderr.write('Usage: node build-latest-json.js <baseUrl> <tag> [dir]\n');
  process.exit(1);
}

const platforms = {};
const version = tag.replace(/^v/, '');
let notes = '';

function findManifests(d) {
  const out = [];
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isFile() && (e.name === 'manifest.json' || (e.name.startsWith('manifest-') && e.name.endsWith('.json')))) {
      out.push(full);
    } else if (e.isDirectory()) {
      out.push(...findManifests(full));
    }
  }
  return out;
}

for (const f of findManifests(dir)) {
  const content = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const asset of content.assets || []) {
    const url = `${baseUrl}/${tag}/${asset.name}`;
    platforms[content.platform] = { url, signature: asset.signature };
  }
  if (content.version) notes = notes || content.version;
}

const latest = {
  version,
  notes: notes || `Release ${tag}`,
  pub_date: new Date().toISOString(),
  platforms,
};

process.stdout.write(JSON.stringify(latest, null, 2));
