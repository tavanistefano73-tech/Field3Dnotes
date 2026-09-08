/**
 * 13-calibration_2.js - Calibrazione AR 5 Punti (Ritratto, Z=Alto, Camera Live 30%, Loop Continuo)
 * Convenzione Spaziale: Z = Alto, Y = Nord, X = Est
 */

console.log("✅ Calibration module loaded (Portrait Mode, Z=Up, Continuous Frame Loop)");

let calibrationMode = false;
let arTrackingActive = false;
let calibrationStep = 0;
let waitingForScreenPoint = false;

let modelPoints = [];
let screenPoints = [];
let markers = [];
let cameraOverlay = null;
let overlayVideo = null;
let mediaStream = null;

let currentGyro = { alpha: 0, beta: 0, gamma: 0, valid: false };
const TOTAL_POINTS = 5;

// Ancoraggio e Quaternioni di Calibrazione
const baseCameraPosition = new THREE.Vector3();
const qSensorsCalib = new THREE.Quaternion();
const qCamCalib = new THREE.Quaternion();

let trackingAnimationFrameId = null;

// ==========================================
// 1. SENSORI IPAD - RITRATTO & Z = ALTO
// ==========================================
function getScreenOrientationAngle() {
    if (window.screen && window.screen.orientation && window.screen.orientation.angle !== undefined) {
        return window.screen.orientation.angle;
    }
    if (typeof window.orientation !== 'undefined') {
        return window.orientation;
    }
    return 0; // 0° = Portrait / Ritratto
}

function handleDeviceOrientation(event) {
    let alpha = event.alpha;
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        alpha = 360 - event.webkitCompassHeading;
    }

    if (alpha !== null && event.beta !== null && event.gamma !== null) {
        currentGyro.alpha = alpha;
        currentGyro.beta = event.beta;
        currentGyro.gamma = event.gamma;
        currentGyro.valid = true;

        if (calibrationMode && window.camera) {
            applyGyroToCamera(window.camera, currentGyro);
        }
    }
}

async function requestSensorPermissions() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response === 'granted') {
                window.addEventListener('deviceorientation', handleDeviceOrientation, true);
            } else {
                alert("⚠️ Permesso sensori giroscopio negato.");
            }
        } catch (e) {
            console.error("Errore sensori:", e);
        }
    } else {
        window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    }
}

// Convertitore Orientamento iPad -> Three.js (Portrait, Z = Alto)
function getCameraQuaternionFromGyro(gyro) {
    if (!gyro || !gyro.valid) return new THREE.Quaternion();

    const degToRad = Math.PI / 180;
    const a = gyro.alpha * degToRad; // Azimut (Rotazione Z)
    const b = gyro.beta * degToRad;  // Pitch (Rotazione X)
    const g = gyro.gamma * degToRad; // Roll (Rotazione Y)

    const euler = new THREE.Euler(b, g, -a, 'ZXY');
    const qGyro = new THREE.Quaternion().setFromEuler(euler);

    // Allineamento sensore iPad tenuto in verticale (Portrait, Z = Alto)
    const qBase = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

    const screenAngle = getScreenOrientationAngle() * degToRad;
    const qScreen = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -screenAngle);

    return qGyro.clone().multiply(qBase).multiply(qScreen);
}

function applyGyroToCamera(camera, gyro) {
    if (!gyro.valid) return;
    camera.quaternion.copy(getCameraQuaternionFromGyro(gyro));
    camera.updateMatrixWorld(true);
}

// ==========================================
// LOOP CONTINUO DI TRACCIAMENTO AR
// ==========================================
function startARTrackingLoop() {
    arTrackingActive = true;

    function arLoop() {
        if (!arTrackingActive) return;

        if (currentGyro.valid && window.camera) {
            // 1. Quaternione attuale dai sensori
            const qSensorsCurrent = getCameraQuaternionFromGyro(currentGyro);

            // 2. Calcolo Delta: ΔQ = Q_calib_sensore^-1 * Q_attuale_sensore
            const qDeltaSensor = qSensorsCalib.clone().invert().multiply(qSensorsCurrent);

            // 3. Applicazione Delta alla camera: Q_camera = Q_calib_camera * ΔQ
            window.camera.quaternion.copy(qCamCalib).multiply(qDeltaSensor);
            window.camera.position.copy(baseCameraPosition);

            // 4. Disattiva interferenza degli OrbitControls
            if (window.controls) {
                window.controls.enabled = false;
            }

            window.camera.matrixAutoUpdate = true;
            window.camera.updateMatrixWorld(true);
        }

        trackingAnimationFrameId = requestAnimationFrame(arLoop);
    }

    if (trackingAnimationFrameId) cancelAnimationFrame(trackingAnimationFrameId);
    arLoop();
}

function stopARTracking() {
    arTrackingActive = false;
    if (trackingAnimationFrameId) {
        cancelAnimationFrame(trackingAnimationFrameId);
        trackingAnimationFrameId = null;
    }
    stopCameraStream();
    if (window.controls) window.controls.enabled = true;
    console.log("⏸️ Tracciamento AR disattivato.");
}

// ==========================================
// 2. OVERLAY FOTOCAMERA (30% OPACITÀ POST 5° PUNTO)
// ==========================================
function createCameraOverlay() {
    if (cameraOverlay) return;

    cameraOverlay = document.createElement('div');
    cameraOverlay.id = 'camera-calibration-overlay';
    cameraOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 200000; display: none; background: transparent; pointer-events: none;
    `;

    overlayVideo = document.createElement('video');
    overlayVideo.setAttribute('autoplay', '');
    overlayVideo.setAttribute('muted', '');
    overlayVideo.setAttribute('playsinline', '');
    overlayVideo.style.cssText = `
        width: 100%; height: 100%; object-fit: cover; opacity: 0.2;
        transition: opacity 0.25s ease-in-out; pointer-events: none;
    `;

    cameraOverlay.addEventListener('click', handleCameraOverlayClick);
    cameraOverlay.appendChild(overlayVideo);
    document.body.appendChild(cameraOverlay);
}

function setOverlayMode(mode) {
    if (!overlayVideo || !cameraOverlay) return;

    if (mode === 'SELECT_3D_MODEL') {
        cameraOverlay.style.display = 'block';
        overlayVideo.style.opacity = '0.2';
        cameraOverlay.style.pointerEvents = 'none';
    } else if (mode === 'SELECT_CAMERA_POINT') {
        cameraOverlay.style.display = 'block';
        overlayVideo.style.opacity = '0.8';
        cameraOverlay.style.pointerEvents = 'auto';
    } else if (mode === 'AR_TRACKING') {
        // Fotocamera reale visibile al 30% sotto il Modello 3D (70%)
        cameraOverlay.style.display = 'block';
        overlayVideo.style.opacity = '0.3';
        cameraOverlay.style.pointerEvents = 'none';
    }
}

async function openCameraOverlay() {
    createCameraOverlay();
    cameraOverlay.style.display = 'block';

    try {
        if (!mediaStream) {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { exact: "environment" } },
                audio: false
            });
        }
        overlayVideo.srcObject = mediaStream;
        await overlayVideo.play();
    } catch (err) {
        try {
            if (!mediaStream) {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }
            overlayVideo.srcObject = mediaStream;
            await overlayVideo.play();
        } catch (fErr) {
            console.error("❌ Errore fotocamera:", fErr);
            alert("Impossibile accedere alla fotocamera.");
            closeCameraOverlay();
        }
    }
}

function closeCameraOverlay() {
    if (cameraOverlay) cameraOverlay.style.display = 'none';
}

function stopCameraStream() {
    closeCameraOverlay();
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (overlayVideo) overlayVideo.srcObject = null;
}

// ==========================================
// 3. FLUSSO DI CALIBRAZIONE A 5 PUNTI
// ==========================================
async function startCalibration() {
    await requestSensorPermissions();

    stopARTracking();
    calibrationMode = true;
    calibrationStep = 0;
    waitingForScreenPoint = false;
    modelPoints = [];
    screenPoints = [];
    clearMarkers();

    if (window.controls) window.controls.enabled = false;

    await openCameraOverlay();
    showCalibrationUI();

    setOverlayMode('SELECT_3D_MODEL');
    updateCalibrationUI(`Punto 1/${TOTAL_POINTS}: Clicca sul punto nel MODELLO 3D (Ritratto, Z=Alto)`);
}

function handleModelClick(e) {
    if (!calibrationMode || calibrationStep >= TOTAL_POINTS) return;
    if (waitingForScreenPoint) return;
    if (e.target.closest('#calibration-ui')) return;

    const camera = window.camera;
    const scene = window.scene;
    const tiles = window.active3dTiles || window.tilesRenderer;
    if (!camera || !scene) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
    );

    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(mouse, camera);

    let hitPoint = null;

    if (tiles && tiles.group) {
        tiles.group.updateMatrixWorld(true);
        const intersects = raycaster.intersectObject(tiles.group, true);
        const validHits = intersects.filter(hit => hit.object.visible && !hit.object.userData.isCalibrationMarker);
        if (validHits.length > 0) hitPoint = validHits[0].point.clone();
    }

    if (!hitPoint) {
        scene.updateMatrixWorld(true);
        const selectables = [];
        scene.traverse(obj => {
            if (obj.isMesh && obj.visible && !obj.userData.isCalibrationMarker) selectables.push(obj);
        });
        const intersects = raycaster.intersectObjects(selectables, true);
        if (intersects.length > 0) hitPoint = intersects[0].point.clone();
    }

    if (hitPoint) {
        modelPoints.push(hitPoint);
        createMarker3D(hitPoint);

        waitingForScreenPoint = true;
        setOverlayMode('SELECT_CAMERA_POINT');
        updateCalibrationUI(`Punto ${calibrationStep + 1}/${TOTAL_POINTS}: Clicca sulla FOTOCAMERA (80% Foto / 20% Modello)`);
    }
}

function handleCameraOverlayClick(e) {
    if (!calibrationMode || !waitingForScreenPoint) return;

    const relX = e.clientX / window.innerWidth;
    const relY = e.clientY / window.innerHeight;

    screenPoints.push({
        x: e.clientX,
        y: e.clientY,
        relX: relX,
        relY: relY,
        gyro: { ...currentGyro }
    });

    createMarker2D(e.clientX, e.clientY);

    calibrationStep++;
    waitingForScreenPoint = false;

    if (calibrationStep >= TOTAL_POINTS) {
        completeCalibration();
    } else {
        setOverlayMode('SELECT_3D_MODEL');
        updateCalibrationUI(`Punto ${calibrationStep + 1}/${TOTAL_POINTS}: Clicca sul prossimo punto nel MODELLO 3D`);
    }
}

document.addEventListener('click', (e) => {
    if (calibrationMode && !waitingForScreenPoint) {
        handleModelClick(e);
    }
}, true);

// ==========================================
// 4. SOLUTORE MATEMATICO FOV E POSIZIONE
// ==========================================
function solveCameraPoseAndFOV(pts3D, pts2D) {
    const N = pts3D.length;
    if (N < 3) return null;

    const aspect = window.innerWidth / window.innerHeight;

    function evaluateFOV(fovDeg) {
        const fovRad = fovDeg * Math.PI / 180;
        const tanHalfFovV = Math.tan(fovRad / 2);
        const tanHalfFovH = tanHalfFovV * aspect;

        const mElements = [0,0,0, 0,0,0, 0,0,0];
        const V = new THREE.Vector3(0, 0, 0);
        const rays = [];

        for (let i = 0; i < N; i++) {
            const p3D = pts3D[i];
            const p2D = pts2D[i];

            const ndcX = (p2D.relX * 2) - 1;
            const ndcY = -(p2D.relY * 2) + 1;

            const dirLocal = new THREE.Vector3(
                ndcX * tanHalfFovH,
                ndcY * tanHalfFovV,
                -1
            ).normalize();

            const qCam = getCameraQuaternionFromGyro(p2D.gyro);
            const d = dirLocal.clone().applyQuaternion(qCam).normalize();
            rays.push(d);

            mElements[0] += 1 - d.x * d.x;
            mElements[1] += -d.x * d.y;
            mElements[2] += -d.x * d.z;

            mElements[3] += -d.x * d.y;
            mElements[4] += 1 - d.y * d.y;
            mElements[5] += -d.y * d.z;

            mElements[6] += -d.x * d.z;
            mElements[7] += -d.y * d.z;
            mElements[8] += 1 - d.z * d.z;

            const dDotP = d.dot(p3D);
            const vContrib = p3D.clone().sub(d.clone().multiplyScalar(dDotP));
            V.add(vContrib);
        }

        const M = new THREE.Matrix3().set(
            mElements[0], mElements[1], mElements[2],
            mElements[3], mElements[4], mElements[5],
            mElements[6], mElements[7], mElements[8]
        );

        const M_inv = M.clone().invert();
        const pos = V.clone().applyMatrix3(M_inv);

        let totalError = 0;
        for (let i = 0; i < N; i++) {
            const p3D = pts3D[i];
            const d = rays[i];
            const diff = p3D.clone().sub(pos);
            const proj = d.clone().multiplyScalar(diff.dot(d));
            totalError += diff.sub(proj).lengthSq();
        }

        return { pos, totalError };
    }

    let bestFov = 60;
    let minError = Infinity;
    let bestPos = null;

    for (let fov = 35; fov <= 95; fov += 0.5) {
        const res = evaluateFOV(fov);
        if (res.totalError < minError) {
            minError = res.totalError;
            bestFov = fov;
            bestPos = res.pos;
        }
    }

    return { position: bestPos, fov: parseFloat(bestFov.toFixed(2)) };
}

// ==========================================
// 5. COMPLETAMENTO ED ESECUZIONE ANCORAGGIO
// ==========================================
function completeCalibration() {
    calibrationMode = false;

    if (modelPoints.length === TOTAL_POINTS && window.camera) {
        const result = solveCameraPoseAndFOV(modelPoints, screenPoints);
        if (result && result.position) {
            // 1. Allinea FOV
            window.camera.fov = result.fov;
            window.camera.updateProjectionMatrix();

            // 2. Ancoraggio Posizione
            baseCameraPosition.copy(result.position);
            window.camera.position.copy(baseCameraPosition);

            // 3. Memorizza i quaternioni di riferimento per il calcolo dei Delta
            qSensorsCalib.copy(getCameraQuaternionFromGyro(currentGyro));
            qCamCalib.copy(window.camera.quaternion);

            window.camera.updateMatrixWorld(true);

            // 4. Mantiene la Fotocamera Visibile al 30% ed avvia il loop di tracciamento continuo
            setOverlayMode('AR_TRACKING');
            startARTrackingLoop();

            console.log(`📍 Posizione Ancorata (Z=Alto):`, baseCameraPosition);
            console.log(`📐 FOV Calibrato: ${result.fov}°`);
        }
    }

    hideCalibrationUI();
    clearMarkers();
    alert("✅ Calibrazione completata!\nTracciamento AR in tempo reale attivo. Fotocamera visibile al 30%.");
}

function cancelCalibration() {
    calibrationMode = false;
    waitingForScreenPoint = false;
    calibrationStep = 0;
    modelPoints = [];
    screenPoints = [];

    stopARTracking();
    clearMarkers();
    hideCalibrationUI();
}

// ==========================================
// MARKER ED INTERFACCIA UTENTE
// ==========================================
function createMarker3D(position) {
    const scene = window.scene;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute([position.x, position.y, position.z], 3));

    const mat = new THREE.PointsMaterial({
        color: 0x0088ff,
        size: 12,
        sizeAttenuation: false,
        depthTest: false,
        transparent: true
    });

    const pointMesh = new THREE.Points(geom, mat);
    pointMesh.userData.isCalibrationMarker = true;
    pointMesh.renderOrder = 999;

    scene.add(pointMesh);
    markers.push(pointMesh);
}

function createMarker2D(x, y) {
    const dot = document.createElement('div');
    dot.className = 'calibration-screen-dot';
    dot.style.cssText = `
        position: fixed; left: ${x - 6}px; top: ${y - 6}px;
        width: 12px; height: 12px; background-color: #ff0000;
        border: 2px solid #ffffff; border-radius: 50%;
        pointer-events: none; z-index: 300000;
    `;
    document.body.appendChild(dot);
    markers.push(dot);
}

function clearMarkers() {
    const scene = window.scene;
    markers.forEach(m => {
        if (m instanceof THREE.Object3D && scene) scene.remove(m);
        else if (m instanceof HTMLElement) m.remove();
    });
    markers = [];
}

function showCalibrationUI() {
    let ui = document.getElementById('calibration-ui');
    if (!ui) {
        ui = document.createElement('div');
        ui.id = 'calibration-ui';
        ui.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.95); color: #ffffff; padding: 16px 24px;
            border-radius: 8px; font-family: sans-serif; font-size: 14px;
            z-index: 350000; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            text-align: center; border: 2px solid #3b82f6; min-width: 340px;
        `;
        document.body.appendChild(ui);
    }
    ui.style.display = 'block';
}

function updateCalibrationUI(message) {
    const ui = document.getElementById('calibration-ui');
    if (!ui) return;

    ui.innerHTML = `
        <div style="margin-bottom: 6px; color: #60a5fa; font-weight: bold; font-size: 15px;">📷 CALIBRAZIONE AR (5 PUNTI)</div>
        <div style="margin-bottom: 8px; font-size: 13px; color: #e2e8f0;">${message}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">Progresso: ${calibrationStep}/${TOTAL_POINTS} punti</div>
        <button onclick="cancelCalibration()" style="
            background: #ef4444; color: white; border: none; padding: 6px 14px;
            border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;
        ">Annulla</button>
    `;
}

function hideCalibrationUI() {
    const ui = document.getElementById('calibration-ui');
    if (ui) ui.style.display = 'none';
}

window.startCalibration = startCalibration;
window.cancelCalibration = cancelCalibration;
window.stopARTracking = stopARTracking;
