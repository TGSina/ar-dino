// Workaround: some Android Chrome builds don't composite the WebXR projection-layer path (content invisible
// while camera/tracking work). Hiding the layers API makes three.js / A-Frame use the classic layer.
// Verify whether it is still needed on current browsers and remove it when fixed.
//   ?xrlayers=1  keep the browser's layers path (A/B test)      ?xrlayers=0  force the workaround
// NOTE: apps that use WebXR compositor layers on purpose (equirect/quad/cylinder layers) lose them.
(() => {
  window.__xrLayersDisabled = false;
  const mode = new URLSearchParams(location.search).get('xrlayers');
  const ua = navigator.userAgent;
  const isPhone = /Android/.test(ua) && /Mobile/.test(ua) && !/OculusBrowser|Quest/.test(ua);
  if (mode === '1' || (mode !== '0' && !isPhone)) return;
  try {
    if (typeof XRWebGLBinding !== 'undefined' && 'createProjectionLayer' in XRWebGLBinding.prototype) {
      delete XRWebGLBinding.prototype.createProjectionLayer;
      window.__xrLayersDisabled = true;
    }
    if (typeof XRRenderState !== 'undefined' && 'layers' in XRRenderState.prototype) {
      delete XRRenderState.prototype.layers;
    }
  } catch (e) { console.warn('xr-compat failed', e); }
})();
