/* js/sv-app.js — SolarVillage UI bundle */
(function(){
  // ===== Config =====
  window.SV_SITE_CENTER = window.SV_SITE_CENTER || { lat: 49.8870, lng: -119.4960 };
  window.SV_GH = window.SV_GH || { slug: "thefranzi/solarvillagemap", branch: "mobile-one-shot-locate" }; // e.g., {slug:"thefranzi/solarvillagemap", branch:"mobile-one-shot-locate"}

  // Silence Leaflet Mixin warning
  (function(){
    var origErr = console.error;
    console.error = function(){
      try{
        var s = Array.prototype.slice.call(arguments).join(" ");
        if(/Deprecated include of L\.Mixin\.Events/.test(s)) return;
      }catch(e){}
      return origErr.apply(console, arguments);
    };
  })();

  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }

  function findMap(){
    try{
      if (window.map && typeof window.map.setView==="function" && typeof window.map.eachLayer==="function") return window.map;
      if (window.L && typeof window.L.Map==="function"){
        for (var k in window){ try{ var v=window[k]; if(v && v._leaflet_id && typeof v.setView==="function" && typeof v.eachLayer==="function") return v; }catch(e){} }
      }
    }catch(e){}
    return null;
  }

  function rawUrl(path){
    var s = (window.SV_GH && window.SV_GH.slug) || "thefranzi/solarvillagemap";
    var b = (window.SV_GH && window.SV_GH.branch) || "mobile-one-shot-locate";
    return "https://raw.githubusercontent.com/"+s+"/"+encodeURIComponent(b)+"/"+path.replace(/^\/+/,'');
  }

  function addBottomBar(){
    var bar = document.getElementById("bottom-toolbar-fixed");
    if(!bar){ bar = document.createElement("div"); bar.id = "bottom-toolbar-fixed"; document.body.appendChild(bar); }
    function mk(id, text, handler){
      if(document.getElementById(id)) return document.getElementById(id);
      var b = document.createElement("button"); b.id=id; b.className="sv-btn"; b.textContent=text; b.addEventListener("click", handler);
      bar.appendChild(b); return b;
    }
    return { bar, mk };
  }

  function ensurePhotoUI(){
    if(document.getElementById("photo-capture")) return;
    var html = ''
      + "<div id=\"photo-capture\" style=\"display:none; position:fixed; left:8px; right:8px; bottom:8vh; z-index:1500; background:#fff; border-radius:10px; padding:12px; box-shadow:0 6px 20px rgba(0,0,0,0.25);\">"
      + "<form id='photoForm'>"
      + "<label for='photoInput' style='display:inline-block; padding:12px 14px; font-size:16px; cursor:pointer;'>Take Photo"
      + "<input id='photoInput' name='photo' type='file' accept='image/*' capture='environment' style='display:none;'></label>"
      + "<div id='photoPreview' style='margin-top:10px;'></div>"
      + "<div style='display:flex; gap:8px; margin-top:10px;'>"
      + "<button id='photoUpload' type='button' style='display:none;'>Upload</button>"
      + "<button id='photoCancel' type='button'>Cancel</button>"
      + "</div>"
      + "<small style='display:block; margin-top:6px; font-size:12px;'>Tap Take Photo → preview → Upload</small>"
      + "</form></div>";
    var div = document.createElement("div"); div.innerHTML = html;
    document.body.appendChild(div.firstChild);

    // wire behavior (compression -> base64 -> function commit + photos layer append)
    const input = document.getElementById('photoInput');
    const preview = document.getElementById('photoPreview');
    const uploadBtn = document.getElementById('photoUpload');
    const cancelBtn = document.getElementById('photoCancel');
    const container = document.getElementById('photo-capture');

    window.openPhotoUI = function(meta){ container.style.display='block'; container.dataset.meta = JSON.stringify(meta||{}); };
    window.closePhotoUI = function(){ container.style.display='none'; preview.innerHTML=''; uploadBtn.style.display='none'; input.value=''; };

    input.addEventListener('change', async (ev)=>{
      const file = ev.target.files && ev.target.files[0]; if(!file) return;
      preview.textContent = 'Preparing preview...';
      const dataUrl = await toCompressedDataUrl(file, 1600);
      preview.innerHTML = "<img id='previewImg' alt='preview' style='max-width:100%;height:auto;border-radius:8px'>";
      document.getElementById('previewImg').src = dataUrl;
      uploadBtn.style.display = 'inline-block';
      uploadBtn.onclick = ()=> uploadPhoto(dataUrl, file.name);
    });
    cancelBtn && (cancelBtn.onclick = ()=> window.closePhotoUI());

    function toCompressedDataUrl(file, maxDim){
      return new Promise((res, rej)=>{
        const img = new Image();
        img.onload = ()=>{
          let w=img.width, h=img.height;
          if(Math.max(w,h)>maxDim){ if(w>h){ h=Math.round(h*(maxDim/w)); w=maxDim; } else { w=Math.round(w*(maxDim/h)); h=maxDim; } }
          const c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          res(c.toDataURL('image/jpeg', 0.78));
        };
        img.onerror = ()=> rej(new Error('Image load failed'));
        img.src = URL.createObjectURL(file);
      });
    }

    async function uploadPhoto(dataUrl, filename){
      const center = (window.map && map.getCenter && map.getCenter()) || L.latLng(SV_SITE_CENTER.lat, SV_SITE_CENTER.lng);
      const meta = { lat:center.lat, lng:center.lng, when: Date.now() };
      const r = await fetch('/.netlify/functions/repo-commit', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ dataUrl, filename, subdir:"uploads" })
      });
      const t = await r.text();
      if(!r.ok){ alert(t); return; }
      const out = JSON.parse(t);
      if(!out.ok){ alert(out.error||"Upload failed"); return; }
      // append feature to photos.geojson
      const feat = { type:"Feature", geometry:{ type:"Point", coordinates:[meta.lng, meta.lat] },
                     properties:{ url: out.url, when: meta.when, name: filename } };
      await fetch('/.netlify/functions/repo-commit', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ feature: feat, geoTarget: "photos" })
      }).catch(()=>{});
      window.closePhotoUI();
      if(window.SV && SV.reloadPhotos) SV.reloadPhotos(true);
      alert("Photo uploaded.");
    }
  }

  ready(function(){
    var map = findMap(); if(!map){ return setTimeout(arguments.callee,200); }
    window.map = map;
    try{ map.setMinZoom && map.setMinZoom(2); }catch(e){}

    // Controls: Layers panel to top-right (if not already)
    try{
      var layersEl=document.querySelector(".leaflet-control-layers");
      var tr=document.querySelector(".leaflet-top.leaflet-right");
      if(layersEl && tr && layersEl.parentElement!==tr){ tr.appendChild(layersEl); }
      layersEl && (layersEl.style.display="block");
    }catch(e){}

    // Bottom toolbar & buttons
    var UI = addBottomBar();

    // 🎯 Site
    UI.mk("btn-center-site", "🎯 Site", function(){
      try{
        var ll = (SV_SITE_CENTER && typeof SV_SITE_CENTER.lat==="number") ? L.latLng(SV_SITE_CENTER.lat, SV_SITE_CENTER.lng)
                 : (map.getBounds && map.getBounds().getCenter()) || L.latLng(49.8870,-119.4960);
        map.setView(ll, Math.max((map.getZoom&&map.getZoom())||15, 15));
        try{ var mk=L.circleMarker(ll,{radius:8,color:"#1976d2"}); var g=L.layerGroup([mk]).addTo(map); setTimeout(()=>{try{map.removeLayer(g)}catch(e){}}, 2000);}catch(e){}
      }catch(e){}
    });

    // 📍 Locate (one-shot)
    UI.mk("btn-locate-once","📍 Locate", function(){
      if(!("geolocation" in navigator)) return alert("Geolocation unsupported");
      navigator.geolocation.getCurrentPosition(function(pos){
        var ll=L.latLng(pos.coords.latitude,pos.coords.longitude);
        var z=Math.max((map.getZoom&&map.getZoom())||15, 15);
        map.setView(ll, z);
        var mk=L.marker(ll); var acc=pos.coords.accuracy||0; var c=acc?L.circle(ll,{radius:acc}):null;
        var grp=L.layerGroup(c?[mk,c]:[mk]).addTo(map); setTimeout(()=>{try{map.removeLayer(grp)}catch(e){}}, 5000);
      }, function(e){ alert("Locate failed: "+(e&&e.message?e.message:e)); }, {timeout:8000, maximumAge:300000});
    });

    // 📏 Measure
    (function(){
      const chip = document.createElement("div"); chip.className="sv-chip"; chip.style.display="none"; document.body.appendChild(chip);
      function showChip(txt){ chip.textContent=txt; chip.style.display="block"; }
      function hideChip(){ chip.style.display="none"; }
      const state = { active:false, pts:[], line:null, dist:0 };
      function fmt(m){ if(m<1000) return m.toFixed(0)+" m"; return (m/1000).toFixed(2)+" km"; }
      function update(){
        if(state.line){ state.line.setLatLngs(state.pts); }
        let d=0; for(let i=1;i<state.pts.length;i++){ d += state.pts[i-1].distanceTo(state.pts[i]); }
        state.dist=d; showChip("Distance: "+fmt(d)+"  (tap to add, double-tap to finish)");
      }
      function finish(){
        state.active=false; hideChip();
        map.off("click", onClick); map.off("dblclick", onDbl);
      }
      function onClick(ev){
        state.pts.push(ev.latlng);
        if(!state.line){ state.line=L.polyline(state.pts,{ color:"#222", weight:3, dashArray:"6,4" }).addTo(map); }
        update();
      }
      function onDbl(){ finish(); }

      UI.mk("btn-measure","📏 Measure", function(){
        if(!state.active){
          state.active=true; state.pts=[]; if(state.line){ try{ map.removeLayer(state.line);}catch(e){} state.line=null; }
          showChip("Distance: 0 m  (tap to add, double-tap to finish)");
          map.on("click", onClick); map.on("dblclick", onDbl);
        } else {
          finish();
        }
      });
    })();

    // 📌 Pin add + Pins/Photos layers + toggles
    window.SV = window.SV || {};
    SV.pins = L.layerGroup().addTo(map);
    SV.photos = L.layerGroup().addTo(map);

    function loadGeo(url, group, kind){
      return fetch(url+"?t="+Date.now()).then(r=>{ if(!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(j=>{
        group.clearLayers();
        (j.features||[]).forEach(f=>{
          if(!f || !f.geometry || f.geometry.type!=="Point") return;
          var c=f.geometry.coordinates, latlng=L.latLng(c[1],c[0]);
          if(kind==="photos"){
            var html = (f.properties && f.properties.url) ? "<img src='"+f.properties.url+"' style='max-width:240px;height:auto;border-radius:6px'>" : "Photo";
            L.marker(latlng).bindPopup(html).addTo(group);
          }else{
            var name=(f.properties&&f.properties.name)||"Pin";
            var desc=(f.properties&&f.properties.desc)||"";
            L.marker(latlng).bindPopup("<b>"+name+"</b><br>"+desc).addTo(group);
          }
        });
      }).catch(()=>{ /* ok if 404 */ });
    }

    SV.reloadPins   = (hard)=> loadGeo(rawUrl("data/pins.geojson"), SV.pins, "pins");
    SV.reloadPhotos = (hard)=> loadGeo(rawUrl("data/photos.geojson"), SV.photos, "photos");
    SV.reloadPins(); SV.reloadPhotos();

    // Add overlay toggles into existing Layers panel (top-right)
    (function addToggles(retry){
      try{
        var panel = document.querySelector(".leaflet-control-layers-overlays") || document.querySelector(".leaflet-control-layers-list");
        if(!panel) throw "no panel";
        function addToggle(label, group){
          var id = "sv-chk-"+label.toLowerCase();
          if(document.getElementById(id)) return;
          var div=document.createElement("label"); div.style.display="block"; div.style.cursor="pointer";
          div.innerHTML = "<input type='checkbox' id='"+id+"' checked> "+label;
          panel.appendChild(div);
          var box = div.querySelector("input");
          box.checked = true; if(!map.hasLayer(group)) map.addLayer(group);
          box.addEventListener("change", function(){
            if(this.checked){ map.addLayer(group); } else { map.removeLayer(group); }
          });
        }
        addToggle("Photos", SV.photos);
        addToggle("Pins", SV.pins);
        // Ensure contours off at startup via labels search
        Array.from(panel.querySelectorAll("label")).forEach(function(lb){
          var t=(lb.textContent||"").toLowerCase();
          var cb=lb.querySelector("input[type=checkbox]");
          if(cb && /contour/.test(t) && cb.checked){ cb.click(); }
        });
      }catch(e){ if((retry||0)<40) setTimeout(function(){ addToggles((retry||0)+1); }, 250); }
    })();

    // 📌 Pin add mode
    (function(){
      let pending = null;
      function promptPin(latlng){
        const name = window.prompt("Pin title?");
        if(name===null) return; // cancelled
        const desc = window.prompt("Description? (optional)") || "";
        const feat = { type:"Feature", geometry:{ type:"Point", coordinates:[latlng.lng, latlng.lat] }, properties:{ name, desc, when: Date.now() } };
        fetch('/.netlify/functions/repo-commit', {
          method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ feature: feat, geoTarget: "pins" })
        }).then(r=>r.json()).then(()=>{ SV.reloadPins(true); alert("Pin saved."); })
          .catch(e=> alert("Pin save failed: "+e));
      }
      function onClick(ev){ map.off("click", onClick); pending=false; promptPin(ev.latlng); }
      var btn = document.getElementById("btn-pin");
      if(!btn){
        var UIbar=document.getElementById("bottom-toolbar-fixed");
        btn=document.createElement("button"); btn.id="btn-pin"; btn.className="sv-btn"; btn.textContent="📌 Pin";
        UIbar.appendChild(btn);
      }
      btn.addEventListener("click", function(){
        if(pending){ map.off("click", onClick); pending=false; alert("Pin mode off"); return; }
        pending=true; alert("Tap the map to place a pin…"); map.once("click", onClick);
      });
    })();

    // 📷 Photo UI and button
    ensurePhotoUI();
    (function(){
      var UIbar=document.getElementById("bottom-toolbar-fixed");
      if(!document.getElementById("btn-photo")){
        var b=document.createElement("button"); b.id="btn-photo"; b.className="sv-btn"; b.textContent="📷 Photo";
        b.addEventListener("click", function(){ window.openPhotoUI({ from:"toolbar" }); });
        UIbar.appendChild(b);
      }
    })();

  }); // ready
})();
