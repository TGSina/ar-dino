// Example second animal (export-only for now): a round yellow chick.
// Same contract as the dino: build() -> { model, own: { geos, mats } }, units meters, +Y up, faces +Z.
// Copy this file to add your own animal, then include it in export.html.
window.AnimalModels = window.AnimalModels || {};
(() => {
  const THREE = AFRAME.THREE;

  function build() {
    const own = { geos: [], mats: [] };
    const sphere = new THREE.SphereGeometry(1, 20, 14);
    const cone = new THREE.ConeGeometry(1, 1, 12);
    own.geos.push(sphere, cone);
    const mat = (color) => {
      const m = new THREE.MeshLambertMaterial({ color });
      own.mats.push(m);
      return m;
    };
    const yellow = mat(0xffe066), orange = mat(0xff9f43), white = mat(0xffffff), dark = mat(0x1c1b2e), pink = mat(0xff8fb1);

    const model = new THREE.Group();
    const part = (geo, material, pos, scl, rot) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(pos[0], pos[1], pos[2]);
      m.scale.set(scl[0], scl[1], scl[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      model.add(m);
      return m;
    };

    part(sphere, yellow, [0, 0.24, 0], [0.2, 0.2, 0.22]);                 // body
    part(sphere, yellow, [0, 0.5, 0.1], [0.15, 0.15, 0.15]);              // head
    part(cone, orange, [0, 0.47, 0.27], [0.05, 0.09, 0.05], [Math.PI / 2, 0, 0]); // beak (points +Z)
    [-1, 1].forEach((s) => {
      part(sphere, white, [s * 0.07, 0.55, 0.22], [0.035, 0.035, 0.035]); // eyes
      part(sphere, dark, [s * 0.072, 0.55, 0.25], [0.02, 0.02, 0.02]);   // pupils
      part(sphere, pink, [s * 0.11, 0.48, 0.2], [0.03, 0.02, 0.012], [0, s * 0.9, 0]); // cheeks
      part(sphere, yellow, [s * 0.2, 0.26, 0], [0.04, 0.11, 0.13]);       // wings
      part(sphere, orange, [s * 0.07, 0.015, 0.04], [0.05, 0.015, 0.07]); // feet
      part(sphere, orange, [s * 0.07, 0.07, 0], [0.015, 0.06, 0.015]);   // legs
    });
    part(cone, orange, [0, 0.67, 0.1], [0.02, 0.07, 0.02]);               // head tuft
    part(cone, orange, [-0.03, 0.66, 0.08], [0.02, 0.06, 0.02], [0, 0, 0.4]);
    part(cone, orange, [0.03, 0.66, 0.08], [0.02, 0.06, 0.02], [0, 0, -0.4]);
    part(cone, yellow, [0, 0.3, -0.24], [0.06, 0.12, 0.03], [-1.2, 0, 0]); // tail feather

    return { model, own };
  }

  window.AnimalModels.chick = { build, label: 'Chick' };
})();
