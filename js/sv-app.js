(function(){
  // --- Config ---
  var GH_SLUG   = "thefranzi/solarvillagemap";     // <owner>/<repo>
  var GH_BRANCH = "mobile-one-shot-locate";        // branch for raw reads & function commits
  var SITE_FALLBACK = {lat:49.8870, lng:-119.4960};

  // --- tiny helpers ---
  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function $(sel){ return document.querySelector(sel); }
  function mapOk(m){ return !!(m && typeof m.setView==="function" && typeof m.eachLayer==="function"); }
  function raw(p){ p=String(p||"").replace(/^\/+/,""); return "https://raw.githubusercontent.com/"+GH_SLUG+"/"+encodeURIComponent(GH_BRANCH)+"/"+p; }
  function ensureEl(id, html){
    var el=document.getElementById(id); if(el) return el;
    var wrap=document.createElement("div"); wrap.innerHTML=html; el=wrap.firstChild; document.body.appendChild(el); return el;
  }
  function killTopLeft(){ var tl=$(".leaflet-top.leaflet-left"); if(tl&&tl.parentNode) try{ tl.parentNode.removeChild(tl);}catch(e){} }

  // --- bottom bar + switches ---
  function toolbar(){
    var bars = document.querySelectorAll("#bottom-toolbar-fixed");
    for(var i=1;i<bars.length;i++){ try{ bars[i].parentNode.removeChild(bars[i]); }catch(e){} }
    var bar = bars[0];
    if(!bar){
      bar = document.createElement("div");
      bar.id="bottom-toolbar-fixed";
      document.body.appendChild(bar);
    }
    // switches block (Photos / Pins)
    var inline = document.getElementById("sv-inline");
    if(!inline){
      inline = document.createElement("div");
      inline.id="sv-inline"; inline.className="sv-inline";
      inline.innerHTML = "<label><input type='checkbox' id='sv-tog-photos' checked> Photos</label>"
                       + " <label><input type='checkbox' id='sv-tog-pins' checked> Pins</label>";
      bar.appendChild(inline);
    }
    function mk(id, text, onClick){
      var b=document.getElementById(id);
      if(!b){
        b=document.createElement("button");
        b.id=id; b.className="sv-btn"; b.textContent=text;
        b.onclick=onClick;
        bar.insertBefore(b, inline); // buttons before switches
      }
      return b;
    }
    return {bar:bar, inline:inline, mk:mk};
  }

  // --- layers: photos + pins groups ---
  function ensureGroups(map){
    window.SV = window.SV || {};
    if(!SV.pins)   SV.pins   = L.layerGroup().addTo(map);
    if(!SV.photos) SV.photos = L.layerGroup().addTo(map);
  }
  function overlaysOnExceptContours(){
    var panel = $(".leaflet-control-layers-overlays") || $(".leaflet-control-layers-list");
    if(!panel) return;
    var labels = panel.getElementsByTagName("label");
    for(var i=0;i<labels.length;i++){
      var lb=labels[i], t=(lb.textContent||"").toLowerCase();
      var cb=lb.querySelector('input[type="checkbox"]'); if(!cb) continue;
      var isContour = /(^|\W)cont(ours?)?(\W|$)|cont\./i.test(t);
      var shouldOn = !isContour;
      if(shouldOn && !cb.checked) cb.click();
      if(!shouldOn && cb.checked) cb.click();
    }
  }
  function wireSwitches(map){
    function bind(id, grp){
      var cb=document.getElementById(id); if(!cb || !grp) return;
      cb.addEventListener("change", function(){
        try{ this.checked ? map.addLayer(grp) : map.removeLayer(grp); }catch(e){}
      });
      try{
        if(cb.checked && !map.hasLayer(grp)) map.addLayer(grp);
        if(!cb.checked && map.hasLayer(grp)) map.removeLayer(grp);
      }catch(e){}
    }
    bind("sv-tog-photos", SV.photos);
    bind("sv-tog-pins",   SV.pins);
  }

  // --- load/save GeoJSON (append feature to file via Netlify function) ---
  function loadGeo(url, group, kind){
    return fetch(url+"?t="+Date.now()).then(function(r){ if(!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(function(j){
        try{ group.clearLayers(); }catch(e){}
        var feats = (j && j.features)||[];
        for(var i=0;i<feats.length;i++){
          var f=feats[i]; if(!f || !f.geometry || f.geometry.type!=="Point") continue;
          var c=f.geometry.coordinates, ll=L.latLng(c[1],c[0]);
          if(kind==="photos"){
            var u=f.properties && f.properties.url;
            var html = u ? "<img src='"+u+"' style='max-width:240px;height:auto;border-radius:6px'>" : "Photo";
            L.marker(ll).addTo(group).bindPopup(html);
          }else{
            var nm=(f.properties&&f.properties.name)||"Pin";
            var ds=(f.properties&&f.properties.desc)||"";
            L.marker(ll).addTo(group).bindPopup("<b>"+nm+"</b><br>"+ds);
          }
        }
      }).catch(function(){ /* ignore 404 on empty */ });
  }
  function commitFeature(feature, target){ // target: "pins" | "photos"
    return fetch("/.netlify/functions/repo-commit",{
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ feature: feature, geoTarget: target, branch: GH_BRANCH, repo: GH_SLUG })
    }).then(function(r){ return r.json().catch(function(){ return {ok:r.ok}; }); });
  }
  function commitUpload(dataUrl, filename){
    return fetch("/.netlify/functions/repo-commit",{
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ dataUrl: dataUrl, filename: filename, subdir: "uploads", branch: GH_BRANCH, repo: GH_SLUG })
    }).then(function(r){ return r.json().catch(function(){ return {ok:r.ok}; }); });
  }

  // --- Photo UI (capture → preview → upload → add Feature) ---
  function ensurePhotoUI(){
    var html = ""
      +"<div id='photo-capture'>"
      +"  <div><label class='sv-btn'>Take Photo"
      +"    <input id='photoInput' type='file' accept='image/*' capture='environment' style='display:none'>"
      +"  </label></div>"
      +"  <div id='photoPreview' style='margin-top:8px;'></div>"
      +"  <div class='row'><button id='photoUpload' class='sv-btn' style='display:none'>Upload</button><button id='photoCancel' class='sv-btn'>Cancel</button></div>"
      +"  <div style='margin-top:6px;font-size:12px;color:#333'>Flow: Take Photo → Preview → Upload</div>"
      +"</div>";
    var ui = ensureEl("photo-capture", html);

    var input   = document.getElementById("photoInput");
    var preview = document.getElementById("photoPreview");
    var up      = document.getElementById("photoUpload");
    var cancel  = document.getElementById("photoCancel");

    window.openPhotoUI  = function(){ ui.style.display="block"; };
    window.closePhotoUI = function(){ ui.style.display="none"; preview.innerHTML=""; up.style.display="none"; input.value=""; };

    input.addEventListener("change", function(ev){
      var file=ev && ev.target && ev.target.files && ev.target.files[0]; if(!file) return;
      preview.textContent="Preparing preview…";
      var reader=new FileReader();
      reader.onload=function(){
        var img=new Image();
        img.onload=function(){
          // compress to max 1600px
          var w=img.width,h=img.height,max=1600;
          if(Math.max(w,h)>max){ if(w>h){ h=Math.round(h*(max/w)); w=max; } else { w=Math.round(w*(max/h)); h=max; } }
          var c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
          var dataUrl=c.toDataURL("image/jpeg",0.78);
          preview.innerHTML="<img id='previewImg' alt='preview' style='max-width:100%;height:auto;border-radius:8px'>";
          document.getElementById("previewImg").src=dataUrl;
          up.style.display="inline-block";
          up.onclick=function(){
            // 1) upload image blob to /uploads in repo
            var fname = "photo-"+Date.now()+".jpg";
            commitUpload(dataUrl, fname).then(function(res){
              if(!res || !res.ok || !res.url){ alert("Upload failed"); return; }
              // 2) add photo feature at current center
              var m = window.map;
              var center = (m&&m.getCenter&&m.getCenter()) || SITE_FALLBACK;
              var feat = {
                type:"Feature",
                geometry:{type:"Point", coordinates:[center.lng, center.lat]},
                properties:{ url: res.url, when: Date.now(), name: fname }
              };
              commitFeature(feat, "photos").then(function(){
                try{ if(window.SV && SV.reloadPhotos) SV.reloadPhotos(); }catch(e){}
                alert("Photo saved.");
                window.closePhotoUI();
              });
            });
          };
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    cancel.onclick=function(){ window.closePhotoUI(); };
  }

  // --- Measure tools (picker: Linear / Area / Clear) ---
  function ensureMeasurePicker(){
    var html = ""
      +"<div id='sv-measure-picker'>"
      +"  <button id='sv-msr-l'>Linear</button>"
      +"  <button id='sv-msr-a'>Area</button>"
      +"  <button id='sv-msr-c'>Clear</button>"
      +"</div>";
    var el = ensureEl("sv-measure-picker", html);
    return el;
  }
  function wireMeasure(map){
    var state = { mode:null, line:null, poly:null, pts:[] };
    var picker = ensureMeasurePicker();
    function fmt(m){ return m<1000? (m.toFixed(0)+" m") : ((m/1000).toFixed(2)+" km"); }
    function fmtA(a){ return a<1e6? (a.toFixed(0)+" m²") : ((a/1e6).toFixed(2)+" km²"); }

    function off(){
      map.off("click", onClick);
      state.mode=null; state.pts=[];
      try{ if(state.line){ map.removeLayer(state.line); state.line=null; } }catch(e){}
      try{ if(state.poly){ map.removeLayer(state.poly); state.poly=null; } }catch(e){}
      picker.style.display="none";
    }
    function onClick(ev){
      state.pts.push(ev.latlng);
      if(state.mode==="linear"){
        if(!state.line){ state.line=L.polyline(state.pts,{color:"#222",weight:3,dashArray:"6,4"}).addTo(map); }
        else { state.line.setLatLngs(state.pts); }
        var d=0; for(var i=1;i<state.pts.length;i++){ d+=state.pts[i-1].distanceTo(state.pts[i]); }
        map.closePopup();
        L.popup({autoClose:true, closeButton:false})
          .setLatLng(ev.latlng).setContent("Distance: "+fmt(d)).openOn(map);
      } else if(state.mode==="area"){
        if(!state.poly){ state.poly=L.polygon(state.pts,{color:"#222",weight:2,fillOpacity:0.1}).addTo(map); }
        else { state.poly.setLatLngs([state.pts]); }
        if(state.pts.length>=3){
          // rough planar area (Leaflet has no built-in geodesic; fine for small projects)
          var area=0;
          for(var j=0;j<state.pts.length;j++){
            var p1=state.pts[j], p2=state.pts[(j+1)%state.pts.length];
            area += (p1.lng * p2.lat - p2.lng * p1.lat);
          }
          area = Math.abs(area)*12364.0; // crude scale for lat/lng degrees near mid-lat; good enough visually
          map.closePopup();
          L.popup({autoClose:true, closeButton:false})
            .setLatLng(ev.latlng).setContent("Area: "+fmtA(area)).openOn(map);
        }
      }
    }

    document.getElementById("sv-msr-l").onclick=function(){ off(); state.mode="linear"; map.on("click", onClick); };
    document.getElementById("sv-msr-a").onclick=function(){ off(); state.mode="area";   map.on("click", onClick); };
    document.getElementById("sv-msr-c").onclick=function(){ off(); alert("Measurements cleared."); };

    return { open:function(){ picker.style.display="flex"; }, close:off };
  }

  // --- Boot ---
  function boot(){
    var tries=0;
    var t = setInterval(function(){
      var m = window.map || null;
      if(!mapOk(m)){ if(++tries>80){ clearInterval(t); } return; }
      clearInterval(t);

      try{ if(m.options && m.options.minZoom>2) m.options.minZoom=2; if(m.setMinZoom) m.setMinZoom(2); }catch(e){}
      killTopLeft();

      ensureGroups(m);

      var UI = toolbar();
      overlaysOnExceptContours();

      // switches bind
      window.SV.reloadPins   = function(){ return loadGeo(raw("data/pins.geojson"),   SV.pins,   "pins"); };
      window.SV.reloadPhotos = function(){ return loadGeo(raw("data/photos.geojson"), SV.photos, "photos"); };
      SV.reloadPins(); SV.reloadPhotos();
      wireSwitches(m);

      // buttons
      UI.mk("btn-center-site","🎯 Site", function(){
        try{
          var c = (m.getBounds && m.getBounds().getCenter()) || (m.getCenter && m.getCenter()) || L.latLng(SITE_FALLBACK.lat, SITE_FALLBACK.lng);
          var z = (m.getZoom && m.getZoom()) || 15; if(z<15) z=15;
          m.setView(c, z);
        }catch(e){}
      });

      UI.mk("btn-locate-once","📍 Locate", function(){
        if(!("geolocation" in navigator)) return alert("Geolocation unsupported");
        navigator.geolocation.getCurrentPosition(function(pos){
          var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
          var z  = (m.getZoom && m.getZoom()) || 15; if(z<15) z=15;
          m.setView(ll, z);
          try{
            var mk=L.marker(ll); var acc=pos.coords.accuracy||0;
            var c = acc ? L.circle(ll,{radius:acc}) : null;
            var g=L.layerGroup(c?[mk,c]:[mk]).addTo(m);
            setTimeout(function(){ try{ m.removeLayer(g);}catch(e){} }, 4000);
          }catch(e){}
        }, function(){ alert("Locate failed"); }, {timeout:8000, maximumAge:300000});
      });

      var msr = wireMeasure(m);
      UI.mk("btn-measure","📏 Measure", function(){ msr.open(); });

      UI.mk("btn-pin","📌 Pin", function(){
        alert("Tap the map to drop a pin, then you’ll be prompted for a title/description.");
        var once = function(ev){
          m.off("click", once);
          try{
            var nm = window.prompt("Pin title?"); if(nm===null) return;
            var ds = window.prompt("Description (optional):") || "";
            var feat = {
              type:"Feature",
              geometry:{type:"Point", coordinates:[ev.latlng.lng, ev.latlng.lat]},
              properties:{ name:nm, desc:ds, when: Date.now() }
            };
            commitFeature(feat,"pins").then(function(){
              SV.reloadPins();
              L.marker(ev.latlng).addTo(m).bindPopup("<b>"+nm+"</b><br>"+ds).openPopup();
              alert("Pin saved.");
            });
          }catch(e){}
        };
        m.once("click", once);
      });

      ensurePhotoUI();
      UI.mk("btn-photo","📷 Photo", function(){ window.openPhotoUI(); });
    }, 250);
  }

  ready(boot);
})();
