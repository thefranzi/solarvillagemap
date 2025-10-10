(function(){
  // SV-LOCAL-DATA-SWITCH: prefer local data/ when on localhost
  function svIsLocal(){ try{ return (location.hostname==="localhost" || location.hostname==="127.0.0.1"); }catch(e){ return false; } }
  function svReady(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function svFindMap(){
    try{
      if(window.map && typeof window.map.setView==="function" && typeof window.map.eachLayer==="function") return window.map;
      if(window.L && window.L.Map){
        var els=document.getElementsByClassName("leaflet-container");
        if(els && els.length && window.map) return window.map;
      }
    }catch(e){}
    return null;
  }
  function svEnsureToolbar(){
    var bar=document.getElementById("bottom-toolbar-fixed");
    if(!bar){ bar=document.createElement("div"); bar.id="bottom-toolbar-fixed"; document.body.appendChild(bar); }
    function mk(id, txt, fn){
      var b=document.getElementById(id); if(b){ return b; }
      b=document.createElement("button"); b.id=id; b.className="sv-btn"; b.textContent=txt; b.onclick=fn; bar.appendChild(b); return b;
    }
    return {bar:bar, mk:mk};
  }
  function svEnsureSwitches(map){
    var row=document.getElementById("sv-switches");
    if(!row){
      row=document.createElement("div"); row.id="sv-switches";
      row.innerHTML = "<label><input type='checkbox' id='sv-tog-photos' checked> Photos</label>"
                    + " <label><input type='checkbox' id='sv-tog-pins' checked> Pins</label>";
      document.body.appendChild(row);
    }
    function bind(id, grp){
      var cb=document.getElementById(id);
      if(!cb) return;
      cb.addEventListener("change", function(){
        try{
          if(this.checked){ if(!map.hasLayer(grp)) map.addLayer(grp); }
          else { if(map.hasLayer(grp)) map.removeLayer(grp); }
        }catch(e){}
      });
    }
    if(window.SV){
      bind("sv-tog-photos", SV.photos);
      bind("sv-tog-pins", SV.pins);
    }
  }

  function svRelaxZoom(map){
    try{
      if(map.setMinZoom) map.setMinZoom(2);
      if(map.options){ map.options.minZoom=2; }
      if(map.setMaxBounds) map.setMaxBounds(null);
      if(map.options){ map.options.maxBounds=null; }
    }catch(e){}
  }

  function svDataLoaders(map){
    window.SV = window.SV || {};
    SV.pins   = SV.pins   || L.layerGroup().addTo(map);
    SV.photos = SV.photos || L.layerGroup().addTo(map);

    function rawUrl(rel){
      // if localhost -> load from local files; else from GitHub raw
      if (svIsLocal()) return rel;
      var slug="thefranzi/solarvillagemap", branch="mobile-one-shot-locate";
      return "https://raw.githubusercontent.com/"+slug+"/"+branch+"/"+rel;
    }
    function loadGeo(url, grp, kind){
      return fetch(url + (url.indexOf("?")>=0 ? "" : "?t="+(new Date()).getTime()))
        .then(function(r){ if(!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(function(j){
          try{ grp.clearLayers(); }catch(e){}
          var feats=(j && j.features) || [];
          for(var i=0;i<feats.length;i++){
            var f=feats[i]; if(!f||!f.geometry||f.geometry.type!=="Point") continue;
            var c=f.geometry.coordinates; var ll=L.latLng(c[1],c[0]);
            if(kind==="photos"){
              var u=f.properties && f.properties.url;
              var cm=f.properties && f.properties.comment;
              var html=(u?("<img src='"+u+"' style='max-width:240px;height:auto;border-radius:6px'><br>"):"")+"<small>"+(cm||"")+"</small>";
              L.marker(ll).bindPopup(html).addTo(grp);
            } else {
              var nm=(f.properties&&f.properties.name)||"Pin";
              var ds=(f.properties&&f.properties.desc)||"";
              L.marker(ll).bindPopup("<b>"+nm+"</b><br>"+ds).addTo(grp);
            }
          }
        })
        .catch(function(){ /* silent on 404 locally */ });
    }
    SV.reloadPins   = function(){ return loadGeo( rawUrl("data/pins.geojson"),   SV.pins,   "pins" ); };
    SV.reloadPhotos = function(){ return loadGeo( rawUrl("data/photos.geojson"), SV.photos, "photos" ); };
  }

  svReady(function(){
    var tries=0, t=setInterval(function(){
      var map = svFindMap();
      if(!map){ if(++tries>80) clearInterval(t); return; }
      clearInterval(t);

      svRelaxZoom(map);

      // Make sure our toolbar exists + add Locate if missing
      var UI = svEnsureToolbar();
      if(!document.getElementById("btn-locate-once")){
        UI.mk("btn-locate-once", "📍 Locate", function(){
          if(!("geolocation" in navigator)) return alert("Geolocation unsupported");
          navigator.geolocation.getCurrentPosition(function(pos){
            var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
            var z  = (map.getZoom && map.getZoom()) || 15; if(z<15) z=15;
            map.setView(ll, z);
            try{
              var mk=L.marker(ll); var acc=pos.coords.accuracy||0;
              var c= acc? L.circle(ll, {radius:acc}) : null;
              var g=L.layerGroup(c?[mk,c]:[mk]).addTo(map);
              setTimeout(function(){ try{ map.removeLayer(g);}catch(e){} }, 4000);
            }catch(e){}
          }, function(){ alert("Locate failed"); }, {timeout:8000, maximumAge:300000});
        });
      }

      // Ensure groups + initial load (local-aware)
      svDataLoaders(map);
      if(window.SV){ SV.reloadPins(); SV.reloadPhotos(); }

      // Add Photos/Pins toggles row
      svEnsureSwitches(map);
    }, 250);
  });
})();

