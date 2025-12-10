// CRITICAL: This file contains server-dependent logic.
// For local testing, you MUST use a local server like 'netlify dev' or 'python -m http.server'.
// Opening index.html directly will cause 'fetch' errors.

document.addEventListener('DOMContentLoaded', function () {
    if (!window.map || typeof L === 'undefined') {
        console.error('Map or Leaflet not found. App logic will not run.');
        return;
    }

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
        canvas: document.getElementById('cam-canvas')
    };

    // Hard fail if core UI is missing
    if (!ui.btnAddPin || !ui.btnCamera || !ui.btnMeasure ||
        !ui.btnCamShot || !ui.btnCamOff || !ui.camWrap ||
        !ui.video || !ui.canvas) {
        console.error('One or more required UI elements are missing. Aborting app.js init.');
        return;
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
        const description = props.description || '';

        L.marker([lat, lng], { icon: pinIcon })
            .addTo(window.pinsLayer)
            .bindPopup(
                `**${title}**\n\n${description}`
            );
    }

    async function savePin(lng, lat, title, description) {
        const f = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: { title, description }
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
        const description = props.description || '';
        const imageUrl = props.imageUrl || '';

        const marker = L.marker([lat, lng], { icon: photoIcon }).addTo(window.photosLayer);

        let popupHtml = `<strong>${title}</strong>`;
        if (description) popupHtml += `<br>${description}`;
        if (imageUrl) {
            popupHtml += `<br><img src="${imageUrl}" style="max-width:200px;max-height:200px;cursor:pointer;" onclick="openPhotoModal('${imageUrl}')">`;
        }

        marker.bindPopup(popupHtml);
    }

    async function savePhoto(lng, lat, title, description, file) {
        const form = new FormData();
        form.append('file', file);
        form.append('title', title);
        form.append('description', description);
        form.append('lng', lng);
        form.append('lat', lat);

        const r = await fetch(BACKEND.photoUpload, {
            method: 'POST',
            body: form
        });
        if (!r.ok) throw new Error(`Failed to upload photo. HTTP ${r.status}`);
        const saved = await r.json();
        addPhotoFeature(saved);
    }

    // --- CAMERA HANDLING ---
    async function startCamera() {
        try {
            state.cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            ui.video.srcObject = state.cam.stream;
            ui.camWrap.classList.add('show');
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

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (!blob) {
            alert('Could not capture photo.');
            return;
        }

        const title = prompt('Photo title?', 'Photo') || 'Photo';
        const description = prompt('Description? (optional)', '') || '';

        try {
            await savePhoto(
                state.photoLatLng.lng,
                state.photoLatLng.lat,
                title,
                description,
                blob
            );
            alert('Photo saved.');
            stopCamera();
            state.dropPhotoArmed = false;
            state.photoLatLng = null;
        } catch (e) {
            console.error('Photo save error', e);
            alert('Could not save photo.');
        }
    });

    // --- MAP CLICK HANDLING FOR PINS & PHOTOS ---
    map.on('click', async function (e) {
        const latlng = e.latlng;
        if (state.dropPinArmed) {
            const title = prompt('Pin title?', 'Pin') || 'Pin';
            const description = prompt('Description? (optional)', '') || '';
            try {
                await savePin(latlng.lng, latlng.lat, title, description);
            } catch (err) {
                console.error('Pin save error', err);
                alert('Could not save pin.');
            }
            state.dropPinArmed = false;
            ui.btnAddPin.classList.remove('active');
        } else if (state.dropPhotoArmed) {
            // Store where the next photo belongs
            state.photoLatLng = { lat: latlng.lat, lng: latlng.lng };
            alert('Location set. Now take a photo.');
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
            ui.btnCamera.classList.add('active');
            ui.btnAddPin.classList.remove('active');
            await startCamera();
            alert('Click on the map to choose the photo location, then tap "Take Photo".');
        } else {
            ui.btnCamera.classList.remove('active');
            state.photoLatLng = null;
            stopCamera();
        }
    });

    // Measure button is handled by leaflet-measure; keep as a placeholder for future hooks if needed.
    ui.btnMeasure.addEventListener('click', function () {
        // No-op here; simple measure control is already on the map.
    });

    // --- INITIAL DATA LOAD ---
    loadData(BACKEND.pinsGet, addPinFeature);
    loadData(BACKEND.photosGet, addPhotoFeature);
});
