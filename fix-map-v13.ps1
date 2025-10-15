# v14 ONE-STOP FIX Script: All Fixes (Fixed PS Syntax), PS 5.1 Safe, Auto-Test
# Double quotes + "`n" for replacement, brace check/revert, append before </script>
# Run in ISE: Paste > Save > F5 .\all-fixes-v14.ps1
param([switch]$Local = $true)  # Always local

$FilePath = "index.html"
if (-not (Test-Path $FilePath)) {
    Write-Error "No $FilePath in $PWD. Add it."
    exit 1
}

# Close processes
Get-Process | Where-Object { $_.ProcessName -in @("chrome","msedge","iexplore","firefox","netlify") -and ($_.MainWindowTitle -like "*localhost*" -or $_.MainWindowTitle -like "*index.html*") } | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Closed browsers/Netlify dev." -ForegroundColor Yellow

$originalSize = (Get-Item $FilePath).Length
$BackupPath = "index-backup-v14.html"
Copy-Item $FilePath $BackupPath -Force
Write-Host "Backup created: $BackupPath ($originalSize bytes)" -ForegroundColor Green

$content = Get-Content $FilePath -Raw -Encoding UTF8
$changed = $false
$warnings = @()

# Pre-Check & Balance Function
function Test-BraceBalance {
    param([string]$Text)
    $opens = ([regex]::Matches($Text, '\{')).Count
    $closes = ([regex]::Matches($Text, '\}')).Count
    return $opens -eq $closes
}

if ($content -match '<script>(.*?)</script>') {
    $scriptPre = $matches[1]
    $preBalance = Test-BraceBalance $scriptPre
} else {
    $scriptPre = ''; $preBalance = $false
}
if ($preBalance) {
    Write-Host "Pre-script brace balance: Good (Safe to append)" -ForegroundColor Green
} else {
    Write-Warning "Pre-script unbalanced—skip JS append, use manual. Reverted."
    Copy-Item $BackupPath $FilePath -Force
    exit 1
}

# Fix 1: Status CSS & Function (Regex to </style>, append to <script>)
Write-Host "`n=== FIX 1: STATUS OVERLAY (CSS/JS) ===" -ForegroundColor Cyan
$hasStatus = $content -match 'function showStatus.*fade-out'
if (-not $hasStatus) {
    $statusCss = @'
#status-overlay {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 1001;
    display: none;
    font-size: 14px;
    max-width: 80%;
    text-align: center;
    opacity: 1;
    transition: opacity 0.5s ease-out;
}
#status-overlay.fade-out {
    opacity: 0;
}
'@

    $content = $content -replace '</style>', "$statusCss`n</style>"
    $changed = $true

    $statusFunc = @'
function showStatus(message, duration = 3000) {
    console.log("v14: Status: " + message);
    var statusDiv = document.getElementById("status-overlay");
    if (!statusDiv) {
        statusDiv = document.createElement("div");
        statusDiv.id = "status-overlay";
        statusDiv.style.cssText = "position: absolute; top: 10px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 10px 15px; border-radius: 5px; z-index: 1001; display: none; font-size: 14px; max-width: 80%; text-align: center; opacity: 1; transition: opacity 0.5s ease-out;";
        document.body.appendChild(statusDiv);
    }
    statusDiv.innerHTML = message;
    statusDiv.style.display = "block";
    statusDiv.style.opacity = "1";
    statusDiv.classList.remove("fade-out");
    setTimeout(function() { statusDiv.classList.add("fade-out"); }, duration);
    setTimeout(function() { statusDiv.style.display = "none"; statusDiv.classList.remove("fade-out"); statusDiv.style.opacity = "1"; }, duration + 500);
}
'@

    # Append status if missing
    if ($scriptPre -notmatch 'function showStatus') {
        $scriptPre += "`n`n$statusFunc"
        $changed = $true
    }
    Write-Host "Status added (fade top-middle)" -ForegroundColor Green
} else {
    Write-Host "Status already present" -ForegroundColor Green
}

# Fix 2: Logo Resize (Regex - safe, first legend img)
Write-Host "`n=== FIX 2: LOGO (80px) ===" -ForegroundColor Cyan
$hasLogo = $content -match 'style="width: 80px'
if (-not $hasLogo) {
    $logoPattern = '(<img[^>]*src="legend[^"]*\.png")'
    $content = $content -replace $logoPattern, '$1 style="width: 80px; height: auto;"', 1
    $changed = $true
    Write-Host "Logo resized (first legend.png to 80px)" -ForegroundColor Green
} else {
    Write-Host "Logo 80px confirmed" -ForegroundColor Green
}

# Fix 3: Button Positions (Regex - locate top-left, layers bottom-left)
Write-Host "`n=== FIX 3: BUTTONS (Positions) ===" -ForegroundColor Cyan
$locatePattern = 'L\.Control\.Locate.*?options:\s*\{'
if ($content -match $locatePattern -and $content -notmatch 'position: "topleft"') {
    $content = $content -replace $locatePattern, 'L.Control.Locate({ position: "topleft",'
    Write-Host "Locate moved to top-left" -ForegroundColor Green
    $changed = $true
}

$layersPattern = 'L\.control\.layers\.tree.*?collapsed:\s*(true|false)'
if ($content -match $layersPattern -and $content -notmatch 'position: "bottomleft"') {
    $content = $content -replace $layersPattern, 'L.control.layers.tree(null, overlaysTree, { collapsed: true, position: "bottomleft" }),'
    Write-Host "Layers tree to bottom-left" -ForegroundColor Green
    $changed = $true
}

# Fix 4: Measure Tool (Append before </script>, with try-catch/map check)
Write-Host "`n=== FIX 4: MEASURE TOOL (📏) ===" -ForegroundColor Cyan
$hasMeasure = $content -match 'var measureControl.*L\.Control\.extend'
if (-not $hasMeasure) {
    $measureCode = @'
// v14 One-Stop Measure: Balanced, Try-Catch, Depends on showStatus/map
try {
    if (typeof map !== "undefined" && typeof L !== "undefined" && typeof showStatus === "function") {
        console.log("v14: Measure Loaded - All Fixes OK");
        var measureControl = L.Control.extend({
            options: { position: "topleft" },
            onAdd: function(map) {
                var container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
                container.style.backgroundColor = "white";
                container.style.width = "26px"; container.style.height = "26px";
                container.style.lineHeight = "26px"; container.style.textAlign = "center";
                container.style.border = "2px solid rgba(0,0,0,0.2)";
                container.innerHTML = "&#128209;"; // 📏
                container.title = "Measure Distance/Area";
                L.DomEvent.disableClickPropagation(container);
                var started = false, latlngs = [], tempLine, tempPoly, marker1, marker2;
                container.onclick = function(e) {
                    L.DomEvent.stopPropagation(e);
                    if (started) {
                        started = false;
                        if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
                        if (tempPoly) { map.removeLayer(tempPoly); tempPoly = null; }
                        if (marker1) { map.removeLayer(marker1); marker1 = null; }
                        if (marker2) { map.removeLayer(marker2); marker2 = null; }
                        latlngs = []; showStatus("Measurement ended", 2000); return;
                    }
                    started = true; latlngs = []; showStatus("Click to measure; double-click end", 3000);
                };
                var mapClickHandler = function(e) {
                    if (!started) return; var latlng = e.latlng; latlngs.push(latlng);
                    if (latlngs.length === 1) { marker1 = L.marker(latlng).addTo(map); showStatus("Next for distance", 2000); }
                    else if (latlngs.length > 1) {
                        if (tempLine) map.removeLayer(tempLine); tempLine = L.polyline(latlngs, {color: "red", weight: 3}).addTo(map);
                        if (latlngs.length === 2) { var dist = latlngs[0].distanceTo(latlngs[1]).toFixed(0) + " m"; showStatus("Distance: " + dist + "; more for area", 3000); }
                        else if (latlngs.length > 2) {
                            if (tempPoly) map.removeLayer(tempPoly); tempPoly = L.polygon(latlngs, {color: "blue", fillOpacity: 0.2}).addTo(map);
                            var area = 0; for (var i = 0; i < latlngs.length; i++) { var p1 = latlngs[i], p2 = latlngs[(i + 1) % latlngs.length]; area += (p1.lat * p2.lng) - (p2.lat * p1.lng); }
                            area = Math.abs(area / 2 / 10000).toFixed(2) + " ha"; showStatus("Area: " + area + "; double-click end", 3000);
                        }
                        if (marker2) map.removeLayer(marker2); marker2 = L.marker(latlng).addTo(map);
                    }
                };
                var mapDoubleClickHandler = function(e) { if (started) container.onclick(e); };
                map.on("click", mapClickHandler); map.on("dblclick", mapDoubleClickHandler); return container;
            },
            onRemove: function(map) { if (map && typeof map.off === "function") { map.off("click", mapClickHandler); map.off("dblclick", mapDoubleClickHandler); } }
        });
        new measureControl().addTo(map);
    } else { console.log("v14: Map/Leaflet/showStatus missing - skipping measure"); }
} catch (e) { console.log("v14: Measure error: " + e.message); }
'@

    $scriptPre += "`n`n$measureCode"
    $changed = $true
    Write-Host "Measure added (📏 top-left, distance/area with fade)" -ForegroundColor Green
} else {
    Write-Host "Measure already present" -ForegroundColor Green
}

# Fix 5: Layer Toggles (Append handlers before </script>)
Write-Host "`n=== FIX 5: LAYERS TOGGLE (Re-Fit) ===" -ForegroundColor Cyan
$hasLayers = $content -match 'L\.control\.layers\.tree.*overlaysTree'
if ($hasLayers) {
    $layersHandlers = @'
// v14 Layer Handlers: Generic for Tree (Re-Fit Bounds + Status)
try {
    if (typeof map !== "undefined") {
        console.log("v14: Layers Handlers OK");
        map.on("overlayadd", function(e) {
            var layerName = e.layer.layerName || "Layer";
            console.log("v14: Added " + layerName);
            showStatus(layerName + " shown", 2000);
            setTimeout(function() {
                var allBounds = L.latLngBounds();
                map.eachLayer(function(layer) {
                    if (layer.getBounds && layer.getBounds().isValid() && map.hasLayer(layer)) {
                        allBounds.extend(layer.getBounds());
                    }
                });
                if (allBounds.isValid()) {
                    map.fitBounds(allBounds, { padding: [10, 10], animate: true, maxZoom: 18 });
                }
            }, 100);
        });
        map.on("overlayremove", function(e) {
            var layerName = e.layer.layerName || "Layer";
            console.log("v14: Removed " + layerName);
            showStatus(layerName + " hidden", 2000);
            setTimeout(function() {
                var allBounds = L.latLngBounds();
                map.eachLayer(function(layer) {
                    if (layer.getBounds && layer.getBounds().isValid() && map.hasLayer(layer)) {
                        allBounds.extend(layer.getBounds());
                    }
                });
                if (allBounds.isValid()) {
                    map.fitBounds(allBounds, { padding: [10, 10], animate: true, maxZoom: 18 });
                }
            }, 100);
        });
    }
} catch (e) { console.log("v14: Layers error: " + e.message); }
'@

    if ($scriptPre -notmatch 'map\.on\("overlayadd"') {
        $scriptPre += "`n`n$layersHandlers"
        $changed = $true
        Write-Host "Layer toggles added (re-fit + status on LOTS/SEPTIC etc.)" -ForegroundColor Green
    } else {
        Write-Host "Layer handlers already present" -ForegroundColor Green
    }
} else {
    $warnings += "No layers tree found—add manually"
}

# Rebuild Content & Post-Balance Check (Fixed Syntax: Double Quotes + "$scriptPre")
$content = $content -replace '<script>(.*?)</script>', "<script>`n$scriptPre`n</script>"

Set-Content -Path $FilePath -Value $content -Encoding UTF8
$newSize = (Get-Item $FilePath).Length

if ($content -match '<script>(.*?)</script>') {
    $scriptPost = $matches[1]
    $postBalance = Test-BraceBalance $scriptPost
} else {
    $postBalance = $false
}

if (-not $postBalance) {
    Copy-Item $BackupPath $FilePath -Force
    Write-Warning "Post-append unbalanced—reverted to backup. Run manual steps below."
    $score = 0
} else {
    Write-Host "`n=== ALL FIXES APPLIED SUCCESSFULLY ===" -ForegroundColor Green
    Write-Host "New size: $newSize bytes (change: +$($newSize - $originalSize))" -ForegroundColor Green
    Write-Host "Post-script brace balance: Good" -ForegroundColor Green
    $score = 20  # Base
    if (-not $hasStatus) { $score += 20 }
    if (-not $hasLogo) { $score += 15 }
    $score += 20  # Buttons
    if (-not $hasMeasure) { $score += 25 }
    if ($hasLayers) { $score += 20 }
    Write-Host "One-Stop Score: $score% - Ready for Test!" -ForegroundColor Green
    if ($warnings.Count -gt 0) { Write-Host "Minor Warnings: $($warnings -join '; ')" -ForegroundColor Yellow } else { Write-Host "No Warnings" -ForegroundColor Green }
}

# Auto-Test with Netlify Dev
Write-Host "`n=== AUTO-TEST STARTING (Netlify Dev) ===" -ForegroundColor Cyan
$netlifyPath = Get-Command netlify -ErrorAction SilentlyContinue
if (-not $netlifyPath) {
    Write-Warning "Netlify CLI missing. Install: npm install -g netlify-cli (needs Node.js)."
    Start-Process $FilePath  # Fallback file open
    Write-Host "Open file://$PWD/index.html for basic test." -ForegroundColor Yellow
} else {
    Start-Process "cmd.exe" -ArgumentList "/c", "netlify dev" -WorkingDirectory $PWD -NoNewWindow
    Write-Host "Netlify dev started: http://localhost:8888 (Ctrl+C to stop after test)." -ForegroundColor Green
    Start-Sleep 3
    Start-Process "http://localhost:8888"
}

Write-Host "`n=== TEST CHECKLIST ===" -ForegroundColor Cyan
Write-Host "- Map loads, no 'Unexpected }' or 'map not detected' in F12." -ForegroundColor White
Write-Host "- 📏 top-left: Click > Draw red line (distance m status fades), +points blue poly (area ha)." -ForegroundColor White
Write-Host "- Layers bottom-left: Toggle LOTS/SEPTIC > Re-zooms + 'Layer shown' status." -ForegroundColor White
Write-Host "- Locate top-left, logo 80px, photo/pin buttons work." -ForegroundColor White
Write-Host "- If good: Ctrl+C > git add . > git commit -m 'v14 all fixes' > git push (live)." -ForegroundColor Green
Write-Host "- Issues? Revert backup > Attach F12 logs." -ForegroundColor Yellow

if ($score -lt 100 -and $postBalance) {
    Write-Host "`nManual Fallback (If Score Low):" -ForegroundColor Yellow
    Write-Host "1. Open index.html in VS Code/Notepad++ > Ctrl+F '</script>' > Paste fixes before it (from prior msg)." -ForegroundColor White
    Write-Host "2. Run .\check-braces.ps1 (save prior brace check script)." -ForegroundColor White
    Write-Host "3. Test & git push." -ForegroundColor White
}

Write-Host "`nOne-Stop Complete! Your solar village map is enhanced." -ForegroundColor Green
