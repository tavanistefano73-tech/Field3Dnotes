function updateUI() {
    const nodeCnt = document.getElementById('node-count');
    if (nodeCnt) nodeCnt.textContent = currentPoints.length;
}

// =================================================================
// CONTROLLO FPS (30 FPS per ridurre del 50% il carico GPU/Batteria)
// =================================================================
window.fpsOptions = [10, 20, 40, 60];
window.currentFpsIndex = 1; // Inizia a 20 (indice 1)
window.currentFPS = window.fpsOptions[window.currentFpsIndex];

window.toggleFPSValue = function() {
    // Passa al prossimo valore (ciclicamente)
    window.currentFpsIndex = (window.currentFpsIndex + 1) % window.fpsOptions.length;
    window.currentFPS = window.fpsOptions[window.currentFpsIndex];
    
    // Aggiorna il pulsante
    const btn = document.getElementById('btn-toggle-fps');
    if (btn) {
        btn.innerText = `⏱️ FPS: ${window.currentFPS}`;
    }
};

const getFrameInterval = () => (1000 / window.currentFPS);

let lastFrameTime = performance.now();

function animate(currentTime) {
    requestAnimationFrame(animate);

    // Salta il rendering se non sono trascorsi ~33 ms dall'ultimo frame
    const delta = currentTime - lastFrameTime;
    const FRAME_INTERVAL = getFrameInterval();
        if (delta < FRAME_INTERVAL) return;
        lastFrameTime = currentTime - (delta % FRAME_INTERVAL);

    // --- AGGIORNAMENTO CONTROLLI E SCENA ---
    if (typeof controls !== 'undefined' && controls) {
        controls.update();
    }

    if (window.active3dTiles) {
        camera.updateMatrixWorld();
        window.active3dTiles.update();
    }

    if (typeof updateSpotDisksScale === 'function') {
        updateSpotDisksScale();
    }
    if (typeof updateNoteMarkersScale === 'function') {
        updateNoteMarkersScale();
    }

    // --- RENDERING SCENA PRINCIPALE ---
    const renderWidth = window.innerWidth;
    const renderHeight = window.innerHeight;

    renderer.autoClear = false;
    renderer.clear();
    renderer.setViewport(0, 0, renderWidth, renderHeight);
    renderer.render(scene, camera);

    // --- RENDERING GIZMO (con verifica di sicurezza su controls.target) ---
    if (typeof controls !== 'undefined' && controls && controls.target) {
        const camDir = new THREE.Vector3().subVectors(camera.position, controls.target);
        if (camDir.lengthSq() > 0) {
            camDir.setLength(3.8);
            gizmoCamera.position.copy(camDir);
            gizmoCamera.lookAt(0, 0, 0);
        }
    }

    const gizmoSize = 120, margin = 10;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(renderWidth - gizmoSize - margin, margin, gizmoSize, gizmoSize);
    renderer.setViewport(renderWidth - gizmoSize - margin, margin, gizmoSize, gizmoSize);
    renderer.render(gizmoScene, gizmoCamera);
    renderer.setScissorTest(false);
}

// Avvio ciclo temporizzato
requestAnimationFrame(animate);

// Ridimensionamento Finestra
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const stereonetWin = document.getElementById('stereonet-window');
    if (stereonetWin && stereonetWin.classList.contains('show') && typeof drawStereonet === 'function') {
        drawStereonet();
    }
});

// Gestione Memoria VRAM
window.vramUpdateInterval = null;

window.updateVRAMStats = function() {
    if (!window.scene) return;

    let totalGeomBytes = 0;
    let totalTexBytes = 0;
    const trackedTextures = new Set();
    const trackedGeometries = new Set();

    window.scene.traverse((object) => {
        if (!object.isMesh) return;

        if (object.geometry && !trackedGeometries.has(object.geometry.id)) {
            trackedGeometries.add(object.geometry.id);
            const geom = object.geometry;

            for (const name in geom.attributes) {
                const attribute = geom.attributes[name];
                if (attribute && attribute.array) {
                    totalGeomBytes += attribute.array.byteLength;
                }
            }

            if (geom.index && geom.index.array) {
                totalGeomBytes += geom.index.array.byteLength;
            }
        }

        if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];

            materials.forEach((mat) => {
                for (const key in mat) {
                    const prop = mat[key];
                    if (prop && prop.isTexture && prop.image && !trackedTextures.has(prop.id)) {
                        trackedTextures.add(prop.id);
                        
                        const width = prop.image.width || prop.image.videoWidth || 0;
                        const height = prop.image.height || prop.image.videoHeight || 0;
                        
                        let texBytes = width * height * 4;

                        if (prop.generateMipmaps) {
                            texBytes *= 1.333;
                        }

                        totalTexBytes += texBytes;
                    }
                }
            });
        }
    });

    const geomMB = (totalGeomBytes / (1024 * 1024)).toFixed(1);
    const texMB = (totalTexBytes / (1024 * 1024)).toFixed(1);
   
    const geomElem = document.getElementById('stat-geometries');
    const texElem = document.getElementById('stat-textures');
   
    if (geomElem) geomElem.textContent = `${geomMB} MB`;
    if (texElem) texElem.textContent = `${texMB} MB`;
};

window.toggleVRAMAccordion = function() {
    const content = document.getElementById('vram-accordion-content');
    const arrow = document.getElementById('vram-accordion-arrow');
    
    if (!content || !arrow) return;

    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(90deg)';
        
        window.updateVRAMStats();
        
        if (!window.vramUpdateInterval) {
            window.vramUpdateInterval = setInterval(window.updateVRAMStats, 1500);
        }
    } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
        
        if (window.vramUpdateInterval) {
            clearInterval(window.vramUpdateInterval);
            window.vramUpdateInterval = null;
        }
    }
};

window.setPerformancePreset = function(presetKey) {
    const tiles = window.active3dTiles || window.tilesRenderer;
    if (!tiles) return;

    if (typeof PERFORMANCE_PRESETS === 'undefined') return;

    const preset = PERFORMANCE_PRESETS[presetKey] || PERFORMANCE_PRESETS.mid;

    tiles.errorTarget = preset.errorTarget;

    if (tiles.lruCache) {
        tiles.lruCache.minSize = preset.minSize;
        tiles.lruCache.maxSize = preset.maxSize;
        if ('unloadPercent' in tiles.lruCache) {
            tiles.lruCache.unloadPercent = preset.unloadPercent;
        }
    }

    if (tiles.group) {
        tiles.group.traverse((object) => {
            if (object.isMesh && object.material) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach((mat) => {
                    for (const key in mat) {
                        const prop = mat[key];
                        if (prop && prop.isTexture && typeof downscaleTexture === 'function') {
                            downscaleTexture(prop, preset.maxTextureSize);
                        }
                    }
                });
            }
        });
    }
};
