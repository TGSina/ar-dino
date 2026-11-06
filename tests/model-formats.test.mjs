import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const F = require('../js/core/model-formats.js');

// A unit cube centered on the origin (8 verts, 12 triangles) and a smaller red tetra-ish part.
function cube(color, name, size = 1, dy = 0) {
  const h = size / 2;
  const positions = [];
  for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) positions.push(x, y + dy, z);
  const normals = positions.map(() => 0).map((_, i) => (i % 3 === 1 ? 1 : 0));
  const indices = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
  return { name, color, positions, normals, indices };
}
const parts = () => [cube(0x6fd36f, 'body', 1), cube(0xff8fb1, 'cheek', 0.2, 0.7), cube(0x6fd36f, 'head', 0.4, 0.9)];

test('bounds', () => {
  const b = F.bounds(parts());
  assert.ok(Math.abs(b.size[0] - 1) < 1e-9);
  assert.ok(Math.abs(b.max[1] - 1.1) < 1e-9);
});

test('prepare: targetSize scales the longest side', () => {
  const out = F.prepare(parts(), { targetSize: 100 });
  const b = F.bounds(out);
  assert.ok(Math.abs(Math.max(...b.size) - 100) < 1e-4);
});

test('prepare: zUp + ground puts the model on the bed (min Z = 0) and centers X/Y', () => {
  const out = F.prepare(parts(), { targetSize: 100, zUp: true, ground: true });
  const b = F.bounds(out);
  assert.ok(Math.abs(b.min[2]) < 1e-4);
  assert.ok(Math.abs(b.min[0] + b.max[0]) < 1e-4);
  assert.ok(Math.abs(b.min[1] + b.max[1]) < 1e-4);
  assert.ok(b.size[2] > 100 * 0.9 && b.size[2] <= 100 + 1e-4); // original height (Y) is the longest side
});

test('STL: size is 84 + 50 * triangles and the count field matches', () => {
  const buf = F.toSTL(parts());
  assert.equal(F.triangleCount(parts()), 36);
  assert.equal(buf.byteLength, 84 + 50 * 36);
  assert.equal(new DataView(buf).getUint32(80, true), 36);
});

test('OBJ: counts of v / vn / f lines and 1-based, in-range indices', () => {
  const { obj, mtl } = F.toOBJ(parts(), { name: 'dino' });
  const lines = obj.split('\n');
  const v = lines.filter((l) => l.startsWith('v ')).length;
  const vn = lines.filter((l) => l.startsWith('vn ')).length;
  const faces = lines.filter((l) => l.startsWith('f '));
  assert.equal(v, 24);
  assert.equal(vn, 24);
  assert.equal(faces.length, 36);
  for (const f of faces) for (const tok of f.slice(2).split(' ')) {
    const idx = Number(tok.split('//')[0]);
    assert.ok(idx >= 1 && idx <= 24);
  }
  assert.ok(obj.includes('mtllib dino.mtl'));
  assert.equal((mtl.match(/newmtl/g) || []).length, 2); // two distinct colors
});

test('GLB: valid header, chunks, accessors and buffer length', () => {
  const buf = F.toGLB(parts(), { name: 'dino' });
  const dv = new DataView(buf);
  assert.equal(dv.getUint32(0, true), 0x46546c67);
  assert.equal(dv.getUint32(4, true), 2);
  assert.equal(dv.getUint32(8, true), buf.byteLength);
  assert.equal(buf.byteLength % 4, 0);
  const jsonLen = dv.getUint32(12, true);
  assert.equal(dv.getUint32(16, true), 0x4e4f534a);
  assert.equal(jsonLen % 4, 0);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binHeader = 20 + jsonLen;
  const binLen = dv.getUint32(binHeader, true);
  assert.equal(dv.getUint32(binHeader + 4, true), 0x004e4942);
  assert.equal(binHeader + 8 + binLen, buf.byteLength);
  assert.ok(json.buffers[0].byteLength <= binLen);
  assert.equal(json.materials.length, 2);          // green and pink merged by color
  assert.equal(json.meshes[0].primitives.length, 2);
  const green = json.meshes[0].primitives[0];
  assert.equal(json.accessors[green.attributes.POSITION].count, 16); // body + head merged
  assert.equal(json.accessors[green.indices].count, 72);
  // every bufferView stays inside the binary buffer
  for (const v of json.bufferViews) assert.ok(v.byteOffset + v.byteLength <= json.buffers[0].byteLength);
  // linear color conversion: sRGB 0x6f -> ~0.159
  assert.ok(Math.abs(json.materials[0].pbrMetallicRoughness.baseColorFactor[0] - 0.159) < 0.01);
});
