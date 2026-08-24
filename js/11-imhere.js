/**
 * 11-imhere.js - Real GPS Module with Multi-Format Support (Native iOS Bridge)
 */
console.log("✅ 11-imhere.js loaded!");

let imHereMarker = null;
let isGpsActive = false;
let latestNativeGPS = null;

// Standard UTM CRS Definitions
if (typeof proj4 !== 'undefined') {
    for (let i = 1; i <= 60; i++) {
        const epsg = 32600 + i;
        proj4.defs(`EPSG:${epsg}`, `+proj=utm +zone=${i} +datum=WGS84 +units=m +no_defs`);
    }
    for (let i = 1; i <= 60; i++) {
        const epsg = 32700 + i;
        proj4.defs(`EPSG:${epsg}`, `+proj=utm +zone=${i} +south +datum=WGS84 +units=m +no_defs`);
    }
    console.log("✅ All UTM zones loaded");
}

// ==========================================
// RECEIVE NATIVE GPS FROM SWIFT
// ==========================================
window.handleNativeLocation = function(lat, lon, alt) {
    latestNativeGPS = {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        alt: alt !== undefined && alt !== null ? parseFloat(alt) : 0
    };

    const btn = document.getElementById('btn-gps-toggle');

    // Se il tracciamento GPS è attivo, aggiorna la posizione del marker
    if (isGpsActive) {
        if (btn && btn.textContent.includes("Waiting")) {
            btn.classList.add('pressed');
            btn.textContent = "📍 GPS Active (Location)";
        }
        updateImHerePosition(latestNativeGPS.lat, latestNativeGPS.lon, latestNativeGPS.alt);
    }
};

/**
 * Calcola lo shift da applicare alle coordinate GPS
 * Gestisce i diversi formati (3TZ, OBJ, GLB, PLY)
 */
function calculateShift() {
    const threeCenter = window.threeCenter;
    const modelUpAxisIsY = window.modelUpAxisIsY;
    const active3dTiles = window.active3dTiles;
    
    let shiftX = 0, shiftY = 0, shiftZ = 0;
    
    if (!threeCenter) {
        console.warn("⚠️ threeCenter not available");
        return { x: 0, y: 0, z: 0 };
    }
    
    if (active3dTiles) {
        console.log("📦 Format: 3D TILES");
        shiftX = threeCenter.x || 0;
        shiftY = -threeCenter.z || 0;
        shiftZ = threeCenter.y || 0;
    }
    else if (modelUpAxisIsY) {
        console.log("📦 Format: OBJ/GLB/PLY con Y-up");
        shiftX = threeCenter.x || 0;
        shiftY = -threeCenter.z || 0;
        shiftZ = threeCenter.y || 0;
    }
    else {
        console.log("📦 Format: OBJ/GLB/PLY con Z-up (standard)");
        shiftX = threeCenter.x || 0;
        shiftY = threeCenter.y || 0;
        shiftZ = threeCenter.z || 0;
    }
    
    console.log("✅ Calculated shift:", {shiftX, shiftY, shiftZ});
    return {x: shiftX, y: shiftY, z: shiftZ};
}

// ==========================================
// TOGGLE GPS MARKER
// ==========================================
function toggleGPS() {
    const btn = document.getElementById('btn-gps-toggle');
    const scene = window.scene;
    const camera = window.camera;
    const renderer = window.renderer;

    if (!scene || !camera || !renderer) {
        alert("Load a model first (menu ☰)");
        return;
    }

    // DISATTIVAZIONE
    if (isGpsActive) {
        isGpsActive = false;
        if (imHereMarker) {
            scene.remove(imHereMarker);
            imHereMarker = null;
        }
        if (btn) {
            btn.classList.remove('pressed');
            btn.textContent = "📍 GPS Inactive (Location)";
        }
        return;
    }

    // ATTIVAZIONE
    isGpsActive = true;

    if (latestNativeGPS) {
        if (btn) {
            btn.classList.add('pressed');
            btn.textContent = "📍 GPS Active (Location)";
        }
        updateImHerePosition(latestNativeGPS.lat, latestNativeGPS.lon, latestNativeGPS.alt);
    } else {
        if (btn) btn.textContent = "⌛ Waiting for GPS signal...";
    }
}

// ==========================================
// CENTER CAMERA ON LOCATION
// ==========================================
function centerOnLocation() {
    const btn = document.getElementById('btn-goto-location');

    if (!latestNativeGPS) {
        alert("⚠️ GPS signal not available yet.");
        return;
    }

    if (btn) btn.textContent = "⌛ Centering...";
    centerCameraOnPosition(latestNativeGPS.lat, latestNativeGPS.lon, latestNativeGPS.alt);
    if (btn) btn.textContent = "🎯 Go to Location";
}

// ==========================================
// CENTER CAMERA IMPLEMENTATION
// ==========================================
function centerCameraOnPosition(lat, lon, alt) {
    const camera = window.camera;
    const controls = window.controls;
    const threeCenter = window.threeCenter;

    if (!camera || !controls) {
        alert("Camera not ready. Load a model first!");
        return;
    }

    if (typeof proj4 === 'undefined') {
        alert("Proj4JS library not found.");
        return;
    }

    const crsInput = document.getElementById('input-crs');
    let targetCRS = (crsInput && crsInput.value.trim()) ? crsInput.value.trim() : "EPSG:32633";

    if (!targetCRS.toUpperCase().startsWith("EPSG:") && !targetCRS.startsWith("+proj")) {
        targetCRS = "EPSG:" + targetCRS;
    }

    try {
        const utmCoords = proj4("EPSG:4326", targetCRS, [lon, lat]);
        const realX = utmCoords[0];
        const realY = utmCoords[1];
        const realZ = alt;

        const pyX = (typeof pythonOffset !== 'undefined' && pythonOffset.x) ? pythonOffset.x : 0;
        const pyY = (typeof pythonOffset !== 'undefined' && pythonOffset.y) ? pythonOffset.y : 0;
        const pyZ = (typeof pythonOffset !== 'undefined' && pythonOffset.z) ? pythonOffset.z : 0;

        const tcX = threeCenter ? threeCenter.x : 0;
        const tcY = threeCenter ? threeCenter.y : 0;
        const tcZ = threeCenter ? threeCenter.z : 0;

        const localX = realX - tcX - pyX;
        const localY = realZ - tcY - pyZ;
        const localZ = -realY - tcZ + pyY;

        const targetPos = new THREE.Vector3(localX, localY, localZ);

        controls.target.copy(targetPos);
        camera.position.set(targetPos.x, targetPos.y + 30, targetPos.z + 40);
        controls.update();

        if (window.active3dTiles) {
            camera.updateMatrixWorld(true);
            window.active3dTiles.update();
        }

    } catch (err) {
        console.error("GPS position calculation error:", err);
        alert(`Error converting coordinates: ` + err.message);
    }
}

// ==========================================
// UPDATE MARKER POSITION
// ==========================================
function updateImHerePosition(lat, lon, alt) {
    const scene = window.scene;
    const threeCenter = window.threeCenter;
    
    if (typeof proj4 === 'undefined') {
        alert("Proj4JS library not found.");
        return;
    }

    const crsInput = document.getElementById('input-crs');
    let targetCRS = (crsInput && crsInput.value.trim()) ? crsInput.value.trim() : "EPSG:32633";

    if (!targetCRS.toUpperCase().startsWith("EPSG:") && !targetCRS.startsWith("+proj")) {
        targetCRS = "EPSG:" + targetCRS;
    }

    try {
        const utmCoords = proj4("EPSG:4326", targetCRS, [lon, lat]);
        const realX = utmCoords[0];
        const realY = utmCoords[1];
        const realZ = alt;

        const pyX = (typeof pythonOffset !== 'undefined' && pythonOffset.x) ? pythonOffset.x : 0;
        const pyY = (typeof pythonOffset !== 'undefined' && pythonOffset.y) ? pythonOffset.y : 0;
        const pyZ = (typeof pythonOffset !== 'undefined' && pythonOffset.z) ? pythonOffset.z : 0;

        const tcX = threeCenter ? threeCenter.x : 0;
        const tcY = threeCenter ? threeCenter.y : 0;
        const tcZ = threeCenter ? threeCenter.z : 0;

        const localX = realX - tcX - pyX;
        const localY = realZ - tcY - pyZ;
        const localZ = -realY - tcZ + pyY;

        const targetPos = new THREE.Vector3(localX, localY, localZ);

        renderHighVisMarker(targetPos);

    } catch (err) {
        console.error("GPS position calculation error:", err);
        alert(`Error converting coordinates: ` + err.message);
    }
}

// ==========================================
// RENDER MARKER
// ==========================================
function renderHighVisMarker(position) {
    const scene = window.scene;
    const renderer = window.renderer;
    
    if (imHereMarker) {
        scene.remove(imHereMarker);
        imHereMarker = null;
    }

    imHereMarker = new THREE.Group();

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.arc(64, 64, 50, 0, Math.PI * 2);
    ctx.fillStyle = '#00ffff';
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#ff0055';
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);

    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: false
    });

    const sprite = new THREE.Sprite(spriteMat);

    const pixelSize = 24;
    const canvasHeight = (renderer && renderer.domElement) ? renderer.domElement.clientHeight : window.innerHeight;
    const scale = pixelSize / canvasHeight;

    sprite.scale.set(scale, scale, 1.0);
    sprite.renderOrder = 999999;

    imHereMarker.add(sprite);
    imHereMarker.position.copy(position);
    scene.add(imHereMarker);

    if (typeof render === 'function') {
        render();
    }
}

window.toggleGPS = toggleGPS;
window.centerOnLocation = centerOnLocation;

console.log("✅ GPS Module loaded with native Swift bridge");
