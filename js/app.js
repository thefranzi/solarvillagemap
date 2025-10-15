// CRITICAL: This file contains server-dependent logic.
// For local testing, you MUST use a local server like 'netlify dev' or 'python -m http.server'.
// Opening index.html directly will cause 'fetch' errors.

document.addEventListener('DOMContentLoaded', function() {
    if (!window.map) {
        console.error("Map object not found. App logic will not run.");
        return;
    }

    const BACKEND = {
        pinsGet: '/.netlify/functions/pins',
        pinsPost: '/.netlify/functions/pins',
        photosGet: '/.netlify/functions/photos',
        photoUpload: '/.netlify/functions/uploadPhoto'
    };
    const state = {
        dropPinArmed: false,
        cam: { stream: null }
    };
    const ui = {
        btnAddPin: document.getElementById('btn-add-pin'),
        btnCamera: document.getElementById('btn-camera'),
        btnMeasure: document.getElementById('btn-measure'),
        btnCamShot: document.getElementById('btn-camera-shot'),
        btnCamOff: document.getElementById('btn-camera-off'),
        camWrap: document.getElementById('camera-wrap'),
        video: document.getElementById('cam-video'),
        canvas: document.getElementById('cam-canvas'),
    };

    const pinIcon = L.icon({ iconUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M20 2c-6.1 0-11 4.9-11 11 0 8.3 11 23 11 23s11-14.7 11-23c0-6.1-4.9-11-11-11z" fill="#ff8c00"/><circle cx="20" cy="13" r="5.5" fill="#fff"/></svg>`), iconSize: [40, 40], iconAnchor: [20, 38], popupAnchor: [0, -32] });
    const photoIcon = L.icon({ iconUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M6 12a4 4 0 0 1 4-4h5l2-2h6l2 2h5a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V12z" fill="#7e57c2"/><circle cx="20" cy="22" r="6.5" fill="#fff"/><circle cx="20" cy="22" r="3.5" fill="#7e57c2"/></svg>`), iconSize: [40, 40], iconAnchor: [20, 36], popupAnchor: [0, -30] });

    async function loadData(url, addFeatureFunc) { try { (await(await fetch(`${url}?t=${Date.now()}`,{cache:'no-store'})).json()).features.forEach(addFeatureFunc); } catch(e) { console.error('Data load error', e); } }
    function addPinFeature(feat) { if (!feat?.geometry?.coordinates) return; const [lng, lat] = feat.geometry.coordinates; const {title,description} = feat.properties||{}; L.marker([lat, lng],{icon:pinIcon}).addTo(pinsLayer).bindPopup(`<b>${title||'Pin'}</b><br>${description||''}`); }
    async function savePin(lng, lat, title, description) { const f = {type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]},properties:{title,description}}; const r = await fetch(BACKEND.pinsPost,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)}); if(!r.ok) throw new Error('Failed to save pin.'); addPinFeature(await r.json()); }
    
    // --- THIS FUNCTION IS NOW FIXED ---
    function addPhotoFeature(feat) { 
        if (!feat?.geometry?.coordinates) return; 
        const [lng, lat] = feat.geometry.coordinates; 
        const {title,description,imageUrl} = feat.properties||{}; 
        // The HTML now includes the onclick event to open the modal
        const h=`<div style="max-width:220px"><b>${title||'Photo'}</b>${description?`<br>${description}`:''}${imageUrl?`<div style="margin-top:6px"><img src="${imageUrl}" alt="Photo thumbnail" style="width:100px;max-height:80px;border-radius:4px;object-fit:cover;cursor:pointer" onclick="openPhotoModal('${imageUrl}')"></div>`:''}</div>`; 
        L.marker([lat,lng],{icon:photoIcon}).addTo(photosLayer).bindPopup(h); 
    }
    
    async function uploadPhoto(blob, filename, lat, lng, title, description) { const fd = new FormData(); fd.append('file',new File([blob],filename,{type:blob.type||'image/jpeg'})); fd.append('lat',String(lat)); fd.append('lng',String(lng)); fd.append('title',title||''); fd.append('description',description||''); const r = await fetch(BACKEND.photoUpload,{method:'POST',body:fd}); if(!r.ok) throw new Error('Photo upload failed.'); addPhotoFeature((await r.json()).feature); }
    async function camOn() { try { const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}); state.cam.stream=s; ui.video.srcObject=s; await ui.video.play(); ui.camWrap.classList.add('show'); } catch(e){ alert('Camera error: '+e.message); } }

    let dropPinCaptureHandler = null;
    function disarmPinDrop() { if(state.dropPinArmed) { state.dropPinArmed = false; if (dropPinCaptureHandler) { map.getContainer().removeEventListener('click', dropPinCaptureHandler, true); dropPinCaptureHandler = null; } map.getContainer().style.cursor = ''; } }
    
    ui.btnAddPin.onclick = () => { if (state.dropPinArmed) return disarmPinDrop(); state.dropPinArmed = true; map.getContainer().style.cursor = 'crosshair'; map.getContainer().addEventListener('click', dropPinCaptureHandler = async (ev) => { if (!state.dropPinArmed) return; const els = [document.getElementById('actionbar'), document.querySelector('.leaflet-control-container')]; if (els.some(el => el && el.contains(ev.target))) return; ev.stopPropagation(); ev.preventDefault(); const latlng = map.containerPointToLatLng([ev.clientX, ev.clientY]); disarmPinDrop(); const title = prompt('Pin title:', 'Pin') || 'Pin'; const description = prompt('Pin description (optional):', ''); try { await savePin(latlng.lng, latlng.lat, title, description); } catch (e) { console.error("Failed to save pin:", e); alert("Error: Could not save pin."); } }, {capture: true, once: true}); };
    ui.btnCamera.onclick = () => { disarmPinDrop(); camOn(); };
    ui.btnCamOff.onclick = () => { if (state.cam.stream) state.cam.stream.getTracks().forEach(t => t.stop()); state.cam.stream = null; ui.video.srcObject = null; ui.camWrap.classList.remove('show'); };
    ui.btnCamShot.onclick = async () => { if (!state.cam.stream) return; const [w,h]=[ui.video.videoWidth,ui.video.videoHeight]; if (!w||!h) return; ui.canvas.width=w;ui.canvas.height=h; ui.canvas.getContext('2d').drawImage(ui.video,0,0,w,h); const blob = await new Promise(res=>ui.canvas.toBlob(res,'image/jpeg',0.8)); const {lat,lng} = map.getCenter(); const title=prompt('Photo title (optional):','')||'Photo'; const description=prompt('Photo description (optional):','')||''; const filename=`photo_${Date.now()}.jpg`; try { await uploadPhoto(blob,filename,lat,lng,title,description); } catch(e) { console.error("Failed to upload photo:",e); alert("Error: Could not upload photo."); } finally { ui.btnCamOff.onclick(); } };

    // --- SIMPLE MEASURE TOOL ---
    const measureTool = (function() {
        let chip = null;
        const state = { on: false, pts: [], line: null };

        function show(text) {
            if (!chip) { 
                chip = document.createElement("div"); 
                chip.className = "sv-measure-chip"; 
                document.body.appendChild(chip); 
            }
            chip.textContent = text;
            chip.style.display = "block";
        }

        function hide() {
            if (chip) { chip.style.display = "none"; }
        }

        function format(meters) {
            return meters < 1000 ? (meters.toFixed(0) + " m") : ((meters / 1000).toFixed(2) + " km");
        }

        function calculateTotal() {
            let dist = 0;
            for (let i = 1; i < state.pts.length; i++) {
                dist += state.pts[i-1].distanceTo(state.pts[i]);
            }
            return dist;
        }

        function clickAdd(ev) {
            state.pts.push(ev.latlng);
            if (!state.line) {
                state.line = L.polyline(state.pts, { color: "#222", weight: 3, dashArray: "6,4" }).addTo(map);
            } else {
                state.line.setLatLngs(state.pts);
            }
            show("Distance: " + format(calculateTotal()) + " (double-click to finish)");
        }

        function finish() {
            hide();
            map.off("click", clickAdd);
            map.off("dblclick", finish);
            if (state.line) {
                try { map.removeLayer(state.line); } catch(e) {}
            }
            state.on = false;
            state.pts = [];
            state.line = null;
        }

        return function() { // This is the function that gets called by the button
            disarmPinDrop(); // Disarm pin drop when measure is activated
            if (!state.on) {
                state.on = true;
                show("Distance: 0 m (double-click to finish)");
                map.on("click", clickAdd);
                map.on("dblclick", finish);
            } else {
                finish();
            }
        };
    })();

    ui.btnMeasure.onclick = measureTool;

    // Initial data load
    loadData(BACKEND.pinsGet, addPinFeature);
    loadData(BACKEND.photosGet, addPhotoFeature);
});