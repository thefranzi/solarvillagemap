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
  if (!ui.btnAddPin || !ui.btnCamera || !ui.btnMeasure || !ui.btnCamShot || !ui.btnCamOff || !ui.camWrap || !ui.video || !ui.canvas) {
    console.error('One or more required UI elements are missing. Aborting app.js init.');
    return;
  }

  const pinIcon = L.icon({
    iconUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
           <path d="M20 2c-6.1 0-11 4.9-11 11 0 8.3 11 23 11 23s11-14.7 11-23c0-6.1-4.9-11-11-11z" fill="#ff8c00"/>
           <circle cx="20" cy="13" r="5.5" fill="#fff"/>
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
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
           <path d="M6 12a4 4 0 0 1 4-4h5l2-2h6l2 2h5a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V12z" fill="#7e57c2"/>
           <circle cx="20" cy="22" r="6.5" fill="#fff"/>
           <circle cx="20" cy="22" r="3.5" fill="#7e57c2"/>
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
      .bindPopup(`<b>${title}</b><br>${description}`);
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

    const h = `
      <div style="max-width:220px">
        <b>${title}</b>
        ${description ? `<br>${description}` : ''}
        ${
          imageUrl
            ? `<div style="margin-top:6px">
                 <img src="${imageUrl}" alt="Photo thumbnail"
                      style="width:100px;max-height:80px;border-radius:4px;object-fit:cover;cursor:pointer"
                      onclick="window.openPhotoModal && window.openPhotoModal('${imageUrl}')">
               </div>`
            : ''
        }
      </div>
    `;

    L.marker([lat, lng], { icon: photoIcon })
      .addTo(window.photosLayer)
      .bindPopup(h);
  }

  async function uploadPhoto(lng, lat, title, description) {
    const dataUrl = ui.canvas.toDataURL('image/jpeg', 0.9);
    const body = { dataUrl, lat, lng, title: title || '', description: description || '' };

    const r = await fetch(BACKEND.photoUpload, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      // Try to log body for debugging, but swallow JSON errors
      try {
        const text = await r.text();
        console.error('Photo upload failed:', r.status, text);
      } catch (e) {
        console.error('Photo upload failed and body could not be read:', r.status);
      }
      throw new Error(`Photo upload failed. HTTP ${r.status}`);
    }

    return r.json();
  }

  // --- CAMERA & PIN/PHOTO DROP ---
  async function camOn() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera is not supported in this browser.');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      state.cam.stream = s;
      ui.video.srcObject = s;
      await ui.video.play();
      ui.camWrap.classList.add('show');
    } catch (e) {
      console.error('getUserMedia error', e);
      alert('Camera error: ' + e.message);
    }
  }

  let dropPinCaptureHandler = null;
  let dropPhotoCaptureHandler = null;

  function resetCursor() {
    map.getContainer().style.cursor = '';
  }

  function disarmPinDrop() {
    if (state.dropPinArmed && dropPinCaptureHandler) {
      map.getContainer().removeEventListener('click', dropPinCaptureHandler, true);
      dropPinCaptureHandler = null;
    }
    state.dropPinArmed = false;
    resetCursor();
  }

  function disarmPhotoDrop() {
    if (state.dropPhotoArmed && dropPhotoCaptureHandler) {
      map.getContainer().removeEventListener('click', dropPhotoCaptureHandler, true);
      dropPhotoCaptureHandler = null;
    }
    state.dropPhotoArmed = false;
    resetCursor();
  }

  ui.btnAddPin.onclick = () => {
    if (state.dropPinArmed) {
      disarmPinDrop();
      return;
    }
    disarmPhotoDrop();
    state.dropPinArmed = true;
    map.getContainer().style.cursor = 'crosshair';

    map.getContainer().addEventListener(
      'click',
      (dropPinCaptureHandler = async ev => {
        if (!state.dropPinArmed) return;

        const els = [
          document.getElementById('actionbar'),
          document.querySelector('.leaflet-control-container')
        ];
        if (els.some(el => el && el.contains(ev.target))) return;

        ev.stopPropagation();
        ev.preventDefault();

        const latlng = map.containerPointToLatLng([ev.clientX, ev.clientY]);
        disarmPinDrop();

        const title = prompt('Pin title:', 'Pin') || 'Pin';
        const description = prompt('Pin description (optional):', '') || '';

        try {
          await savePin(latlng.lng, latlng.lat, title, description);
        } catch (e) {
          console.error('Failed to save pin:', e);
          alert('Error: Could not save pin.');
        }
      }),
      { capture: true, once: true }
    );
  };

  // Photo: click to choose location, then open camera
  ui.btnCamera.onclick = () => {
    disarmPinDrop();
    disarmPhotoDrop();
    state.photoLatLng = null;

    state.dropPhotoArmed = true;
    map.getContainer().style.cursor = 'crosshair';

    map.getContainer().addEventListener(
      'click',
      (dropPhotoCaptureHandler = async ev => {
        if (!state.dropPhotoArmed) return;

        const els = [
          document.getElementById('actionbar'),
          document.querySelector('.leaflet-control-container')
        ];
        if (els.some(el => el && el.contains(ev.target))) return;

        ev.stopPropagation();
        ev.preventDefault();

        const latlng = map.containerPointToLatLng([ev.clientX, ev.clientY]);
        disarmPhotoDrop();

        state.photoLatLng = latlng;
        camOn();
      }),
      { capture: true, once: true }
    );
  };

  ui.btnCamOff.onclick = () => {
    if (state.cam.stream) {
      state.cam.stream.getTracks().forEach(t => t.stop());
    }
    state.cam.stream = null;
    ui.video.srcObject = null;
    ui.camWrap.classList.remove('show');
    state.photoLatLng = null;
  };

  ui.btnCamShot.onclick = async () => {
    if (!state.cam.stream) return;

    const w = ui.video.videoWidth;
    const h = ui.video.videoHeight;
    if (!w || !h) {
      console.warn('Video dimensions not ready; ignoring shot.');
      return;
    }

    ui.canvas.width = w;
    ui.canvas.height = h;
    const ctx = ui.canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas 2D context unavailable.');
      return;
    }
    ctx.drawImage(ui.video, 0, 0, w, h);

    const { lat, lng } = state.photoLatLng || map.getCenter();

    const title = prompt('Photo title (optional):', '') || 'Photo';
    const description = prompt('Photo description (optional):', '') || '';

    try {
      const resp = await uploadPhoto(lng, lat, title, description);
      const feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          title,
          description,
          imageUrl: resp.imageUrl,
          ts: Date.now()
        }
      };
      addPhotoFeature(feature);
    } catch (e) {
      console.error('Failed to upload photo:', e);
      alert('Error: Could not upload photo.');
    } finally {
      ui.btnCamOff.onclick();
    }
  };

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
        try {
          map.removeLayer(stateM.line);
        } catch (e) {
          console.warn('Error removing measure line', e);
        }
      }
      stateM.on = false;
      stateM.pts = [];
      stateM.line = null;
    }

    return function () {
      disarmPinDrop();
      disarmPhotoDrop();
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

  ui.btnMeasure.onclick = measureTool;

  // Initial data load
  loadData(BACKEND.pinsGet, addPinFeature);
  loadData(BACKEND.photosGet, addPhotoFeature);
});
