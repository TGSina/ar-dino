// Verifies that relative references in html/css/js point to existing files (case-sensitive).
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = process.cwd();
const IGNORE = new Set(['node_modules', '.git', 'lib', 'dist', '.wrangler']);
const EXT = /\.(html|css|js|mjs)$/;
const REF = /(?:src|href)\s*=\s*["']([^"'#?]+)|url\(\s*["']?([^"')#?]+)|from\s+["'](\.{1,2}\/[^"']+)|import\(\s*["'](\.{1,2}\/[^"']+)/g;
const EXTERNAL = /^(https?:|data:|mailto:|tel:|javascript:|blob:|\/\/)/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.test(name)) yield p;
  }
}

// exact-case existence check (also correct on case-insensitive file systems)
function existsExact(path) {
  let cur = ROOT;
  for (const part of relative(ROOT, path).split(/[\\/]/)) {
    if (!existsSync(cur) || !readdirSync(cur).includes(part)) return false;
    cur = join(cur, part);
  }
  return true;
}

let bad = 0;
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(REF)) {
    const ref = m[1] || m[2] || m[3] || m[4];
    if (!ref || EXTERNAL.test(ref)) continue;
    const target = resolve(dirname(file), ref);
    if (!existsSync(target) || !existsExact(target)) {
      console.error(`${relative(ROOT, file)} -> ${ref}`);
      bad++;
    }
  }
}
if (bad) {
  console.error(`${bad} broken reference(s)`);
  if (bad && !existsSync(join(ROOT, 'lib/aframe/aframe.min.js'))) {
    console.error('Hint: lib/aframe/aframe.min.js is missing. Run `npm install && npm run vendor`.');
  }
  process.exit(1);
}
console.log('All relative references resolve.');
