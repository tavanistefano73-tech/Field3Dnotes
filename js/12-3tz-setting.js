// Configurazione dei preset per 3D Tiles / 3TZ
const PERFORMANCE_PRESETS = {
    low: {
        minSize: 30,
        maxSize: 100,
        errorTarget: 16.0,
        maxTextureSize: 2048,
        unloadPercent: 1.0
    },
    mid: {
        minSize: 70,
        maxSize: 400,
        errorTarget: 12.0,
        maxTextureSize: 4096,
        unloadPercent: 0.8
    },
    high: {
        minSize: 150,
        maxSize: 1000,
        errorTarget: 6.0,
        maxTextureSize: 8192,
        unloadPercent: 0.6
    },
    ultra: {
        minSize: 300,
        maxSize: 3000,
        errorTarget: 6.0,
        maxTextureSize: 8192,
        unloadPercent: 0.5
    }
};

window.currentPerfPreset = 'mid';
window.vramUpdateInterval = null;

/**
 * Applica i parametri del preset al TilesRenderer ed eventualmente al LRUCache
 */
window.setPerformancePreset = function(presetKey) {
    const config = PERFORMANCE_PRESETS[presetKey];
    if (!config) return;

    window.currentPerfPreset = presetKey;

    // Recupera l'istanza attiva già presente in window.active3dTiles o window.tilesRenderer
    const tiles = window.active3dTiles || window.tilesRenderer;

    if (tiles) {
        // 1. Assegna il Geometric Error (errorTarget)
        if ('errorTarget' in tiles) {
            tiles.errorTarget = config.errorTarget;
        }

        // 2. Aggiorna i limiti della LRU Cache
        if (tiles.lruCache) {
            if ('minSize' in tiles.lruCache) tiles.lruCache.minSize = config.minSize;
            if ('maxSize' in tiles.lruCache) tiles.lruCache.maxSize = config.maxSize;
            if ('unloadPercent' in tiles.lruCache) tiles.lruCache.unloadPercent = config.unloadPercent;
        }

        // 3. Forziamo l'aggiornamento per applicare il cambio di dettaglio alle tessere visibili
        if (typeof tiles.update === 'function' && window.camera) {
            tiles.update();
        }
    }

    // Aggiorna l'interfaccia visiva dei bottoni
    updatePresetButtonsUI(presetKey);

    // Calcola subito la VRAM se la funzione esiste
    if (typeof window.updateVRAMStats === 'function') {
        window.updateVRAMStats();
    }
};

/**
 * Calcola il consumo VRAM di geometrie e texture nella scena
 */
window.updateVRAMStats = function() {
    if (!window.scene) return;

    let totalGeomBytes = 0;
    let totalTexBytes = 0;
    const trackedTextures = new Set();
    const trackedGeometries = new Set();

    window.scene.traverse((object) => {
        if (!object.isMesh) return;

        // Calcolo Geometria
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

        // Calcolo Texture
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

/**
 * Gestisce l'apertura/chiusura del menu ed aziona il timer solo se espanso
 */
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

/**
 * Evidenzia visivamente il pulsante selezionato nell'interfaccia
 */
function updatePresetButtonsUI(activePreset) {
    const container = document.getElementById('vram-accordion-content');
    if (!container) return;

    const buttons = container.querySelectorAll('.vram-btn-compact');
    buttons.forEach(btn => {
        const btnPreset = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (btnPreset === activePreset) {
            btn.classList.add('active');
            btn.style.background = '#1D9E75';
            btn.style.borderColor = '#1D9E75';
            btn.style.color = '#fff';
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        }
    });
}
window.setPerformancePreset = function(presetKey) {
    const config = PERFORMANCE_PRESETS[presetKey];
    if (!config) return;

    window.currentPerfPreset = presetKey;
    const tiles = window.active3dTiles || window.tilesRenderer;

    if (tiles) {
        // 1. Applica i parametri del preset
        tiles.errorTarget = config.errorTarget;

        if (tiles.lruCache) {
            tiles.lruCache.minSize = config.minSize;
            tiles.lruCache.maxSize = config.maxSize;
            if ('unloadPercent' in tiles.lruCache) tiles.lruCache.unloadPercent = config.unloadPercent;
            
            // 2. FORZA lo scaricamento immediato dei nodi in eccesso
            if (typeof tiles.lruCache.scheduleUnload === 'function') {
                tiles.lruCache.scheduleUnload();
            }
        }

        // 3. Ricalcola le tessere visibili per la telecamera corrente
        if (window.camera && typeof tiles.update === 'function') {
            tiles.update();
        }
    }

    updatePresetButtonsUI(presetKey);

    // 4. Aggiorna le statistiche VRAM dopo un breve delay per far elaborare la rimozione a Three.js
    setTimeout(() => {
        if (typeof window.updateVRAMStats === 'function') {
            window.updateVRAMStats();
        }
    }, 100);
};

// Funzione di calcolo preciso VRAM basata solo sui nodi attivi in scena
window.calculate3dDTilesVRAM = function() {
    const tiles = window.active3dTiles || window.tilesRenderer;
    if (!tiles || !tiles.group) return 0;

    let totalBytes = 0;

    tiles.group.traverse((node) => {
        if (node.isMesh && node.geometry) {
            const geo = node.geometry;
            for (const key in geo.attributes) {
                const attr = geo.attributes[key];
                if (attr && attr.array) {
                    totalBytes += attr.array.byteLength;
                }
            }
            if (geo.index && geo.index.array) {
                totalBytes += geo.index.array.byteLength;
            }
        }
    });

    return (totalBytes / (1024 * 1024)).toFixed(2); // Restituisce i MB effettivi in VRAM
};
