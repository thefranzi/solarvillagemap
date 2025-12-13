// CRITICAL: This file contains server-dependent logic.
// For local testing, you MUST use a local server like 'netlify dev' or 'python -m http.server'.
// Opening index.html directly will cause 'fetch' errors.

document.addEventListener('DOMContentLoaded', function () {
    if (!window.map || typeof L === 'undefined') {
        console.error('Map or Leaflet not found. App logic will not run.');
        return;
    }

    // Ensure layers exist
    if (!window.pinsLayer || !window.photosLayer) {
        console.warn('pinsLayer or photosLayer missing; creating new feature groups.');
        window.pinsLayer = window.pinsLayer || L.featureGroup().addTo(map);
        window.photosLayer = window.photosLayer || L.featureGroup().addTo(map);
    }

    const BACKEND = {
        pinsGet: '/.netlify/functions/pins',
        pinsPost: '/.netlify/functions/pins',
        photosGet: '/.netlify/functions/photos',
        photoUpload: '/.netlify/functions/uploadPhoto'
    };

    const state = {
        dropPinArmed: false,
        dropPhotoArmed: false,
        photoLatLng: null,
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
        toast: document.getElementById('sv-toast') // optional toast element
    };

    // Hard fail if core UI is missing
    if (!ui.btnAddPin || !ui.btnCamera || !ui.btnMeasure ||
        !ui.btnCamShot || !ui.btnCamOff || !ui.camWrap ||
        !ui.video || !ui.canvas) {
        console.error('One or more required UI elements are missing. Aborting app.js init.');
        return;
    }

    // Simple toast helper for short status messages
    function svShowToast(msg) {
        if (!ui.toast) return;
        ui.toast.textContent = msg;
        ui.toast.style.opacity = '0.95';
        setTimeout(function () {
            ui.toast.style.opacity = '0';
        }, 2000);
    }

    const pinIcon = L.icon({
        iconUrl:
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                    <defs>
                        <radialGradient id="gPin" cx="50%" cy="30%" r="60%">
                            <stop offset="0%" stop-color="#ffd699"/>
                            <stop offset="100%" stop-color="#ff8c00"/>
                        </radialGradient>
                        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
                        </filter>
                    </defs>
                    <g filter="url(#shadow)">
                        <path d="M32 4C21.5 4 13 12.5 13 23c0 10.4 7 16.6 12.5 24.2 2.2 3 4.3 6 6.5 9.8 2.2-3.8 4.3-6.8 6.5-9.8C44 39.6 51 33.4 51 23 51 12.5 42.5 4 32 4z" fill="url(#gPin)"/>
                        <circle cx="32" cy="23" r="8" fill="#fff" stroke="#cc6a00" stroke-width="2"/>
                    </g>
                </svg>`
            ),
        iconSize: [40, 40],
        iconAnchor: [20, 38],
        popupAnchor: [0, -32]
    });

    const photoIcon = L.icon({
        iconUrl:
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                    <defs>
                        <linearGradient id="gCam" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#7e57c2"/>
                            <stop offset="100%" stop-color="#512da8"/>
                        </linearGradient>
                        <filter id="shadowCam" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
                        </filter>
                    </defs>
                    <g filter="url(#shadowCam)">
                        <rect x="8" y="18" width="48" height="32" rx="4" ry="4" fill="url(#gCam)"/>
                        <rect x="14" y="24" width="36" height="20" rx="3" ry="3" fill="#fff"/>
                        <circle cx="32" cy="34" r="8" fill="#90caf9" stroke="#3949ab" stroke-width="2"/>
                        <rect x="20" y="12" width="12" height="8" rx="2" ry="2" fill="#5e35b1"/>
                    </g>
                </svg>`
            ),
        iconSize: [40, 40],
        iconAnchor: [20, 36],
        popupAnchor: [0, -30]
    });

    async function loadData(url, addFeatureFunc) {
        try {
            const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const fc = await res.json();
            (fc.features || []).forEach(addFeatureFunc);
        } catch (e) {
            console.error('Data load error', url, e);
        }
    }

    // --- PINS ---
    function addPinFeature(feat) {
        if (!feat || !feat.geometry || !Array.isArray(feat.geometry.coordinates)) return;
        const [lng, lat] = feat.geometry.coordinates;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;

        const props = feat.properties || {};
        const title = props.title || 'Pin';

        L.marker([lat, lng], { icon: pinIcon })
            .addTo(window.pinsLayer)
            .bindPopup(`<b>${title}</b>`);
    }

    async function savePin(lng, lat, title) {
        const f = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: { title }
        };
        const r = await fetch(BACKEND.pinsPost, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(f)
        });
        if (!r.ok) throw new Error(`Failed to save pin. HTTP ${r.status}`);
        const saved = await r.json();
        addPinFeature(saved);
    }

    // --- PHOTOS ---
    function addPhotoFeature(feat) {
        if (!feat || !feat.geometry || !Array.isArray(feat.geometry.coordinates)) return;
        const [lng, lat] = feat.geometry.coordinates;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;

        const props = feat.properties || {};
        const title = props.title || 'Photo';
        const imageUrl = props.imageUrl || '';

        const marker = L.marker([lat, lng], { icon: photoIcon }).addTo(window.photosLayer);

        let popupHtml = `<strong>${title}</strong>`;
        if (imageUrl) {
            popupHtml += `<br><img src="${imageUrl}" style="max-width:200px;max-height:200px;cursor:pointer;" onclick="openPhotoModal('${imageUrl}')">`;
        }

        marker.bindPopup(popupHtml);
    }

    // Upload photo using JSON dataUrl, matching uploadPhoto.mjs
    async function savePhoto(lng, lat, title, blob) {
        // Convert Blob → data URL
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        const body = { dataUrl, lat, lng, title };

        const r = await fetch(BACKEND.photoUpload, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!r.ok) {
            let errText = '';
            try {
                errText = await r.text();
            } catch (e) { /* ignore */ }
            console.error('uploadPhoto HTTP', r.status, 'body:', errText);
            throw new Error(`Failed to upload photo. HTTP ${r.status}`);
        }

        const saved = await r.json(); // { ok: true, imageUrl }

        const feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
                title,
                imageUrl: saved.imageUrl,
                ts: Date.now()
            }
        };
        addPhotoFeature(feature);
    }

    // --- CAMERA HANDLING ---
    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Camera is not supported in this browser.');
            return;
        }
        try {
            state.cam.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            ui.video.srcObject = state.cam.stream;
            // Camera stream ready; UI will be shown after map click for location
        } catch (e) {
            console.error('Camera error', e);
            alert('Could not access camera.');
        }
    }

    function stopCamera() {
        if (state.cam.stream) {
            state.cam.stream.getTracks().forEach(t => t.stop());
            state.cam.stream = null;
        }
        ui.video.srcObject = null;
        ui.camWrap.classList.remove('show');
    }

    ui.btnCamOff.addEventListener('click', function () {
        stopCamera();
        state.dropPhotoArmed = false;
        state.photoLatLng = null;
    });

    ui.btnCamShot.addEventListener('click', async function () {
        if (!state.cam.stream) return;
        if (!state.photoLatLng) {
            alert('Tap the map to choose where this photo belongs first.');
            return;
        }

        const video = ui.video;
        const canvas = ui.canvas;
        const ctx = canvas.getContext('2d');

        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;

        if (!vw || !vh) {
            console.warn('Video dimensions not ready; ignoring shot.');
            return;
        }

        canvas.width = vw;
        canvas.height = vh;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (!blob) {
            alert('Could not capture photo.');
            return;
        }

        const title = prompt('Photo title?', 'Photo') || 'Photo';

        try {
            await savePhoto(
                state.photoLatLng.lng,
                state.photoLatLng.lat,
                title,
                blob
            );
            svShowToast('Photo saved successfully');
            stopCamera();
            state.dropPhotoArmed = false;
            state.photoLatLng = null;
            if (typeof closePhotoModal === 'function') {
                closePhotoModal();
            }
        } catch (e) {
            console.error('Photo save error', e);
            alert('Could not save photo.');
        }
    });

    // --- MAP CLICK HANDLING FOR PINS & PHOTOS ---
    map.on('click', async function (e) {
        const latlng = e.latlng;
        if (!latlng) return;

        if (state.dropPinArmed) {
            const title = prompt('Pin title?', 'Pin') || 'Pin';
            try {
                await savePin(latlng.lng, latlng.lat, title);
                svShowToast('Pin placed successfully');
            } catch (err) {
                console.error('Pin save error', err);
                alert('Could not save pin.');
            }
            state.dropPinArmed = false;
            ui.btnAddPin.classList.remove('active');
        } else if (state.dropPhotoArmed) {
            state.photoLatLng = { lat: latlng.lat, lng: latlng.lng };
            svShowToast('Location set. Now take a photo.');
            ui.camWrap.classList.add('show');
        }
    });

    // --- UI BUTTON HANDLERS ---
    ui.btnAddPin.addEventListener('click', function () {
        state.dropPinArmed = !state.dropPinArmed;
        if (state.dropPinArmed) {
            state.dropPhotoArmed = false;
            state.photoLatLng = null;
            ui.btnAddPin.classList.add('active');
            ui.btnCamera.classList.remove('active');
            stopCamera();
            alert('Click on the map to drop a pin.');
        } else {
            ui.btnAddPin.classList.remove('active');
        }
    });

    ui.btnCamera.addEventListener('click', async function () {
        state.dropPhotoArmed = !state.dropPhotoArmed;
        if (state.dropPhotoArmed) {
            state.dropPinArmed = false;
            state.photoLatLng = null;
            ui.btnCamera.classList.add('active');
            ui.btnAddPin.classList.remove('active');
            // Start camera stream but keep UI hidden until map click
            await startCamera();
            svShowToast('Tap on the map where the photo was taken');
        } else {
            ui.btnCamera.classList.remove('active');
            state.photoLatLng = null;
            stopCamera();
            ui.camWrap.classList.remove('show');
        }
    });

    // --- SIMPLE MEASURE TOOL ---
    const measureTool = (function () {
        let chip = null;
        const stateM = { on: false, pts: [], line: null };

        function show(text) {
            if (!chip) {
                chip = document.createElement('div');
                chip.className = 'sv-measure-chip';
                document.body.appendChild(chip);
            }
            chip.textContent = text;
            chip.style.display = 'block';
        }

        function hide() {
            if (chip) chip.style.display = 'none';
        }

        function format(meters) {
            return meters < 1000 ? meters.toFixed(0) + ' m' : (meters / 1000).toFixed(2) + ' km';
        }

        function calculateTotal() {
            let dist = 0;
            for (let i = 1; i < stateM.pts.length; i++) {
                dist += stateM.pts[i - 1].distanceTo(stateM.pts[i]);
            }
            return dist;
        }

        function clickAdd(ev) {
            stateM.pts.push(ev.latlng);
            if (!stateM.line) {
                stateM.line = L.polyline(stateM.pts, {
                    color: '#222',
                    weight: 3,
                    dashArray: '6,4'
                }).addTo(map);
            } else {
                stateM.line.setLatLngs(stateM.pts);
            }
            show('Distance: ' + format(calculateTotal()) + ' (double-click to finish)');
        }

        function finish() {
            hide();
            map.off('click', clickAdd);
            map.off('dblclick', finish);
            if (stateM.line) {
                try { map.removeLayer(stateM.line); } catch (e) {}
            }
            stateM.on = false;
            stateM.pts = [];
            stateM.line = null;
        }

        return function () {
            // Turn off pin/photo modes when measuring
            state.dropPinArmed = false;
            state.dropPhotoArmed = false;
            state.photoLatLng = null;
            ui.btnAddPin.classList.remove('active');
            ui.btnCamera.classList.remove('active');

            if (!stateM.on) {
                stateM.on = true;
                show('Distance: 0 m (double-click to finish)');
                map.on('click', clickAdd);
                map.on('dblclick', finish);
            } else {
                finish();
            }
        };
    })();

    ui.btnMeasure.addEventListener('click', measureTool);

    // --- INITIAL DATA LOAD ---
    loadData(BACKEND.pinsGet, addPinFeature);
    loadData(BACKEND.photosGet, addPhotoFeature);
});
