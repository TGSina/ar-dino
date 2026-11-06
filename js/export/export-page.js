// Wiring for export.html: preview a model, then save it as GLB / OBJ(+MTL) / STL.
(() => {
  const $ = (id) => document.getElementById(id);

  AFRAME.registerComponent('spin', {
    schema: { speed: { default: 25 } }, // degrees per second
    tick(time, dt) {
      this.el.object3D.rotation.y += (this.data.speed * Math.PI / 180) * (dt / 1000);
    }
  });

  function init(scene) {
    const holder = $('preview-model');
    const select = $('animal');
    const status = $('export-status');
    let rig = null;

    Object.keys(window.AnimalModels).forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = window.AnimalModels[key].label || key;
      select.appendChild(opt);
    });

    function show(key) {
      if (rig) {
        holder.removeObject3D('model');
        rig.own.geos.forEach((g) => g.dispose());
        rig.own.mats.forEach((m) => m.dispose());
      }
      const def = window.AnimalModels[key];
      rig = def.build();
      if (def.pose) def.pose(rig);
      holder.setObject3D('model', rig.model);
      status.textContent = 'Ready. Pick a format to save.';
    }

    function run(format) {
      try {
        const sizeMm = Number($('size-mm').value) || 100;
        const files = window.ModelExport.exportObject(rig.model, format, { name: select.value, sizeMm });
        window.ModelExport.download(files);
        status.textContent = 'Saved: ' + files.map((f) => f.filename).join(' + ');
      } catch (err) {
        console.error(err);
        status.textContent = 'Export failed: ' + err.message;
      }
    }

    select.addEventListener('change', () => show(select.value));
    $('btn-glb').addEventListener('click', () => run('glb'));
    $('btn-obj').addEventListener('click', () => run('obj'));
    $('btn-stl').addEventListener('click', () => run('stl'));
    show(select.value);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene.hasLoaded) init(scene);
    else scene.addEventListener('loaded', () => init(scene));
  });
})();
