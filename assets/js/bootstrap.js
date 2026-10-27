// Keep load failures visible even when a dependency fails before app.js executes.
import('./app.js?v=20261027-login-fix').then(()=>{
  window.gremoryPanelReady?.();
}).catch(err=>{
  console.error('[GREMORY BOOT]',err);
  window.gremoryPanelFailed?.(err);
});
