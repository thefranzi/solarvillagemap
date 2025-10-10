(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function afterMap(fn){ if(window.map) fn(); else setTimeout(()=>afterMap(fn), 200); }

  ready(function(){ afterMap(function(){

    // 1) Allow deeper zoom-out
    try{
      if (typeof map.setMinZoom === 'function') map.setMinZoom(2);
      if (map && map.options) map.options.minZoom = Math.min(map.options.minZoom||10, 2);
      if (map.eachLayer){
        map.eachLayer(function(lyr){
          if(lyr && lyr.options){
            if('minZoom' in lyr.options) lyr.options.minZoom = Math.min(lyr.options.minZoom, 2);
            if('minNativeZoom' in lyr.options) lyr.options.minNativeZoom = Math.min(lyr.options.minNativeZoom, 2);
          }
        });
      }
    } catch(e){ console.warn('minZoom patch failed', e); }

    // 2) Ensure Layers control is visible & in top-right corner
    try{
      var layersCtrl = document.querySelector('.leaflet-control-layers');
      var topRight = document.querySelector('.leaflet-top.leaflet-right');
      if(layersCtrl && topRight && layersCtrl.parentElement !== topRight){ topRight.appendChild(layersCtrl); }
      if(layersCtrl){ layersCtrl.style.display = 'block'; layersCtrl.style.removeProperty('display'); }
    } catch(e){ console.warn('layers placement failed', e); }

    // 3) Bottom toolbar: reuse existing or create new fixed bar
    var bar = document.getElementById('bottom-toolbar') || document.querySelector('.bottom-toolbar');
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'bottom-toolbar-fixed';
      document.body.appendChild(bar);
    }

    // 3a) Remove any bottom 'Layers' button (by id or text match)
    try{
      var candidates = Array.from(bar.querySelectorAll('button, a'));
      candidates.forEach(function(el){
        var txt = (el.textContent||'').toLowerCase();
        if(el.id === 'btn-layers' || /layers?/.test(txt)){ el.remove(); }
      });
    }catch(e){}

    // 3b) Add '🎯 Site' button if missing
    if(!document.getElementById('btn-center-site')){
      var btnSite = document.createElement('button');
      btnSite.id = 'btn-center-site';
      btnSite.className = 'sv-btn';
      btnSite.title = 'Center on site';
      btnSite.innerText = '🎯 Site';
      btnSite.addEventListener('click', function(){
        try{
          var ll = L.latLng(49.8870, -119.4960);
          var targetZoom = Math.max((map.getZoom&&map.getZoom())||15, 15);
          map.setView(ll, targetZoom);
          // Pulse marker briefly
          var mk = L.circleMarker(ll, {radius:8, color:'#1976d2', fillColor:'#1976d2', fillOpacity:0.85});
          var grp = L.layerGroup([mk]).addTo(map);
          var tick=0, t = setInterval(function(){ try{ tick++; mk.setRadius(8+(tick%6)); if(tick>15){ clearInterval(t); map.removeLayer(grp);} }catch(e){ clearInterval(t);} }, 160);
        }catch(e){ alert('Cannot center: '+e.message); }
      });
      bar.appendChild(btnSite);
    }

    // 3c) Add '📍 Locate' (one-shot, no tracking) if missing
    if(!document.getElementById('btn-locate-once')){
      var btnLoc = document.createElement('button');
      btnLoc.id = 'btn-locate-once';
      btnLoc.className = 'sv-btn';
      btnLoc.title = 'Locate me (one time)';
      btnLoc.innerText = '📍 Locate';
      btnLoc.addEventListener('click', function(){
        if(!('geolocation' in navigator)){ return alert('Geolocation not supported'); }
        btnLoc.disabled = true;
        var opts = { enableHighAccuracy:false, timeout:8000, maximumAge:300000 };
        navigator.geolocation.getCurrentPosition(function(pos){
          try{
            var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
            var acc = pos.coords.accuracy||0;
            var zoom = Math.max((map.getZoom&&map.getZoom())||12, 15);
            map.setView(ll, zoom);
            var mk = L.marker(ll);
            var circ = acc>0 ? L.circle(ll, {radius:acc}) : null;
            var grp = L.layerGroup(circ?[mk,circ]:[mk]).addTo(map);
            setTimeout(function(){ try{ map.removeLayer(grp);}catch(e){} }, 5000);
          } finally { btnLoc.disabled = false; }
        }, function(err){
          console.warn('Locate failed', err);
          alert('Could not get location: ' + (err && err.message ? err.message : 'Unknown error'));
          btnLoc.disabled = false;
        }, opts);
      });
      bar.appendChild(btnLoc);
    }

    // 4) Turn on all overlays except contours at startup (by UI checkbox to preserve handlers)
    (function enableOverlaysExceptContours(retries){
      try{
        var panel = document.querySelector('.leaflet-control-layers');
        // open/expand panel if collapsible
        if(panel && panel.classList.contains('leaflet-control-layers-collapsed')){
          panel.classList.remove('leaflet-control-layers-collapsed');
        }
        var labels = panel ? panel.querySelectorAll('.leaflet-control-layers-overlays label') : [];
        if(!labels || labels.length===0) throw new Error('no overlay labels found yet');

        labels.forEach(function(lb){
          var name = (lb.textContent||'').trim().toLowerCase();
          var isContour = /contour|contours|cont\./.test(name);
          var input = lb.querySelector('input[type=checkbox]');
          if(!input) return;
          // Desired state: ON unless contours -> OFF
          var shouldBeOn = !isContour;
          if(shouldBeOn && !input.checked){ input.click(); }   // turn ON
          if(!shouldBeOn && input.checked){ input.click(); }   // turn OFF
        });

        // collapse again (optional)
        if(panel && !panel.classList.contains('leaflet-control-layers-expanded')){
          // no-op; modern Leaflet just toggles class
        }
      } catch(e){
        if((retries||0) < 25){ return setTimeout(function(){ enableOverlaysExceptContours((retries||0)+1); }, 200); }
        console.warn('Could not toggle overlays by UI:', e);
      }
    })();

  });});
})();
