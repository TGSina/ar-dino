// Pure 3D file writers: GLB (glTF 2.0 binary), binary STL and OBJ+MTL. No THREE, no DOM: unit-tested in Node.
//
// Input "parts" are plain, world-space triangle meshes (Y up, meters):
//   { name: string, color: 0xRRGGBB (sRGB hex), positions: ArrayLike<number> (x,y,z,...),
//     normals: ArrayLike<number> (same length), indices: ArrayLike<number> (3 per triangle) }
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ModelFormats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const hex6 = (n) => (n & 0xffffff).toString(16).padStart(6, '0');
  const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

  /** Axis-aligned bounds over all parts: { min:[x,y,z], max:[x,y,z], size:[x,y,z] }. */
  function bounds(parts) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of parts) {
      for (let i = 0; i < p.positions.length; i += 3) {
        for (let a = 0; a < 3; a++) {
          const v = p.positions[i + a];
          if (v < min[a]) min[a] = v;
          if (v > max[a]) max[a] = v;
        }
      }
    }
    return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
  }

  /**
   * Returns transformed copies of the parts.
   *   targetSize  longest dimension of the result, in output units (e.g. 100 = 100 mm). Wins over `scale`.
   *   scale       plain multiplier (default 1).
   *   zUp         rotate Y-up -> Z-up (3D printing / CAD convention): (x, y, z) -> (x, -z, y).
   *   ground      move the model so its lowest point sits at 0 on the up axis and center it on the others.
   */
  function prepare(parts, opts = {}) {
    const b = bounds(parts);
    const maxDim = Math.max(b.size[0], b.size[1], b.size[2]) || 1;
    const s = opts.targetSize ? opts.targetSize / maxDim : (opts.scale || 1);
    const out = parts.map((p) => {
      const positions = new Float32Array(p.positions.length);
      const normals = new Float32Array(p.normals.length);
      for (let i = 0; i < positions.length; i += 3) {
        let x = p.positions[i] * s, y = p.positions[i + 1] * s, z = p.positions[i + 2] * s;
        let nx = p.normals[i], ny = p.normals[i + 1], nz = p.normals[i + 2];
        if (opts.zUp) { [y, z] = [-z, y]; [ny, nz] = [-nz, ny]; }
        positions[i] = x; positions[i + 1] = y; positions[i + 2] = z;
        normals[i] = nx; normals[i + 1] = ny; normals[i + 2] = nz;
      }
      return { name: p.name, color: p.color, positions, normals, indices: Array.from(p.indices) };
    });
    if (opts.ground) {
      const nb = bounds(out);
      const up = opts.zUp ? 2 : 1;
      const shift = [0, 0, 0];
      for (let a = 0; a < 3; a++) shift[a] = a === up ? -nb.min[a] : -(nb.min[a] + nb.max[a]) / 2;
      for (const p of out) {
        for (let i = 0; i < p.positions.length; i += 3) {
          p.positions[i] += shift[0];
          p.positions[i + 1] += shift[1];
          p.positions[i + 2] += shift[2];
        }
      }
    }
    return out;
  }

  /** Merges parts that share a color so the GLB has one primitive per material. */
  function mergeByColor(parts) {
    const map = new Map();
    for (const p of parts) {
      if (!map.has(p.color)) map.set(p.color, { color: p.color, positions: [], normals: [], indices: [], names: [] });
      const m = map.get(p.color);
      const offset = m.positions.length / 3;
      for (let i = 0; i < p.positions.length; i++) { m.positions.push(p.positions[i]); m.normals.push(p.normals[i]); }
      for (let i = 0; i < p.indices.length; i++) m.indices.push(p.indices[i] + offset);
      m.names.push(p.name);
    }
    return Array.from(map.values());
  }

  function triangleCount(parts) {
    return parts.reduce((n, p) => n + p.indices.length / 3, 0);
  }

  // ---------------------------------------------------------------- OBJ + MTL
  function toOBJ(parts, opts = {}) {
    const name = opts.name || 'model';
    const lines = [`# ${name} exported by AR Dino`, `mtllib ${name}.mtl`, `o ${name}`];
    const mats = new Map();
    let offset = 1; // OBJ indices are 1-based
    for (const p of parts) {
      const matName = 'mat_' + hex6(p.color);
      mats.set(matName, p.color);
      for (let i = 0; i < p.positions.length; i += 3) {
        lines.push(`v ${+p.positions[i].toFixed(6)} ${+p.positions[i + 1].toFixed(6)} ${+p.positions[i + 2].toFixed(6)}`);
      }
      for (let i = 0; i < p.normals.length; i += 3) {
        lines.push(`vn ${+p.normals[i].toFixed(5)} ${+p.normals[i + 1].toFixed(5)} ${+p.normals[i + 2].toFixed(5)}`);
      }
      lines.push(`g ${p.name}`, `usemtl ${matName}`);
      for (let i = 0; i < p.indices.length; i += 3) {
        const a = p.indices[i] + offset, b = p.indices[i + 1] + offset, c = p.indices[i + 2] + offset;
        lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
      }
      offset += p.positions.length / 3;
    }
    const mtl = ['# materials'];
    for (const [matName, color] of mats) {
      const [r, g, b] = rgb(color);
      mtl.push(`newmtl ${matName}`, `Ka 0 0 0`, `Kd ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`, `Ks 0 0 0`, `d 1`, `illum 1`, '');
    }
    return { obj: lines.join('\n') + '\n', mtl: mtl.join('\n') };
  }

  // ---------------------------------------------------------------- binary STL
  function toSTL(parts) {
    const tris = triangleCount(parts);
    const buf = new ArrayBuffer(84 + tris * 50);
    const dv = new DataView(buf);
    const header = 'Binary STL exported by AR Dino';
    for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
    dv.setUint32(80, tris, true);
    let o = 84;
    for (const p of parts) {
      for (let i = 0; i < p.indices.length; i += 3) {
        const ia = p.indices[i] * 3, ib = p.indices[i + 1] * 3, ic = p.indices[i + 2] * 3;
        const ax = p.positions[ia], ay = p.positions[ia + 1], az = p.positions[ia + 2];
        const bx = p.positions[ib], by = p.positions[ib + 1], bz = p.positions[ib + 2];
        const cx = p.positions[ic], cy = p.positions[ic + 1], cz = p.positions[ic + 2];
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;
        [nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz].forEach((v) => { dv.setFloat32(o, v, true); o += 4; });
        dv.setUint16(o, 0, true); o += 2;
      }
    }
    return buf;
  }

  // ---------------------------------------------------------------- GLB (glTF 2.0 binary)
  function toGLB(parts, opts = {}) {
    const name = opts.name || 'model';
    const groups = mergeByColor(parts);
    const bufferViews = [], accessors = [], materials = [], primitives = [];
    const chunks = [];
    let byteOffset = 0;

    const addView = (typedArray, target) => {
      const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
      bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, target });
      chunks.push(bytes);
      byteOffset += bytes.length; // Float32 / Uint32 data is always 4-byte aligned
      return bufferViews.length - 1;
    };

    groups.forEach((g, i) => {
      const pos = new Float32Array(g.positions);
      const nor = new Float32Array(g.normals);
      const idx = new Uint32Array(g.indices);
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < pos.length; k += 3) {
        for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[k + a]); max[a] = Math.max(max[a], pos[k + a]); }
      }
      const posView = addView(pos, 34962);
      const norView = addView(nor, 34962);
      const idxView = addView(idx, 34963);
      const base = accessors.length;
      accessors.push({ bufferView: posView, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max });
      accessors.push({ bufferView: norView, componentType: 5126, count: nor.length / 3, type: 'VEC3' });
      accessors.push({ bufferView: idxView, componentType: 5125, count: idx.length, type: 'SCALAR' });
      const [r, gg, b] = rgb(g.color).map(srgbToLinear); // glTF colors are linear
      materials.push({
        name: 'mat_' + hex6(g.color),
        pbrMetallicRoughness: { baseColorFactor: [r, gg, b, 1], metallicFactor: 0, roughnessFactor: 0.85 }
      });
      primitives.push({ attributes: { POSITION: base, NORMAL: base + 1 }, indices: base + 2, material: i, mode: 4 });
    });

    const json = {
      asset: { version: '2.0', generator: 'AR Dino exporter' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name, mesh: 0 }],
      meshes: [{ name, primitives }],
      materials, accessors, bufferViews,
      buffers: [{ byteLength: byteOffset }]
    };

    let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
    const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
    if (jsonPad) {
      const padded = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20); // pad JSON with spaces
      padded.set(jsonBytes);
      jsonBytes = padded;
    }
    const binLength = byteOffset + ((4 - (byteOffset % 4)) % 4);
    const total = 12 + 8 + jsonBytes.length + 8 + binLength;
    const out = new ArrayBuffer(total);
    const dv = new DataView(out);
    const u8 = new Uint8Array(out);
    dv.setUint32(0, 0x46546c67, true); // 'glTF'
    dv.setUint32(4, 2, true);
    dv.setUint32(8, total, true);
    dv.setUint32(12, jsonBytes.length, true);
    dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
    u8.set(jsonBytes, 20);
    let o = 20 + jsonBytes.length;
    dv.setUint32(o, binLength, true);
    dv.setUint32(o + 4, 0x004e4942, true); // 'BIN\0'
    o += 8;
    for (const c of chunks) { u8.set(c, o); o += c.length; }
    return out;
  }

  return { bounds, prepare, mergeByColor, triangleCount, toOBJ, toSTL, toGLB };
});
