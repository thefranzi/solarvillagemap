(function(){
  // ---- Config ----
  window.SV_SITE_CENTER = window.SV_SITE_CENTER || { lat: 49.8870, lng: -119.4960 };
  var GH_SLUG   = "thefranzi/solarvillagemap";
  var GH_BRANCH = "mobile-one-shot-locate";

  // ---- Small helpers ----
  function onReady(fn){
    if(document.readyState !== "loading"){ fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  }
  function getMap(){
    try {
      if (window.map && typeof window.map.setView === "function" && typeof window.map.eachLayer === "function"){ return window.map; }
      if (window.L && document.getElementsByClassName("leaflet-container").length > 0 && window.map){ return window.map; }
    } catch(e){}
    return null;
  }
  function ensureBar(){
    var bar = document.getElementById("bottom-toolbar-fixed");
    if(!bar){
      bar = document.createElement("div");
      bar.id = "bottom-toolbar-fixed";
      document.body.appendChild(bar);
    }
    return bar;
  }
  function mkBtn(id, label, handler){
    var btn = document.getElementById(id);
    if(!btn){
      btn = document.createElement("button");
      btn.id = id;
      btn.className = "sv-btn";
      btn.textContent = label;
      btn.onclick = handler;
      ensureBar().appendChild(btn);
    }
    return btn;
  }
  function rawBase(){ return "https://raw.githubusercontent.com/"+GH_SLUG+"/"+encodeURIComponent(GH_BRANCH); }
  function raw(path){
    path = String(path||"").replace(/^\/+/,"");
    return rawBase() + "/" + path;
  }

  // ---- Photo UI (simple inline) ----
  function ensurePhotoUI(){
    if(document.getElementById("photo-capture")) return;
    var d = document.createElement("div");
    d.innerHTML =
      "<div id='photo-capture' style='display:none; position:fixed; left:8px; right:8px; bottom:8vh; z-index:1500; background:#fff; border-radius:10px; padding:12px; box-shadow:0 6px 20px rgba(0,0,0,0.25);'>" +
      "  <form id='photoForm'>" +
      "    <label for='photoInput' style='display:inline-block; padding:12px 14px; font-size:16px; cursor:pointer;'>Take Photo" +
      "      <input id='photoInput' name='photo' type='file' accept='image/*' capture='environment' style='display:none;'>" +
      "    </label>" +
      "    <div id='photoPreview' style='margin-top:10px;'></div>" +
      "    <div style='display:flex; gap:8px; margin-top:10px;'>" +
      "      <button id='photoUpload' type='button' style='display:none;'>Upload</button>" +
      "      <button id='photoCancel' type='button'>Cancel</button>" +
      "    </div>" +
      "    <small style='display:block; margin-top:6px; font-size:12px;'>Tap Take Photo → preview → Upload</small>" +
      "  </form>" +
      "</div>";
    document.body.appendChild(d.firstChild);

    var input  = document.getElementById("photoInput");
    var preview= document.getElementById("photoPreview");
    var upload = document.getElementById("photoUpload");
    var cancel = document.getElementById("photoCancel");
    var wrap   = document.getElementById("photo-capture");

    window.openPhotoUI  = function(meta){ wrap.style.display = "block"; wrap.setAttribute("data-meta", JSON.stringify(meta||{})); };
    window.closePhotoUI = function(){ wrap.style.display = "none"; preview.innerHTML=""; upload.style.display="none"; if(input){ input.value=""; } };

    function compressToDataURL(file, cb){
      try{
        var reader = new FileReader();
        reader.onload = function(){
          try{
            var img = new Image();
            img.onload = function(){
              try{
                var w = img.width, h = img.height, max = 1600;
                if (Math.max(w,h) > max){
                  if (w > h){ h = Math.round(h * (max / w)); w = max; }
                  else      { w = Math.round(w * (max / h)); h = max; }
                }
                var c = document.createElement("canvas");
                c.width = w; c.height = h;
                c.getContext("2d").drawImage(img,0,0,w,h);
                var dataUrl = c.toDataURL("image/jpeg", 0.78);
                cb(null, dataUrl);
              } catch(e){ cb(e); }
            };
            img.onerror = function(){ cb(new Error("Image load failed")); };
            img.src = reader.result;
          }catch(e){ cb(e); }
        };
        reader.onerror = function(){ cb(new Error("File read failed")); };
        reader.readAsDataURL(file);
      }catch(e){ cb(e); }
    }

    function uploadPhoto(dataUrl, fileName){
      try{
        var c = (window.map && typeof window.map.getCenter === "function") ? window.map.getCenter() : (window.SV_SITE_CENTER || {lat:0,lng:0});
        var feat = {
          type:"Feature",
          geometry:{ type:"Point", coordinates:[ c.lng || 0, c.lat || 0 ] },
          properties:{ url:"", name:fileName||"photo", when:(new Date()).getTime() }
        };
        // 1) Put image in repo (function should create /uploads/<timestamp>.jpg and return raw URL)
        fetch("/.netlify/functions/repo-commit",{
          method:"POST",
          headers:{ "content-type":"application/json" },
          body: JSON.stringify({ dataUrl:dataUrl, filename:fileName||("photo_"+Date.now()+".jpg"), subdir:"uploads" })
        })
        .then(function(r){ return r.text().then(function(t){ return { ok:r.ok, text:t }; }); })
        .then(function(res){
          if(!res.ok){ alert("Upload failed"); return; }
          try{ var out = JSON.parse(res.text); feat.properties.url = out && out.url ? out.url : ""; } catch(e){}
          // 2) Append feature to data/photos.geojson via same function
          return fetch("/.netlify/functions/repo-commit",{
            method:"POST",
            headers:{ "content-type":"application/json" },
            body: JSON.stringify({ feature:feat, geoTarget:"photos" })
          });
        })
        .then(function(){ if(window.SV && typeof window.SV.reloadPhotos === "function"){ window.SV.reloadPhotos(true); } window.closePhotoUI(); alert("Photo uploaded."); })
        .catch(function(){ alert("Upload failed"); });
      }catch(e){ alert("Upload failed"); }
    }

    if(input){
      input.addEventListener("change", function(ev){
        var file = ev && ev.target && ev.target.files && ev.target.files[0];
        if(!file) return;
        preview.textContent = "Preparing preview...";
        compressToDataURL(file, function(err, dataUrl){
          if(err){ preview.textContent = "Preview failed"; return; }
          preview.innerHTML = "<img id='previewImg' alt='preview' style='max-width:100%;height:auto;border-radius:8px'>";
          document.getElementById("previewImg").src = dataUrl;
          upload.style.display = "inline-block";
          upload.onclick = function(){ uploadPhoto(dataUrl, file.name); };
        });
      });
    }
    if(cancel){ cancel.onclick = function(){ window.closePhotoUI(); }; }
  }

  // ---- App init (non-recursive wait) ----
  function boot(){
    var tries = 0, maxTries = 80; // ~20s at 250ms
    var timer = setInterval(function(){
      var m = getMap();
      if(m){
        clearInterval(timer);
        try{ init(m); }catch(e){}
      }else{
        tries += 1;
        if(tries >= maxTries){ clearInterval(timer); }
      }
    }, 250);
  }

  function init(map){
    // Layers control to top-right (if present)
    try{
      var layersEl = document.querySelector(".leaflet-control-layers");
      var tr = document.querySelector(".leaflet-top.leaflet-right");
      if(layersEl && tr && layersEl.parentElement !== tr){ tr.appendChild(layersEl); }
      if(layersEl){ layersEl.style.display = "block"; }
    }catch(e){}

    // Bottom toolbar
    ensureBar();
    mkBtn("btn-center-site","🎯 Site", function(){
      try{
        var c = window.SV_SITE_CENTER || { lat:49.8870, lng:-119.4960 };
        var ll = L.latLng(c.lat, c.lng);
        var z = (typeof map.getZoom === "function") ? map.getZoom() : 15;
        if(z < 15) z = 15;
        map.setView(ll, z);
      }catch(e){}
    });

    mkBtn("btn-locate-once","📍 Locate", function(){
      if(!navigator.geolocation){ alert("Geolocation unsupported"); return; }
      navigator.geolocation.getCurrentPosition(function(pos){
        var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
        var z = (typeof map.getZoom === "function") ? map.getZoom() : 15;
        if(z < 15) z = 15;
        map.setView(ll, z);
        try{
          var mk = L.marker(ll);
          var acc = pos.coords.accuracy || 0;
          var circ = acc ? L.circle(ll, { radius: acc }) : null;
          var g = L.layerGroup(circ ? [mk, circ] : [mk]).addTo(map);
          setTimeout(function(){ try{ map.removeLayer(g);}catch(e){} }, 5000);
        }catch(e){}
      }, function(){ alert("Locate failed"); }, { timeout:8000, maximumAge:300000 });
    });

    // Measure tool
    (function(){
      var chip = document.createElement("div");
      chip.className = "sv-chip";
      chip.style.display = "none";
      document.body.appendChild(chip);
      function show(t){ chip.textContent = t; chip.style.display = "block"; }
      function hide(){ chip.style.display = "none"; }
      var st = { active:false, pts:[], line:null };
      function fmt(m){ return (m<1000) ? (m.toFixed(0)+" m") : ((m/1000).toFixed(2)+" km"); }
      function dist(){ var d=0,i; for(i=1;i<st.pts.length;i++){ d += st.pts[i-1].distanceTo(st.pts[i]); } return d; }
      function onClick(ev){
        st.pts.push(ev.latlng);
        if(!st.line){ st.line = L.polyline(st.pts, { color:"#222", weight:3, dashArray:"6,4" }).addTo(map); }
        else { st.line.setLatLngs(st.pts); }
        show("Distance: " + fmt(dist()) + " (double-tap to finish)");
      }
      function finish(){
        hide();
        map.off("click", onClick);
        map.off("dblclick", finish);
        st.active = false;
      }
      mkBtn("btn-measure","📏 Measure", function(){
        if(!st.active){
          st.active = true; st.pts = [];
          if(st.line){ try{ map.removeLayer(st.line);}catch(e){} st.line = null; }
          show("Distance: 0 m (double-tap to finish)");
          map.on("click", onClick);
          map.on("dblclick", finish);
        } else {
          finish();
        }
      });
    })();

    // Pins & Photos layers
    window.SV = window.SV || {};
    window.SV.pins   = L.layerGroup().addTo(map);
    window.SV.photos = L.layerGroup().addTo(map);

    function loadGeo(url, group, kind){
      return fetch(url + "?t=" + (new Date()).getTime())
        .then(function(r){ if(!r.ok){ throw new Error(String(r.status)); } return r.json(); })
        .then(function(j){
          try{ group.clearLayers(); }catch(e){}
          var feats = (j && j.features) ? j.features : [];
          for(var i=0;i<feats.length;i++){
            var f = feats[i];
            if(!f || !f.geometry || f.geometry.type !== "Point") continue;
            var c = f.geometry.coordinates || [];
            var lat = (c.length>1) ? c[1] : 0;
            var lng = (c.length>0) ? c[0] : 0;
            var ll = L.latLng(lat, lng);
            if(kind === "photos"){
              var u = f.properties && f.properties.url;
              var html = u ? ("<img src='"+u+"' style='max-width:240px;height:auto;border-radius:6px'>") : "Photo";
              L.marker(ll).bindPopup(html).addTo(group);
            } else {
              var nm = (f.properties && f.properties.name) || "Pin";
              var ds = (f.properties && f.properties.desc) || "";
              L.marker(ll).bindPopup("<b>"+nm+"</b><br>"+ds).addTo(group);
            }
          }
        })
        .catch(function(){ /* silent */ });
    }

    function pinsURL(){ return raw("data/pins.geojson"); }
    function photosURL(){ return raw("data/photos.geojson"); }

    window.SV.reloadPins   = function(){ return loadGeo(pinsURL(),   window.SV.pins,   "pins");   };
    window.SV.reloadPhotos = function(){ return loadGeo(photosURL(), window.SV.photos, "photos"); };
    window.SV.reloadPins(); window.SV.reloadPhotos();

    // Add toggles into the layers panel (and force contours OFF)
    (function addToggles(){
      function tryPanel(){
        var panel = document.querySelector(".leaflet-control-layers-overlays") || document.querySelector(".leaflet-control-layers-list");
        if(!panel){ setTimeout(tryPanel, 300); return; }

        function addToggle(label, group){
          var id = "sv-chk-" + label.toLowerCase();
          if(document.getElementById(id)) return;
          var lab = document.createElement("label");
          lab.style.display = "block";
          lab.style.cursor  = "pointer";
          lab.innerHTML = "<input type='checkbox' id='"+id+"' checked> " + label;
          panel.appendChild(lab);
          var box = lab.querySelector("input");
          if(box){
            if(!map.hasLayer(group)){ map.addLayer(group); }
            box.checked = true;
            box.addEventListener("change", function(){
              if(this.checked){ map.addLayer(group); } else { map.removeLayer(group); }
            });
          }
        }
        addToggle("Photos", window.SV.photos);
        addToggle("Pins",   window.SV.pins);

        // turn contours OFF if present
        var labs = panel.getElementsByTagName("label");
        for(var i=0;i<labs.length;i++){
          var t = (labs[i].textContent || "").toLowerCase();
          var cb = labs[i].querySelector("input[type=checkbox]");
          if(cb && /contour/.test(t) && cb.checked){ cb.click(); }
        }
      }
      tryPanel();
    })();

    // Photo + Pin buttons
    ensurePhotoUI();
    mkBtn("btn-photo","📷 Photo", function(){ window.openPhotoUI({ from:"toolbar" }); });

    (function pinMaker(){
      var armed = false;
      function place(ev){
        map.off("click", place);
        armed = false;
        var ll = ev && ev.latlng ? ev.latlng : null;
        if(!ll){ alert("No location"); return; }
        var name = window.prompt("Pin title?");
        if(name === null){ return; }
        var desc = window.prompt("Description? (optional)") || "";
        var feat = {
          type:"Feature",
          geometry:{ type:"Point", coordinates:[ ll.lng, ll.lat ] },
          properties:{ name:name, desc:desc, when:(new Date()).getTime() }
        };
        fetch("/.netlify/functions/repo-commit",{
          method:"POST",
          headers:{ "content-type":"application/json" },
          body: JSON.stringify({ feature:feat, geoTarget:"pins" })
        })
        .then(function(r){ return r.json(); })
        .then(function(){ if(window.SV && typeof window.SV.reloadPins === "function"){ window.SV.reloadPins(); } alert("Pin saved."); })
        .catch(function(e){ alert("Pin save failed: " + e); });
      }
      mkBtn("btn-pin","📌 Pin", function(){
        if(armed){ map.off("click", place); armed=false; alert("Pin mode off"); return; }
        armed = true; alert("Tap the map to place a pin…");
        map.once("click", place);
      });
    })();
  }

  onReady(function(){ boot(); });
  window.addEventListener("load", function(){ boot(); });
})();
