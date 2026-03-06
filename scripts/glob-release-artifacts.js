#!/usr/bin/env node
/**
 * Lista los artefactos de build de Tauri para subir al release.
 * Salida: una ruta por línea (relativa a la raíz del repo).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetRoot = path.join(__dirname, '..', 'src-tauri', 'target');
const ext = ['.exe', '.sig', '.tar.gz', '.AppImage'];
const seen = new Set();

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
    if (e.isDirectory()) {
      walk(full);
    } else if (ext.some((ext) => e.name.endsWith(ext)) && rel.includes('/bundle/')) {
      if (!seen.has(rel)) {
        seen.add(rel);
        console.log(rel);
      }
    }
  }
}

const root = path.resolve(__dirname, '..');
process.chdir(root);

walk(path.join(targetRoot, 'release'));
walk(path.join(targetRoot, 'aarch64-apple-darwin', 'release'));
walk(path.join(targetRoot, 'x86_64-apple-darwin', 'release'));
walk(path.join(targetRoot, 'x86_64-pc-windows-msvc', 'release'));
