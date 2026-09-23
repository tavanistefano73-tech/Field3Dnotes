function recenterScene() {
    
    if (!loadedMesh) {
        camera.position.set(10, 10, 10);
        controls.target.set(0, 0, 0);
        controls.update();
        return;
    }
    const box = new THREE.Box3().setFromObject(loadedMesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 10;

    camera.position.set(maxDim * 1.3, maxDim * 1.3, maxDim * 1.3);
    controls.target.set(0, 0, 0);
    controls.update();

    document.getElementById('status').textContent = 'View recentered 🎯';
    document.getElementById('status').style.color = '#1D9E75';
}




function safeDispose(obj) {
    if (!obj) return;
    scene.remove(obj);
    obj.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                ['map', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap'].forEach(k => {
                    if (m[k]) m[k].dispose();
                });
                m.dispose();
            });
        }
    });
}

// ==========================================
// 5. SCENE AND MEMORY RESET (02-scene-interaction.js)
// ==========================================

function resetSceneAndState() {
  // 1. Removes and frees GPU memory for all digitized meshes
  if (typeof digitizedGroup !== "undefined" && digitizedGroup) {
    digitizedGroup.traverse((child) => {
      if (child.isMesh || child.isLine || child.isPoints) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    digitizedGroup.clear(); // Clears the Three.js group
  }

  // 2. Resets the feature state array in memory
  if (typeof appState !== "undefined" && appState) {
    appState.features = [];
  }
}

window.toggleClipPopup = function(event) {
    if (event) {
        event.stopPropagation();
    }
    const el = document.getElementById('clipping-ui');
    if (!el) return;
    const isHidden = window.getComputedStyle(el).display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
};

window.updateCameraClipping = function() {
    if (typeof camera === 'undefined' || !camera) return;

    const nearVal = parseFloat(document.getElementById('input-near').value) || 0.1;
    const farVal = parseFloat(document.getElementById('input-far').value) || 2000;

    camera.near = nearVal;
    camera.far = farVal;
    
    camera.updateProjectionMatrix();
};

function toggleRotateMenu() {
    const select = document.getElementById('input-crs');
    const crsValue = select ? select.value : 'Local';
    const isLocal = crsValue.toLowerCase().includes('local');

    if (!isLocal) {
        alert("Georeferenced models cannot be rotated.");
        return;
    }

    const menu = document.getElementById('rotate-model-menu');
    if (menu) {
        const isHidden = (menu.style.display === 'none' || menu.style.display === '');
        menu.style.display = isHidden ? 'flex' : 'none';
    }
}

function syncAndRotateModel(val, source) {
    let degrees = parseFloat(val);
    
    if (isNaN(degrees)) degrees = 0;
    if (degrees < 0) degrees = 0;
    if (degrees > 360) degrees = 360;

    const slider = document.getElementById('rotate-slider');
    const numInput = document.getElementById('rotate-num-input');

    if (source === 'slider' && numInput) {
        numInput.value = degrees;
    } else if (source === 'input' && slider) {
        slider.value = degrees;
    }

    applyModelRotation(degrees);
}

function applyModelRotation(degrees) {
    if (typeof loadedMesh === 'undefined' || !loadedMesh) return;

    if (!initialQuaternion) {
        initialQuaternion = loadedMesh.quaternion.clone();
    }

    const radians = (degrees * Math.PI) / 180.0;
    loadedMesh.quaternion.copy(initialQuaternion);

    const rotationQuaternion = new THREE.Quaternion();
    rotationQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), radians);

    loadedMesh.quaternion.premultiply(rotationQuaternion);

    if (typeof render === 'function') {
        render();
    }
}
// Imposta il nuovo centro di rotazione tramite doppio clic / doppio tap sul punto del modello
(function initDoubleTapSetCenter() {
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    function setCenterFromCoords(clientX, clientY) {
        if (!loadedMesh || typeof raycaster === 'undefined' || typeof camera === 'undefined') return;

        const container = document.getElementById('canvas-container');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        
        // Converti le coordinate dello schermo in coordinate Normalizzate Device (-1 a +1)
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(loadedMesh, true);

        if (intersects.length > 0) {
            controls.target.copy(intersects[0].point);
            controls.update();
            
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.textContent = 'New center set ✓';
                statusEl.style.color = '#1D9E75';
            }
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('canvas-container');
        if (!container) return;

        // 1. Doppio clic da Desktop
        container.addEventListener('dblclick', (e) => {
            setCenterFromCoords(e.clientX, e.clientY);
        });

        // 2. Doppio tap da Mobile
        container.addEventListener('touchend', (e) => {
            if (e.changedTouches.length !== 1) return;

            const touch = e.changedTouches[0];
            const now = Date.now();
            const timeDiff = now - lastTapTime;
            const dist = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);

            if (timeDiff > 0 && timeDiff < 300 && dist < 30) {
                setCenterFromCoords(touch.clientX, touch.clientY);
                lastTapTime = 0;
            } else {
                lastTapTime = now;
                lastTapX = touch.clientX;
                lastTapY = touch.clientY;
            }
        });
    });
})();
window.syncAndRotateModel = syncAndRotateModel;
window.applyModelRotation = applyModelRotation;


// ==================== DISTANCE MEASURE TOOL ====================
let isMeasuring = false;
let measurePoints = [];
let measureMarkers = [];
let measureLine = null;
let measureLabelEl = null;

// Tracciamento posizione iniziale per distinguere il Tap (misura) dal Drag (rotazione vista)
let measureStartX = 0;
let measureStartY = 0;

window.addEventListener('pointerdown', (e) => {
    measureStartX = e.clientX;
    measureStartY = e.clientY;
}, false);

window.addEventListener('pointerup', handleMeasurePointerUp, false);

function toggleMeasureTool(event) {
    // Blocca la propagazione per non registrare il click sul pulsante come punto 3D
    if (event) event.stopPropagation();

    isMeasuring = !isMeasuring;
    clearMeasurement();

    const btn = document.getElementById('btn-measure');
    if (btn) {
        btn.classList.toggle('active', isMeasuring);
    }

    const statusMsg = isMeasuring
        ? "Measure mode active: Tap the first point on the mesh..."
        : "Measure tool deactivated";
    if (typeof updateStatus === 'function') {
        updateStatus(statusMsg, isMeasuring ? '#ffc107' : '#17a2b8');
    }
}

function handleMeasurePointerUp(event) {
    if (!isMeasuring || !loadedMesh) return;

    // Ignora i tap su pulsanti o elementi della barra UI
    if (event.target.closest('#bottom-bar') ||
        event.target.closest('#top-bar') ||
        event.target.closest('#bottom-left-controls') ||
        event.target.closest('#top-right-container') ||
        event.target.closest('#ui') ||
        event.target.tagName === 'BUTTON' ||
        event.target.tagName === 'SELECT' ||
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'LABEL') {
        return;
    }

    // Se lo spostamento del dito/mouse è > 8px, è una rotazione/pan della telecamera, non un tap
    const dist = Math.hypot(event.clientX - measureStartX, event.clientY - measureStartY);
    if (dist > 8) return;

    // Normalizzazione coordinate rispetto al canvas
    const canvas = (window.renderer && window.renderer.domElement) ? window.renderer.domElement : null;
    const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(loadedMesh, true);

    if (intersects.length > 0) {
        const hitPoint = intersects[0].point.clone();

        if (measurePoints.length === 2) {
            clearMeasurement();
        }

        measurePoints.push(hitPoint);
        addMeasureMarker(hitPoint);

        if (measurePoints.length === 1) {
            if (typeof updateStatus === 'function') {
                updateStatus("First point selected. Tap the second point...", '#ffc107');
            }
        } else if (measurePoints.length === 2) {
            const p1 = measurePoints[0];
            const p2 = measurePoints[1];
            const distance = p1.distanceTo(p2);

            drawMeasureLine(p1, p2);
            displayMeasureResult(p1, p2, distance);

            if (typeof updateStatus === 'function') {
                updateStatus(`Measured distance: ${distance.toFixed(2)} m`, '#28a745');
            }
        }
    }
}

function drawMeasureLine(p1, p2) {
    if (measureLine) {
        scene.remove(measureLine);
        measureLine.geometry.dispose();
    }

    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const material = new THREE.LineBasicMaterial({
        color: 0xff3333,
        linewidth: 15,
        depthTest: false
    });

    measureLine = new THREE.Line(geometry, material);
    measureLine.renderOrder = 999;
    scene.add(measureLine);
}

function addMeasureMarker(point) {
    // Geometria con un singolo vertice
    const geometry = new THREE.BufferGeometry().setFromPoints([point]);

    // Materiale per punti con dimensione fissa in PIXEL
    const material = new THREE.PointsMaterial({
        color: 0xffff00,
        size: 8,                    // Dimensione fissa in pixel sullo schermo
        sizeAttenuation: false,     // Impedisce che il punto rimpicciolisca allontanandosi
        depthTest: false
    });

    const marker = new THREE.Points(geometry, material);
    marker.renderOrder = 1000;

    scene.add(marker);
    measureMarkers.push(marker);
}

function displayMeasureResult(p1, p2, distance) {
    if (measureLabelEl) measureLabelEl.remove();

    measureLabelEl = document.createElement('div');
    measureLabelEl.className = 'measure-result-label';
    measureLabelEl.style.position = 'absolute';
    measureLabelEl.style.bottom = '50px';
    measureLabelEl.style.right = '20px';
    measureLabelEl.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    measureLabelEl.style.color = '#00ffcc';
    measureLabelEl.style.padding = '8px 14px';
    measureLabelEl.style.borderRadius = '6px';
    measureLabelEl.style.fontFamily = 'inherit';
    measureLabelEl.style.fontSize = '13px';
    measureLabelEl.style.border = '1px solid #00ffcc';
    measureLabelEl.style.zIndex = '10000';
    measureLabelEl.innerHTML = `📏 Distance: <b>${distance.toFixed(2)} m</b>`;

    document.body.appendChild(measureLabelEl);
}

function clearMeasurement() {
    measurePoints = [];

    measureMarkers.forEach(m => {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
    });
    measureMarkers = [];

    if (measureLine) {
        scene.remove(measureLine);
        measureLine.geometry.dispose();
        measureLine.material.dispose();
        measureLine = null;
    }

    if (measureLabelEl) {
        measureLabelEl.remove();
        measureLabelEl = null;
    }
}
