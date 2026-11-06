// Browser adapter for the pure writers in js/core/model-formats.js.
//   ModelExport.exportObject(object3D, 'glb' | 'obj' | 'stl', { name, sizeMm }) -> [{ filename, data, mime }]
//   ModelExport.download(files)
// The root's own transform (position / rotation / scale) is ignored: you get the model in its own space,
// at its built size, with child transforms baked into the vertices. Meshes with userData.noExport are skipped.
(() => {
  const F = window.ModelFormats;

  function collectParts(root) {
    const THREE = AFRAME.THREE;
    root.updateMatrixWorld(true);
    const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const matrix = new THREE.Matrix4();
    const normalMatrix = new THREE.Matrix3();
    const v = new THREE.Vector3();
    const parts = [];

    root.traverse((obj) => {
      if (!obj.isMesh || obj.userData.noExport) return;
      for (let o = obj; o; o = o === root ? null : o.parent) if (!o.visible) return; // hidden branch
      let geo = obj.geometry;
      const pos = geo.getAttribute('position');
      if (!pos) return;
      if (!geo.getAttribute('normal')) { geo = geo.clone(); geo.computeVertexNormals(); }
      const nor = geo.getAttribute('normal');

      matrix.multiplyMatrices(rootInverse, obj.matrixWorld);
      normalMatrix.getNormalMatrix(matrix);

      const positions = new Float32Array(pos.count * 3);
      const normals = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
        positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;
        v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        normals[i * 3] = v.x; normals[i * 3 + 1] = v.y; normals[i * 3 + 2] = v.z;
      }

      const indices = geo.index ? Array.from(geo.index.array) : Array.from({ length: pos.count }, (_, i) => i);
      if (matrix.determinant() < 0) { // mirrored transform flips the winding
        for (let i = 0; i < indices.length; i += 3) { const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t; }
      }
      const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      parts.push({
        name: (obj.name || 'mesh_' + parts.length).replace(/\s+/g, '_'),
        color: material && material.color ? material.color.getHex() : 0xcccccc, // sRGB hex
        positions, normals, indices
      });
    });
    return parts;
  }

  function exportObject(root, format, opts = {}) {
    const name = (opts.name || 'model').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    let parts = collectParts(root);
    if (!parts.length) throw new Error('Nothing to export (no visible meshes).');

    if (format === 'stl') {
      // 3D printing convention: millimeters, Z up, model sits on the bed (z = 0) and is centered.
      parts = F.prepare(parts, { targetSize: opts.sizeMm || 100, zUp: true, ground: true });
      return [{ filename: name + '.stl', data: F.toSTL(parts), mime: 'model/stl' }];
    }
    parts = F.prepare(parts, { ground: true }); // meters, Y up, feet on y = 0
    if (format === 'obj') {
      const { obj, mtl } = F.toOBJ(parts, { name });
      return [
        { filename: name + '.obj', data: obj, mime: 'text/plain' },
        { filename: name + '.mtl', data: mtl, mime: 'text/plain' }
      ];
    }
    if (format === 'glb') return [{ filename: name + '.glb', data: F.toGLB(parts, { name }), mime: 'model/gltf-binary' }];
    throw new Error('Unknown format: ' + format);
  }

  /** Saves each file through a temporary download link (staggered so browsers allow several downloads). */
  function download(files) {
    files.forEach((f, i) => {
      setTimeout(() => {
        const url = URL.createObjectURL(new Blob([f.data], { type: f.mime }));
        const a = document.createElement('a');
        a.href = url;
        a.download = f.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, i * 400);
    });
  }

  window.ModelExport = { collectParts, exportObject, download };
})();
