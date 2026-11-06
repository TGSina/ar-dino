// Sky, ground disc and grid used only by the non-AR "Preview" mode.
// Shown when app state mode === 'preview'; moved to the floor height announced by 'preview:floor'.
AFRAME.registerComponent('preview-backdrop', {
  init() {
    const THREE = AFRAME.THREE;
    this.groundGeo = new THREE.CircleGeometry(4, 48);
    this.groundGeo.rotateX(-Math.PI / 2);
    this.groundMat = new THREE.MeshBasicMaterial({ color: 0xcdeccd });
    const ground = new THREE.Mesh(this.groundGeo, this.groundMat);
    ground.position.y = -0.002;
    this.grid = new THREE.GridHelper(8, 16, 0x6fa8dc, 0x9cc7ea);
    this.el.setObject3D('ground', ground);
    this.el.setObject3D('grid', this.grid);
    this.el.object3D.visible = false;

    this.onState = (e) => { this.el.object3D.visible = e.detail.next.mode === 'preview'; };
    this.onFloor = (e) => { this.el.object3D.position.y = e.detail.y; };
    this.el.sceneEl.addEventListener('app:state-changed', this.onState);
    this.el.sceneEl.addEventListener('preview:floor', this.onFloor);
  },

  remove() {
    this.el.sceneEl.removeEventListener('app:state-changed', this.onState);
    this.el.sceneEl.removeEventListener('preview:floor', this.onFloor);
    this.el.removeObject3D('ground');
    this.el.removeObject3D('grid');
    this.groundGeo.dispose();
    this.groundMat.dispose();
    this.grid.geometry.dispose();
    this.grid.material.dispose();
  }
});
