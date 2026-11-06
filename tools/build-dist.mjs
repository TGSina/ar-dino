// Copies only the files that must be published into dist/ (no node_modules, tests, tools, docs).
// Used for Cloudflare (Workers static assets or Pages). GitHub Pages does not need it.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';

const FILES = ['index.html', 'export.html'];
const DIRS = ['css', 'js', 'lib', 'assets'];

if (!existsSync('lib/aframe/aframe.min.js')) {
  console.error('lib/aframe/aframe.min.js is missing. Run `npm install && npm run vendor` first.');
  process.exit(1);
}

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of FILES) cpSync(f, `dist/${f}`);
for (const d of DIRS) if (existsSync(d)) cpSync(d, `dist/${d}`, { recursive: true });
console.log(`dist/ ready: ${FILES.join(', ')}, ${DIRS.join('/, ')}/`);
