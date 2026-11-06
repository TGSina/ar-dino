// Copies the pinned A-Frame build from node_modules into lib/aframe/ (GitHub Pages does not run npm).
import { cpSync, mkdirSync, readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const pkgDir = 'node_modules/aframe';
if (!existsSync(pkgDir)) {
  console.error('node_modules/aframe not found. Run `npm install` first.');
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const dist = join(pkgDir, 'dist');
const candidates = readdirSync(dist).filter((f) => /^aframe.*\.min\.js$/.test(f));
const pick =
  candidates.find((f) => f.includes(pkg.version)) ||
  candidates.find((f) => f === 'aframe-master.min.js') ||
  candidates[0];
if (!pick) {
  console.error('No aframe*.min.js found in ' + dist);
  process.exit(1);
}
mkdirSync('lib/aframe', { recursive: true });
cpSync(join(dist, pick), 'lib/aframe/aframe.min.js');
if (existsSync(join(pkgDir, 'LICENSE'))) cpSync(join(pkgDir, 'LICENSE'), 'lib/aframe/LICENSE');
console.log(`Vendored A-Frame ${pkg.version} (${pick}) -> lib/aframe/aframe.min.js`);
