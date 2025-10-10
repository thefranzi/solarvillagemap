(function(){
  // Config
  window.SV_SITE_CENTER = window.SV_SITE_CENTER || { lat: 49.8870, lng: -119.4960 };
  window.SV_GH = window.SV_GH || { slug: "thefranzi/solarvillagemap", branch: "mobile-one-shot-locate" };

  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }

  // Find Leaflet map safely
  function findMap(){
    try{
      if(window.map && typeof window.map.setView==="function" && typeof window.map.eachLayer==="function") return window.map;
      if(window.L && window.L.Map){
        var els = document.getElementsByClassName("leaflet-container");
        if(els && els.length && window.map) return window.map;
      }
    }catch(e){}
    return null;
  }

  // Create bottom toolbar
  function ensureBar(){
    var bar = document.getElementById("bottom-toolbar-fixed");
    if(!bar){
      bar = document.createElement("div");
      bar.id = "bottom-toolbar-fixed";
      document.body.appendChild(bar);
    }
    return bar;
  }
  function mkBtn(id, label, onClick){
    var btn = document.getElementById(id);
    if(btn) return btn;
    btn = document.createElement("button");
    btn.id = id; btn.className = "sv-btn"; btn.textContent = label;
    if(onClick) btn.onclick = onClick;
    ensureBar().appendChild(btn);
    return btn;
  }

  function rawBase(){ return "https://raw.githubusercontent.com/"+SV_GH.slug+"/"+SV_GH.branch+"/"; }
  function pinsUrl(){   return rawBase() + "data/pins.geojson"; }
  function photosUrl(){ return rawBase() + "data/photos.geojson"; }

  function ensurePhotoUI(){
    if(document.getElementById("photo-capture")) return;
    var wrap = document.createElement("div");
    wrap.id = "photo-capture";
    wrap.style.cssText = "display:none; position:fixed; left:8px; right:8px; bottom:8vh; z-index:1500; background:#fff; border-radius:10px; padding:12px; box-shadow:0 6px 20px rgba(0,0,0,0.25);";
    wrap.innerHTML =
      "<form id='photoForm'>" +
        "<label for='photoInput' style='display:inline-block; padding:12px 14px; font-size:16px; cursor:pointer;'>Take Photo" +
          "<input id='photoInput' name='photo' type='file' accept='image/*' capture='environment' style='display:none;'>" +
        "</label>" +
        "<div id='photoPreview' style='margin-top:10px;'></div>" +
        "<div style='display:flex; gap:8px; margin-top:10px;'>" +
          "<button id='photoUpload' type='button' style='display:none;'>Upload</button>" +
          "<button id='photoCancel' type='button'>Cancel</button>" +
        "</div>" +
        "<small style='display:block; margin-top:6px; font-size:12px;'>Tap Take Photo → preview → Upload</small>" +
      "</form>";
    document.body.appendChild(wrap);

    var input = document.getElementById("photoInput");
    var preview = document.getElementById("photoPreview");
    var uploadBtn = document.getElementById("photoUpload");
    var cancelBtn = document.getElementById("photoCancel");

    window.openPhotoUI = function(meta){ wrap.style.display="block"; wrap.setAttribute("data-meta", JSON.stringify(meta||{})); };
    window.closePhotoUI = function(){ wrap.style.display="none"; preview.innerHTML=""; uploadBtn.style.display="none"; input.value=""; };

    input.addEventListener("change", function(ev){
      var file = ev && ev.target && ev.target.files && ev.target.files[0]; if(!file) return;
      preview.textContent = "Preparing preview...";
      var reader = new FileReader();
      reader.onload = function(){
        var img = new Image();
        img.onload = function(){
          var w = img.width, h = img.height, max = 1600;
          if(Math.max(w,h)>max){ if(w>h){ h=Math.round(h*(max/w)); w=max; } else { w=Math.round(w*(max/h)); h=max; } }
          var c = document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
          var dataUrl = c.toDataURL("image/jpeg", 0.78);
          preview.innerHTML = "<img id='previewImg' alt='preview' style='max-width:100%;height:auto;border-radius:8px'>";
          document.getElementById("previewImg").src = dataUrl;
          uploadBtn.style.display = "inline-block";
          uploadBtn.onclick = function(){ uploadPhoto(dataUrl, file.name); };
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    if(cancelBtn) cancelBtn.onclick = function(){ window.closePhotoUI(); };

    function uploadPhoto(dataUrl, filename){
      var center = (window.map && map.getCenter && map.getCenter()) || SV_SITE_CENTER;
      var meta = { lat: center.lat, lng: center.lng, when: (new Date()).getTime() };

      // First: upload image (to repo via Netlify function if configured)
      fetch("/.netlify/functions/repo-commit", {
        method: "POST", headers: {"content-type":"application/json"},
        body: JSON.stringify({ dataUrl: dataUrl, filename: filename, subdir: "uploads" })
      }).then(function(r){ return r.text().then(function(t){ return {ok:r.ok, t:t}; }); })
      .then(function(res){
        if(!res.ok){ alert(res.t||"Upload failed"); return; }
        var out = {}; try{ out = JSON.parse(res.t); }catch(e){}
        if(!out.ok){ alert(out.error||"Upload failed"); return; }

        // Append feature to photos.geojson
        var feat = { type:"Feature", geometry:{type:"Point",coordinates:[meta.lng,meta.lat]}, properties:{url:out.url, when:meta.when, name:filename} };
        return fetch("/.netlify/functions/repo-commit", {
          method:"POST", headers:{"content-type":"application/json"},
          body: JSON.stringify({ feature: feat, geoTarget: "photos" })
        });
      }).then(function(){ if(window.SV && SV.reloadPhotos) SV.reloadPhotos(true); window.closePhotoUI(); alert("Photo uploaded."); })
      .catch(function(){ alert("Upload failed (function not configured?)"); });
    }
  }

  // Boot after DOM ready, poll for Leaflet map without recursion bug
  ready(function(){
    function boot(){
      var map = findMap();
      if(!map){ setTimeout(boot, 250); return; }

      try{
        // Ensure layers control is visible and in top-right
        var layersEl = document.querySelector(".leaflet-control-layers");
        var tr = document.querySelector(".leaflet-top.leaflet-right");
        if(layersEl && tr && layersEl.parentElement!==tr){ tr.appendChild(layersEl); }
        if(layersEl) layersEl.style.display = "block";
      }catch(e){}

      // Toolbar
      mkBtn("btn-center-site","🎯 Site", function(){
        try{
          var c = SV_SITE_CENTER || {lat:49.8870,lng:-119.4960};
          var ll = L.latLng(c.lat, c.lng); var z = (map.getZoom&&map.getZoom())||15; if(z<15) z=15;
          map.setView(ll, z);
        }catch(e){}
      });

      mkBtn("btn-locate-once","📍 Locate", function(){
        if(!navigator.geolocation) return alert("Geolocation unsupported");
        navigator.geolocation.getCurrentPosition(function(pos){
          var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
          var z = (map.getZoom&&map.getZoom())||15; if(z<15) z=15; map.setView(ll, z);
          try{
            var mk=L.marker(ll); var acc=pos.coords.accuracy||0; var circ=acc?L.circle(ll,{radius:acc}):null;
            var g=L.layerGroup(circ?[mk,circ]:[mk]).addTo(map); setTimeout(function(){ try{ map.removeLayer(g);}catch(e){} }, 5000);
          }catch(e){}
        }, function(){ alert("Locate failed"); }, {timeout:8000, maximumAge:300000});
      });

      // Measure tool
      (function(){
        var chip=document.createElement("div"); chip.className="sv-chip"; chip.style.display="none"; document.body.appendChild(chip);
        function show(t){ chip.textContent=t; chip.style.display="block"; }
        function hide(){ chip.style.display="none"; }
        var st={active:false,pts:[],line:null};
        function fmt(m){ return m<1000? (m.toFixed(0)+" m") : ((m/1000).toFixed(2)+" km"); }
        function dist(){ var d=0; for(var i=1;i<st.pts.length;i++){ d+=st.pts[i-1].distanceTo(st.pts[i]); } return d; }
        function onClick(ev){ st.pts.push(ev.latlng); if(!st.line){ st.line=L.polyline(st.pts,{color:"#222",weight:3,dashArray:"6,4"}).addTo(map); } else { st.line.setLatLngs(st.pts); } show("Distance: "+fmt(dist())+" (double-tap to finish)"); }
        function onDbl(){ hide(); map.off("click",onClick); map.off("dblclick",onDbl); st.active=false; }
        mkBtn("btn-measure","📏 Measure", function(){ if(!st.active){ st.active=true; st.pts=[]; if(st.line){ try{ map.removeLayer(st.line);}catch(e){} st.line=null; show("Distance: 0 m (double-tap to finish)"); map.on("click",onClick); map.on("dblclick",onDbl);} else { onDbl(); } });
      })();

      // Layers: Pins + Photos
      window.SV = window.SV || {}; SV.pins=L.layerGroup().addTo(map); SV.photos=L.layerGroup().addTo(map);

      function loadGeo(url,grp,kind){
        return fetch(url+"?t="+(new Date()).getTime())
          .then(function(r){ if(!r.ok) throw new Error(r.statusText); return r.json(); })
          .then(function(j){
            try{ grp.clearLayers(); }catch(e){}
            var feats=(j&&j.features)||[];
            for(var i=0;i<feats.length;i++){
              var f=feats[i]; if(!f||!f.geometry||f.geometry.type!=="Point") continue;
              var c=f.geometry.coordinates, ll=L.latLng(c[1],c[0]);
              if(kind==="photos"){
                var u=f.properties&&f.properties.url;
                var html=u?"<img src='"+u+"' style='max-width:240px;height:auto;border-radius:6px'>":"Photo";
                L.marker(ll).bindPopup(html).addTo(grp);
              }else{
                var nm=(f.properties&&f.properties.name)||"Pin";
                var ds=(f.properties&&f.properties.desc)||"";
                L.marker(ll).bindPopup("<b>"+nm+"</b><br>"+ds).addTo(grp);
              }
            }
          }).catch(function(){});
      }
      SV.reloadPins   = function(){ return loadGeo(pinsUrl(),   SV.pins,   "pins"); };
      SV.reloadPhotos = function(){ return loadGeo(photosUrl(), SV.photos, "photos"); };
      SV.reloadPins(); SV.reloadPhotos();

      // Add toggles into layers panel + turn off contours if found
      (function addToggles(){
        function tryPanel(){
          var panel = document.querySelector(".leaflet-control-layers-overlays") || document.querySelector(".leaflet-control-layers-list");
          if(!panel){ setTimeout(tryPanel, 300); return; }
          function add(label,grp){
            var id="sv-chk-"+label.toLowerCase();
            if(document.getElementById(id)) return;
            var lab=document.createElement("label"); lab.style.display="block"; lab.style.cursor="pointer";
            lab.innerHTML="<input type='checkbox' id='"+id+"' checked> "+label;
            panel.appendChild(lab);
            var box=lab.querySelector("input"); if(!box) return;
            box.checked=true; if(!map.hasLayer(grp)) map.addLayer(grp);
            box.addEventListener("change", function(){ if(this.checked){ map.addLayer(grp);} else { map.removeLayer(grp);} });
          }
          add("Photos", SV.photos);
          add("Pins",   SV.pins);
          var labs=panel.getElementsByTagName("label");
          for(var i=0;i<labs.length;i++){
            var t=(labs[i].textContent||"").toLowerCase();
            var cb=labs[i].querySelector("input[type=checkbox]");
            if(cb && /contour/.test(t) && cb.checked){ cb.click(); }
          }
        }
        tryPanel();
      })();

      // Photo & Pin buttons
      ensurePhotoUI();
      if(!document.getElementById("btn-photo")){
        mkBtn("btn-photo","📷 Photo", function(){ window.openPhotoUI({from:"toolbar"}); });
      }
      if(!document.getElementById("btn-pin")){
        var armed=false;
        mkBtn("btn-pin","📌 Pin", function(){
          if(armed){ map.off("click",place); armed=false; alert("Pin mode off"); return; }
          armed=true; alert("Tap the map to place a pin…"); map.once("click", place);
        });
        function place(ev){
          armed=false;
          var ll=ev.latlng; var name=window.prompt("Pin title?"); if(name===null) return; var desc=window.prompt("Description? (optional)")||"";
          var feat={type:"Feature",geometry:{type:"Point",coordinates:[ll.lng,ll.lat]},properties:{name:name,desc:desc,when:(new Date()).getTime()}};
          fetch("/.netlify/functions/repo-commit",{
            method:"POST",headers:{"content-type":"application/json"},
            body:JSON.stringify({feature:feat, geoTarget:"pins"})
          }).then(function(r){ return r.json(); })
          .then(function(){ SV.reloadPins(); alert("Pin saved."); })
          .catch(function(e){ alert("Pin save failed (function not configured?)"); });
        }
      }
    }
    // Start polling once per 250ms until map exists
    setTimeout(boot, 250);
  });
})();
