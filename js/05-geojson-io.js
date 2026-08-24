// ==================== GEOJSON I/O (PURE RAM VERSION) ====================

function buildGeoJSONObject() {
    const geojsonFeatures = [];

    for (const f of digitizedFeatures) {
        const propsBase = {
            feature_id: f.id,
            f_type: f.f_type || '',
            unit: f.unit || '',
            set: f.set || ''
        };

        // 1. NOTES MANAGEMENT (Unchanged)
        if (f.is_note) {
            const noteProps = {
                ...propsBase,
                layer_type: "note",
                note_type: f.note_type || 'text',
                text: f.text || ''
            };

            if (f.note_type === 'photo') {
                noteProps.photo_file = f.photo_file || '';
                noteProps.photo_data = f.photo_data || '';
            }
            if (f.note_type === 'sketch') {
                noteProps.sketch_file = f.sketch_file || '';
                noteProps.sketch_data = f.sketch_data || '';
            }
            if (f.note_type === 'audio') {
                noteProps.audio_file = f.audio_file || '';
                noteProps.audio_data = f.audio_data || '';
            }

            geojsonFeatures.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: f.point },
                properties: noteProps
            });
            continue;
        }

        // 2. MANUAL SPOT ORIENTATION MANAGEMENT (Unchanged)
        if (f.is_manual_spot) {
            const props = {
                ...propsBase,
                layer_type: "manual_orientation",
                geometry_type: f.geometry || 'plane',
                ...(f.custom_fields || {})
            };

            if (f.geometry === 'line') {
                props.trend = f.trend !== undefined ? f.trend : 0;
                props.plunge = f.plunge !== undefined ? f.plunge : 0;
            } else if (f.geometry === 'plane') {
                props.strike = f.strike !== undefined ? f.strike : 0;
                props.dip_dir = f.dip_dir !== undefined ? f.dip_dir : 90;
                props.dip = f.dip !== undefined ? f.dip : 45;
            } else if (f.geometry === 'plane&line') {
                props.strike = f.strike !== undefined ? f.strike : 0;
                props.dip_dir = f.dip_dir !== undefined ? f.dip_dir : 90;
                props.dip = f.dip !== undefined ? f.dip : 45;
                props.rake = f.rake !== undefined ? f.rake : 90;
                props.sense = f.sense || 'NA';
            }

            geojsonFeatures.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: f.point },
                properties: props
            });
            continue;
        }

        // 3. ➕ NEW MANAGEMENT: SIMPLE POLYLINE (Without PCA or centroid point)
        if (f.is_simple_polyline) {
            geojsonFeatures.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: f.line || [] },
                properties: {
                    ...propsBase,
                    layer_type: "simple_polyline",
                    ...(f.custom_fields || {})
                }
            });
            continue; // Skip the rest of the loop for this feature
        }

        // 4. STANDARD POLYLINE / 3D PLANE MANAGEMENT (Unchanged)
        const lineGis = f.line || [];

        if (lineGis.length >= 2) {
            const pca = lineGis.length >= 3
                ? calculatePCAAndOrientationJS(lineGis)
                : { valMin: 0, valMed: 0, valMax: 0, strike: 0, dipDir: 0, dip: 0 };

            geojsonFeatures.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: lineGis },
                properties: {
                    ...propsBase,
                    layer_type: "orientation",
                    val_min: pca.valMin, val_med: pca.valMed, val_max: pca.valMax,
                    strike: pca.strike, dip_dir: pca.dipDir, dip: pca.dip,
                    ...(f.custom_fields || {})
                }
            });
        }

        if (lineGis.length >= 3) {
            let cx = 0, cy = 0, cz = 0;
            lineGis.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; });
            cx /= lineGis.length; cy /= lineGis.length; cz /= lineGis.length;

            const pca = calculatePCAAndOrientationJS(lineGis);

            geojsonFeatures.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [cx, cy, cz] },
                properties: {
                    ...propsBase,
                    layer_type: "orientation",
                    val_min: pca.valMin, val_med: pca.valMed, val_max: pca.valMax,
                    strike: pca.strike, dip_dir: pca.dipDir, dip: pca.dip,
                    ...(f.custom_fields || {})
                }
            });
        }
    }

    return {
        type: "FeatureCollection",
        crs: { type: "name", properties: { name: window.currentCRS || "urn:ogc:def:crs:OGC:1.3:EPSG:3857" } },
        features: geojsonFeatures
    };
}

function saveToGeoJSON() {
    if (typeof closeMenu === 'function') closeMenu();
    if (document.activeElement) document.activeElement.blur();

    if (!digitizedFeatures || digitizedFeatures.length === 0) {
        return alert("No features to save!");
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    let filename = `survey_${dateStr}_${timeStr}.geojson`;

    updateStatus('Packing notes and media...', '#e0a800');

    try {
        const geojsonDoc = buildGeoJSONObject();
        const jsonStr = JSON.stringify(geojsonDoc, null, 2);

        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.exportGeoJSON) {
            window.webkit.messageHandlers.exportGeoJSON.postMessage({
                jsonString: jsonStr,
                filename: filename
            });
            updateStatus('Preparing file for sharing...', '#28a745');
            
            window.geoJsonSaveInProgress = true;
            setTimeout(() => {
                if (window.geoJsonSaveInProgress) {
                    window.geoJsonSaveInProgress = false;
                    updateStatus('File saved! 💾', '#28a745');
                }
            }, 3500);
        } else {
            const blob = new Blob([jsonStr], { type: "application/geo+json;charset=utf-8" });
            triggerDirectDownload(blob, filename);
        }
    } catch (err) {
        console.error("❌ Error:", err);
        alert("Error generating GeoJSON file:\n" + err.message);
    }
}

function triggerDirectDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none'; a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    updateStatus('File saved to Downloads!! 💾', '#28a745');
}

function updateStatus(msg, color) {
    const statusEl = document.getElementById('status');
    if (statusEl) { statusEl.textContent = msg; statusEl.style.color = color; }
}

function loadGeoJSONFile(files) {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const geojsonFile = fileArray.find(f => f.name.endsWith('.geojson') || f.name.endsWith('.json'));
    if (!geojsonFile) return alert("No valid GeoJSON file found!");

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const geojson = JSON.parse(e.target.result);
            if (!geojson.features) return alert("Invalid GeoJSON file!");
            
            let loadedCRS = null;
            if (geojson.crs && geojson.crs.properties && geojson.crs.properties.name) {
                loadedCRS = geojson.crs.properties.name;
            } else if (geojson.properties && geojson.properties.crs) {
                loadedCRS = geojson.properties.crs;
            }

            if (loadedCRS) {
                window.currentCRS = loadedCRS;
                localStorage.setItem('field3d_crs', window.currentCRS);
                const crsInput = document.getElementById('input-crs');
                if (crsInput) {
                    crsInput.value = window.currentCRS;
                    if (typeof onCRSChanged === 'function') onCRSChanged();
                }
            }
            digitizedFeatures.forEach(f => { if (f.group) safeDispose(f.group); });
            digitizedFeatures.length = 0; selectedFeatureId = null;

            function gisToThree(ptGis) {
                return new THREE.Vector3(
                    ptGis[0] - pythonOffset.x - threeCenter.x,
                    ptGis[2] - pythonOffset.z - threeCenter.y,
                    -(ptGis[1] - pythonOffset.y) - threeCenter.z
                );
            }
            let notesLoadedCount = 0;

            // 1. LOADING NOTES (Unchanged)
            geojson.features.forEach(feat => {
                const props = feat.properties || {};
                if (props.layer_type !== 'note' || !feat.geometry || feat.geometry.type !== 'Point') return;

                const fid = props.feature_id || props.id || featureCounter;
                const ptThree = gisToThree(feat.geometry.coordinates);
                const noteType = props.note_type || 'text';

                const markerGroup = createNoteMarker(ptThree, noteType);
                markerGroup.userData = { featureId: fid };
                markerGroup.traverse(c => c.userData = { featureId: fid });
                scene.add(markerGroup);

                digitizedFeatures.push({
                    id: fid, is_note: true, note_type: noteType,
                    f_type: props.f_type || '', unit: props.unit || '', set: props.set || '',
                    point: feat.geometry.coordinates,
                    text: props.text || '',
                    photo_file: props.photo_file || '',
                    photo_data: props.photo_data || '',
                    sketch_file: props.sketch_file || '',
                    sketch_data: props.sketch_data || '',
                    audio_file: props.audio_file || '',
                    audio_data: props.audio_data || '',
                    group: markerGroup
                });

                if (fid >= featureCounter) featureCounter = fid + 1;
                notesLoadedCount++;
            });

            const knownSystemKeys = [
                'feature_id', 'id', 'f_type', 'type', 'unit', 'set', 'layer_type',
                'note_type', 'text', 'photo_file', 'photo_data', 'sketch_file', 'sketch_data',
                'audio_file', 'audio_data', 'geometry_type', 'trend', 'plunge', 'strike',
                'dip_dir', 'dip', 'rake', 'sense', 'n_nodes', 'val_min', 'val_med', 'val_max'
            ];

            const featsMap = {};
            geojson.features.forEach(feat => {
                const props = feat.properties || {};
                if (props.layer_type === 'note') return;

                const fid = props.feature_id || props.id || featureCounter;
                const customFields = {};
                Object.keys(props).forEach(k => {
                    if (!knownSystemKeys.includes(k)) customFields[k] = props[k];
                });

                if (!featsMap[fid]) {
                    let calcDipDir = props.dip_dir || 0;
                    let calcStrike = props.strike !== undefined ? props.strike : Math.round((calcDipDir - 90 + 360) % 360);

                    featsMap[fid] = {
                        id: fid, f_type: props.f_type || '', unit: props.unit || '', set: props.set || '',
                        lineGis: null, polyGis: null, spotPointGis: null,
                        strike: calcStrike, dip_dir: calcDipDir, dip: props.dip || 0,
                        trend: props.trend || 0, plunge: props.plunge || 0,
                        rake: props.rake !== undefined ? props.rake : 90,
                        sense: props.sense || 'NA',
                        geometry_type: props.geometry_type || 'plane',
                        is_manual_spot: (props.layer_type === 'manual_orientation'),
                        is_simple_polyline: (props.layer_type === 'simple_polyline'), // ➕ READ THE TYPE
                        custom_fields: customFields
                    };
                } else {
                    featsMap[fid].custom_fields = { ...featsMap[fid].custom_fields, ...customFields };
                    // If one of the features associated with the same ID declares simple_polyline, keep it
                    if (props.layer_type === 'simple_polyline') {
                        featsMap[fid].is_simple_polyline = true;
                    }
                }

                if (feat.geometry.type === 'Point' && props.layer_type === 'manual_orientation') {
                    featsMap[fid].spotPointGis = feat.geometry.coordinates;
                    featsMap[fid].is_manual_spot = true;
                } else if (feat.geometry.type === 'LineString') {
                    featsMap[fid].lineGis = feat.geometry.coordinates;
                }
            });
            
            let loadedCount = 0;
            Object.values(featsMap).forEach(item => {
                // 2. RECONSTRUCTING SPOT ORIENTATION (Unchanged)
                if (item.is_manual_spot && item.spotPointGis) {
                    const ptThree = gisToThree(item.spotPointGis);

                    let spotGroup;
                    if (item.geometry_type === 'line') {
                        spotGroup = createLineArrowGroup(ptThree, item.trend, item.plunge);
                    } else if (item.geometry_type === 'plane') {
                        spotGroup = createOrientedDiskGroup(ptThree, item.dip_dir, item.dip);
                    } else {
                        spotGroup = createOrientedDiskGroup(ptThree, item.dip_dir, item.dip);
                        spotGroup.add(createRakeIndicator(item.strike, item.dip, item.rake, item.sense));
                    }
                    spotGroup.userData = { featureId: item.id };
                    spotGroup.traverse(c => c.userData = { featureId: item.id });
                    scene.add(spotGroup);

                    const spotData = {
                        id: item.id, is_manual_spot: true, f_type: item.f_type, unit: item.unit, set: item.set,
                        custom_fields: item.custom_fields || {},
                        point: item.spotPointGis, geometry: item.geometry_type,
                        group: spotGroup
                    };

                    if (item.geometry_type === 'line') {
                        spotData.trend = item.trend;
                        spotData.plunge = item.plunge;
                    } else if (item.geometry_type === 'plane') {
                        spotData.strike = item.strike;
                        spotData.dip_dir = item.dip_dir;
                        spotData.dip = item.dip;
                    } else if (item.geometry_type === 'plane&line') {
                        spotData.strike = item.strike;
                        spotData.dip_dir = item.dip_dir;
                        spotData.dip = item.dip;
                        spotData.rake = item.rake;
                        spotData.sense = item.sense;
                    }

                    digitizedFeatures.push(spotData);

                    if (item.id >= featureCounter) featureCounter = item.id + 1;
                    loadedCount++;
                }
                // 3. RECONSTRUCTING LINESTRING (Modified only the polyPts calculation)
                else if (item.lineGis && item.lineGis.length > 0) {
                    const linePts = item.lineGis.map(gisToThree);
                    
                    let polyPts = null;
                    // ➕ Generate plane surface ONLY if NOT a simple polyline
                    if (!item.is_simple_polyline && linePts.length >= 3) {
                        polyPts = calculatePlaneCornersForPoints(linePts);
                    }

                    const featGroup = createFeatureGroup(linePts, polyPts);
                    featGroup.userData = { featureId: item.id };
                    featGroup.traverse(c => c.userData = { featureId: item.id });
                    scene.add(featGroup);

                    digitizedFeatures.push({
                        id: item.id,
                        is_manual_spot: false,
                        is_simple_polyline: !!item.is_simple_polyline, // ➕ Save flag in RAM
                        f_type: item.f_type,
                        unit: item.unit,
                        set: item.set,
                        custom_fields: item.custom_fields || {},
                        line: item.lineGis,
                        polygon: null,
                        group: featGroup
                    });

                    if (item.id >= featureCounter) featureCounter = item.id + 1;
                    loadedCount++;
                }
            });

            updateVisibilityFiltersUI();
            updateUI();
            document.getElementById('status').textContent = 'Loaded ' + (loadedCount + notesLoadedCount) + ' Features from GeoJSON ✓';
            document.getElementById('status').style.color = '#17a2b8';

        } catch (err) {
            alert("Error reading GeoJSON file: " + err.message);
        }
    };
    reader.readAsText(geojsonFile);
}
