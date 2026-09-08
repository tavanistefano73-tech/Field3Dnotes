window.isDeviceFaceDown = false;

window.addEventListener('devicemotion', function(event) {
    if (event.accelerationIncludingGravity) {
        // Su iOS, accelerationIncludingGravity.z è POSITIVO quando lo schermo guarda in basso
        window.isDeviceFaceDown = event.accelerationIncludingGravity.z > 0;
    }
}, true);


/// ==========================================
// 10-LIDAR.JS (STANDALONE SENSOR BRIDGE + LIDAR ARKIT)
// ==========================================

window.isLiDARAvailable = false;
window.activeLiDARInputTarget = null;

// Calcola Rake, Trend e Plunge dalla vista 3D se assenti dai dati nativi iOS
function getCameraGeologicalFallback() {
    const cam = window.camera || (typeof camera !== 'undefined' ? camera : null);
    if (!cam || typeof THREE === 'undefined') return { rake: 90, trend: 0, plunge: 0 };

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);

    // Plunge: inclinazione della vista [0°..90°]
    const plungeRad = Math.asin(Math.min(1.0, Math.max(-1.0, Math.abs(dir.y || dir.z || 0))));
    const plungeDeg = Math.round(plungeRad * (180 / Math.PI));

    // Trend: Azimut della vista [0°..360°]
    let trendRad = Math.atan2(dir.x, dir.z || dir.y || 1);
    let trendDeg = Math.round(trendRad * (180 / Math.PI));
    if (trendDeg < 0) trendDeg += 360;

    const rakeDeg = Math.min(90, Math.max(0, plungeDeg));

    return { rake: rakeDeg, trend: trendDeg, plunge: plungeDeg };
}




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


