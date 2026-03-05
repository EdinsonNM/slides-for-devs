/**
 * Genera un manifest JSON para este build (plataforma, versión, asset, signature).
 * Uso: node scripts/release-manifest.js <platformKey>
 * Escribe a stdout: { platform, version, assets: [{ name, signature }] }
 */
const fs = require('fs');
const path = require('path');

const platformKey = process.argv[2];
if (!platformKey) {
  process.stderr.write('Usage: node release-manifest.js <platformKey>\n');
  process.exit(1);
}

const targetRoot = path.join(__dirname, '..', 'src-tauri', 'target');
const tauriConf = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json'), 'utf8')
);
const version = tauriConf.version;

function findBundleDir() {
  const candidates = [
    path.join(targetRoot, 'release', 'bundle'),
    path.join(targetRoot, 'aarch64-apple-darwin', 'release', 'bundle'),
    path.join(targetRoot, 'x86_64-apple-darwin', 'release', 'bundle'),
    path.join(targetRoot, 'x86_64-pc-windows-msvc', 'release', 'bundle'),
  ];
  for (const d of candidates) {
    if (fs.existsSync(d)) return d;
  }
  return null;
}

const bundleDir = findBundleDir();
if (!bundleDir) {
  process.stderr.write('bundle dir not found\n');
  process.exit(1);
}

const assets = [];
function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      scan(full);
    } else if (e.name.endsWith('.sig')) {
      const installerName = e.name.replace(/\.sig$/, '');
      const sig = fs.readFileSync(full, 'utf8').trim();
      assets.push({ name: installerName, signature: sig });
    }
  }
}
scan(bundleDir);

process.stdout.write(
  JSON.stringify({
    platform: platformKey,
    version,
    assets,
  })
);
