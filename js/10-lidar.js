// ==========================================
// 10-LIDAR.JS (STANDALONE SENSOR BRIDGE + LIDAR ARKIT)
// ==========================================

window.isLiDARAvailable = false;
window.activeLiDARInputTarget = null;

// Calcola Rake, Trend e Plunge dalla vista 3D se assenti dai dati nativi iOS
function getCameraGeologicalFallback() {
    const cam = window.camera || (typeof camera !== 'undefined' ? camera : null);
    if (!cam) return { rake: 90, trend: 0, plunge: 0 };

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);

    // Plunge: inclinazione della vista [0°..90°]
    const plungeRad = Math.asin(Math.min(1.0, Math.max(-1.0, Math.abs(dir.z))));
    const plungeDeg = Math.round(plungeRad * (180 / Math.PI));

    // Trend: Azimut della vista [0°..360°]
    let trendRad = Math.atan2(dir.x, dir.y);
    let trendDeg = Math.round(trendRad * (180 / Math.PI));
    if (trendDeg < 0) trendDeg += 360;

    const rakeDeg = Math.min(90, Math.max(0, plungeDeg));

    return { rake: rakeDeg, trend: trendDeg, plunge: plungeDeg };
}

// 1. Riceve i dati in tempo reale dai sensori nativi iOS (Bussola/Inclinometro)
window.handleNativeSensors = function(strike, dipDir, dip, rake, trend, plunge) {
    const strikeEl = document.getElementById('sensor-strike');
    const dipdirEl = document.getElementById('sensor-dipdir');
    const dipEl = document.getElementById('sensor-dip');
    const rakeEl = document.getElementById('sensor-rake');
    const trendEl = document.getElementById('sensor-trend');
    const plungeEl = document.getElementById('sensor-plunge');

    // Valori principali del piano
    const safeStrike = (strike !== undefined && strike !== null) ? strike : 0;
    const safeDipDir = (dipDir !== undefined && dipDir !== null) ? dipDir : 0;
    const safeDip = (dip !== undefined && dip !== null) ? dip : 0;

    if (strikeEl) strikeEl.innerText = safeStrike + '°';
    if (dipdirEl) dipdirEl.innerText = safeDipDir + '°';
    if (dipEl) dipEl.innerText = safeDip + '°';

    // Fallback integrato se Swift non trasmette Rake, Trend o Plunge
    const camFallback = getCameraGeologicalFallback();
    const safeRake = (rake !== undefined && rake !== null) ? rake : camFallback.rake;
    const safeTrend = (trend !== undefined && trend !== null) ? trend : camFallback.trend;
    const safePlunge = (plunge !== undefined && plunge !== null) ? plunge : camFallback.plunge;

    if (rakeEl) rakeEl.innerText = safeRake + '°';
    if (trendEl) trendEl.innerText = safeTrend + '°';
    if (plungeEl) plungeEl.innerText = safePlunge + '°';

    // Sincronizzazione campi di input form
    const inputStrike = document.getElementById('input-strike');
    const inputDipDir = document.getElementById('input-dipdir');
    const inputDip = document.getElementById('input-dip');
    const inputRake = document.getElementById('input-rake');
    const inputTrend = document.getElementById('input-trend');
    const inputPlunge = document.getElementById('input-plunge');

    if (inputStrike) inputStrike.value = safeStrike;
    if (inputDipDir) inputDipDir.value = safeDipDir;
    if (inputDip) inputDip.value = safeDip;
    if (inputRake) inputRake.value = safeRake;
    if (inputTrend) inputTrend.value = safeTrend;
    if (inputPlunge) inputPlunge.value = safePlunge;

    // Sincronizzazione dello stato globale sensori
    window.liveSensorData = {
        strike: safeStrike,
        dipDir: safeDipDir,
        dip: safeDip,
        rake: safeRake,
        trend: safeTrend,
        plunge: safePlunge
    };
};

// 2. Callback invocata da Swift per confermare la presenza del LiDAR
window.setLiDARSupport = function(supported) {
    console.log("LiDAR support status received from Swift:", supported);
    window.isLiDARAvailable = !!supported;
};

// 3. Avvia la misurazione nativa ARKit per un campo custom della tabella
function measureWithLiDAR(buttonElement) {
    if (!window.isLiDARAvailable) {
        console.warn("LiDAR sensor is not available on this device.");
        return;
    }

    const row = buttonElement.closest('.custom-field-row');
    if (row) {
        window.activeLiDARInputTarget = row.querySelector('.custom-val-input');
    }

    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.startARMeasure) {
        window.webkit.messageHandlers.startARMeasure.postMessage({});
    }
}

// 4. Callback che riceve la misura da ARKit (Swift) e la inserisce nell'input del Custom Field
window.onLiDARMeasurementComplete = function(distanceString) {
    console.log("Distance received from ARKit:", distanceString);
    
    if (window.activeLiDARInputTarget) {
        window.activeLiDARInputTarget.value = distanceString;
        window.activeLiDARInputTarget = null;
    }
};

// 5. Verifica disponibilità LiDAR all'avvio dell'applicazione
document.addEventListener("DOMContentLoaded", function() {
    setTimeout(function() {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.checkLiDARSupport) {
            window.webkit.messageHandlers.checkLiDARSupport.postMessage({});
        }
    }, 100);
});


