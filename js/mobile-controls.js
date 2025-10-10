// js/mobile-controls.js — small helper to create bottom tray and move controls on mobile
(function(){
  function init(){
    if(!window.map) return setTimeout(init, 200);
    if(!window.matchMedia('(max-width:720px)').matches) {
      // still create bottom toolbar for all viewports so Site+Locate available
    }
    if(document.getElementById('bottom-toolbar-fixed')) return;

    const tray = document.createElement('div');
    tray.id = 'bottom-toolbar-fixed';
    document.body.appendChild(tray);

    // If there is a pre-existing zoom control, move a clone into tray
    const zoom = document.querySelector('.leaflet-control-zoom');
    if(zoom){
      const clone = zoom.cloneNode(true);
      clone.style.display = 'inline-flex';
      tray.appendChild(clone);
    }

    // Ensure site & locate buttons exist - they will be wired by site-ui-utils.js if present
    // (buttons may be appended there; this file ensures the container exists)
  }
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
})();
