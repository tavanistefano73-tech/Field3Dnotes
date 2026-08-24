function toggleDigitizePanel(e) {
    if (e) e.stopPropagation();
    const ui = document.getElementById('ui');
    if (ui) ui.classList.toggle('collapsed');
}

function toggleMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('dropdown-menu');
    menu.classList.toggle('show');
}

function closeMenu() {
    const menu = document.getElementById('dropdown-menu');
    if (menu) menu.classList.remove('show');
}

function toggleFilterPanel(e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById('filter-section');
    if (panel) panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
}

window.addEventListener('click', closeMenu);

function triggerFileInput() { document.getElementById('file-input').click(); }
function triggerGeoJSONInput() { document.getElementById('geojson-input').click(); }

// --- THREE.JS ENGINE ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.7); dirLight1.position.set(1, 2, 1); scene.add(dirLight1);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4); dirLight2.position.set(-1, -2, -1); scene.add(dirLight2);

// --- AXIS GIZMO ---
const gizmoScene = new THREE.Scene();
const gizmoCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
const gizmoOrigin = new THREE.Vector3(0, 0, 0);

gizmoScene.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), gizmoOrigin, 1.0, 0xff4444, 0.28, 0.18));
gizmoScene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), gizmoOrigin, 1.0, 0x44ff44, 0.28, 0.18));
gizmoScene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), gizmoOrigin, 1.0, 0x4444ff, 0.28, 0.18));

function createTextSprite(text, colorHexStr) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorHexStr; ctx.font = 'Bold 28px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
    sprite.scale.set(0.7, 0.35, 1);
    return sprite;
}

gizmoScene.add(createTextSprite("East", "#ff6666").clone().translateOnAxis(new THREE.Vector3(1,0,0), 1.35));
gizmoScene.add(createTextSprite("Up", "#66ff66").clone().translateOnAxis(new THREE.Vector3(0,1,0), 1.35));
gizmoScene.add(createTextSprite("South", "#6666ff").clone().translateOnAxis(new THREE.Vector3(0,0,1), 1.35));

let loadedMesh = null;
let initialQuaternion = null;
let pythonOffset = { x: 0, y: 0, z: 0 };
let threeCenter = new THREE.Vector3(0, 0, 0);
let raycasterThreshold = 0.5;

const digitizedFeatures = [];
let featureCounter = 1;
let selectedFeatureId = null;
let isDigitizing = false;
let isSettingCenter = false;

const filterState = { f_type: {}, unit: {}, set: {} };

let currentPoints = [];
let currentPlaneCorners = null;
let currentPointsObj = null, currentLineMesh = null, currentPlaneMesh = null, currentPlaneWireframe = null;

let mouseDownPos = { x: 0, y: 0 };
let wasDragging = false;

const activePointsMat = new THREE.PointsMaterial({ color: 0xffff00, size: 6, sizeAttenuation: false });
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// SENSOR DATA
let rawSensorData = { strike: 0, dipDir: 90, dip: 45, rake: 90 };
let liveSensorData = { strike: 0, dipDir: 90, dip: 45, rake: 90 };
let sensorsActive = false;

function getCorrectedOrientation(rawStrike, rawDipDir) {
    const chkDecl = document.getElementById('chk-use-declination');
    const inputDecl = document.getElementById('input-declination');
    const useDecl = chkDecl && chkDecl.checked;
    const declVal = useDecl ? (parseFloat(inputDecl.value) || 0) : 0;

    const finalStrike = Math.round((rawStrike + declVal + 360) % 360);
    const finalDipDir = Math.round((rawDipDir + declVal + 360) % 360);
    return { strike: finalStrike, dipDir: finalDipDir };
}

function onDeclinationToggleOrChange() {
    const corrected = getCorrectedOrientation(rawSensorData.strike, rawSensorData.dipDir);
    liveSensorData.strike = corrected.strike;
    liveSensorData.dipDir = corrected.dipDir;
    liveSensorData.dip = rawSensorData.dip;
    liveSensorData.rake = rawSensorData.rake;

    const elStrike = document.getElementById('sensor-strike');
    const elDipDir = document.getElementById('sensor-dipdir');
    if (elStrike) elStrike.textContent = corrected.strike + '°';
    if (elDipDir) elDipDir.textContent = corrected.dipDir + '°';

    const inputStrike = document.getElementById('input-strike');
    const inputDipDir = document.getElementById('input-dipdir');
    if (inputStrike) inputStrike.value = corrected.strike;
    if (inputDipDir) inputDipDir.value = corrected.dipDir;
}

function estimateDeclination(lat, lon) {
    const magLat = 86.5 * Math.PI / 180;
    const magLon = 164.0 * Math.PI / 180;
    const phi = lat * Math.PI / 180;
    const lambda = lon * Math.PI / 180;
    
    const dLon = magLon - lambda;
    const y = Math.sin(dLon) * Math.cos(magLat);
    const x = Math.cos(phi) * Math.sin(magLat) - Math.sin(phi) * Math.cos(magLat) * Math.cos(dLon);
    
    const decl = Math.atan2(y, x) * 180 / Math.PI;
    return Math.round(decl * 10) / 10;
}

// Status initialization at startup
// No status message at startup
function initGPSDeclination() {
    const statusEl = document.getElementById('declination-status');
    if (statusEl) {
        statusEl.textContent = ''; // Clears default text present in HTML
    }
}

// NATIVE GPS RECEIPT FROM SWIFT (iOS)
window.handleNativeLocation = function(lat, lng, alt) {
    // 1. Save global coordinates
    window.currentLatitude = lat;
    window.currentLongitude = lng;
    window.currentAltitude = alt;

    // 2. Calculate magnetic declination in background
    const inputDecl = document.getElementById('input-declination');
    const chkDecl = document.getElementById('chk-use-declination');

    if (typeof estimateDeclination === 'function') {
        const defaultDecl = estimateDeclination(lat, lng);

        if (inputDecl) inputDecl.value = defaultDecl;
        if (chkDecl) chkDecl.checked = true;

        if (typeof onDeclinationToggleOrChange === 'function') {
            onDeclinationToggleOrChange();
        }
    }

    // 3. Update coordinate input fields
    const latInput = document.getElementById('input-lat');
    const lngInput = document.getElementById('input-lng');
    const altInput = document.getElementById('input-alt');

    if (latInput) latInput.value = lat.toFixed(6);
    if (lngInput) lngInput.value = lng.toFixed(6);
    if (altInput) altInput.value = alt.toFixed(1);
};

function autoInitSensors() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(state => { if (state === 'granted') initSensors(); }).catch(() => {});
    } else if ('DeviceOrientationEvent' in window) {
        initSensors();
    }
}

function initSensors() {
    window.addEventListener('deviceorientation', handleOrientation, true);
    sensorsActive = true;
    const dot = document.getElementById('sensor-dot');
    if (dot) dot.style.background = '#55ff55';
}

window.addEventListener('load', () => {
    autoInitSensors();
    initGPSDeclination();
});
document.addEventListener('touchstart', autoInitSensors, { once: true });
document.addEventListener('pointerdown', autoInitSensors, { once: true });

function handleOrientation(e) {
    if (e.beta === null || e.gamma === null) return;
    let heading = (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) ? e.webkitCompassHeading : (e.alpha !== null ? (360 - e.alpha) % 360 : 0);
    const degToRad = Math.PI / 180.0;
    const b = e.beta * degToRad, g = e.gamma * degToRad, h = heading * degToRad;

    let Nx_dev = Math.sin(g), Ny_dev = -Math.sin(b) * Math.cos(g), Nz_dev = Math.cos(b) * Math.cos(g);
    let Ne = Nx_dev * Math.cos(h) + Ny_dev * Math.sin(h);
    let Nn = -Nx_dev * Math.sin(h) + Ny_dev * Math.cos(h);
    let Nu = Nz_dev;

    if (Nu < 0) { Ne = -Ne; Nn = -Nn; Nu = -Nu; }

    let dip = Math.round(Math.acos(Math.min(1.0, Math.max(-1.0, Nu))) / degToRad);
    let dipDir = 0, strike = 0;
    if (dip > 0.5) {
        dipDir = Math.round(((Math.atan2(-Ne, -Nn) / degToRad) + 360) % 360);
        strike = Math.round((dipDir - 90 + 360) % 360);
    }

    rawSensorData.strike = strike;
    rawSensorData.dipDir = dipDir;
    rawSensorData.dip = dip;
    rawSensorData.rake = 90;

    const corrected = getCorrectedOrientation(strike, dipDir);
    liveSensorData.strike = corrected.strike;
    liveSensorData.dipDir = corrected.dipDir;
    liveSensorData.dip = dip;
    liveSensorData.rake = 90;

    document.getElementById('sensor-strike').textContent = corrected.strike + '°';
    document.getElementById('sensor-dipdir').textContent = corrected.dipDir + '°';
    document.getElementById('sensor-dip').textContent = dip + '°';
    if (document.getElementById('sensor-rake'))
        document.getElementById('sensor-rake').textContent = '90°';

    if (document.getElementById('input-strike')) document.getElementById('input-strike').value = corrected.strike;
    if (document.getElementById('input-dipdir')) document.getElementById('input-dipdir').value = corrected.dipDir;
    if (document.getElementById('input-dip')) document.getElementById('input-dip').value = dip;
    if (document.getElementById('input-rake')) document.getElementById('input-rake').value = 90;
}

function updateMouseCoords(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

// Sensor state exposed globally
window.rawSensorData = { strike: 0, dipDir: 90, dip: 45, rake: 90, trend: 90, plunge: 45 };
window.liveSensorData = { strike: 0, dipDir: 90, dip: 45, rake: 90, trend: 90, plunge: 45 };

// Declination correction utility
window.getCorrectedOrientation = function(rawStrike, rawDipDir) {
    const chkDecl = document.getElementById('chk-use-declination');
    const inputDecl = document.getElementById('input-declination');
    const useDecl = chkDecl && chkDecl.checked;
    const declVal = useDecl ? (parseFloat(inputDecl?.value) || 0) : 0;

    const finalStrike = Math.round((rawStrike + declVal + 360) % 360);
    const finalDipDir = Math.round((rawDipDir + declVal + 360) % 360);
    return { strike: finalStrike, dipDir: finalDipDir };
};

// Copy current data to HTML input fields
window.copySensorsToFields = function() {
    if (!window.liveSensorData) return;
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('input-strike', window.liveSensorData.strike);
    setVal('input-dipdir', window.liveSensorData.dipDir);
    setVal('input-dip', window.liveSensorData.dip);
    setVal('input-rake', window.liveSensorData.rake);
    setVal('input-trend', window.liveSensorData.trend);
    setVal('input-plunge', window.liveSensorData.plunge);
};

// Native Callback from Swift
window.handleNativeSensors = function(strike, dipDir, dip, rake, trend, plunge) {
    const rStrike = strike || 0;
    const rDipDir = dipDir || 0;
    const rDip = dip || 0;
    const rRake = (rake !== undefined && rake !== null) ? rake : 90;
    const rTrend = (trend !== undefined && trend !== null) ? trend : rDipDir;
    const rPlunge = (plunge !== undefined && plunge !== null) ? plunge : rDip;

    const corrected = window.getCorrectedOrientation(rStrike, rDipDir);

    window.rawSensorData = { strike: rStrike, dipDir: rDipDir, dip: rDip, rake: rRake, trend: rTrend, plunge: rPlunge };
    window.liveSensorData = {
        strike: corrected.strike,
        dipDir: corrected.dipDir,
        dip: rDip,
        rake: rRake,
        trend: rTrend,
        plunge: rPlunge
    };

    // Update panel text labels
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val + '°';
    };
    setTxt('sensor-strike', window.liveSensorData.strike);
    setTxt('sensor-dipdir', window.liveSensorData.dipDir);
    setTxt('sensor-dip', window.liveSensorData.dip);
    setTxt('sensor-rake', window.liveSensorData.rake);
    setTxt('sensor-trend', window.liveSensorData.trend);
    setTxt('sensor-plunge', window.liveSensorData.plunge);

    const dot = document.getElementById('sensor-dot');
    if (dot) dot.style.background = '#28a745';

    // If Live Sync is active, also update input fields
    const chkLiveSync = document.getElementById('chk-live-sync');
    if (chkLiveSync && chkLiveSync.checked) {
        window.copySensorsToFields();
    }
};

window.currentCRS = localStorage.getItem('field3d_crs') || 'urn:ogc:def:crs:OGC:1.3:EPSG:3857';

window.onCRSChanged = function() {
    const el = document.getElementById('input-crs');
    if (!el) return;
    const val = el.value.trim();
    window.currentCRS = val || 'urn:ogc:def:crs:OGC:1.3:EPSG:3857';
    localStorage.setItem('field3d_crs', window.currentCRS);
};

window.addEventListener('load', () => {
    const el = document.getElementById('input-crs');
    if (el) el.value = window.currentCRS;
});

function makePanelDraggable() {
    const ui = document.getElementById('ui');
    if (!ui) return;
    
    const handle = ui.querySelector('.drag-handle') || ui.querySelector('.ui-header');
    if (!handle) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let rafId = null;

    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || e.target.closest('.dropdown-menu')) return;

        e.preventDefault();
        e.stopPropagation();

        isDragging = true;
        
        // Force transition reset directly on element
        ui.style.transition = 'none';

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = ui.offsetLeft;
        initialTop = ui.offsetTop;

        handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        e.stopPropagation();

        const currentX = e.clientX;
        const currentY = e.clientY;

        // Synchronize movement with screen refresh rate (60/120Hz)
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            const maxLeft = window.innerWidth - ui.offsetWidth - 10;
            const maxTop = window.innerHeight - ui.offsetHeight - 10;

            newLeft = Math.max(10, Math.min(newLeft, maxLeft));
            newTop = Math.max(10, Math.min(newTop, maxTop));

            ui.style.left = `${newLeft}px`;
            ui.style.top = `${newTop}px`;
        });
    });

    const stopDrag = (e) => {
        if (isDragging) {
            isDragging = false;
            if (rafId) cancelAnimationFrame(rafId);
            
            // Restore transition defined in CSS
            ui.style.transition = '';

            try {
                handle.releasePointerCapture(e.pointerId);
            } catch (err) {}
        }
    };

    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', makePanelDraggable);
} else {
    makePanelDraggable();
}

// Toggle Right Panel Minimization
function toggleRightPanel(e) {
    if (e) e.stopPropagation();
    const container = document.getElementById('top-right-container');
    const btn = document.getElementById('btn-toggle-right-panel');
    if (!container) return;

    const isCollapsed = container.classList.toggle('collapsed');
    if (btn) {
        btn.textContent = isCollapsed ? '➕' : '➖';
    }
}

function makeRightPanelDraggable() {
    const container = document.getElementById('top-right-container');
    if (!container) return;

    const handle = container.querySelector('.drag-handle');
    if (!handle) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let rafId = null;

    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;

        e.preventDefault();
        e.stopPropagation();

        isDragging = true;
        container.style.transition = 'none';

        startX = e.clientX;
        startY = e.clientY;

        const rect = container.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Convert positioning from 'right' to 'left' to allow movement
        container.style.left = `${initialLeft}px`;
        container.style.right = 'auto';

        handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        e.stopPropagation();

        const currentX = e.clientX;
        const currentY = e.clientY;

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            const maxLeft = window.innerWidth - container.offsetWidth - 10;
            const maxTop = window.innerHeight - container.offsetHeight - 10;

            newLeft = Math.max(10, Math.min(newLeft, maxLeft));
            newTop = Math.max(10, Math.min(newTop, maxTop));

            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;
        });
    });

    const stopDrag = (e) => {
        if (isDragging) {
            isDragging = false;
            if (rafId) cancelAnimationFrame(rafId);
            container.style.transition = '';
            try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
        }
    };

    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
}

// Initialize listener for right panel
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', makeRightPanelDraggable);
} else {
    makeRightPanelDraggable();
}

// Function to update viewport and eliminate distortions
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Update camera aspect ratio to avoid distortion
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // 2. Resize Three.js canvas
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
}

// Listen for both window resize and orientation change (Mobile/iOS)
window.addEventListener('resize', onWindowResize);
window.addEventListener('orientationchange', () => {
    // Small delay to allow iOS/Android to update real viewport coordinates
    setTimeout(onWindowResize, 100);
});

function resizeStereonetCanvas() {
    const windowEl = document.getElementById('stereonet-window');
    // Perform resize only if stereonet window is open
    if (!windowEl || !windowEl.classList.contains('show')) return;

    const wrapper = document.getElementById('stereonet-canvas-wrapper');
    const canvas = document.getElementById('stereonet-canvas');
    if (!wrapper || !canvas) return;

    // Calculate available size guaranteeing a perfect square shape
    const availableWidth = wrapper.clientWidth;
    const availableHeight = wrapper.clientHeight;
    const size = Math.min(availableWidth, availableHeight) * 0.95;

    // Update internal canvas resolution (avoids pixelation)
    canvas.width = Math.floor(size);
    canvas.height = Math.floor(size);

    // Call stereonet render function to update drawing
    if (typeof renderStereonet === 'function') {
        renderStereonet();
    } else if (typeof drawStereonet === 'function') {
        drawStereonet();
    }
}

// Listen for resize and orientation change
window.addEventListener('resize', resizeStereonetCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeStereonetCanvas, 150); // Delay to allow iOS/Android to update coordinates
});

// ==========================================
// LIGHT / DARK THEME TOGGLE
// ==========================================
function updateSceneBackground() {
    const isLight = document.body.classList.contains('light-theme');
    const colorHex = isLight ? 0xebebeb : 0x1a1a1a;
    
    // Retrieve scene (from both window.scene and global variable scene)
    const currentScene = window.scene || (typeof scene !== 'undefined' ? scene : null);
    if (currentScene) {
        currentScene.background = new THREE.Color(colorHex);
    }
    
    // Retrieve Three.js renderer if present
    const currentRenderer = window.renderer || (typeof renderer !== 'undefined' ? renderer : null);
    if (currentRenderer) {
        currentRenderer.setClearColor(colorHex);
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    updateSceneBackground();
    localStorage.setItem('field3d_theme', isLight ? 'light' : 'dark');
}

// Restore saved theme on startup
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('field3d_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
    // Apply background to 3D scene as soon as ready
    setTimeout(updateSceneBackground, 200);
});

// Expose functions globally
window.toggleTheme = toggleTheme;
window.updateSceneBackground = updateSceneBackground;

// ==========================================
// NATIVE GPS RECEIPT FROM SWIFT (iOS)
// ==========================================
window.handleNativeLocation = function(lat, lng, alt) {
    console.log("📍 GPS coordinates received from iOS:", lat, lng, alt);

    // 1. Update global variables
    window.currentLatitude = lat;
    window.currentLongitude = lng;
    window.currentAltitude = alt;

    // 2. Update UI input values if present
    const latInput = document.getElementById('input-lat');
    const lngInput = document.getElementById('input-lng');
    const altInput = document.getElementById('input-alt');

    if (latInput) latInput.value = lat.toFixed(6);
    if (lngInput) lngInput.value = lng.toFixed(6);
    if (altInput) altInput.value = alt.toFixed(1);
};

let lastGPSLocation = null;
let userMarker = null;

// 1. Function to create blue marker in Three.js scene
function createUserMarker() {
    const group = new THREE.Group();

    // Inner blue sphere
    const sphereGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x007aff });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(sphere);

    // Outer white ring for contrast against ground
    const ringGeo = new THREE.RingGeometry(1.8, 2.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    group.visible = false;
    scene.add(group);
    return group;
}

// 2. Callback invoked by iOS/Swift on every GPS update
window.handleNativeLocation = function(lat, lng, alt) {
    lastGPSLocation = { lat: lat, lng: lng, alt: alt || 0 };

    // If CRS and loaded model exist, update blue marker position immediately
    if (window.currentCRS && typeof pythonOffset !== 'undefined' && pythonOffset) {
        try {
            if (!userMarker) userMarker = createUserMarker();

            const projectCoords = proj4("EPSG:4326", window.currentCRS, [lng, lat]);
            const ptGis = [projectCoords[0], projectCoords[1], alt || 0];
            const ptThree = gisToThree(ptGis);

            userMarker.position.copy(ptThree);
            userMarker.visible = true;
        } catch (e) {
            console.warn("Error updating GPS marker:", e);
        }
    }
};

// ==========================================
// ✅ GLOBAL VARIABLES EXPOSURE
// ==========================================
// Expose all required global variables for other modules
window.scene = scene;
window.camera = camera;
window.renderer = renderer;
window.controls = controls;
window.loadedMesh = loadedMesh;
window.threeCenter = threeCenter;
window.gizmoScene = gizmoScene;
window.gizmoCamera = gizmoCamera;
window.raycaster = raycaster;
window.mouse = mouse;
window.digitizedFeatures = digitizedFeatures;
window.featureCounter = featureCounter;
window.selectedFeatureId = selectedFeatureId;
window.isDigitizing = isDigitizing;
window.isSettingCenter = isSettingCenter;
window.filterState = filterState;
window.currentPoints = currentPoints;
window.currentPlaneCorners = currentPlaneCorners;
window.currentPointsObj = currentPointsObj;
window.currentLineMesh = currentLineMesh;
window.currentPlaneMesh = currentPlaneMesh;
window.currentPlaneWireframe = currentPlaneWireframe;
window.wasDragging = wasDragging;
window.mouseDownPos = mouseDownPos;
window.initialQuaternion = initialQuaternion;
window.pythonOffset = pythonOffset;
window.activePointsMat = activePointsMat;
window.rawSensorData = rawSensorData;
window.liveSensorData = liveSensorData;
window.sensorsActive = sensorsActive;

console.log("✅ All global variables exposed from 01-core-scene.js");
