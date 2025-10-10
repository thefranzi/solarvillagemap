(function() {
    function onReady(fn) {
        if (document.readyState !== "loading") fn();
        else document.addEventListener("DOMContentLoaded", fn);
    }

    function findMap() {
        try {
            if (window.map && typeof map.setView === "function") return window.map;
        } catch (e) {}
        return null;
    }

    function ensureLayersTopRight(map) {
        try {
            var layers = document.querySelector(".leaflet-control-layers");
            var tr = document.querySelector(".leaflet-top.leaflet-right");
            if (layers && tr && layers.parentElement !== tr) {
                tr.appendChild(layers);
            }
            if (layers) layers.style.display = "block";
        } catch (e) {}
    }

    function bar() {
        var el = document.getElementById("bottom-toolbar-fixed");
        if (!el) {
            el = document.createElement("div");
            el.id = "bottom-toolbar-fixed";
            document.body.appendChild(el);
        }

        function mk(id, label, handler) {
            var b = document.getElementById(id);
            if (!b) {
                b = document.createElement("button");
                b.id = id;
                b.className = "sv-btn";
                b.textContent = label;
                el.appendChild(b);
            }
            b.onclick = handler;
            return b;
        }
        return { el: el, mk: mk };
    }

    function addPinsPhotosTogglesIntoLayers(map, pinsGroup, photosGroup) {
        function tryPanel() {
            var panel = document.querySelector(".leaflet-control-layers-overlays") || document.querySelector(".leaflet-control-layers-list");
            if (!panel) { return setTimeout(tryPanel, 300); }
            
            function addToggle(label, group) {
                var id = "sv-chk-" + label.toLowerCase();
                if (document.getElementById(id)) return;
                var lab = document.createElement("label");
                lab.style.display = "flex";
                lab.style.alignItems = "center";
                lab.innerHTML = "<input type='checkbox' id='" + id + "' checked style='margin-right: 8px;'> " + label;
                panel.appendChild(lab);
                var cb = lab.querySelector("input");
                if (cb) {
                    cb.checked = true;
                    if (!map.hasLayer(group)) map.addLayer(group);
                    cb.addEventListener("change", function() {
                        if (this.checked) { map.addLayer(group); } 
                        else { map.removeLayer(group); }
                    });
                }
            }
            addToggle("Photos", photosGroup);
            addToggle("Pins", pinsGroup);

            var labels = panel.getElementsByTagName("label");
            for (var i = 0; i < labels.length; i++) {
                var t = (labels[i].textContent || "").toUpperCase();
                var cb = labels[i].querySelector("input[type=checkbox]");
                if (!cb) continue;
                var shouldOn = (t.indexOf("CONT") === -1);
                if (shouldOn && !cb.checked) cb.click();
                if (!shouldOn && cb.checked) cb.click();
            }
        }
        tryPanel();
    }

    function ensurePhotoUI() {
        if (document.getElementById("photo-capture")) return;
        var w = document.createElement("div");
        w.id = "photo-capture";
        w.innerHTML = "<form id='photoForm'><label for='photoInput' class='sv-btn' style='display:inline-block;cursor:pointer;'>Take Photo  <input id='photoInput' type='file' accept='image/*' capture='environment' style='display:none;'></label> <button id='photoUpload' type='button' class='sv-btn' style='display:none'>Upload</button> <button id='photoCancel' type='button' class='sv-btn'>Cancel</button><div id='photoPreview' style='margin-top:10px'></div><small style='display:block;margin-top:6px;font-size:12px'>Take → preview → Upload</small></form>";
        document.body.appendChild(w);
        var input = document.getElementById("photoInput"), preview = document.getElementById("photoPreview"), upload = document.getElementById("photoUpload"), cancel = document.getElementById("photoCancel");
        window.openPhotoUI = function() { w.style.display = "block"; };
        window.closePhotoUI = function() { w.style.display = "none"; preview.innerHTML = ""; upload.style.display = "none"; if (input) input.value = ""; };
        if(input) input.addEventListener("change", function(ev) {
            var file = ev && ev.target && ev.target.files && ev.target.files[0]; if (!file) return;
            preview.textContent = "Preparing preview...";
            var rdr = new FileReader();
            rdr.onload = function() {
                var img = new Image();
                img.onload = function() {
                    var max = 1600, w0 = img.width, h0 = img.height, w1 = w0, h1 = h0;
                    if (Math.max(w0, h0) > max) { if (w0 > h0) { h1 = Math.round(h0 * (max / w0)); w1 = max; } else { w1 = Math.round(w0 * (max / h0)); h1 = max; } }
                    var c = document.createElement("canvas"); c.width = w1; c.height = h1; c.getContext("2d").drawImage(img, 0, 0, w1, h1);
                    var dataUrl = c.toDataURL("image/jpeg", 0.78);
                    preview.innerHTML = "<img alt='preview' style='max-width:100%;height:auto;border-radius:8px'>";
                    preview.firstChild.src = dataUrl;
                    upload.style.display = "inline-block";
                    upload.onclick = function() { /* Upload logic needs to be connected to Netlify functions */ };
                };
                img.src = rdr.result;
            };
            rdr.readAsDataURL(file);
        });
        if(cancel) cancel.onclick = function() { window.closePhotoUI(); };
    }

    function measureTool(map, UI) {
        var chip = document.querySelector(".sv-chip");
        if (!chip) { chip = document.createElement("div"); chip.className = "sv-chip"; chip.style.display = "none"; document.body.appendChild(chip); }
        function show(t) { chip.textContent = t; chip.style.display = "block"; }
        function hide() { chip.style.display = "none"; }
        var state = { on: false, pts: [], line: null };
        function fmt(m) { return m < 1000 ? (m.toFixed(0) + " m") : ((m / 1000).toFixed(2) + " km"); }
        function total() { var d = 0, i; for (i = 1; i < state.pts.length; i++) { d += state.pts[i - 1].distanceTo(state.pts[i]); } return d; }
        function clickAdd(ev) {
            state.pts.push(ev.latlng);
            if (!state.line) { state.line = L.polyline(state.pts, { color: "#222", weight: 3, dashArray: "6,4" }).addTo(map); } else { state.line.setLatLngs(state.pts); }
            show("Distance: " + fmt(total()) + "  (double-tap to finish)");
        }
        function dblFinish() { hide(); map.off("click", clickAdd); map.off("dblclick", dblFinish); state.on = false; }
        UI.mk("btn-measure", "Measure", function() {
            if (!state.on) {
                state.on = true; state.pts = [];
                if (state.line) { try { map.removeLayer(state.line); } catch (e) {} state.line = null; }
                show("Distance: 0 m  (double-tap to finish)");
                map.on("click", clickAdd);
                map.on("dblclick", dblFinish);
            } else { dblFinish(); }
        });
    }

    // MAIN
    onReady(function() {
        var tries = 0;
        (function boot() {
            var map = findMap();
            if (!map) { if (++tries < 40) { return setTimeout(boot, 250); } else { console.warn("Leaflet map not detected."); return; } }
            
            ensureLayersTopRight(map);
            var UI = bar();

            // --- ALL BUTTONS CREATED HERE ---

            // 1. Site Button (FIXED)
            UI.mk("btn-goto-site", "Site", function() {
                if (typeof bounds_group !== 'undefined' && bounds_group.getBounds().isValid()) {
                    map.fitBounds(bounds_group.getBounds());
                } else if (typeof INITIAL_BOUNDS !== 'undefined') {
                    map.fitBounds(INITIAL_BOUNDS); // Fallback to initial view
                }
            });

            // 2. Measure Button
            measureTool(map, UI);

            // 3. Pin Button
            UI.mk("btn-drop-pin", "Pin", function() {
                alert("Tap the map to place a pin…");
                map.once("click", function(ev) {
                    var ll = ev.latlng;
                    var name = window.prompt("Pin title?");
                    if (name === null) return;
                    var desc = window.prompt("Description? (optional)") || "";
                    var feat = { type: "Feature", geometry: { type: "Point", coordinates: [ll.lng, ll.lat] }, properties: { name: name, desc: desc, when: (new Date()).getTime() } };
                    fetch("/.netlify/functions/repo-commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ feature: feat, geoTarget: "pins" }) })
                        .then(r => r.json())
                        .then(() => { if(window.SV && SV.reloadPins) SV.reloadPins(); alert("Pin saved."); })
                        .catch(() => { L.marker(ll).bindPopup("<b>" + name + "</b><br>" + desc).addTo(SV.pins); alert("No commit function; pin shown locally only."); });
                });
            });

            // 4. Locate Button
            UI.mk("btn-locate-once", "Locate", function() {
                if (!("geolocation" in navigator)) return alert("Geolocation unsupported");
                navigator.geolocation.getCurrentPosition(function(pos) {
                    var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
                    map.setView(ll, 16);
                    try {
                        var mk = L.marker(ll);
                        var acc = pos.coords.accuracy || 0;
                        var circ = acc ? L.circle(ll, { radius: acc }) : null;
                        var g = L.layerGroup(circ ? [mk, circ] : [mk]).addTo(map);
                        setTimeout(function() { try { map.removeLayer(g); } catch (e) {} }, 5000);
                    } catch (e) {}
                }, function() { alert("Locate failed"); }, { timeout: 8000, maximumAge: 300000 });
            });

            // 5. Photo Button
            ensurePhotoUI();
            UI.mk("btn-camera-on", "Photo", function() { if(window.openPhotoUI) window.openPhotoUI(); });
            
            // Define layer groups
            window.SV = window.SV || {};
            SV.pins = SV.pins || L.layerGroup().addTo(map);
            SV.photos = SV.photos || L.layerGroup().addTo(map);

            // Add toggles for Pins/Photos INSIDE the Layers panel (FIXED)
            addPinsPhotosTogglesIntoLayers(map, SV.pins, SV.photos);

            // --- DATA LOADING ---
            function rawBase() { return "https://raw.githubusercontent.com/thefranzi/solarvillagemap/mobile-one-shot-locate"; }
            function loadGeo(url, group, kind) {
                return fetch(url + "?t=" + Date.now()).then(r => r.ok ? r.json() : Promise.reject("HTTP " + r.status)).then(json => {
                    if(group.clearLayers) group.clearLayers();
                    var feats = (json && json.features) || [];
                    feats.forEach(f => {
                        if (!f || !f.geometry || f.geometry.type !== "Point") return;
                        var c = f.geometry.coordinates; var ll = L.latLng(c[1], c[0]);
                        if (kind === "photos") {
                            var u = f.properties && f.properties.url;
                            var html = u ? "<img src='" + u + "' style='max-width:240px;height:auto;border-radius:6px'>" : "Photo";
                            L.marker(ll).bindPopup(html).addTo(group);
                        } else {
                            var nm = (f.properties && f.properties.name) || "Pin";
                            var ds = (f.properties && f.properties.desc) || "";
                            L.marker(ll).bindPopup("<b>" + nm + "</b><br>" + ds).addTo(group);
                        }
                    });
                }).catch(function() {});
            }
            window.SV.reloadPins = function() { return loadGeo(rawBase() + "/data/pins.geojson", SV.pins, "pins"); };
            window.SV.reloadPhotos = function() { return loadGeo(rawBase() + "/data/photos.geojson", SV.photos, "photos"); };
            SV.reloadPins();
            SV.reloadPhotos();
        })();
    });
})();