// Activate with ?xrdebug=1 . Logs which render path the XR session used; readable after exiting XR.
(() => {
  if (new URLSearchParams(location.search).get('xrdebug') !== '1') return;
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;margin:0;padding:6px;font:11px monospace;' +
    'background:#000c;color:#9fffb0;z-index:99999;white-space:pre-wrap;max-height:40vh;overflow:auto';
  const log = (m) => { box.textContent += m + '\n'; };
  addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
  log(`${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]}  xr-compat disabled layers: ${window.__xrLayersDisabled}`);
  const xr = navigator.xr;
  if (!xr?.requestSession) { log('WebXR not available'); return; }
  const original = xr.requestSession.bind(xr);
  const describe = (s) => {
    const rs = s.renderState, bl = rs.baseLayer;
    return `baseLayer=${bl ? 'XRWebGLLayer ' + bl.framebufferWidth + 'x' + bl.framebufferHeight : 'null'} ` +
           `layers=${rs.layers ? rs.layers.length : 'n/a'} blend=${s.environmentBlendMode}`;
  };
  xr.requestSession = async (mode, init) => {
    log(`requestSession(${mode}) ${JSON.stringify(init || {})}`);
    const s = await original(mode, init);
    setTimeout(() => log('+1.5s ' + describe(s)), 1500);
    s.addEventListener('end', () => log('ended: ' + describe(s)));
    return s;
  };
})();
