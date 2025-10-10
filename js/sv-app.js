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



(function(){
  function onReady(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function findMap(){
    try{
      if(window.map && typeof map.setView==="function" && typeof map.eachLayer==="function") return map;
      if(window.L && L.Map){ var els=document.getElementsByClassName("leaflet-container"); if(els.length && window.map) return window.map; }
    }catch(e){}
    return null;
  }
  function ensureToolbar(){
    var bar=document.getElementById("bottom-toolbar-fixed");
    if(!bar){ bar=document.createElement("div"); bar.id="bottom-toolbar-fixed"; document.body.appendChild(bar); }
    // Inline switches block (inside same bar)
    var inline=document.getElementById("sv-inline");
    if(!inline){
      inline=document.createElement("div"); inline.id="sv-inline"; inline.className="sv-inline";
      inline.innerHTML = "<label><input type='checkbox' id='sv-tog-photos' checked> Photos</label>"
                       + " <label><input type='checkbox' id='sv-tog-pins' checked> Pins</label>";
      bar.appendChild(inline);
    }
    function mk(id, txt, handler){
      var b=document.getElementById(id);
      if(!b){
        b=document.createElement("button"); b.id=id; b.className="sv-btn"; b.textContent=txt; b.onclick=handler;
        // put buttons before switches for nice layout
        bar.insertBefore(b, inline);
      }
      return b;
    }
    return { bar: bar, mk: mk, inline: inline };
  }
  function overlaysOnExceptContours(){
    try{
      var panel = document.querySelector(".leaflet-control-layers-overlays") || document.querySelector(".leaflet-control-layers-list");
      if(!panel) return;
      var labels = panel.querySelectorAll("label");
      labels.forEach(function(lb){
        var name = (lb.textContent||"").toLowerCase();
        var cb = lb.querySelector('input[type="checkbox"]');
        if(!cb) return;
        var isContour = /(^|\W)cont(ours?)?(\W|$)|cont\./i.test(name);
        var shouldBeOn = !isContour;  // turn everything ON except contours
        if(shouldBeOn && !cb.checked) cb.click();
        if(!shouldBeOn && cb.checked) cb.click();
      });
    }catch(e){}
  }
  function wireInlineToggles(map){
    // expects window.SV.photos / SV.pins as L.LayerGroup
    function bind(id, grp){
      var cb = document.getElementById(id);
      if(!cb || !grp) return;
      cb.addEventListener("change", function(){
        try{
          if(this.checked){ if(!map.hasLayer(grp)) map.addLayer(grp); }
          else { if(map.hasLayer(grp)) map.removeLayer(grp); }
        }catch(e){}
      });
      // reflect initial state
      try{
        if(cb.checked && !map.hasLayer(grp)) map.addLayer(grp);
        if(!cb.checked && map.hasLayer(grp)) map.removeLayer(grp);
      }catch(e){}
    }
    if(window.SV){
      bind("sv-tog-photos", SV.photos);
      bind("sv-tog-pins",   SV.pins);
    }
  }
  function relaxZoom(map){
    try{
      if(map.setMinZoom) map.setMinZoom(2);
      if(map.options) map.options.minZoom = 2;
    }catch(e){}
  }
  function killLegacyToolbox(){
    // just in case CSS misses a variant
    var sel = [
      "#left-toolbox",".left-toolbox","#toolbox-left",".toolbox-left",
      "#sidebar",".sidebar"
    ];
    sel.forEach(function(s){
      var el = document.querySelector(s);
      if(el && el.parentNode) try{ el.parentNode.removeChild(el); }catch(e){}
    });
  }
  onReady(function(){
    var tries=0, t = setInterval(function(){
      var map = findMap();
      if(!map){ if(++tries>80){ clearInterval(t);} return; }
      clearInterval(t);

      killLegacyToolbox();
      relaxZoom(map);

      // Ensure our toolbar and add buttons we need
      var UI = ensureToolbar();

      // Locate (ensure present)
      if(!document.getElementById("btn-locate-once")){
        UI.mk("btn-locate-once","📍 Locate",function(){
          if(!("geolocation" in navigator)) return alert("Geolocation unsupported");
          navigator.geolocation.getCurrentPosition(function(pos){
            var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
            var z  = (map.getZoom && map.getZoom()) || 15; if(z<15) z=15;
            map.setView(ll, z);
            try{
              var mk=L.marker(ll); var acc=pos.coords.accuracy||0;
              var c= acc? L.circle(ll,{radius:acc}) : null;
              var g=L.layerGroup(c?[mk,c]:[mk]).addTo(map);
              setTimeout(function(){ try{ map.removeLayer(g);}catch(e){} }, 4000);
            }catch(e){}
          }, function(){ alert("Locate failed"); }, {timeout:8000, maximumAge:300000});
        });
      }

      // Ensure groups exist if your base code hasn't created them yet
      window.SV = window.SV || {};
      SV.pins   = SV.pins   || L.layerGroup().addTo(map);
      SV.photos = SV.photos || L.layerGroup().addTo(map);

      // Turn overlays on (except contours)
      overlaysOnExceptContours();

      // Wire inline Photos/Pins toggles INSIDE the toolbar
      wireInlineToggles(map);
    }, 250);
  });
})();

/* === SV delta: dedupe toolbar, add buttons (Site/Locate/Measure/Pin/Photo) === */
(function(){
  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function findMap(){
    try{
      if(window.map && typeof map.setView==="function" && typeof map.eachLayer==="function") return map;
      if(window.L && L.Map && document.querySelector(".leaflet-container")) return window.map || null;
    }catch(e){}
    return null;
  }
  function oneToolbar(){
    // remove any duplicates by id
    var bars = Array.prototype.slice.call(document.querySelectorAll("#bottom-toolbar-fixed"));
    var bar = bars[0];
    for(var i=1;i<bars.length;i++){ try{ bars[i].parentNode.removeChild(bars[i]); }catch(e){} }
    if(!bar){
      bar = document.createElement("div");
      bar.id = "bottom-toolbar-fixed";
      // basic container look in case CSS is late
      bar.style.position="fixed"; bar.style.left="8px"; bar.style.right="8px"; bar.style.bottom="8px";
      bar.style.zIndex="1500"; bar.style.background="rgba(255,255,255,0.95)";
      bar.style.padding="10px 12px"; bar.style.borderRadius="14px"; bar.style.boxShadow="0 8px 24px rgba(0,0,0,0.25)";
      document.body.appendChild(bar);
    }
    // ensure the inline switches live inside this bar (and only once)
    var inline = document.getElementById("sv-inline");
    if(!inline){
      inline = document.createElement("div");
      inline.id = "sv-inline"; inline.className = "sv-inline";
      inline.innerHTML = "<label><input type='checkbox' id='sv-tog-photos' checked> Photos</label>"
                       + " <label><input type='checkbox' id='sv-tog-pins' checked> Pins</label>";
      bar.appendChild(inline);
    }else{
      if(inline.parentNode !== bar){ try{ bar.appendChild(inline); }catch(e){} }
    }
    function mk(id, text, onClick){
      var b = document.getElementById(id);
      if(!b){
        b = document.createElement("button");
        b.id = id; b.className = "sv-btn"; b.textContent = text;
        b.onclick = onClick;
        // insert buttons before switches
        bar.insertBefore(b, inline);
      }
      return b;
    }
    return {bar:bar, inline:inline, mk:mk};
  }
  function killTopLeft(){
    // we now hide via CSS, but also remove to be 100% sure
    var tl = document.querySelector(".leaflet-top.leaflet-left");
    if(tl && tl.parentNode){ try{ tl.parentNode.removeChild(tl); }catch(e){} }
  }
  function ensureGroups(map){
    window.SV = window.SV || {};
    SV.pins   = SV.pins   || L.layerGroup().addTo(map);
    SV.photos = SV.photos || L.layerGroup().addTo(map);
  }
  function wireSwitches(map){
    function bind(id, grp){
      var cb = document.getElementById(id);
      if(!cb || !grp) return;
      cb.addEventListener("change", function(){
        try{ this.checked ? map.addLayer(grp) : map.removeLayer(grp); }catch(e){}
      });
      try{
        if(cb.checked && !map.hasLayer(grp)) map.addLayer(grp);
        if(!cb.checked && map.hasLayer(grp)) map.removeLayer(grp);
      }catch(e){}
    }
    if(window.SV){ bind("sv-tog-photos", SV.photos); bind("sv-tog-pins", SV.pins); }
  }
  function overlaysOnExceptContours(){
    var panel = document.querySelector(".leaflet-control-layers-overlays") || document.querySelector(".leaflet-control-layers-list");
    if(!panel) return;
    var labels = panel.querySelectorAll("label");
    labels.forEach(function(lb){
      var name = (lb.textContent||"").toLowerCase();
      var cb = lb.querySelector('input[type="checkbox"]');
      if(!cb) return;
      var isContour = /(^|\W)cont(ours?)?(\W|$)|cont\./i.test(name);
      var shouldOn = !isContour;
      if(shouldOn && !cb.checked) cb.click();
      if(!shouldOn && cb.checked) cb.click();
    });
  }
  function addButtons(UI, map){
    // 1) Site (Project) — centers on current map bounds center as fallback
    UI.mk("btn-center-site","🎯 Site", function(){
      try{
        var c = (map.getBounds && map.getBounds().getCenter()) || map.getCenter();
        var z = (map.getZoom && map.getZoom()) || 15; if(z<15) z=15;
        map.setView(c, z);
      }catch(e){}
    });

    // 2) Locate (current position)
    UI.mk("btn-locate-once","📍 Locate", function(){
      if(!("geolocation" in navigator)) return alert("Geolocation unsupported");
      navigator.geolocation.getCurrentPosition(function(pos){
        var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
        var z  = (map.getZoom && map.getZoom()) || 15; if(z<15) z=15;
        map.setView(ll, z);
        try{
          var mk=L.marker(ll);
          var acc=pos.coords.accuracy||0;
          var c = acc? L.circle(ll,{radius:acc}) : null;
          var g=L.layerGroup(c?[mk,c]:[mk]).addTo(map);
          setTimeout(function(){ try{ map.removeLayer(g);}catch(e){} }, 4000);
        }catch(e){}
      }, function(){ alert("Locate failed"); }, {timeout:8000, maximumAge:300000});
    });

    // 3) Measure (simple linear toggle; area mode can be added later)
    (function(){
      var state = { on:false, pts:[], line:null };
      function fmt(m){ return m<1000? (m.toFixed(0)+" m") : ((m/1000).toFixed(2)+" km"); }
      function total(){
        var d=0; for(var i=1;i<state.pts.length;i++){ d += state.pts[i-1].distanceTo(state.pts[i]); } return d;
      }
      function click(ev){
        state.pts.push(ev.latlng);
        if(!state.line){ state.line=L.polyline(state.pts,{color:"#222",weight:3,dashArray:"6,4"}).addTo(map); }
        else { state.line.setLatLngs(state.pts); }
        try{ map.closePopup(); }catch(e){}
      }
      function off(){
        map.off("click", click);
        state.on=false;
        state.pts=[];
        try{ if(state.line){ map.removeLayer(state.line); state.line=null; } }catch(e){}
      }
      UI.mk("btn-measure","📏 Measure", function(){
        if(!state.on){
          state.on=true; state.pts=[];
          map.on("click", click);
          alert("Measuring on: click points; reload or click Measure again to clear.");
        } else {
          off();
          alert("Measuring cleared.");
        }
      });
    })();

    // 4) Pin (place one pin & store only in memory for now)
    (function(){
      UI.mk("btn-pin","📌 Pin", function(){
        alert("Tap the map to drop a pin.");
        var once = function(ev){
          map.off("click", once);
          try{
            L.marker(ev.latlng).addTo(map).bindPopup("<b>New pin</b>").openPopup();
          }catch(e){}
        };
        map.once("click", once);
      });
    })();

    // 5) Photo (opens lightweight capture UI; you can wire your function later)
    (function(){
      UI.mk("btn-photo","📷 Photo", function(){
        alert("Photo UI stub — plug in your capture/upload flow here.");
      });
    })();
  }

  ready(function(){
    var tries=0, t=setInterval(function(){
      var map = findMap();
      if(!map){ if(++tries>80){ clearInterval(t); } return; }
      clearInterval(t);

      // remove any legacy left stack and relax minZoom
      try{ var mz = (map.options && map.options.minZoom); if(mz>2) map.options.minZoom = 2; if(map.setMinZoom) map.setMinZoom(2); }catch(e){}
      killTopLeft();

      // single toolbar
      var UI = oneToolbar();

      // groups + switches + overlays
      ensureGroups(map);
      overlaysOnExceptContours();
      addButtons(UI, map);
      wireSwitches(map);
    }, 250);
  });
})();
