(function(){
  // ---- Config ----
  window.SV_SITE_CENTER = window.SV_SITE_CENTER || { lat: 49.8870, lng: -119.4960 }; // adjust if needed
  window.SV = window.SV || {};
  SV.layers = SV.layers || {};
  SV.state  = SV.state  || {};

  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function $(sel){ return document.querySelector(sel); }
  function el(tag, props){ var n=document.createElement(tag); if(props){ for(var k in props){ if(k==="text") n.textContent=props[k]; else n.setAttribute(k, props[k]); } } return n; }
  function showChip(t){ var c=$(".sv-chip"); if(!c){ c=el("div"); c.className="sv-chip"; document.body.appendChild(c); } c.textContent=t; c.style.display="block"; clearTimeout(showChip._t); showChip._t=setTimeout(function(){ c.style.display="none"; }, 2500); }
  function ensureBar(){ var b=$("#bottom-toolbar-fixed"); if(!b){ b=el("div",{id:"bottom-toolbar-fixed"}); document.body.appendChild(b); } return b; }
  function addBtn(id, label, onClick){ var b=document.getElementById(id); if(b) return b; b=el("button"); b.id=id; b.className="sv-btn"; b.textContent=label; b.onclick=onClick; ensureBar().appendChild(b); return b; }
  function ensureMenu(id){ var m=document.getElementById(id); if(!m){ m=el("div",{id:id}); m.className="sv-menu"; document.body.appendChild(m); } return m; }
  function openMenu(m){ closeMenus(); m.style.display="block"; }
  function closeMenus(){ var menus=document.getElementsByClassName("sv-menu"); for(var i=0;i<menus.length;i++){ menus[i].style.display="none"; } }

  // ---- Map detection (we don’t create it; we augment an existing Leaflet map) ----
  function getMap(){
    try {
      if (window.map && typeof map.setView==="function" && typeof map.eachLayer==="function") return window.map;
      if (window.L && L.Map) {
        // try to find existing map instances attached to DOM; fallback to guessing
        var c=document.getElementsByClassName("leaflet-container");
        if (c.length) return window.map || null;
      }
    } catch(e){}
    return null;
  }

  // ---- Pins/Photos layers + loaders ----
  function ensureLayers(map){
    if(!SV.layers.pins){ SV.layers.pins = L.layerGroup().addTo(map); }
    if(!SV.layers.photos){ SV.layers.photos = L.layerGroup().addTo(map); }
  }
  function rawBase(){ return "https://raw.githubusercontent.com/thefranzi/solarvillagemap/mobile-one-shot-locate"; }
  function loadGeo(url, group, kind){
    return fetch(url + "?t=" + Date.now())
      .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(j){
        try{ group.clearLayers(); }catch(e){}
        var feats = (j && j.features) || [];
        for(var i=0;i<feats.length;i++){
          var f=feats[i]; if(!f||!f.geometry||f.geometry.type!=="Point") continue;
          var c=f.geometry.coordinates; var ll=L.latLng(c[1],c[0]);
          if(kind==="photos"){
            var u=f.properties && f.properties.url;
            var cap=f.properties && f.properties.caption || "";
            var html=(u?("<img src='"+u+"' style='max-width:240px;height:auto;border-radius:6px'>"):"(photo)") + (cap?("<div style='margin-top:6px'>"+cap+"</div>"):"");
            L.marker(ll).bindPopup(html).addTo(group);
          } else {
            var nm=(f.properties&&f.properties.name)||"Pin";
            var ds=(f.properties&&f.properties.desc)||"";
            L.marker(ll).bindPopup("<b>"+nm+"</b><br>"+ds).addTo(group);
          }
        }
      }).catch(function(){ /* ignore 404 until files exist */ });
  }
  SV.reloadPins   = function(){ var url = rawBase() + "/data/pins.geojson";   if(SV.layers.pins)   return loadGeo(url, SV.layers.pins, "pins"); };
  SV.reloadPhotos = function(){ var url = rawBase() + "/data/photos.geojson"; if(SV.layers.photos) return loadGeo(url, SV.layers.photos, "photos"); };

  // ---- Small geodesy helpers (haversine + polygon area) ----
  function toRad(x){ return x*Math.PI/180; }
  function hav(a,b){
    var R=6371008.8, dLat=toRad(b.lat-a.lat), dLon=toRad(b.lng-a.lng);
    var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)*Math.sin(dLon/2);
    return 2*R*Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
  }
  function polyArea(lls){
    if(lls.length<3) return 0;
    var R=6371008.8, area=0;
    for(var i=0;i<lls.length;i++){
      var p1=lls[i], p2=lls[(i+1)%lls.length];
      area += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
    }
    return Math.abs(area*R*R/2);
  }
  function fmtLen(m){ return m<1000 ? (m.toFixed(0)+" m") : ((m/1000).toFixed(2)+" km"); }
  function fmtArea(m2){ return m2<1e6 ? (m2.toFixed(0)+" m²") : ((m2/1e6).toFixed(2)+" km²"); }

  // ---- Measure tool (Line / Area / Clear) ----
  function wireMeasure(map){
    var menu=ensureMenu("sv-menu-measure");
    if(!menu.dataset.ready){
      menu.innerHTML = ""
        + "<h4>Measure</h4>"
        + "<div class='row'>"
        + "<button id='sv-meas-line'>Line</button>"
        + "<button id='sv-meas-area'>Area</button>"
        + "<button id='sv-meas-clear'>Clear</button>"
        + "</div>";
      menu.dataset.ready="1";
      document.body.addEventListener("click", function(ev){
        if(!menu.contains(ev.target) && ev.target.id!=="btn-measure"){ menu.style.display="none"; }
      });
    }
    var st = SV.state.measure || (SV.state.measure = { mode:null, pts:[], gfx:null });

    function end(){
      map.off("click", onClick);
      map.off("dblclick", onDbl);
      st.mode=null; st.pts=[];
      showChip("Measurement finished");
    }
    function onDbl(){ end(); }

    function redraw(){
      if(st.gfx){ try{ map.removeLayer(st.gfx); }catch(e){} st.gfx=null; }
      if(st.mode==="line" && st.pts.length){
        st.gfx = L.polyline(st.pts, { color:"#222", weight:3, dashArray:"6,4" }).addTo(map);
        var d=0; for(var i=1;i<st.pts.length;i++){ d+=hav(st.pts[i-1], st.pts[i]); }
        showChip("Distance: " + fmtLen(d) + "  (double-tap to finish)");
      } else if(st.mode==="area" && st.pts.length>=3){
        st.gfx = L.polygon(st.pts, { color:"#222", weight:2, fillOpacity:0.08 }).addTo(map);
        var a = polyArea(st.pts);
        showChip("Area: " + fmtArea(a) + "  (double-tap to finish)");
      }
    }
    function onClick(ev){
      st.pts.push(ev.latlng);
      redraw();
    }

    document.getElementById("sv-meas-line").onclick = function(){
      closeMenus(); st.mode="line"; st.pts=[]; redraw();
      map.on("click", onClick); map.on("dblclick", onDbl);
      showChip("Tap map to add points (Line)");
    };
    document.getElementById("sv-meas-area").onclick = function(){
      closeMenus(); st.mode="area"; st.pts=[]; redraw();
      map.on("click", onClick); map.on("dblclick", onDbl);
      showChip("Tap map to add vertices (Area)");
    };
    document.getElementById("sv-meas-clear").onclick = function(){
      closeMenus(); st.mode=null; st.pts=[];
      if(st.gfx){ try{ map.removeLayer(st.gfx);}catch(e){} st.gfx=null; }
      showChip("Cleared measurements");
    };
  }

  // ---- Camera UI (take photo, set location, add comment, upload) ----
  function ensurePhotoUI(map){
    var menu=ensureMenu("sv-menu-camera");
    if(!menu.dataset.ready){
      menu.innerHTML = ""
        + "<h4>Camera</h4>"
        + "<div class='row'><button id='sv-photo-take'>Take Picture</button>"
        + "<button id='sv-photo-loc'>Set Location</button></div>"
        + "<div class='row'><label>Comment<input id='sv-photo-comment' type='text' placeholder='Optional note'></label></div>"
        + "<div class='row'><button id='sv-photo-upload'>Upload</button><button id='sv-photo-cancel'>Cancel</button></div>"
        + "<div id='sv-photo-preview' style='padding:8px'></div>";
      menu.dataset.ready="1";
      document.body.addEventListener("click", function(ev){
        if(!menu.contains(ev.target) && ev.target.id!=="btn-photo"){ menu.style.display="none"; }
      });
    }

    var state = SV.state.camera || (SV.state.camera = { dataUrl:null, where:null });
    var preview = document.getElementById("sv-photo-preview");

    function showPreview(){
      preview.innerHTML = state.dataUrl ? "<img src='"+state.dataUrl+"' style='max-width:100%;height:auto;border-radius:8px'>" : "(no image yet)";
      var where = state.where || (map.getCenter ? map.getCenter() : SV_SITE_CENTER);
      var comment = document.getElementById("sv-photo-comment").value || "";
      preview.insertAdjacentHTML("beforeend", "<div style='margin-top:6px;font-size:12px;opacity:.8'>"
        + "Location: " + where.lat.toFixed(5)+", "+where.lng.toFixed(5)
        + (comment ? " · Note: "+comment : "")
        + "</div>");
    }

    document.getElementById("sv-photo-take").onclick = function(){
      closeMenus(); openMenu(menu);
      var input = el("input", { type:"file", accept:"image/*", capture:"environment", style:"display:none" });
      input.onchange = function(ev){
        var file = ev.target && ev.target.files && ev.target.files[0]; if(!file) return;
        var r = new FileReader();
        r.onload = function(){ // compress to ~1600 max dim
          var img=new Image();
          img.onload = function(){
            var w=img.width,h=img.height,max=1600;
            if(Math.max(w,h)>max){ if(w>h){ h=Math.round(h*(max/w)); w=max; } else { w=Math.round(w*(max/h)); h=max; } }
            var c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
            state.dataUrl = c.toDataURL("image/jpeg",0.78);
            showPreview();
          };
          img.src = r.result;
        };
        r.readAsDataURL(file);
      };
      document.body.appendChild(input); input.click(); setTimeout(function(){ document.body.removeChild(input); }, 0);
    };

    document.getElementById("sv-photo-loc").onclick = function(){
      closeMenus(); openMenu(menu);
      showChip("Tap the map to set photo location…");
      var once = function(ev){
        map.off("click", once);
        state.where = ev.latlng;
        showPreview();
      };
      map.once("click", once);
    };

    document.getElementById("sv-photo-upload").onclick = function(){
      if(!state.dataUrl){ alert("No image yet. Tap Take Picture first."); return; }
      var where = state.where || (map.getCenter ? map.getCenter() : SV_SITE_CENTER);
      var note = document.getElementById("sv-photo-comment").value || "";
      // 1) upload image
      fetch("/.netlify/functions/repo-commit", {
        method:"POST", headers:{ "content-type":"application/json" },
        body: JSON.stringify({ dataUrl: state.dataUrl, filename: "photo-"+Date.now()+".jpg", subdir: "uploads" })
      })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(!j || !j.ok || !j.url){ throw new Error("upload failed"); }
        // 2) append feature to photos.geojson
        var feat = {
          type:"Feature",
          geometry:{ type:"Point", coordinates:[ where.lng, where.lat ] },
          properties:{ url:j.url, caption: note, when: Date.now() }
        };
        return fetch("/.netlify/functions/repo-commit", {
          method:"POST", headers:{ "content-type":"application/json" },
          body: JSON.stringify({ feature: feat, geoTarget: "photos" })
        });
      })
      .then(function(){ SV.reloadPhotos && SV.reloadPhotos(); showChip("Photo uploaded"); closeMenus(); })
      .catch(function(e){ alert("Upload failed. Ensure Netlify function 'repo-commit' exists."); });
    };

    document.getElementById("sv-photo-cancel").onclick = function(){ state.dataUrl=null; closeMenus(); };
  }

  // ---- Pin drop ----
  function wirePin(map){
    var armed = false;
    return function(){
      if(armed){ map.off("click", place); armed=false; showChip("Pin mode off"); return; }
      armed=true; showChip("Tap the map to place a pin…");
      map.once("click", place);
    };
    function place(ev){
      armed=false;
      var name = window.prompt("Pin title?"); if(name===null) return;
      var desc = window.prompt("Description? (optional)") || "";
      var feat = {
        type:"Feature",
        geometry:{ type:"Point", coordinates:[ ev.latlng.lng, ev.latlng.lat ] },
        properties:{ name:name, desc:desc, when: Date.now() }
      };
      fetch("/.netlify/functions/repo-commit", {
        method:"POST", headers:{ "content-type":"application/json" },
        body: JSON.stringify({ feature: feat, geoTarget: "pins" })
      })
      .then(function(r){ return r.json(); })
      .then(function(){ SV.reloadPins && SV.reloadPins(); showChip("Pin saved"); })
      .catch(function(e){ alert("Pin save failed. Ensure Netlify function 'repo-commit' exists."); });
    }
  }

  // ---- Layers panel toggles for Photos/Pins + ensure contours off ----
  function wireLayerToggles(map){
    function tryPanel(){
      var panel = document.querySelector(".leaflet-control-layers-overlays") || document.querySelector(".leaflet-control-layers-list");
      if(!panel){ return setTimeout(tryPanel, 300); }
      function add(name, grp){
        var id = "sv-chk-" + name.toLowerCase();
        if(document.getElementById(id)) return;
        var lab = el("label"); lab.style.display="block"; lab.style.cursor="pointer";
        lab.innerHTML = "<input type='checkbox' id='"+id+"' checked> " + name;
        panel.appendChild(lab);
        var cb = lab.querySelector("input");
        cb.checked = true;
        if(!map.hasLayer(grp)) map.addLayer(grp);
        cb.addEventListener("change", function(){
          if(this.checked){ map.addLayer(grp); } else { map.removeLayer(grp); }
        });
      }
      if(SV.layers.photos) add("Photos", SV.layers.photos);
      if(SV.layers.pins)   add("Pins",   SV.layers.pins);

      // turn off contours if present
      var labels = panel.getElementsByTagName("label");
      for(var i=0;i<labels.length;i++){
        var t=(labels[i].textContent||"").toLowerCase();
        var box=labels[i].querySelector("input[type=checkbox]");
        if(box && /contour/.test(t) && box.checked){ box.click(); }
      }
    }
    tryPanel();
  }

  // ---- Guard legacy inline photo modal onclick (null-safety) ----
  function guardLegacyPhotoModal(){
    ready(function(){
      var photoModal = document.getElementById("photo-modal");
      var photoModalImg = document.getElementById("photo-modal-img");
      if (photoModal && !photoModal.__sv_guarded){
        photoModal.__sv_guarded = true;
        photoModal.addEventListener("click", function(){
          photoModal.style.display = "none";
          if (photoModalImg) photoModalImg.src = "";
        });
      }
    });
  }

  // ---- Main init ----
  function init(){
    var map = getMap();
    if(!map){ return setTimeout(init, 300); }

    // Ensure layers
    ensureLayers(map);

    // Build toolbar
    addBtn("btn-center-site", "🎯 Project", function(){
      try{
        var c = SV_SITE_CENTER || {lat:49.8870,lng:-119.4960};
        var z = (map.getZoom && map.getZoom())||15; if(z<15) z=15;
        map.setView(L.latLng(c.lat,c.lng), z);
      }catch(e){}
    });

    addBtn("btn-locate-once", "📍 Location", function(){
      if(!navigator.geolocation) return alert("Geolocation unsupported");
      navigator.geolocation.getCurrentPosition(function(pos){
        var ll=L.latLng(pos.coords.latitude, pos.coords.longitude);
        var z=(map.getZoom&&map.getZoom())||15; if(z<15) z=15;
        map.setView(ll, z);
        try{
          var mk=L.marker(ll);
          var acc=pos.coords.accuracy||0;
          var c=acc?L.circle(ll,{radius:acc}):null;
          var g=L.layerGroup(c?[mk,c]:[mk]).addTo(map);
          setTimeout(function(){ try{ map.removeLayer(g);}catch(e){} }, 4000);
        }catch(e){}
      }, function(){ alert("Locate failed"); }, { timeout:8000, maximumAge:300000 });
    });

    addBtn("btn-pin", "📌 Pin", wirePin(map));

    addBtn("btn-measure", "📏 Measure", function(){
      var m=ensureMenu("sv-menu-measure"); openMenu(m); wireMeasure(map);
    });

    addBtn("btn-photo", "📷 Camera", function(){
      var m=ensureMenu("sv-menu-camera"); openMenu(m); ensurePhotoUI(map);
    });

    // Layers toggles & initial loads
    wireLayerToggles(map);
    SV.reloadPins && SV.reloadPins();
    SV.reloadPhotos && SV.reloadPhotos();

    // Final guards
    guardLegacyPhotoModal();
  }

  // Start
  ready(init);
})();
