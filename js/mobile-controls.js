// js/mobile-controls.js
// Moves selected leaflet controls into a compact mobile tray for better touch UX.
(function(){
  function init(){
    if(!window.map) return setTimeout(init, 200);
    if(!window.matchMedia('(max-width:720px)').matches) return;

    // create tray
    if(document.querySelector('.mobile-control-tray')) return;
    const tray = document.createElement('div');
    tray.className = 'mobile-control-tray';
    document.body.appendChild(tray);

    // selectors of controls we want to move (tweak to match your site)
    const selectors = ['.leaflet-control-zoom', '.leaflet-control-scale', '.my-custom-buttons', '.custom-photo-button'];

    selectors.forEach(sel=>{
      const el = document.querySelector(sel);
      if(!el) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'mobile-control';
      wrapper.appendChild(el);
      tray.appendChild(wrapper);
    });

    // add a compact Layers button if layer control exists (to toggle display)
    const layers = document.querySelector('.leaflet-control-layers');
    if(layers){
      const btn = document.createElement('button');
      btn.className = 'touch-btn';
      btn.innerText = 'Layers';
      btn.onclick = ()=> layers.style.display = (layers.style.display === 'block') ? 'none' : 'block';
      tray.appendChild(btn);
    }

    // ensure map redraw after layout changes
    setTimeout(()=>{ if(window.map && window.map.invalidateSize) window.map.invalidateSize(); }, 300);
  }
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
  window.addEventListener('resize', ()=>{ if(window.map && window.map.invalidateSize) window.map.invalidateSize(); });
})();
