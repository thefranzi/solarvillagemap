(function(){
  window.SV_SITE_CENTER = window.SV_SITE_CENTER || { lat: 49.8870, lng: -119.4960 };
  window.SV_GH = window.SV_GH || { slug: "__GH_SLUG__", branch: "mobile-one-shot-locate" };
  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function findMap(){ try{
    if(window.map && typeof window.map.setView==="function" && typeof window.map.eachLayer==="function") return window.map;
    if(window.L && window.L.Map){ var els=document.getElementsByClassName("leaflet-container"); if(els.length) return window.map||null; }
  }catch(e){} return null; }
  function addBar(){ var bar=document.getElementById("bottom-toolbar-fixed"); if(!bar){ bar=document.createElement("div"); bar.id="bottom-toolbar-fixed"; document.body.appendChild(bar); }
    function mk(id, txt, fn){ var e=document.getElementById(id); if(e) return e; e=document.createElement("button"); e.id=id; e.className="sv-btn"; e.textContent=txt; e.onclick=fn; bar.appendChild(e); return e; }
    return {bar:bar, mk:mk};
  }
  function raw(path){ var s=(window.SV_GH&&SV_GH.slug)||"__GH_SLUG__", b=(window.SV_GH&&SV_GH.branch)||"mobile-one-shot-locate"; path=String(path||"").replace(/^\/+/,""); return "https://raw.githubusercontent.com/"+s+"/"+encodeURIComponent(b)+"/"+path; }
  function ensurePhotoUI(){
    if(document.getElementById("photo-capture")) return;
    var d=document.createElement("div"); d.innerHTML=""
      +"<div id='photo-capture' style='display:none; position:fixed; left:8px; right:8px; bottom:8vh; z-index:1500; background:#fff; border-radius:10px; padding:12px; box-shadow:0 6px 20px rgba(0,0,0,0.25);'>"
      +"<form id='photoForm'><label for='photoInput' style='display:inline-block; padding:12px 14px; font-size:16px; cursor:pointer;'>Take Photo"
      +"<input id='photoInput' name='photo' type='file' accept='image/*' capture='environment' style='display:none;'></label>"
      +"<div id='photoPreview' style='margin-top:10px;'></div>"
      +"<div style='display:flex; gap:8px; margin-top:10px;'><button id='photoUpload' type='button' style='display:none;'>Upload</button><button id='photoCancel' type='button'>Cancel</button></div>"
      +"<small style='display:block; margin-top:6px; font-size:12px;'>Tap Take Photo → preview → Upload</small></form></div>";
    document.body.appendChild(d.firstChild);
    var input=document.getElementById("photoInput"), preview=document.getElementById("photoPreview"), up=document.getElementById("photoUpload"), cancel=document.getElementById("photoCancel"), wrap=document.getElementById("photo-capture");
    window.openPhotoUI=function(meta){ wrap.style.display="block"; wrap.setAttribute("data-meta", JSON.stringify(meta||{})); };
    window.closePhotoUI=function(){ wrap.style.display="none"; preview.innerHTML=""; up.style.display="none"; input.value=""; };
    input.addEventListener("change", function(ev){
      var file=ev && ev.target && ev.target.files && ev.target.files[0]; if(!file) return;
      preview.textContent="Preparing preview...";
      var reader=new FileReader(); reader.onload=function(){ var img=new Image(); img.onload=function(){
        var w=img.width,h=img.height,max=1600; if(Math.max(w,h)>max){ if(w>h){ h=Math.round(h*(max/w)); w=max; } else { w=Math.round(w*(max/h)); h=max; } }
        var c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
        var dataUrl=c.toDataURL("image/jpeg",0.78); preview.innerHTML="<img id='previewImg' alt='preview' style='max-width:100%;height:auto;border-radius:8px'>"; document.getElementById("previewImg").src=dataUrl;
        up.style.display="inline-block"; up.onclick=function(){ uploadPhoto(dataUrl, file.name); };
      }; img.src=reader.result; }; reader.readAsDataURL(file);
    });
    if(cancel) cancel.onclick=function(){ window.closePhotoUI(); };
    function uploadPhoto(dataUrl, name){
      var center=(window.map&&map.getCenter&&map.getCenter())||{lat: (window.SV_SITE_CENTER||{}).lat, lng:(window.SV_SITE_CENTER||{}).lng};
      var meta={lat:center.lat,lng:center.lng,when:(new Date()).getTime()};
      fetch("/.netlify/functions/repo-commit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dataUrl:dataUrl,filename:name,subdir:"uploads"})})
        .then(function(r){return r.text().then(function(t){return {ok:r.ok,t:t};});})
        .then(function(res){ if(!res.ok){ alert(res.t||"Upload failed"); return; } var out={}; try{ out=JSON.parse(res.t);}catch(e){} if(!out.ok){ alert(out.error||"Upload failed"); return; }
          var feat={type:"Feature",geometry:{type:"Point",coordinates:[meta.lng,meta.lat]},properties:{url:out.url,when:meta.when,name:name}};
          return fetch("/.netlify/functions/repo-commit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({feature:feat,geoTarget:"photos"})});
        }).then(function(){ if(window.SV&&SV.reloadPhotos) SV.reloadPhotos(true); window.closePhotoUI(); alert("Photo uploaded."); });
    }
  }
  ready(function(){
    var map = findMap(); if(!map){ return setTimeout(function(){ (arguments.callee||function(){})() }, 250); }
    try{ map.setMinZoom && map.setMinZoom(2); }catch(e){}
    try{ var layersEl=document.querySelector(".leaflet-control-layers"); var tr=document.querySelector(".leaflet-top.leaflet-right");
      if(layersEl && tr && layersEl.parentElement!==tr){ tr.appendChild(layersEl); } if(layersEl) layersEl.style.display="block"; }catch(e){}
    var UI=addBar();
    UI.mk("btn-center-site","🎯 Site",function(){ try{ var c=window.SV_SITE_CENTER||{lat:49.8870,lng:-119.4960}; var ll=L.latLng(c.lat,c.lng); var z=(map.getZoom&&map.getZoom())||15; if(z<15) z=15; map.setView(ll,z); }catch(e){} });
    UI.mk("btn-locate-once","📍 Locate",function(){ if(!navigator.geolocation) return alert("Geolocation unsupported");
      navigator.geolocation.getCurrentPosition(function(pos){ var ll=L.latLng(pos.coords.latitude,pos.coords.longitude); var z=(map.getZoom&&map.getZoom())||15; if(z<15) z=15; map.setView(ll,z);
        try{ var mk=L.marker(ll); var acc=pos.coords.accuracy||0; var c=acc?L.circle(ll,{radius:acc}):null; var g=L.layerGroup(c?[mk,c]:[mk]).addTo(map); setTimeout(function(){ try{ map.removeLayer(g);}catch(e){} },5000);}catch(e){}
      },function(e){ alert("Locate failed"); },{timeout:8000, maximumAge:300000});
    });
    (function(){ var chip=document.createElement("div"); chip.className="sv-chip"; chip.style.display="none"; document.body.appendChild(chip);
      function show(t){ chip.textContent=t; chip.style.display="block"; } function hide(){ chip.style.display="none"; }
      var st={active:false,pts:[],line:null}; function fmt(m){ return m<1000? (m.toFixed(0)+" m") : ((m/1000).toFixed(2)+" km"); }
      function dist(){ for(var d=0,i=1;i<st.pts.length;i++){ d+=st.pts[i-1].distanceTo(st.pts[i]); } return d; }
      function onClick(ev){ st.pts.push(ev.latlng); if(!st.line){ st.line=L.polyline(st.pts,{color:"#222",weight:3,dashArray:"6,4"}).addTo(map); } else { st.line.setLatLngs(st.pts); } show("Distance: "+fmt(dist())+" (double-tap to finish)"); }
      function onDbl(){ hide(); map.off("click",onClick); map.off("dblclick",onDbl); st.active=false; }
      UI.mk("btn-measure","📏 Measure",function(){ if(!st.active){ st.active=true; st.pts=[]; if(st.line){ try{ map.removeLayer(st.line);}catch(e){} st.line=null; } show("Distance: 0 m (double-tap to finish)"); map.on("click",onClick); map.on("dblclick",onDbl);} else { onDbl(); } });
    })();
    window.SV = window.SV || {}; SV.pins=L.layerGroup().addTo(map); SV.photos=L.layerGroup().addTo(map);
    function loadGeo(url,grp,kind){ return fetch(url+"?t="+(new Date()).getTime()).then(function(r){ if(!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(function(j){ try{ grp.clearLayers(); }catch(e){} var feats=(j&&j.features)||[]; for(var i=0;i<feats.length;i++){ var f=feats[i]; if(!f||!f.geometry||f.geometry.type!=="Point") continue;
        var c=f.geometry.coordinates; var ll=L.latLng(c[1],c[0]); if(kind==="photos"){ var u=f.properties&&f.properties.url; var html=u?"<img src='"+u+"' style='max-width:240px;height:auto;border-radius:6px'>":"Photo"; L.marker(ll).bindPopup(html).addTo(grp); }
        else { var nm=(f.properties&&f.properties.name)||"Pin"; var ds=(f.properties&&f.properties.desc)||""; L.marker(ll).bindPopup("<b>"+nm+"</b><br>"+ds).addTo(grp); } } }).catch(function(){});
    }
    function rawPins(){ return "__RAW__/data/pins.geojson".replace("__RAW__", "https://raw.githubusercontent.com/__GH_SLUG__/mobile-one-shot-locate"); }
    function rawPhotos(){ return "__RAW__/data/photos.geojson".replace("__RAW__", "https://raw.githubusercontent.com/__GH_SLUG__/mobile-one-shot-locate"); }
    SV.reloadPins=function(){ return loadGeo(rawPins(), SV.pins, "pins"); }; SV.reloadPhotos=function(){ return loadGeo(rawPhotos(), SV.photos, "photos"); }; SV.reloadPins(); SV.reloadPhotos();
    (function toggles(){ function tryPanel(){ var panel=document.querySelector(".leaflet-control-layers-overlays")||document.querySelector(".leaflet-control-layers-list"); if(!panel) return setTimeout(tryPanel,300);
        function add(label,grp){ var id="sv-chk-"+label.toLowerCase(); if(document.getElementById(id)) return; var lab=document.createElement("label"); lab.style.display="block"; lab.style.cursor="pointer";
          lab.innerHTML="<input type='checkbox' id='"+id+"' checked> "+label; panel.appendChild(lab); var box=lab.querySelector("input"); if(box){ box.checked=true; if(!map.hasLayer(grp)) map.addLayer(grp);
            box.addEventListener("change", function(){ if(this.checked){ map.addLayer(grp);} else { map.removeLayer(grp);} }); } }
        add("Photos",SV.photos); add("Pins",SV.pins);
        var labs=panel.getElementsByTagName("label"); for(var i=0;i<labs.length;i++){ var t=(labs[i].textContent||"").toLowerCase(); var cb=labs[i].querySelector("input[type=checkbox]"); if(cb && /contour/.test(t) && cb.checked){ cb.click(); } }
      } tryPanel();
    })();
    ensurePhotoUI();
    (function(){ var bar=document.getElementById("bottom-toolbar-fixed"); if(!document.getElementById("btn-photo")){ var b=document.createElement("button"); b.id="btn-photo"; b.className="sv-btn"; b.textContent="📷 Photo"; b.onclick=function(){ window.openPhotoUI({from:"toolbar"}); }; bar.appendChild(b); }
      if(!document.getElementById("btn-pin")){ var p=document.createElement("button"); p.id="btn-pin"; p.className="sv-btn"; p.textContent="📌 Pin"; bar.appendChild(p);
        var armed=false; function place(ev){ map.off("click",place); armed=false; var ll=ev.latlng; var name=window.prompt("Pin title?"); if(name===null) return; var desc=window.prompt("Description? (optional)")||"";
          var feat={type:"Feature",geometry:{type:"Point",coordinates:[ll.lng,ll.lat]},properties:{name:name,desc:desc,when:(new Date()).getTime()}};
          fetch("/.netlify/functions/repo-commit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({feature:feat,geoTarget:"pins"})})
            .then(function(r){ return r.json(); }).then(function(){ SV.reloadPins(); alert("Pin saved."); }).catch(function(e){ alert("Pin save failed: "+e); });
        }
        p.onclick=function(){ if(armed){ map.off("click",place); armed=false; alert("Pin mode off"); return; } armed=true; alert("Tap the map to place a pin…"); map.once("click",place); };
      }
    })();
  });
})();
