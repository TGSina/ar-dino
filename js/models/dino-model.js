// Procedural cartoon dinosaur geometry. Units: meters, +Y up, facing +Z, feet on y = 0.
// Registered as window.AnimalModels.dino so both the game (cute-dino) and export.html can use it.
// A model's build() returns { model, shadow, ...named parts used for animation, own: { geos, mats } }.
// Meshes with userData.noExport = true are skipped by the exporters.
window.AnimalModels = window.AnimalModels || {};
(() => {
  const THREE = AFRAME.THREE;

  const COLORS = {
    body: 0x6fd36f, legs: 0x5cc25c, feet: 0x4fae4f, belly: 0xfff0b3, spike: 0xff9f43,
    cheek: 0xff8fb1, white: 0xffffff, pupil: 0x1c1b2e, dark: 0x3a2a2a, mouth: 0x6b1636, toe: 0xfff0b3
  };
  const TAIL_BASE_X = [0.15, 0.1, 0.08];
  const HIP_Y = 0.23;

  function build() {
    const own = { geos: [], mats: [] };
    const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
    const coneGeo = new THREE.ConeGeometry(1, 1, 6);
    const smileGeo = new THREE.TorusGeometry(0.035, 0.005, 6, 16, Math.PI);
    const shadowGeo = new THREE.CircleGeometry(0.3, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    own.geos.push(sphereGeo, coneGeo, smileGeo, shadowGeo);

    const M = {};
    Object.keys(COLORS).forEach((k) => {
      M[k] = new THREE.MeshLambertMaterial({ color: COLORS[k] });
      own.mats.push(M[k]);
    });

    const mesh = (parent, geo, mat, pos, scl) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(pos[0], pos[1], pos[2]);
      m.scale.set(scl[0], scl[1], scl[2]);
      parent.add(m);
      return m;
    };
    const group = (parent, x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };

    const model = new THREE.Group();
    const upper = group(model, 0, 0, 0); // everything above the hips: bobs and rolls while walking

    // Body + belly
    const B = { y: 0.33, rx: 0.17, ry: 0.17, rz: 0.22 };
    mesh(upper, sphereGeo, M.body, [0, B.y, 0], [B.rx, B.ry, B.rz]);
    mesh(upper, sphereGeo, M.belly, [0, 0.3, 0.08], [0.145, 0.14, 0.19]);

    // Back spikes
    [-0.13, -0.03, 0.07].forEach((z) => {
      const y = B.y + B.ry * Math.sqrt(1 - Math.pow(z / B.rz, 2)) - 0.015;
      const s = mesh(upper, coneGeo, M.spike, [0, y + 0.03, z], [0.04, 0.07, 0.04]);
      s.rotation.x = -0.3;
    });

    // Tiny arms
    const arms = [-1, 1].map((side) => {
      const a = group(upper, side * 0.155, 0.36, 0.13);
      mesh(a, sphereGeo, M.body, [0, -0.045, 0.01], [0.03, 0.055, 0.03]);
      a.userData.side = side;
      return a;
    });

    // Head (big = cute)
    const head = group(upper, 0, 0.44, 0.17);
    mesh(head, sphereGeo, M.body, [0, 0.1, 0.07], [0.17, 0.15, 0.17]);
    mesh(head, sphereGeo, M.body, [0, 0.06, 0.2], [0.1, 0.075, 0.11]); // snout
    [-1, 1].forEach((s) => mesh(head, sphereGeo, M.dark, [s * 0.035, 0.085, 0.298], [0.012, 0.012, 0.008]));
    const eyes = [-1, 1].map((s) => {
      const e = group(head, s * 0.085, 0.15, 0.2);
      mesh(e, sphereGeo, M.white, [0, 0, 0], [0.045, 0.045, 0.045]);
      mesh(e, sphereGeo, M.pupil, [s * 0.004, -0.002, 0.034], [0.026, 0.026, 0.026]);
      mesh(e, sphereGeo, M.white, [s * 0.012, 0.011, 0.052], [0.009, 0.009, 0.009]); // sparkle
      return e;
    });
    [-1, 1].forEach((s) => {
      const c = mesh(head, sphereGeo, M.cheek, [s * 0.115, 0.065, 0.185], [0.032, 0.022, 0.012]);
      c.rotation.y = s * 0.9;
    });
    const smile = new THREE.Mesh(smileGeo, M.dark);
    smile.rotation.z = Math.PI; // arc opens upward -> smile
    smile.position.set(0, 0.062, 0.303);
    head.add(smile);
    const mouth = mesh(head, sphereGeo, M.mouth, [0, 0.04, 0.29], [0.001, 0.001, 0.03]); // opens when roaring
    mouth.userData.noExport = true; // invisible while closed

    // Tail: 3 chained segments so it can wag in a wave
    const tail = [];
    let parent = upper;
    [
      { pivot: [0, 0.33, -0.17], r: [0.09, 0.08, 0.13], c: -0.1 },
      { pivot: [0, 0, -0.2], r: [0.065, 0.06, 0.11], c: -0.08 },
      { pivot: [0, 0, -0.16], r: [0.042, 0.04, 0.09], c: -0.07 }
    ].forEach((s, i) => {
      const g = group(parent, s.pivot[0], s.pivot[1], s.pivot[2]);
      mesh(g, sphereGeo, M.body, [0, 0, s.c], s.r);
      g.rotation.x = TAIL_BASE_X[i];
      tail.push(g);
      parent = g;
    });

    // Legs (pivot at the hip) + feet + toes
    const legs = [-1, 1].map((s) => {
      const l = group(model, s * 0.095, HIP_Y, -0.01);
      mesh(l, sphereGeo, M.legs, [0, -0.1, 0], [0.06, 0.12, 0.06]);
      mesh(l, sphereGeo, M.feet, [0, -0.2, 0.035], [0.065, 0.03, 0.09]);
      [-1, 0, 1].forEach((t) => mesh(l, sphereGeo, M.toe, [t * 0.028, -0.205, 0.12], [0.014, 0.014, 0.014]));
      return l;
    });

    // Blob shadow (stays on the ground while the dino hops)
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    own.mats.push(shadowMat);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.003;
    shadow.userData.noExport = true; // not part of the exported model

    return { model, shadow, upper, head, eyes, mouth, tail, arms, legs, own };
  }


  // Rest pose used for exporting (the game animates the same parts every frame).
  function pose(rig) {
    rig.arms.forEach((a) => { a.rotation.z = a.userData.side * 0.45; });
    rig.head.rotation.y = 0.15;
  }

  window.AnimalModels.dino = { build, pose, TAIL_BASE_X, label: 'Dinosaur' };
})();
