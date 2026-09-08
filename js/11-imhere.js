/**
 * 11-imhere.js - Real GPS Module with Multi-Format Support, Line-of-Sight Tilting & Manual Altitude Slider
 */
console.log("✅ 11-imhere.js loaded!");

(function() {
    const originalHandler = window.handleNativeSensors;
    window.handleNativeSensors = function(...args) {
        // Il 7° parametro (indice 6) è isFaceDown inviato da Swift
        if (args.length >= 7) {
            window.isDeviceFaceDown = !!args[6];
        }
        // Esegue la funzione originale mantenendo intatto tutto il resto
        if (originalHandler) {
            originalHandler.apply(this, args);
        }
    };
})();

let imHereMarker = null;
let isGpsActive = false;
let isFollowModeActive = false;
let latestNativeGPS = null;

// Offset di elevazione manuale in metri (-100m a +100m)
window.gpsAltitudeOffset = 0;

// Target e Posizione correnti per l'interpolazione fluida (LERP)
const targetCamPos = new THREE.Vector3();
const targetLookAt = new THREE.Vector3();
let isAnimLoopRunning = false;

// Standard UTM CRS Definitions
if (typeof proj4 !== 'undefined') {
    for (let i = 1; i <= 60; i++) {
        const epsg = 32600 + i;
        proj4.defs(`EPSG:${epsg}`, `+proj=utm +zone=${i} +datum=WGS84 +units=m +no_defs`);
    }
    for (let i = 1; i <= 60; i++) {
        const epsg = 32700 + i;
        proj4.defs(`EPSG:${epsg}`, `+proj=utm +south +datum=WGS84 +units=m +no_defs`);
    }
}

// ==========================================
// RECEIVE NATIVE HEADING / SENSORS
// ==========================================
window.handleNativeHeading = function(heading) {
    if (window.liveSensorData) {
        window.liveSensorData.dipDir = parseFloat(heading);
    }
};

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

    if (isGpsActive) {
        if (btn && btn.textContent.includes("Waiting")) {
            btn.classList.add('pressed');
            btn.textContent = "📍 GNSS Active";
        }
        
        updateImHerePosition(latestNativeGPS.lat, latestNativeGPS.lon, latestNativeGPS.alt);
    }
};

/**
 * Aggiorna l'offset dell'altezza dallo slider manuale (-100m a +100m)
 */
window.updateGpsAltitudeOffset = function(val) {
    const parsed = parseFloat(val);
    window.gpsAltitudeOffset = isNaN(parsed) ? 0 : parsed;
    
    // Aggiorna la label testuale se presente
    const label = document.getElementById('alt-offset-val');
    if (label) {
        label.textContent = (window.gpsAltitudeOffset > 0 ? "+" : "") + window.gpsAltitudeOffset.toFixed(1) + "m";
    }

    // Aggiorna subito la posizione se il GPS è attivo
    if (isGpsActive && latestNativeGPS) {
        updateImHerePosition(latestNativeGPS.lat, latestNativeGPS.lon, latestNativeGPS.alt);
    }
};

/**
 * Opzione secondaria: Snap alla superficie del modello 3D
 */
window.snapToTerrain = function() {
    // 1. Recupera la posizione esatta del marker GPS nello spazio globale 3D
    let markerPos = null;
    if (imHereMarker) {
        markerPos = imHereMarker.position.clone();
    } else if (latestNativeGPS) {
        markerPos = getLocalPositionFromGPS(latestNativeGPS.lat, latestNativeGPS.lon, latestNativeGPS.alt);
    }

    if (!markerPos) return;

    // 2. Raccogli tutte le mesh reali caricate (OBJ, PLY, GLTF, 3D-Tiles)
    const meshes = [];
    if (typeof scene !== 'undefined') {
        scene.traverse((child) => {
            if (child.isMesh && child.visible && child !== imHereMarker && !child.name.includes("imHere")) {
                child.updateMatrixWorld(true);
                meshes.push(child);
            }
        });
    }

    if (meshes.length === 0) return;

    // 3. Determina se l'asse verticale attivo è Z oppure Y
    const isZUp = window.modelUpAxisIsY === false || document.getElementById('modal-btn-yes')?.classList.contains('active');

    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = false;

    let topOrigin, bottomOrigin, downDir, upDir;

    if (isZUp) {
        topOrigin    = new THREE.Vector3(markerPos.x, markerPos.y, markerPos.z + 5000);
        downDir      = new THREE.Vector3(0, 0, -1);
        bottomOrigin = new THREE.Vector3(markerPos.x, markerPos.y, markerPos.z - 5000);
        upDir        = new THREE.Vector3(0, 0, 1);
    } else {
        topOrigin    = new THREE.Vector3(markerPos.x, markerPos.y + 5000, markerPos.z);
        downDir      = new THREE.Vector3(0, -1, 0);
        bottomOrigin = new THREE.Vector3(markerPos.x - 5000, markerPos.y, markerPos.z);
        upDir        = new THREE.Vector3(0, 1, 0);
    }

    // 4. Raycast dall'alto verso il basso
    raycaster.set(topOrigin, downDir);
    let intersects = raycaster.intersectObjects(meshes, true);

    // Raycast dal basso verso l'alto se necessario
    if (intersects.length === 0) {
        raycaster.set(bottomOrigin, upDir);
        intersects = raycaster.intersectObjects(meshes, true);
    }

    // 5. Fallback: ricerca vertice più vicino nel raggio XY
    if (intersects.length === 0) {
        let closestHit = null;
        let minDistXY = Infinity;

        const dummyPoint = new THREE.Vector3();

        meshes.forEach(mesh => {
            const posAttr = mesh.geometry?.attributes?.position;
            if (!posAttr) return;

            const matrixWorld = mesh.matrixWorld;

            for (let i = 0; i < posAttr.count; i += 3) {
                dummyPoint.fromBufferAttribute(posAttr, i);
                dummyPoint.applyMatrix4(matrixWorld);

                const dx = dummyPoint.x - markerPos.x;
                const dy = isZUp ? (dummyPoint.y - markerPos.y) : (dummyPoint.z - markerPos.z);
                const distXY = Math.sqrt(dx * dx + dy * dy);

                if (distXY < 2.0 && distXY < minDistXY) {
                    minDistXY = distXY;
                    closestHit = dummyPoint.clone();
                }
            }
        });

        if (closestHit) {
            intersects = [{ point: closestHit }];
        }
    }

    // 6. Aggiornamento silenzioso di slider e quota Z
    if (intersects.length > 0) {
        const hitPoint = intersects[0].point;

        let targetHeight  = isZUp ? hitPoint.z  : hitPoint.y;
        let currentHeight = isZUp ? markerPos.z : markerPos.y;

        const currentOffset = window.gpsAltitudeOffset || 0;
        let baseGpsHeight = currentHeight - currentOffset;

        let calculatedOffset = targetHeight - baseGpsHeight;
        calculatedOffset = Math.max(-100, Math.min(100, Math.round(calculatedOffset * 10) / 10));

        const slider = document.getElementById('input-alt-slider');
        if (slider) slider.value = calculatedOffset;

        window.updateGpsAltitudeOffset(calculatedOffset);
    }
};
// ==========================================
// TOGGLE GPS MARKER (PALLINO BLU)
// ==========================================
function toggleGPS() {
    const btn = document.getElementById('btn-gps-toggle');
    const sliderContainer = document.getElementById('alt-slider-panel');
    const scene = window.scene;

    if (!scene) {
        alert("Load a model first (menu ☰)");
        return;
    }

    if (isGpsActive) {
        isGpsActive = false;
        isFollowModeActive = false;
        if (imHereMarker) {
            scene.remove(imHereMarker);
            imHereMarker = null;
        }
        if (btn) {
            btn.classList.remove('pressed');
            btn.textContent = "📍 Show Me";
        }
        const gotoBtn = document.getElementById('btn-goto-location');
        if (gotoBtn) {
            gotoBtn.classList.remove('pressed');
            gotoBtn.textContent = "🎯 Go to Location";
        }
        
        // Nasconde lo slider a destra quando disattivi il GPS
        if (sliderContainer) sliderContainer.style.display = 'none';
        return;
    }

    isGpsActive = true;
    
    // Mostra lo slider a destra quando attivi il GPS
    if (sliderContainer) sliderContainer.style.display = 'flex';

    if (latestNativeGPS) {
        if (btn) {
            btn.classList.add('pressed');
            btn.textContent = "📍 Hide Me";
        }
        updateImHerePosition(latestNativeGPS.lat, latestNativeGPS.lon, latestNativeGPS.alt);
    } else {
        if (btn) btn.textContent = "⌛ Waiting for GNSS signal...";
    }
}

// ==========================================
// CENTER CAMERA ON LOCATION (RICENTRA / FOLLOW)
// ==========================================
function centerOnLocation() {
    const btn = document.getElementById('btn-goto-location');

    if (!latestNativeGPS) {
        alert("⚠️ GNSS signal not available yet.");
        return;
    }

    if (!isGpsActive) {
        toggleGPS();
    }

    isFollowModeActive = !isFollowModeActive;

    if (isFollowModeActive) {
        if (btn) {
            btn.classList.add('pressed');
            btn.textContent = "🔒 Following Me";
        }
        startFollowAnimationLoop();
    } else {
        if (btn) {
            btn.classList.remove('pressed');
            btn.textContent = "🎯 Go to Location";
        }
    }
}

// ==========================================
// HELPER COORDINATE LOCALI THREE.JS
// ==========================================
function getLocalPositionFromGPS(lat, lon, alt) {
    if (typeof proj4 === 'undefined') return null;

    const crsInput = document.getElementById('input-crs');
    let targetCRS = (crsInput && crsInput.value.trim()) ? crsInput.value.trim() : "EPSG:32633";

    if (!targetCRS.toUpperCase().startsWith("EPSG:") && !targetCRS.startsWith("+proj")) {
        targetCRS = "EPSG:" + targetCRS;
    }

    const utmCoords = proj4("EPSG:4326", targetCRS, [lon, lat]);
    const realX = utmCoords[0];
    const realY = utmCoords[1];
    
    // Quota GPS nativa + Offset Manuale (-100m / +100m)
    const adjustedAlt = alt + (window.gpsAltitudeOffset || 0);
    const realZ = adjustedAlt;

    const pyX = (typeof pythonOffset !== 'undefined' && pythonOffset.x) ? pythonOffset.x : 0;
    const pyY = (typeof pythonOffset !== 'undefined' && pythonOffset.y) ? pythonOffset.y : 0;
    const pyZ = (typeof pythonOffset !== 'undefined' && pythonOffset.z) ? pythonOffset.z : 0;

    const threeCenter = window.threeCenter;
    const tcX = threeCenter ? threeCenter.x : 0;
    const tcY = threeCenter ? threeCenter.y : 0;
    const tcZ = threeCenter ? threeCenter.z : 0;

    const localX = realX - tcX - pyX;
    const localY = realZ - tcY - pyZ;
    const localZ = -realY - tcZ + pyY;

    return new THREE.Vector3(localX, localY, localZ);
}

// ==========================================
// LOOP DI ANIMAZIONE FLUIDA (LERP + HEADING + LINE OF SIGHT TILTING)
// ==========================================
function startFollowAnimationLoop() {
    if (isAnimLoopRunning) return;
    isAnimLoopRunning = true;

    function animate() {
        if (!isFollowModeActive || !latestNativeGPS) {
            isAnimLoopRunning = false;
            return;
        }

        const camera = window.camera;
        const controls = window.controls;

        if (camera && controls) {
            const userPos = getLocalPositionFromGPS(latestNativeGPS.lat, latestNativeGPS.lon, latestNativeGPS.alt);
            
            if (userPos) {
                let currentHeading = 0;
                if (window.rawSensorData && window.rawSensorData.dipDir !== undefined) {
                                    currentHeading = window.rawSensorData.dipDir;
                                } else if (window.liveSensorData && window.liveSensorData.dipDir !== undefined) {
                                    currentHeading = window.liveSensorData.dipDir;
                                }
                
                const isFaceDown = window.isDeviceFaceDown === true;

                let rawDip = 45;
                if (window.rawSensorData && window.rawSensorData.dip !== undefined) {
                    rawDip = window.rawSensorData.dip;
                } else if (window.liveSensorData && window.liveSensorData.dip !== undefined) {
                    rawDip = window.liveSensorData.dip;
                }

                const basePitch = 90 - rawDip;

                let viewPitch;
                if (!isFaceDown) {
                    // Face Down: Vista dall'alto verso il basso (pitch positivo)
                    viewPitch = Math.max(2, Math.min(85, basePitch));
                } else {
                    // Face Up: Vista dal basso verso l'alto (pitch negativo)
                    viewPitch = Math.min(-2, Math.max(-85, -basePitch));
                }
                
                const baseRadius = 25;
                const pitchRad = (viewPitch * Math.PI) / 180.0;
                
                const cameraHeight = baseRadius * Math.sin(pitchRad);
                const cameraDistance = baseRadius * Math.cos(pitchRad);
                
                let headingRad = currentHeading * Math.PI / 180.0;

                // Se face down, non invertire (guarda dove punta il tablet)
                // Se face up, inverte di 180 (compensa inversione di Swift)
                if (isFaceDown) {
                    // Face down: guarda nella direzione del dipDir
                    headingRad = headingRad;
                } else {
                    // Face up: inverte perché Swift già lo ha fatto
                    headingRad = headingRad + Math.PI;
                }

                targetCamPos.x = userPos.x - cameraDistance * Math.sin(headingRad);
                targetCamPos.z = userPos.z + cameraDistance * Math.cos(headingRad);
                targetCamPos.y = userPos.y + cameraHeight;
                targetLookAt.copy(userPos);

                camera.position.lerp(targetCamPos, 0.08);
                controls.target.lerp(targetLookAt, 0.08);
                controls.update();

                if (window.active3dTiles) {
                    camera.updateMatrixWorld(true);
                    window.active3dTiles.update();
                }

                if (typeof render === 'function') render();
            }
        }

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}

// ==========================================
// UPDATE MARKER POSITION (PALLINO BLU)
// ==========================================
function updateImHerePosition(lat, lon, alt) {
    try {
        const userPos = getLocalPositionFromGPS(lat, lon, alt);
        if (userPos) {
            renderHighVisMarker(userPos);
        }
    } catch (err) {
        console.error("GNSS position calculation error:", err);
    }
}

// ==========================================
// RENDER MARKER
// ==========================================
function renderHighVisMarker(position) {
    const scene = window.scene;
    const renderer = window.renderer;
    if (!scene) return;
    
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

    if (typeof render === 'function') render();
}

window.toggleGPS = toggleGPS;
window.centerOnLocation = centerOnLocation;
