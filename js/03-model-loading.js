const DRACO_LOCAL_PATH = new URL('js/libs/draco/', window.location.href).href;

/**
 * 03-model-loading.js
 * Modulo per il caricamento dei modelli 3D.
 * Gestisce l'importazione di file OBJ (con streaming worker inline), GLB/GLTF, PLY, 3TZ e SKETCHFAB.
 */

const CHUNK_SIZE_OBJ = 16 * 1024 * 1024; // 16 MB per chunk

/**
 * Caricamento OBJ Streaming con TextDecoder in Worker Inline.
 * Gestisce vertici, coordinate UV e indici delle facce senza saturare la memoria.
 */
/**
 * Caricamento OBJ Streaming con supporto Texture.
 */
/**
 * Caricamento OBJ Streaming con supporto Multi-Texture e MTL sincrono.
 */
async function loadOBJModel(mainFile, fileMap = {}) {
    if (!mainFile) return;

    let offset = 0;
    const fileSize = mainFile.size;

    // 1. Mappa normale per la ricerca case-insensitive dei file caricati
    const normalizedFileMap = {};
    for (const rawName in fileMap) {
        const cleanName = rawName.replace(/\\/g, '/').split('/').pop().toLowerCase();
        normalizedFileMap[cleanName] = fileMap[rawName];
    }

    // 2. Lettura e isolamento del file MTL prima dell'avvio del Worker
    const materialsMap = {};
    let mtlFile = null;

    for (const fileName in normalizedFileMap) {
        if (fileName.endsWith('.mtl')) {
            mtlFile = normalizedFileMap[fileName];
            break;
        }
    }

    if (mtlFile) {
        try {
            const mtlText = await mtlFile.text();
            const mtlLines = mtlText.split('\n');
            let currentMtl = null;
            const texturePromises = [];

            for (let line of mtlLines) {
                line = line.trim();
                if (line.startsWith('newmtl ')) {
                    currentMtl = line.substring(7).trim();
                } else if ((line.startsWith('map_Kd ') || line.startsWith('map_kd ')) && currentMtl) {
                    const rawTexPath = line.substring(7).trim().replace(/"/g, '');
                    const texName = rawTexPath.replace(/\\/g, '/').split('/').pop().toLowerCase();

                    if (normalizedFileMap[texName]) {
                        const targetMtl = currentMtl;
                        const blobUrl = URL.createObjectURL(normalizedFileMap[texName]);
                        
                        // Promise per attendere il caricamento della texture prima del rendering
                        const texPromise = new Promise((resolve) => {
                            new THREE.TextureLoader().load(blobUrl, (texture) => {
                                texture.encoding = THREE.sRGBEncoding;
                                texture.wrapS = THREE.RepeatWrapping;
                                texture.wrapT = THREE.RepeatWrapping;
                                if (typeof downscaleTexture === 'function') downscaleTexture(texture, 4096);
                                
                                materialsMap[targetMtl] = new THREE.MeshStandardMaterial({
                                    map: texture,
                                    color: 0xffffff,
                                    roughness: 0.6,
                                    metalness: 0.1,
                                    side: THREE.DoubleSide
                                });
                                URL.revokeObjectURL(blobUrl);
                                resolve();
                            }, undefined, () => {
                                console.warn("Errore caricamento texture:", texName);
                                URL.revokeObjectURL(blobUrl);
                                resolve();
                            });
                        });
                        texturePromises.push(texPromise);
                    }
                }
            }
            // Attende la risoluzione di tutte le immagini MTL prima di iniziare il Worker
            await Promise.all(texturePromises);
        } catch (err) {
            console.error("Errore lettura MTL:", err);
        }
    }

    const defaultMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.6,
        metalness: 0.1,
        side: THREE.DoubleSide
    });

    // 3. Worker Inline esteso
    const workerCode = `
        let rawPositions = [];
        let rawUVs = [];

        let meshGroups = {}; 
        let currentMaterial = "default";

        let remainder = "";
        let detectedCRS = null;
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        const decoder = new TextDecoder('utf-8');

        self.onmessage = function (e) {
            const data = e.data;

            if (data.action === 'PARSE_CHUNK') {
                const textChunk = remainder + decoder.decode(data.buffer, { stream: true });
                const lastNewLine = textChunk.lastIndexOf('\\n');

                if (lastNewLine === -1) {
                    remainder = textChunk;
                    self.postMessage({ action: 'NEXT_CHUNK' });
                    return;
                }

                const validText = textChunk.substring(0, lastNewLine);
                remainder = textChunk.substring(lastNewLine + 1);
                const lines = validText.split('\\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line || line.startsWith('#')) {
                        if (!detectedCRS && line.startsWith('#')) {
                            const match = line.match(/EPSG:\\d+/i) || line.match(/CRS:\\s*([\\w:]+)/i);
                            if (match) detectedCRS = match[0].toUpperCase().replace("CRS:", "").trim();
                        }
                        continue;
                    }

                    if (line.startsWith('usemtl ')) {
                        currentMaterial = line.substring(7).trim();
                        if (!meshGroups[currentMaterial]) {
                            meshGroups[currentMaterial] = { positions: [], uvs: [] };
                        }
                    }
                    else if (line.startsWith('v ')) {
                        const parts = line.split(/\\s+/);
                        if (parts.length >= 4) {
                            const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
                            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                                rawPositions.push(x, y, z);
                                if (x < minX) minX = x; if (x > maxX) maxX = x;
                                if (y < minY) minY = y; if (y > maxY) maxY = y;
                                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                            }
                        }
                    }
                    else if (line.startsWith('vt ')) {
                        const parts = line.split(/\\s+/);
                        if (parts.length >= 3) {
                            const u = parseFloat(parts[1]), v = parseFloat(parts[2]);
                            if (!isNaN(u) && !isNaN(v)) rawUVs.push(u, v);
                        }
                    }
                    else if (line.startsWith('f ')) {
                        if (!meshGroups[currentMaterial]) {
                            meshGroups[currentMaterial] = { positions: [], uvs: [] };
                        }
                        const targetGroup = meshGroups[currentMaterial];

                        const parts = line.split(/\\s+/);
                        const vIndices = [];
                        const vtIndices = [];

                        for (let j = 1; j < parts.length; j++) {
                            const segs = parts[j].split('/');
                            const vIdx = parseInt(segs[0], 10) - 1;
                            const vtIdx = segs[1] ? parseInt(segs[1], 10) - 1 : -1;

                            if (!isNaN(vIdx) && vIdx >= 0) vIndices.push(vIdx);
                            if (!isNaN(vtIdx) && vtIdx >= 0) vtIndices.push(vtIdx);
                        }

                        for (let j = 1; j < vIndices.length - 1; j++) {
                            const i0 = vIndices[0], i1 = vIndices[j], i2 = vIndices[j + 1];

                            if (i0 * 3 + 2 < rawPositions.length && i1 * 3 + 2 < rawPositions.length && i2 * 3 + 2 < rawPositions.length) {
                                targetGroup.positions.push(
                                    rawPositions[i0 * 3], rawPositions[i0 * 3 + 1], rawPositions[i0 * 3 + 2],
                                    rawPositions[i1 * 3], rawPositions[i1 * 3 + 1], rawPositions[i1 * 3 + 2],
                                    rawPositions[i2 * 3], rawPositions[i2 * 3 + 1], rawPositions[i2 * 3 + 2]
                                );

                                if (vtIndices.length >= vIndices.length) {
                                    const u0 = vtIndices[0], u1 = vtIndices[j], u2 = vtIndices[j + 1];
                                    targetGroup.uvs.push(
                                        rawUVs[u0 * 2], rawUVs[u0 * 2 + 1],
                                        rawUVs[u1 * 2], rawUVs[u1 * 2 + 1],
                                        rawUVs[u2 * 2], rawUVs[u2 * 2 + 1]
                                    );
                                }
                            }
                        }
                    }
                }
                self.postMessage({ action: 'NEXT_CHUNK' });
            } 
            else if (data.action === 'FINISH') {
                const cx = (minX + maxX) / 2.0;
                const cy = (minY + maxY) / 2.0;
                const cz = (minZ + maxZ) / 2.0;

                const resultGroups = {};
                const transferables = [];

                for (const mtlName in meshGroups) {
                    const group = meshGroups[mtlName];
                    if (group.positions.length === 0) continue;

                    const posArray = new Float32Array(group.positions.length);
                    for (let i = 0; i < group.positions.length; i += 3) {
                        posArray[i]     = group.positions[i] - cx;
                        posArray[i + 1] = group.positions[i + 1] - cy;
                        posArray[i + 2] = group.positions[i + 2] - cz;
                    }

                    const uvArray = group.uvs.length > 0 ? new Float32Array(group.uvs) : null;
                    transferables.push(posArray.buffer);
                    if (uvArray) transferables.push(uvArray.buffer);

                    resultGroups[mtlName] = {
                        positions: posArray.buffer,
                        uvs: uvArray ? uvArray.buffer : null
                    };
                }

                self.postMessage({
                    action: 'COMPLETE',
                    groups: resultGroups,
                    center: [cx, cy, cz],
                    detectedCRS: detectedCRS
                }, transferables);
            }
        };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    if (typeof showLoadingProgress === 'function') showLoadingProgress(0);

    worker.onmessage = async function (e) {
        const data = e.data;

        if (data.action === 'NEXT_CHUNK') {
            const progress = Math.min(100, Math.round((offset / fileSize) * 100));
            if (typeof showLoadingProgress === 'function') showLoadingProgress(progress);
            readNextChunk(mainFile, worker);
        }
        else if (data.action === 'COMPLETE') {
            URL.revokeObjectURL(workerUrl);
            if (typeof hideLoadingProgress === 'function') hideLoadingProgress();

            const center = data.center;

            if (data.detectedCRS && typeof populateCRSDropdown === 'function') {
                populateCRSDropdown(data.detectedCRS);
            } else if (typeof populateCRSDropdown === 'function') {
                populateCRSDropdown(estimateCRSFromCoords(center[0], center[1]));
            }

            const meshGroup = buildThreeMeshGroupFromPositions(data.groups, materialsMap, defaultMaterial);
            await onModelLoaded(meshGroup, { x: center[0], y: center[1], z: center[2] });

            worker.terminate();
        }
        else if (data.action === 'ERROR') {
            URL.revokeObjectURL(workerUrl);
            alert("Errore caricamento OBJ: " + data.message);
            if (typeof hideLoadingProgress === 'function') hideLoadingProgress();
            worker.terminate();
        }
    };

    worker.onerror = function (err) {
        URL.revokeObjectURL(workerUrl);
        console.error("Errore Worker OBJ:", err);
        alert("Errore durante il parsing del file OBJ.");
        if (typeof hideLoadingProgress === 'function') hideLoadingProgress();
        worker.terminate();
    };

    function readNextChunk(file, workerInstance) {
        if (offset >= fileSize) {
            workerInstance.postMessage({ action: 'FINISH' });
            return;
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE_OBJ);
        const reader = new FileReader();

        reader.onload = function (evt) {
            const buffer = evt.target.result;
            workerInstance.postMessage({ action: 'PARSE_CHUNK', buffer: buffer }, [buffer]);
            offset += CHUNK_SIZE_OBJ;
        };

        reader.readAsArrayBuffer(slice);
    }

    readNextChunk(mainFile, worker);
}

/**
 * Assembla le sub-mesh applicando i materiali MTL caricati
 */
function buildThreeMeshGroupFromPositions(resultGroups, materialsMap, defaultMaterial) {
    const parentGroup = new THREE.Group();
    const MAX_VERTICES_PER_MESH = 600000;

    for (const mtlName in resultGroups) {
        const groupData = resultGroups[mtlName];
        const positions = new Float32Array(groupData.positions);
        const uvs = groupData.uvs ? new Float32Array(groupData.uvs) : null;

        // Se il nome MTL corrisponde assegna il materiale con texture, altrimenti usa il default
        const material = materialsMap[mtlName] || defaultMaterial;
        const totalVertices = positions.length / 3;
        let currentVertex = 0;

        while (currentVertex < totalVertices) {
            const count = Math.min(MAX_VERTICES_PER_MESH, totalVertices - currentVertex);
            
            const chunkPositions = positions.subarray(currentVertex * 3, (currentVertex + count) * 3);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(chunkPositions, 3));

            if (uvs && uvs.length >= (currentVertex + count) * 2) {
                const chunkUVs = uvs.subarray(currentVertex * 2, (currentVertex + count) * 2);
                geometry.setAttribute('uv', new THREE.BufferAttribute(chunkUVs, 2));
            }

            geometry.computeVertexNormals();

            const mesh = new THREE.Mesh(geometry, material);
            parentGroup.add(mesh);

            currentVertex += count;
        }
    }

    return parentGroup;
}

function resetFeaturesAndTiles() {
    try {
        window.tilesInitialized = false;

        if (typeof cancelCurrentDigitizing === 'function') cancelCurrentDigitizing();
        if (typeof deselectFeature === 'function') deselectFeature();

        if (typeof digitizedFeatures !== 'undefined' && Array.isArray(digitizedFeatures)) {
            digitizedFeatures.forEach(f => {
                if (f && f.group && typeof scene !== 'undefined' && scene) {
                    scene.remove(f.group);
                    if (typeof safeDispose === 'function') {
                        safeDispose(f.group);
                    }
                }
            });
            digitizedFeatures.length = 0;
        }

        if (typeof featureCounter !== 'undefined') {
            featureCounter = 1;
        }

        if (typeof updateVisibilityFiltersUI === 'function') updateVisibilityFiltersUI();
        if (typeof updateUI === 'function') updateUI();

    } catch (err) {
        console.warn("Initial reset ignored (first load):", err);
    }
}

function downscaleTexture(texture, maxSize = 8192) {
    if (!texture || !texture.image) return;
    const img = texture.image;
    const processImg = (imageSource) => {
        let w = imageSource.width || imageSource.naturalWidth;
        let h = imageSource.height || imageSource.naturalHeight;
        if (!w || !h) return;
        if (w > maxSize || h > maxSize) {
            let newW = w > h ? maxSize : Math.round((w * maxSize) / h);
            let newH = h >= w ? maxSize : Math.round((h * maxSize) / w);
            const canvas = document.createElement('canvas');
            canvas.width = newW; canvas.height = newH;
            canvas.getContext('2d').drawImage(imageSource, 0, 0, newW, newH);
            texture.image = canvas;
            texture.needsUpdate = true;
        }
    };
    if (img.complete === false) img.addEventListener('load', () => processImg(img), { once: true });
    else processImg(img);
}

function optimizeModelForMobile(object) {
    object.traverse((child) => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                m.side = THREE.DoubleSide;
                ['map', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap'].forEach(texKey => {
                    if (m[texKey]) {
                        downscaleTexture(m[texKey], 2048);
                        m[texKey].encoding = THREE.sRGBEncoding;
                        m[texKey].needsUpdate = true;
                    }
                });
                m.needsUpdate = true;
            });
        }
    });
}

function centerObjInJS(objText) {
    const lines = objText.split('\n');
    const vertices = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('v ')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 4) {
                const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) vertices.push([x, y, z]);
            }
        }
    }

    if (vertices.length === 0) return { text: objText, offset: { x: 0, y: 0, z: 0 } };

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
        if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
        if (v[2] < minZ) minZ = v[2]; if (v[2] > maxZ) maxZ = v[2];
    }

    const cx = (minX + maxX) / 2.0, cy = (minY + maxY) / 2.0, cz = (minZ + maxZ) / 2.0;
    if (Math.abs(cx) < 1e-4 && Math.abs(cy) < 1e-4 && Math.abs(cz) < 1e-4) return { text: objText, offset: { x: 0, y: 0, z: 0 } };

    const newLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('v ')) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 4) {
                const x = parseFloat(parts[1]) - cx, y = parseFloat(parts[2]) - cy, z = parseFloat(parts[3]) - cz;
                const extra = parts.length > 4 ? " " + parts.slice(4).join(" ") : "";
                return `v ${x.toFixed(8)} ${y.toFixed(8)} ${z.toFixed(8)}${extra}`;
            }
        }
        return line;
    });

    return { text: newLines.join('\n'), offset: { x: cx, y: cy, z: cz } };
}

function sanitizeMTLText(mtlText) {
    return mtlText.replace(/\\/g, '/').replace(/map_Kd\s+"([^"]+)"/gi, 'map_Kd $1').replace(/map_Bump\s+"([^"]+)"/gi, 'map_Bump $1');
}

function estimateCRSFromCoords(x, y) {
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (absX < 1000 && absY < 1000) return null;

    if (x >= -180 && x <= 180 && y >= -90 && y <= 90) return "EPSG:4326";

    if (x >= 100000 && x <= 900000 && y >= 0 && y <= 10000000) {
        if (window.userLongitude !== undefined) {
            const zone = Math.floor((window.userLongitude + 180) / 6) + 1;
            const isNorth = (window.userLatitude === undefined || window.userLatitude >= 0);
            return `EPSG:${(isNorth ? 32600 : 32700) + zone}`;
        }
        return "EPSG:32633";
    }

    if (absX > 900000 || absY > 10000000) {
        return "EPSG:3857";
    }

    return null;
}

function parseOBJMetadataCRS(objText) {
    const lines = objText.split('\n').slice(0, 50);
    for (let line of lines) {
        if (line.startsWith('#')) {
            const match = line.match(/EPSG:\d+/i) || line.match(/CRS:\s*([\w:]+)/i);
            if (match) return match[0].toUpperCase().replace("CRS:", "").trim();
        }
    }
    return null;
}

function populateCRSDropdown(suggestedCRS = null) {
    const select = document.getElementById('input-crs');
    if (!select) return;

    select.innerHTML = '';

    if (suggestedCRS && suggestedCRS !== 'Local') {
        const optSuggested = document.createElement('option');
        optSuggested.value = suggestedCRS;
        optSuggested.textContent = `⭐ ${suggestedCRS} (Suggested)`;
        select.appendChild(optSuggested);
    }

    const optLocal = document.createElement('option');
    optLocal.value = "Local";
    optLocal.textContent = "Local / Coordinates-free";
    select.appendChild(optLocal);

    const optWgs84 = document.createElement('option');
    optWgs84.value = "EPSG:4326";
    optWgs84.textContent = "EPSG:4326 (WGS 84 - Lat/Lon)";
    select.appendChild(optWgs84);

    const optMercator = document.createElement('option');
    optMercator.value = "EPSG:3857";
    optMercator.textContent = "EPSG:3857 (Web Mercator)";
    select.appendChild(optMercator);

    const groupNorth = document.createElement('optgroup');
    groupNorth.label = "UTM Northern Hemisphere (WGS 84)";
    for (let i = 1; i <= 60; i++) {
        const epsg = `EPSG:${32600 + i}`;
        if (epsg === suggestedCRS) continue;
        const opt = document.createElement('option');
        opt.value = epsg;
        opt.textContent = `${epsg} (UTM Zone ${i}N)`;
        groupNorth.appendChild(opt);
    }
    select.appendChild(groupNorth);

    const groupSouth = document.createElement('optgroup');
    groupSouth.label = "UTM Southern Hemisphere (WGS 84)";
    for (let i = 1; i <= 60; i++) {
        const epsg = `EPSG:${32700 + i}`;
        if (epsg === suggestedCRS) continue;
        const opt = document.createElement('option');
        opt.value = epsg;
        opt.textContent = `${epsg} (UTM Zone ${i}S)`;
        groupSouth.appendChild(opt);
    }
    select.appendChild(groupSouth);

    select.selectedIndex = 0;
    onCRSChanged();
}

function onCRSChanged() {
    const select = document.getElementById('input-crs');
    if (select) {
        window.currentCRS = select.value;
        localStorage.setItem('field3d_crs', window.currentCRS);
    }
}

async function load3TZ(file) {
    try {
        console.log("🔵 3TZ loading started...");

        const TilesRenderer = window.TilesRenderer || window.TilesRendererLib?.TilesRenderer;
        if (!window.TilesRenderer) {
            console.error("❌ TilesRenderer not loaded");
            alert("Error: TilesRenderer library is not loaded.");
            document.getElementById('status').textContent = '3TZ Error';
            return;
        }

        const zip = await JSZip.loadAsync(file);
        let possibleTilesets = [];
        zip.forEach((relPath, entry) => {
            if (!entry.dir && relPath.toLowerCase().endsWith('tileset.json')) {
                possibleTilesets.push({ path: relPath, entry: entry });
            }
        });

        if (possibleTilesets.length === 0) {
            alert("Error: No tileset.json found in ZIP!");
            document.getElementById('status').textContent = '3TZ Error';
            return;
        }

        possibleTilesets.sort((a, b) => a.path.length - b.path.length);
        const rootTilesetData = possibleTilesets[0];
        const rootTilesetText = await rootTilesetData.entry.async('string');

        try {
            const parsedTileset = JSON.parse(rootTilesetText);
            if (parsedTileset && parsedTileset.root && parsedTileset.root.boundingVolume) {
                const bv = parsedTileset.root.boundingVolume;
                let estimatedCRS = null;
                if (bv.box) estimatedCRS = estimateCRSFromCoords(bv.box[0], bv.box[1]);
                else if (bv.sphere) estimatedCRS = estimateCRSFromCoords(bv.sphere[0], bv.sphere[1]);
                else if (bv.region) estimatedCRS = "EPSG:4326";
                populateCRSDropdown(estimatedCRS);
            } else {
                populateCRSDropdown(null);
            }
        } catch (e) {
            populateCRSDropdown(null);
        }

        const lastSlashIdx = rootTilesetData.path.lastIndexOf('/');
        const zipPrefix = lastSlashIdx !== -1 ? rootTilesetData.path.substring(0, lastSlashIdx + 1).toLowerCase() : "";

        const zipIndex = new Map();
        zip.forEach((relPath, entry) => {
            if (entry.dir) return;
            const normPath = relPath.replace(/\\/g, '/').toLowerCase();
            zipIndex.set(normPath, entry);
        });

        if (window.active3dTiles) {
            scene.remove(window.active3dTiles.group);
            window.active3dTiles.dispose();
            window.active3dTiles = null;
        }
        if (loadedMesh) {
            if (typeof safeDispose === 'function') safeDispose(loadedMesh);
            loadedMesh = null;
        }
        if (window.active3dTilesOriginalFetch) {
            window.fetch = window.active3dTilesOriginalFetch;
        }

        const originalFetch = window.fetch;
        window.fetch = async (input, init) => {
            const urlStr = typeof input === 'string' ? input : (input ? input.url : '');

            if (urlStr.includes('local-3tz-storage')) {
                try {
                    const parsedUrl = new URL(urlStr);
                    let requestedPath = decodeURIComponent(parsedUrl.pathname)
                        .replace(/^\/local-3tz-storage\/?/, '')
                        .replace(/^\//, '')
                        .replace(/\\/g, '/')
                        .toLowerCase();

                    if (requestedPath === '' || requestedPath === 'tileset.json') {
                        return new Response(rootTilesetText, {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    let rawZipPath = zipPrefix + requestedPath;
                    const parts = [];
                    for (const segment of rawZipPath.split('/')) {
                        if (segment === '..') {
                            if (parts.length > 0) parts.pop();
                        } else if (segment !== '.' && segment !== '') {
                            parts.push(segment);
                        }
                    }
                    const finalZipPath = parts.join('/');
                    const targetEntry = zipIndex.get(finalZipPath);
                    if (targetEntry) {
                        if (finalZipPath.endsWith('.json')) {
                            const jsonText = await targetEntry.async('string');
                            return new Response(jsonText, { headers: { 'Content-Type': 'application/json' } });
                        }
                        const buffer = await targetEntry.async('arraybuffer');
                        return new Response(buffer, { status: 200 });
                    }
                    return new Response(null, { status: 404 });
                } catch (e) {
                    return new Response(null, { status: 500 });
                }
            }
            return originalFetch(input, init);
        };

        const tilesRenderer = new window.TilesRenderer('https://local-3tz-storage/tileset.json');
        tilesRenderer.setCamera(camera);
        tilesRenderer.setResolutionFromRenderer(camera, renderer);

        tilesRenderer.errorTarget = 6.0;
        tilesRenderer.stopAtLoaded = true;
        tilesRenderer.cullWithFrustum = true;
        tilesRenderer.maxDepth = Infinity;
        tilesRenderer.maxDownloads = 16;

        if (tilesRenderer.lruCache) {
            tilesRenderer.lruCache.minSize = 1000;
            tilesRenderer.lruCache.maxSize = 3500;
        }

        if (typeof THREE.DRACOLoader !== 'undefined') {
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            const gltfLoader = new THREE.GLTFLoader().setDRACOLoader(dracoLoader);
            tilesRenderer.manager.addHandler(/\.gltf$/, gltfLoader);
            tilesRenderer.manager.addHandler(/\.glb$/, gltfLoader);
        }

        tilesRenderer.onLoadModel = (sceneObj) => {
            sceneObj.traverse((c) => {
                if (c.isMesh) {
                    c.frustumCulled = false;
                    if (c.material) {
                        const mats = Array.isArray(c.material) ? c.material : [c.material];
                        mats.forEach(m => m.side = THREE.DoubleSide);
                    }
                }
            });
        };

        tilesRenderer.onLoadTileSet = async () => {
            if (window.tilesInitialized) return;

            tilesRenderer.group.position.set(0, 0, 0);
            tilesRenderer.group.rotation.set(0, 0, 0);
            tilesRenderer.group.scale.set(1, 1, 1);
            tilesRenderer.group.updateMatrixWorld(true);

            const crsInput = document.getElementById('input-crs');
            const crsValue = crsInput ? crsInput.value.trim() : 'Local';
            const isUtmOrGeoref = crsValue && !crsValue.toLowerCase().includes('local');
            const sphere = new THREE.Sphere();
            if (tilesRenderer.getBoundingSphere(sphere)) {

                if (isUtmOrGeoref) {
                    autoShift = sphere.center.clone();

                    tilesRenderer.group.rotation.x = -Math.PI / 2;
                    tilesRenderer.group.updateMatrixWorld(true);

                    tilesRenderer.group.position.copy(autoShift).negate();
                    tilesRenderer.group.updateMatrixWorld(true);
                } else {
                    tilesRenderer.group.rotation.x = -Math.PI / 2;
                    window.modelUpAxisIsY = true;
                    autoShift = new THREE.Vector3(
                        sphere.center.x,
                        sphere.center.z,
                        -sphere.center.y
                    );
                    tilesRenderer.group.position.copy(autoShift).negate();
                    tilesRenderer.group.updateMatrixWorld(true);
                }

                threeCenter = autoShift.clone();
                window.threeCenter = threeCenter;
                const box = new THREE.Box3().setFromObject(tilesRenderer.group);
                autoShift = box.getCenter(new THREE.Vector3());
                console.log("✅ 3TZ - Bounding Box center:", autoShift);
                window.threeCenter = threeCenter;

                const radius = sphere.radius || 50;
                camera.near = 0.1;
                camera.far = Math.max(100000, radius * 50);
                camera.updateProjectionMatrix();

                controls.target.set(0, 0, 0);
                camera.position.set(0, radius * 1.5, radius * 1.5);
                controls.update();
            }

            loadedMesh = tilesRenderer.group;

            onCRSChanged();
            document.getElementById('status').textContent = '3TZ Model Loaded ✓ | CRS: ' + crsValue;
            document.getElementById('status').style.color = '#1D9E75';

            window.tilesInitialized = true;
        };

        scene.add(tilesRenderer.group);
        window.active3dTiles = tilesRenderer;
        window.active3dTilesOriginalFetch = originalFetch;

    } catch (err) {
        console.error("🔴 3TZ ERROR:", err);
        alert("3TZ load error: " + err.message);
        document.getElementById('status').textContent = '3TZ Error';
        document.getElementById('status').style.color = '#ff4444';

        if (window.active3dTilesOriginalFetch) {
            window.fetch = window.active3dTilesOriginalFetch;
        }
    }
}

async function handleFileUpload(files) {
   
    const sketchfabPanel = document.getElementById('sketchfab-import-panel');
    if (sketchfabPanel) sketchfabPanel.style.display = 'none';
    
    
    
    if (!files || files.length === 0) return;
    
    resetFeaturesAndTiles();
    
    document.getElementById('status').textContent = 'Processing local file...';
    document.getElementById('status').style.color = '#e0a800';
    
    initialQuaternion = null;
    if (loadedMesh) {
        if (typeof safeDispose === 'function') safeDispose(loadedMesh);
        loadedMesh = null;
    }

    const fileMap = {};
    let mainFile = null;

    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        fileMap[f.name.toLowerCase()] = f;
        const ext = f.name.split('.').pop().toLowerCase();
        if (['obj', 'glb', 'gltf', '3tz', 'ply'].includes(ext)) {
            mainFile = f;
        }
    }

    if (!mainFile) {
        alert("Please select a 3D model (.obj, .glb, .ply, or .3tz)!");
        document.getElementById('status').textContent = 'No valid model file';
        document.getElementById('status').style.color = '#ff4444';
        return;
    }

    const ext = mainFile.name.split('.').pop().toLowerCase();

    if (ext === '3tz') {
        await load3TZ(mainFile);

    } else if (ext === 'ply') {
        await loadPLY(mainFile);

    } else if (ext === 'glb' || ext === 'gltf') {
        const loader = new THREE.GLTFLoader();
        
        if (typeof THREE.DRACOLoader !== 'undefined') {
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            loader.setDRACOLoader(dracoLoader);
        }

        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
            const fileName = url.split('/').pop().split('\\').pop().toLowerCase();
            if (fileMap[fileName]) return URL.createObjectURL(fileMap[fileName]);
            return url;
        });
        loader.manager = manager;

        const url = URL.createObjectURL(mainFile);
        loader.load(
            url,
            async (gltf) => {
                URL.revokeObjectURL(url);
                const box = new THREE.Box3().setFromObject(gltf.scene);
                if (!box.isEmpty()) {
                    const center = box.getCenter(new THREE.Vector3());
                    const estimatedCRS = estimateCRSFromCoords(center.x, center.y);
                    populateCRSDropdown(estimatedCRS);
                } else {
                    populateCRSDropdown(null);
                }
                await onModelLoaded(gltf.scene);
            },
            undefined,
            (err) => {
                console.error("GLB/GLTF Error:", err);
                alert("Error loading GLB/GLTF file");
                document.getElementById('status').textContent = 'GLB Error';
                document.getElementById('status').style.color = '#ff4444';
            }
        );

    } else if (ext === 'obj') {
        loadOBJModel(mainFile, fileMap);
    }
}

function showAxisDialog() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        const btnYes = document.getElementById('modal-btn-yes');
        const btnNo = document.getElementById('modal-btn-no');

        overlay.classList.add('show');

        const handleYes = () => {
            overlay.classList.remove('show');
            btnYes.removeEventListener('click', handleYes);
            btnNo.removeEventListener('click', handleNo);
            resolve(true);
        };

        const handleNo = () => {
            overlay.classList.remove('show');
            btnYes.removeEventListener('click', handleYes);
            btnNo.removeEventListener('click', handleNo);
            resolve(false);
        };

        btnYes.addEventListener('click', handleYes);
        btnNo.addEventListener('click', handleNo);
    });
}

async function onModelLoaded(object, presetOffset = null) {
    const axisUpIsY = await showAxisDialog();
    window.modelUpAxisIsY = axisUpIsY;
    
    if (axisUpIsY) {
        object.rotation.x = -Math.PI / 2;
    }
    
    object.updateMatrixWorld(true);
    optimizeModelForMobile(object);

    if (presetOffset) {
        if (axisUpIsY) {
            threeCenter = new THREE.Vector3(presetOffset.x, presetOffset.z, -presetOffset.y);
            window.threeCenter = threeCenter;
            console.log("✅ threeCenter saved (OBJ Y-up):", threeCenter);
        } else {
            threeCenter = new THREE.Vector3(presetOffset.x, presetOffset.y, presetOffset.z);
            window.threeCenter = threeCenter;
            console.log("✅ threeCenter saved (OBJ Z-up):", threeCenter);
        }
    } else {
        const box = new THREE.Box3().setFromObject(object);
        threeCenter = box.getCenter(new THREE.Vector3());
        object.position.sub(threeCenter);
        window.threeCenter = threeCenter;
        console.log("✅ threeCenter saved (GLB):", threeCenter);
    }
    
    object.updateMatrixWorld(true);
    loadedMesh = object;
    scene.add(loadedMesh);

    const box = new THREE.Box3().setFromObject(loadedMesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 10;
    
    camera.position.set(maxDim * 1.3, maxDim * 1.3, maxDim * 1.3);
    controls.target.set(0, 0, 0);
    controls.update();

    onCRSChanged();
    const crsInput = document.getElementById('input-crs');
    const crsLabel = (crsInput && crsInput.value.trim()) ? crsInput.value.trim() : 'Local';

    document.getElementById('status').textContent = `Model Loaded ✓ | CRS: ${crsLabel}`;
    document.getElementById('status').style.color = '#1D9E75';
}

async function loadPLY(file) {
    try {
        console.log("🔵 PLY (Point Cloud) loading started...");
        
        if (loadedMesh) {
            if (typeof safeDispose === 'function') safeDispose(loadedMesh);
            loadedMesh = null;
        }
        
        const loader = new THREE.PLYLoader();
        const arrayBuffer = await file.arrayBuffer();
        const geometry = loader.parse(arrayBuffer);
        
        const posAttr = geometry.attributes.position;
        if (posAttr && posAttr.count > 0) {
            const estimatedCRS = estimateCRSFromCoords(posAttr.getX(0), posAttr.getY(0));
            populateCRSDropdown(estimatedCRS);
        } else {
            populateCRSDropdown(null);
        }

        const axisUpIsY = await showAxisDialog();
        window.modelUpAxisIsY = axisUpIsY;
        
        if (axisUpIsY) {
            geometry.rotateX(-Math.PI / 2);
        }

        geometry.computeBoundingBox();
        threeCenter = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometry.center();

        window.threeCenter = threeCenter;
        console.log("✅ threeCenter saved (PLY):", threeCenter);

        const hasVertexColors = !!geometry.attributes.color;
        const material = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: hasVertexColors,
            color: hasVertexColors ? 0xffffff : 0x00ff00,
            sizeAttenuation: true
        });

        loadedMesh = new THREE.Points(geometry, material);
        optimizeModelForMobile(loadedMesh);
        scene.add(loadedMesh);

        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 10;
        raycasterThreshold = maxDim * 0.015;

        camera.position.set(maxDim * 1.3, maxDim * 1.3, maxDim * 1.3);
        controls.target.set(0, 0, 0);
        controls.update();

        onCRSChanged();
        const crsInput = document.getElementById('input-crs');
        const crsLabel = (crsInput && crsInput.value.trim()) ? crsInput.value.trim() : 'Local';

        document.getElementById('status').textContent = `PLY Point Cloud Loaded ✓ | CRS: ${crsLabel}`;
        document.getElementById('status').style.color = '#1D9E75';

    } catch (err) {
        console.error("PLY Error:", err);
        alert("PLY load error: " + err.message);
        document.getElementById('status').textContent = 'PLY Error';
        document.getElementById('status').style.color = '#ff4444';
    }
}

function toggleDigitizeModeUI() {
    deselectFeature();
    if (isDigitizing) cancelCurrentDigitizing();
    const mode = document.getElementById('digitize-mode').value;

    document.getElementById('manual-orient-inputs').style.display = (mode === 'spot_point') ? 'block' : 'none';
    document.getElementById('note-mode-inputs').style.display = (mode === 'note') ? 'block' : 'none';

    const sensorUI = document.getElementById('sensor-ui');
    const polyUI = document.getElementById('polyline-metrics-ui');
    if (mode === 'spot_point') {
        if (sensorUI) sensorUI.style.display = 'block';
        if (polyUI) polyUI.style.display = 'none';
    } else if (mode === 'note') {
        if (polyUI) polyUI.style.display = 'none';
    } else {
        if (sensorUI) sensorUI.style.display = 'none';
        if (polyUI) polyUI.style.display = 'block';
    }

    const startBtn = document.getElementById('btn-toggle-digitize');
    if (startBtn) startBtn.textContent = (mode === 'note') ? '▶ Place Note' : '▶ Start Digitizing';
}

function updateGeometryFields() {
    const geometry = document.getElementById('input-geometry').value;
    
    document.getElementById('field-strike').style.display = 'none';
    document.getElementById('field-dipdir').style.display = 'none';
    document.getElementById('field-dip').style.display = 'none';
    document.getElementById('field-trend').style.display = 'none';
    document.getElementById('field-plunge').style.display = 'none';
    document.getElementById('field-rake').style.display = 'none';
    document.getElementById('field-sense').style.display = 'none';

    if (geometry === 'line') {
        document.getElementById('field-trend').style.display = 'grid';
        document.getElementById('field-plunge').style.display = 'grid';
    } else if (geometry === 'plane') {
        document.getElementById('field-strike').style.display = 'grid';
        document.getElementById('field-dipdir').style.display = 'grid';
        document.getElementById('field-dip').style.display = 'grid';
    } else if (geometry === 'plane&line') {
        document.getElementById('field-strike').style.display = 'grid';
        document.getElementById('field-dipdir').style.display = 'grid';
        document.getElementById('field-dip').style.display = 'grid';
        document.getElementById('field-rake').style.display = 'grid';
        document.getElementById('field-sense').style.display = 'grid';
    }
}

function autoCalcDipDir() {
    const strikeVal = parseFloat(document.getElementById('input-strike').value);
    if (!isNaN(strikeVal)) {
        document.getElementById('input-dipdir').value = Math.round((strikeVal + 90) % 360);
    }
}

function autoCalcStrike() {
    const dipDirVal = parseFloat(document.getElementById('input-dipdir').value);
    if (!isNaN(dipDirVal)) {
        document.getElementById('input-strike').value = Math.round((dipDirVal - 90 + 360) % 360);
    }
}


// ==========================================
// SEZIONE SKETCHFAB (AGGIUNTA)
// ==========================================

window.toggleSketchfabPanel = function() {
    const panel = document.getElementById('sketchfab-import-panel');
    if (!panel) return;
    
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';

    if (isHidden) {
        const tokenInput = document.getElementById('sketchfab-api-token');
        const savedToken = localStorage.getItem('sketchfab_api_token');
        if (tokenInput && savedToken) tokenInput.value = savedToken;
    }
};

window.executeSketchfabDownload = function() {
    const urlInput = document.getElementById('sketchfab-url-input');
    const tokenInput = document.getElementById('sketchfab-api-token');

    const pageUrl = urlInput ? urlInput.value.trim() : '';
    const apiToken = tokenInput ? tokenInput.value.trim() : '';

    loadModelFromSketchfab(pageUrl, apiToken);
};

function extractSketchfabUID(url) {
    const regex = /([a-f0-9]{32})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function loadModelFromSketchfab(pageUrl, apiToken) {
    const uid = extractSketchfabUID(pageUrl);

    if (!uid) {
        alert("Sketchfab URL is not valid.");
        return;
    }

    if (!apiToken) {
        alert("Sketchfab API key Token.");
        return;
    }

    // Memorizza l'API Key nel browser
    localStorage.setItem('sketchfab_api_token', apiToken);

    // Pulisce l'input dell'URL per la prossima volta
    const urlInput = document.getElementById('sketchfab-url-input');
    if (urlInput) urlInput.value = '';

    // Nasconde il pannello di importazione
    const panel = document.getElementById('sketchfab-import-panel');
    if (panel) panel.style.display = 'none';



    // 1. Resetta le feature digitalizzate e le 3D Tiles attive
    resetFeaturesAndTiles();

    // 2. Rimuove e distrugge il modello standard caricato in precedenza
    if (loadedMesh) {
        scene.remove(loadedMesh);
        if (typeof safeDispose === 'function') safeDispose(loadedMesh);
        loadedMesh = null;
    }

    const statusElem = document.getElementById('status');
    if (statusElem) {
        statusElem.textContent = "Connessione a Sketchfab...";
        statusElem.style.color = '#e0a800';
    }

    try {
        const response = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, {
            method: 'GET',
            headers: { 'Authorization': `Token ${apiToken}` }
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error("API Token non valido o modello protetto.");
            if (response.status === 404) throw new Error("Modello non trovato o scaricabile.");
            throw new Error(`Errore API (${response.status})`);
        }

        const data = await response.json();
        const downloadUrl = data.glb ? data.glb.url : (data.gltf ? data.gltf.url : null);

        if (!downloadUrl) {
            throw new Error("Nessun file GLB/GLTF scaricabile trovato per questo modello.");
        }

        if (statusElem) statusElem.textContent = "Download modello...";

        const fileResponse = await fetch(downloadUrl);
        const blob = await fileResponse.blob();

        if (downloadUrl.includes('.zip') || blob.type.includes('zip')) {
            if (statusElem) statusElem.textContent = "Decompressione ZIP...";
            
            const zip = await JSZip.loadAsync(blob);
            const files = {};
            
            for (const filename of Object.keys(zip.files)) {
                const file = zip.files[filename];
                if (!file.dir) {
                    const fileBlob = await file.async('blob');
                    files[filename] = URL.createObjectURL(fileBlob);
                }
            }

            const gltfFilename = Object.keys(files).find(name => name.endsWith('.gltf'));
            if (!gltfFilename) throw new Error("Nessun file .gltf trovato nell'archivio ZIP.");

            const manager = new THREE.LoadingManager();
            manager.setURLModifier((url) => {
                const cleanUrl = url.replace(/^.*[\\\/]/, '');
                return files[cleanUrl] || url;
            });

            const loader = new THREE.GLTFLoader(manager);
            if (typeof THREE.DRACOLoader !== 'undefined') {
                const dracoLoader = new THREE.DRACOLoader();
                dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
                loader.setDRACOLoader(dracoLoader);
            }

            loader.load(files[gltfFilename], async (gltf) => {
                const box = new THREE.Box3().setFromObject(gltf.scene);
                if (!box.isEmpty()) {
                    const center = box.getCenter(new THREE.Vector3());
                    const estimatedCRS = estimateCRSFromCoords(center.x, center.y);
                    populateCRSDropdown(estimatedCRS);
                } else {
                    populateCRSDropdown(null);
                }
                await onModelLoaded(gltf.scene);
            });

        } else {
            const loader = new THREE.GLTFLoader();
            if (typeof THREE.DRACOLoader !== 'undefined') {
                const dracoLoader = new THREE.DRACOLoader();
                dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
                loader.setDRACOLoader(dracoLoader);
            }

            const blobUrl = URL.createObjectURL(blob);
            loader.load(blobUrl, async (gltf) => {
                URL.revokeObjectURL(blobUrl);
                const box = new THREE.Box3().setFromObject(gltf.scene);
                if (!box.isEmpty()) {
                    const center = box.getCenter(new THREE.Vector3());
                    const estimatedCRS = estimateCRSFromCoords(center.x, center.y);
                    populateCRSDropdown(estimatedCRS);
                } else {
                    populateCRSDropdown(null);
                }
                await onModelLoaded(gltf.scene);
            });
        }

    } catch (err) {
        console.error("Errore Sketchfab Import:", err);
        alert(`Impossibile importare da Sketchfab: ${err.message}`);
        if (statusElem) {
            statusElem.textContent = "Errore Sketchfab";
            statusElem.style.color = '#ff4444';
        }
    }
}


// Ripopola l'API Key all'avvio della pagina se presente nel localStorage
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('sketchfab_api_token');
    const tokenInput = document.getElementById('sketchfab-api-token');
    
    if (savedToken && tokenInput) {
        tokenInput.value = savedToken;
    }
});
