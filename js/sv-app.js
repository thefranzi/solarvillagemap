(function(){
  // ---- Config / helpers ----
  window.SV_SITE_CENTER = window.SV_SITE_CENTER || { lat: 49.8870, lng: -119.4960 }; // fallback if BNDRY not found
  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function findMap(){ try{
    if(window.map && typeof window.map.setView==="function" && typeof window.map.eachLayer==="function") return window.map;
    if(window.L && window.L.Map){
      var els = document.getElementsByClassName("leaflet-container");
      if(els && els.length && window.map) return window.map;
    }
  }catch(e){} return null; }

  function ensureLayersTopRight(){
    try{
      var layersEl=document.querySelector(".leaflet-control-layers");
      var tr=document.querySelector(".leaflet-top.leaflet-right");
      if(layersEl && tr && layersEl.parentElement!==tr){ tr.appendChild(layersEl); }
      if(layersEl){ layersEl.style.display="block"; }
    }catch(e){}
  }

  function addToolbar(){
    var bar=document.getElementById("bottom-toolbar-fixed");
    if(!bar){ bar=document.createElement("div"); bar.id="bottom-toolbar-fixed"; document.body.appendChild(bar); }
    function mk(id, txt, fn){
      var b=document.getElementById(id); if(b){ return b; }
      b=document.createElement("button"); b.id=id; b.className="sv-btn"; b.textContent=txt; b.onclick=fn; bar.appendChild(b); return b;
    }
    return { bar: bar, mk: mk };
  }

  function mapCenterOfBNDRY(map){
    // find any layer/group whose name/id contains 'BNDRY'
    var found=null;
    map.eachLayer(function(layer){
      try{
        var n = (layer && (layer.options && (layer.options.name||layer.options.title))) || layer.name || layer._leaflet_id || "";
        n = String(n||"");
        if(/bndry/i.test(n)){ found = layer; }
      }catch(e){}
    });
    // if not found by name, try feature groups with lots of bounds
    if(!found){
      map.eachLayer(function(layer){
        if(found) return;
        try{
          if(typeof layer.getBounds==="function"){
            var b = layer.getBounds();
            if(b && b.isValid && b.isValid()){
              // heuristic: very large polygon likely your project boundary
              var sw=b.getSouthWest(), ne=b.getNorthEast();
              var span = Math.abs(ne.lat-sw.lat) + Math.abs(ne.lng-sw.lng);
              if(span>0.01){ found = layer; }
            }
          }
        }catch(e){}
      });
    }
    if(found && typeof found.getBounds==="function"){
      var bb = found.getBounds();
      if(bb && bb.getCenter){ return bb.getCenter(); }
    }
    // fallback to configured site center
    return L.latLng(window.SV_SITE_CENTER.lat, window.SV_SITE_CENTER.lng);
  }

  function relaxZoomLimits(map){
    try{
      if(map.setMinZoom) map.setMinZoom(2);
      if(map.options){ map.options.minZoom = 2; }
      if(map.setMaxBounds) map.setMaxBounds(null);
      if(map.options){ map.options.maxBounds = null; }
    }catch(e){}
  }

  function overlaysOnExceptContours(map){
    // after layers panel appears, toggle checkboxes: ON for all except contours/CONT
    function tryPanel(attempts){
      var panel = document.querySelector(".leaflet-control-layers-overlays") || document.querySelector(".leaflet-control-layers-list");
      if(!panel){
        if((attempts||0)<40){ setTimeout(function(){ tryPanel((attempts||0)+1); }, 250); }
        return;
      }
      var labels = panel.getElementsByTagName("label");
      for(var i=0;i<labels.length;i++){
        var lb = labels[i];
        var txt = (lb.textContent||"").toLowerCase();
        var cb = lb.querySelector("input[type=checkbox]");
        if(!cb) continue;
        var isContour = /contour|contours|\bcont\b/.test(txt);
        // desired state: ON unless contours
        var shouldOn = !isContour;
        if(shouldOn && !cb.checked){ cb.click(); }
        if(!shouldOn && cb.checked){ cb.click(); }
      }
    }
    tryPanel(0);
  }

  // ---- Measure Tools (ES5) ----
  function measureTools(map, UI){
    var pop = document.getElementById("sv-measure-pop");
    if(!pop){
      pop = document.createElement("div"); pop.id="sv-measure-pop"; pop.className="sv-pop";
      pop.innerHTML = "<div><button id='sv-meas-linear'>Linear</button><button id='sv-meas-area'>Area</button><button id='sv-meas-clear'>Clear</button></div>";
      document.body.appendChild(pop);
    }
    var state = { mode: null, pts: [], line: null, poly: null };
    var chip = document.createElement("div"); chip.className="sv-chip"; chip.style.display="none"; document.body.appendChild(chip);
    function showChip(t){ chip.textContent=t; chip.style.display="block"; }
    function hideChip(){ chip.style.display="none"; }

    function fmtDist(m){ return (m<1000)? (m.toFixed(0)+" m") : ((m/1000).toFixed(2)+" km"); }
    function fmtArea(m2){
      if(m2<10000) return m2.toFixed(0)+" m²";
      var ha = m2/10000; if(ha<100) return ha.toFixed(2)+" ha";
      var km2 = m2/1e6;  return km2.toFixed(3)+" km²";
    }

    function linearClick(ev){
      state.pts.push(ev.latlng);
      if(!state.line){ state.line=L.polyline(state.pts,{color:"#222",weight:3,dashArray:"6,4"}).addTo(map); }
      else { state.line.setLatLngs(state.pts); }
      // sum distances
      var d=0; for(var i=1;i<state.pts.length;i++){ d+= state.pts[i-1].distanceTo(state.pts[i]); }
      showChip("Distance: "+fmtDist(d)+" (double-tap to finish)");
    }
    function areaClick(ev){
      state.pts.push(ev.latlng);
      if(!state.poly){ state.poly=L.polygon(state.pts,{color:"#222",weight:2,fillOpacity:0.1}).addTo(map); }
      else { state.poly.setLatLngs([state.pts]); }
      try{
        if(state.pts.length>=3 && state.poly.getLatLngs){
          var area = L.GeometryUtil && L.GeometryUtil.geodesicArea ? L.GeometryUtil.geodesicArea(state.poly.getLatLngs()[0]) : 0;
          showChip("Area: "+fmtArea(area)+" (double-tap to finish)");
        } else {
          showChip("Area: 0 m² (double-tap to finish)");
        }
      }catch(e){ showChip("Measuring… (double-tap to finish)"); }
    }
    function stop(){
      hideChip();
      map.off("click", linearClick);
      map.off("click", areaClick);
      map.off("dblclick", stop);
      state.mode=null;
    }
    function clearAll(){
      try{ if(state.line) map.removeLayer(state.line); }catch(e){}
      try{ if(state.poly) map.removeLayer(state.poly); }catch(e){}
      state.line=null; state.poly=null; state.pts=[];
      hideChip();
    }

    document.getElementById("sv-meas-linear").onclick = function(){
      pop.style.display="none"; clearAll(); state.mode="linear"; map.on("click", linearClick); map.on("dblclick", stop); showChip("Distance: 0 m");
    };
    document.getElementById("sv-meas-area").onclick = function(){
      pop.style.display="none"; clearAll(); state.mode="area"; map.on("click", areaClick); map.on("dblclick", stop); showChip("Area: 0 m²");
    };
    document.getElementById("sv-meas-clear").onclick = function(){
      pop.style.display="none"; clearAll();
    };

    return {
      togglePopover: function(){
        if(pop.style.display==="none" || !pop.style.display){ pop.style.display="block"; } else { pop.style.display="none"; }
      },
      clear: clearAll
    };
  }

  function ensurePhotoUI(){
    if(document.getElementById("photo-capture")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = ""
      + "<div id='photo-capture' style='display:none; position:fixed; left:8px; right:8px; bottom:8vh; z-index:1500; background:#fff; border-radius:10px; padding:12px; box-shadow:0 6px 20px rgba(0,0,0,0.25);'>"
      + "<form id='photoForm'><label for='photoInput' style='display:inline-block; padding:12px 14px; font-size:16px; cursor:pointer;'>Take Photo"
      + "<input id='photoInput' name='photo' type='file' accept='image/*' capture='environment' style='display:none;'></label>"
      + "<div id='photoPreview' style='margin-top:10px;'></div>"
      + "<div style='display:flex; gap:8px; margin-top:10px;'><button id='photoUpload' type='button' style='display:none;'>Upload</button><button id='photoCancel' type='button'>Cancel</button></div>"
      + "<small style='display:block; margin-top:6px; font-size:12px;'>Take Photo → preview → Upload. A comment box will appear on upload.</small></form></div>";
    document.body.appendChild(wrap.firstChild);

    var input=document.getElementById("photoInput"),
        preview=document.getElementById("photoPreview"),
        uploadBtn=document.getElementById("photoUpload"),
        cancelBtn=document.getElementById("photoCancel"),
        container=document.getElementById("photo-capture");

    window.openPhotoUI=function(meta){ container.style.display="block"; try{ container.setAttribute("data-meta", JSON.stringify(meta||{})); }catch(e){} };
    window.closePhotoUI=function(){ container.style.display="none"; preview.innerHTML=""; uploadBtn.style.display="none"; input.value=""; };

    input.addEventListener("change", function(ev){
      var file = ev && ev.target && ev.target.files && ev.target.files[0];
      if(!file) return;
      preview.textContent = "Preparing preview...";
      var reader=new FileReader();
      reader.onload=function(){
        var img=new Image();
        img.onload=function(){
          var w=img.width, h=img.height, max=1600;
          if(Math.max(w,h)>max){ if(w>h){ h=Math.round(h*(max/w)); w=max; } else { w=Math.round(w*(max/h)); h=max; } }
          var c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
          var dataUrl=c.toDataURL("image/jpeg",0.78);
          preview.innerHTML="<img id='previewImg' alt='preview' style='max-width:100%;height:auto;border-radius:8px'>";
          document.getElementById("previewImg").src=dataUrl;
          uploadBtn.style.display="inline-block";
          uploadBtn.onclick=function(){
            var comment = window.prompt("Add a comment (optional):","") || "";
            var center = (window.map && map.getCenter && map.getCenter()) || {lat: window.SV_SITE_CENTER.lat, lng: window.SV_SITE_CENTER.lng};
            var meta={lat:center.lat, lng:center.lng, when:(new Date()).getTime(), comment: comment};
            fetch("/.netlify/functions/repo-commit",{
              method:"POST", headers:{"content-type":"application/json"},
              body:JSON.stringify({ dataUrl: dataUrl, filename: (file && file.name)||("photo_"+meta.when+".jpg"), subdir:"uploads" })
            })
            .then(function(r){ return r.text().then(function(t){ return {ok:r.ok, t:t}; }); })
            .then(function(res){
              if(!res.ok){ alert("Upload failed"); return; }
              var out={}; try{ out=JSON.parse(res.t);}catch(e){}
              if(!out.ok){ alert(out.error||"Upload failed"); return; }
              var feat={type:"Feature",geometry:{type:"Point",coordinates:[meta.lng,meta.lat]},properties:{url:out.url,when:meta.when,comment:meta.comment}};
              return fetch("/.netlify/functions/repo-commit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ feature: feat, geoTarget: "photos" })});
            })
            .then(function(){ if(window.SV && SV.reloadPhotos) SV.reloadPhotos(true); window.closePhotoUI(); alert("Photo uploaded."); })
            .catch(function(){ alert("Upload failed"); });
          };
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    if(cancelBtn){ cancelBtn.onclick=function(){ window.closePhotoUI(); }; }
  }

  function dataLoaders(map){
    // layer groups
    window.SV = window.SV || {};
    SV.pins   = SV.pins   || L.layerGroup().addTo(map);
    SV.photos = SV.photos || L.layerGroup().addTo(map);

    function rawUrl(rel){
      // Uses GitHub raw from current branch; customize if needed
      var slug = "thefranzi/solarvillagemap";
      var branch = "mobile-one-shot-locate";
      return "https://raw.githubusercontent.com/"+slug+"/"+branch+"/"+rel;
    }

    function loadGeo(url, grp, kind){
      return fetch(url + "?t=" + (new Date()).getTime())
        .then(function(r){ if(!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(function(j){
          try{ grp.clearLayers(); }catch(e){}
          var feats = (j && j.features) || [];
          for(var i=0;i<feats.length;i++){
            var f = feats[i]; if(!f || !f.geometry || f.geometry.type!=="Point") continue;
            var c = f.geometry.coordinates; var ll=L.latLng(c[1],c[0]);
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
        .catch(function(){ /* silent if file missing */ });
    }

    SV.reloadPins   = function(){ return loadGeo(rawUrl("data/pins.geojson"),   SV.pins,   "pins");   };
    SV.reloadPhotos = function(){ return loadGeo(rawUrl("data/photos.geojson"), SV.photos, "photos"); };
  }

  // ---- Boot / init ----
  ready(function(){
    var tries = 0, maxTries = 80, tmr = setInterval(function(){
      var map = findMap();
      if(!map){ if(++tries>=maxTries) clearInterval(tmr); return; }
      clearInterval(tmr);

      relaxZoomLimits(map);
      ensureLayersTopRight();

      var UI = addToolbar();

      // Project
      UI.mk("btn-center-site","🎯 Project", function(){
        try{
          var center = mapCenterOfBNDRY(map);
          var z = (map.getZoom && map.getZoom()) || 15;
          if(z<15) z=15;
          map.setView(center, z);
        }catch(e){}
      });

      // Locate (once)
      UI.mk("btn-locate-once","📍 Locate", function(){
        if(!("geolocation" in navigator)) return alert("Geolocation unsupported");
        navigator.geolocation.getCurrentPosition(function(pos){
          var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
          var z = (map.getZoom && map.getZoom()) || 15; if(z<15) z=15;
          map.setView(ll, z);
          try{
            var mk=L.marker(ll);
            var acc=pos.coords.accuracy||0;
            var c=acc?L.circle(ll,{radius:acc}):null;
            var g=L.layerGroup(c?[mk,c]:[mk]).addTo(map);
            setTimeout(function(){ try{ map.removeLayer(g);}catch(e){} }, 5000);
          }catch(e){}
        }, function(){ alert("Locate failed"); }, {timeout:8000, maximumAge:300000});
      });

      // Measure (with popover)
      var meas = measureTools(map, UI);
      UI.mk("btn-measure","📏 Measure", function(){ meas.togglePopover(); });

      // Pin
      UI.mk("btn-pin","📌 Pin", function(){
        var armed = true;
        alert("Tap the map to place your pin.");
        function place(ev){
          if(!armed) return;
          armed=false; map.off("click", place);
          var ll=ev.latlng; var name=window.prompt("Pin title?"); if(name===null) return;
          var desc=window.prompt("Description? (optional)")||"";
          var feat={type:"Feature",geometry:{type:"Point",coordinates:[ll.lng,ll.lat]},properties:{name:name,desc:desc,when:(new Date()).getTime()}};
          fetch("/.netlify/functions/repo-commit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({feature:feat,geoTarget:"pins"})})
            .then(function(r){ return r.json(); })
            .then(function(){ if(window.SV&&SV.reloadPins) SV.reloadPins(); alert("Pin saved."); })
            .catch(function(e){ alert("Pin save failed"); });
        }
        map.once("click", place);
      });

      // Camera
      ensurePhotoUI();
      UI.mk("btn-photo","📷 Camera", function(){ window.openPhotoUI({ from:"toolbar" }); });

      // Data groups + initial load
      dataLoaders(map);
      if(window.SV){ SV.reloadPins(); SV.reloadPhotos(); }

      // Initial overlays: ON except contours
      overlaysOnExceptContours(map);

    }, 250);
  });
})();
