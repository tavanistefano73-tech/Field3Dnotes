function updateVisibilityFiltersUI() {
            const types = new Set(), units = new Set(), sets = new Set();
            digitizedFeatures.forEach(f => {
                types.add(f.f_type.trim() || '(Unspecified)');
                units.add(f.unit.trim() || '(Unspecified)');
                sets.add(f.set.trim() || '(Unspecified)');
            });
            buildFilterCategoryDOM('filter-type-list', 'f_type', types);
            buildFilterCategoryDOM('filter-unit-list', 'unit', units);
            buildFilterCategoryDOM('filter-set-list', 'set', sets);
            applyVisibilityFilters();
        }

        function buildFilterCategoryDOM(containerId, categoryKey, uniqueSet) {
            const container = document.getElementById(containerId);
            if (uniqueSet.size === 0) { container.innerHTML = '<span style="color:#666;">No items</span>'; return; }
            container.innerHTML = '';
            uniqueSet.forEach(val => {
                if (!(val in filterState[categoryKey])) filterState[categoryKey][val] = true;
                const itemLabel = document.createElement('label'); itemLabel.className = 'filter-item';
                const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = filterState[categoryKey][val];
                chk.addEventListener('change', e => {
                    filterState[categoryKey][val] = e.target.checked;
                    applyVisibilityFilters();
                });
                itemLabel.appendChild(chk); itemLabel.appendChild(document.createTextNode(val));
                container.appendChild(itemLabel);
            });
        }

        function applyVisibilityFilters() {
            const chkNotes = document.getElementById('chk-show-notes');
            const notesVisible = !chkNotes || chkNotes.checked;

            digitizedFeatures.forEach(f => {
                const tVal = f.f_type.trim() || '(Unspecified)', uVal = f.unit.trim() || '(Unspecified)', sVal = f.set.trim() || '(Unspecified)';
                let isVisible = (filterState.f_type[tVal] !== false) && (filterState.unit[uVal] !== false) && (filterState.set[sVal] !== false);
                if (f.is_note && !notesVisible) isVisible = false;
                if (f.group) f.group.visible = isVisible;
                if (!isVisible && selectedFeatureId === f.id) deselectFeature();
            });
        }

        function selectFeatureAtMouse(e) {
            if (digitizedFeatures.length === 0) return;
            updateMouseCoords(e);
            raycaster.setFromCamera(mouse, camera);
            raycaster.params.Points.threshold = raycasterThreshold; raycaster.params.Line.threshold = raycasterThreshold;

            const selectables = [];
            digitizedFeatures.forEach(f => { if (f.group && f.group.visible) f.group.traverse(c => selectables.push(c)); });
            const intersects = raycaster.intersectObjects(selectables, true);

            if (intersects.length > 0) {
                let featId = intersects[0].object.userData ? intersects[0].object.userData.featureId : null;
                if (featId) return selectFeature(featId);
            }
            deselectFeature();
        }

function selectFeature(featId) {
    deselectFeature();
    const feat = digitizedFeatures.find(f => f.id === featId);
    if (!feat || !feat.group) return;

    selectedFeatureId = featId;
    feat.group.traverse(child => {
        if (child.isPoints) child.material.color.setHex(0xffaa00);
        else if (child.isLine || child.isLineSegments) child.material.color.setHex(0xffaa00);
        else if (child.isMesh) { child.material.color.setHex(0xffaa00); child.material.opacity = 0.65; }
    });

    // If it is a manual spot, update the input fields
    if (feat.is_manual_spot) {
        const geomType = feat.geometry || 'plane';
        const geomDropdown = document.getElementById('input-geometry');
        if (geomDropdown) {
            geomDropdown.value = geomType;
            updateGeometryFields();
        }

        // Populate input fields with feature values
        if (feat.strike !== undefined && document.getElementById('input-strike'))
            document.getElementById('input-strike').value = feat.strike;
        if (feat.dip_dir !== undefined && document.getElementById('input-dipdir'))
            document.getElementById('input-dipdir').value = feat.dip_dir;
        if (feat.dip !== undefined && document.getElementById('input-dip'))
            document.getElementById('input-dip').value = feat.dip;
        if (feat.trend !== undefined && document.getElementById('input-trend'))
            document.getElementById('input-trend').value = feat.trend;
        if (feat.plunge !== undefined && document.getElementById('input-plunge'))
            document.getElementById('input-plunge').value = feat.plunge;
        if (feat.rake !== undefined && document.getElementById('input-rake'))
            document.getElementById('input-rake').value = feat.rake;
        if (feat.sense !== undefined && document.getElementById('input-sense'))
            document.getElementById('input-sense').value = feat.sense;
    }

    let html = '';
    html += `<div class="popup-info-row"><span class="popup-info-label">ID Feature:</span><span class="popup-info-value">#${feat.id}</span></div>`;
    html += `<div class="popup-info-row"><span class="popup-info-label">Type:</span><span class="popup-info-value">${feat.f_type || '-'}</span></div>`;
    html += `<div class="popup-info-row"><span class="popup-info-label">Unit:</span><span class="popup-info-value">${feat.unit || '-'}</span></div>`;
    html += `<div class="popup-info-row"><span class="popup-info-label">Set:</span><span class="popup-info-value">${feat.set || '-'}</span></div>`;

    // 1. Branch for NOTES
        if (feat.is_note) {
            html += `<div class="popup-info-row"><span class="popup-info-label">Mode:</span><span class="popup-info-value">Note 📝</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Note Type:</span><span class="popup-info-value">${feat.note_type || 'text'}</span></div>`;

            if (feat.note_type === 'text') {
                html += `<div class="popup-info-row"><span class="popup-info-label">Text:</span><span class="popup-info-value" style="color:#17a2b8;">"${feat.text || ''}"</span></div>`;
            } else if (feat.note_type === 'photo') {
                html += `<div class="popup-info-row" style="display:block;">`;
                html += `<img src="${feat.photo_data || ''}" class="note-photo-full" onerror="this.outerHTML='<div class=&quot;note-photo-missing&quot;>⚠️ Photo not available</div>';">`;
                if (feat.text) {
                    html += `<div style="margin-top:6px; color:#55ff55; font-size:10px; white-space:pre-wrap;">${feat.text}</div>`;
                }
                html += `</div>`;
            } else if (feat.note_type === 'sketch') {
                html += `<div class="popup-info-row" style="display:block;">`;
                html += `<img src="${feat.sketch_data || ''}" class="note-photo-full" onerror="this.outerHTML='<div class=&quot;note-photo-missing&quot;>⚠️ Sketch not available</div>';">`;
                if (feat.text) {
                    html += `<div style="margin-top:6px; color:#55ff55; font-size:10px; white-space:pre-wrap;">${feat.text}</div>`;
                }
                html += `</div>`;
            } else if (feat.note_type === 'audio') {
                html += `<div class="popup-info-row" style="display:block;">`;
                html += `<audio controls src="${feat.audio_data || ''}" style="width:100%;" onerror="this.outerHTML='<div class=&quot;note-photo-missing&quot;>⚠️ Audio not available</div>';"></audio>`;
                if (feat.text) {
                    html += `<div style="margin-top:6px; color:#55ff55; font-size:10px; white-space:pre-wrap;">${feat.text}</div>`;
                }
                html += `</div>`;
            }

            if (feat.point) {
                html += `<div class="popup-info-row"><span class="popup-info-label">Coord X:</span><span class="popup-info-value">${feat.point[0].toFixed(2)}</span></div>`;
                html += `<div class="popup-info-row"><span class="popup-info-label">Coord Y:</span><span class="popup-info-value">${feat.point[1].toFixed(2)}</span></div>`;
                html += `<div class="popup-info-row"><span class="popup-info-label">Coord Z:</span><span class="popup-info-value">${feat.point[2].toFixed(2)}</span></div>`;
            }
        }
    
    // 2. Branch for SPOT POINTS
    else if (feat.is_manual_spot) {
        html += `<div class="popup-info-row"><span class="popup-info-label">Mode:</span><span class="popup-info-value">Spot Point</span></div>`;
        html += `<div class="popup-info-row"><span class="popup-info-label">Geometry:</span><span class="popup-info-value">${feat.geometry || 'plane'}</span></div>`;
        
        if (feat.geometry === 'line') {
            html += `<div class="popup-info-row"><span class="popup-info-label">Trend:</span><span class="popup-info-value">${feat.trend}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Plunge:</span><span class="popup-info-value">${feat.plunge}°</span></div>`;
        } else if (feat.geometry === 'plane') {
            html += `<div class="popup-info-row"><span class="popup-info-label">Strike:</span><span class="popup-info-value">${feat.strike}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Dip Dir:</span><span class="popup-info-value">${feat.dip_dir}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Dip:</span><span class="popup-info-value">${feat.dip}°</span></div>`;
        } else if (feat.geometry === 'plane&line') {
            html += `<div class="popup-info-row"><span class="popup-info-label">Strike:</span><span class="popup-info-value">${feat.strike}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Dip Dir:</span><span class="popup-info-value">${feat.dip_dir}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Dip:</span><span class="popup-info-value">${feat.dip}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Trend:</span><span class="popup-info-value">${feat.trend}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Plunge:</span><span class="popup-info-value">${feat.plunge}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Rake:</span><span class="popup-info-value">${feat.rake}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Sense:</span><span class="popup-info-value">${feat.sense}</span></div>`;
        }
        
        if (feat.point) {
            html += `<div class="popup-info-row"><span class="popup-info-label">Coord X:</span><span class="popup-info-value">${feat.point[0].toFixed(2)}</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Coord Y:</span><span class="popup-info-value">${feat.point[1].toFixed(2)}</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Coord Z:</span><span class="popup-info-value">${feat.point[2].toFixed(2)}</span></div>`;
        }
    }
    // 3. Branch for POLYLINES
    else {
        html += `<div class="popup-info-row"><span class="popup-info-label">Mode:</span><span class="popup-info-value">Polyline (3D)</span></div>`;
        html += `<div class="popup-info-row"><span class="popup-info-label">N. Nodes:</span><span class="popup-info-value">${feat.line ? feat.line.length : 0}</span></div>`;
        if (feat.line && feat.line.length >= 3) {
            const pca = calculatePCAAndOrientationJS(feat.line);
            html += `<div class="popup-info-row"><span class="popup-info-label">Strike (PCA):</span><span class="popup-info-value">${pca.strike}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Dip Dir (PCA):</span><span class="popup-info-value">${pca.dipDir}°</span></div>`;
            html += `<div class="popup-info-row"><span class="popup-info-label">Dip (PCA):</span><span class="popup-info-value">${pca.dip}°</span></div>`;
        }
    }
    if (feat.custom_fields && Object.keys(feat.custom_fields).length > 0) {
            Object.entries(feat.custom_fields).forEach(([key, val]) => {
                html += `<div class="popup-info-row"><span class="popup-info-label">${key}:</span><span class="popup-info-value">${val !== undefined && val !== null ? val : '-'}</span></div>`;
            });
        }
    document.getElementById('feature-info-content').innerHTML = html;
    document.getElementById('feature-info-popup').style.display = 'block';
    document.getElementById('feature-delete-popup').style.display = 'flex';

    document.getElementById('status').textContent = 'Feature #' + featId + ' Selected 🟡';
    document.getElementById('status').style.color = '#ffaa00';
}

function deselectFeature() {
    if (selectedFeatureId === null) return;
    const feat = digitizedFeatures.find(f => f.id === selectedFeatureId);
    if (feat && feat.group) {
        feat.group.traverse(child => {
            // Ignore the rake indicator and all its sub-elements
            if (child.userData?.isIndicator || child.parent?.userData?.isIndicator || child.parent?.parent?.userData?.isIndicator) {
                return;
            }

            if (child.isPoints) child.material.color.setHex(feat.is_manual_spot ? 0xff00ff : 0x00ff00);
            else if (child.isLine || child.isLineSegments) child.material.color.setHex(feat.is_manual_spot ? 0xff88ff : 0x00ff00);
            else if (child.isMesh) { child.material.color.setHex(feat.is_manual_spot ? 0xff00ff : 0x00aaff); child.material.opacity = feat.is_manual_spot ? 0.45 : 0.25; }
        });
    }
    selectedFeatureId = null;

    document.getElementById('feature-info-popup').style.display = 'none';
    document.getElementById('feature-delete-popup').style.display = 'none';

    document.getElementById('status').textContent = 'Model Loaded ✓';
    document.getElementById('status').style.color = '#1D9E75';
}

function deleteSelectedFeature() {
            if (selectedFeatureId === null) return;
            const featIdx = digitizedFeatures.findIndex(f => f.id === selectedFeatureId);
            if (featIdx !== -1) {
                const featToDelete = digitizedFeatures[featIdx];
                if (featToDelete.is_note && featToDelete.note_type === 'photo' && featToDelete.photo_file) {
                    deleteNoteMediaFromDisk(featToDelete.photo_file);
                }
                safeDispose(featToDelete.group);
                const delId = featToDelete.id;
                digitizedFeatures.splice(featIdx, 1);
                deselectFeature();
                updateVisibilityFiltersUI(); updateUI();
                document.getElementById('status').textContent = 'Feature #' + delId + ' Deleted 🗑️';
            }
        }

// 1. Dynamically generate the Key / Value input row in the DOM
function addCustomFieldInput(key = '', value = '') {
    const container = document.getElementById('custom-fields-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'custom-field-row';
    row.style.cssText = 'background: #1e1e1e; padding: 4px; border: 1px solid #333; border-radius: 4px; margin-bottom: 5px; box-sizing: border-box; width: 100%;';

    // Handler that intercepts both touch and click, stopping panel drag
    const lidarAction = "event.stopPropagation(); measureWithLiDAR(this);";

    const lidarBtnHTML = `
        <button type="button" 
                onclick="${lidarAction}" 
                ontouchstart="${lidarAction}" 
                style="width: 22px; height: 18px; line-height: 18px; text-align: center; padding: 0; font-size: 10px; background: #28a745; color: #fff; border: none; border-radius: 2px; cursor: pointer; flex-shrink: 0; position: relative; z-index: 10; pointer-events: auto !important;" 
                title="Measure with LiDAR">📐</button>
    `;

    row.innerHTML = `
        <!-- First row: Name + Compact Delete Button -->
        <div style="display: flex; gap: 4px; align-items: center; margin-bottom: 3px; width: 100%; box-sizing: border-box;">
            <input type="text" class="custom-key-input" placeholder="Name" value="${key}" style="flex: 1; min-width: 0; font-size: 10px; padding: 2px 4px; background: #282828; color: #fff; border: 1px solid #444; border-radius: 3px; box-sizing: border-box; outline: none;">
            <button type="button" onclick="event.stopPropagation(); this.closest('.custom-field-row').remove()" ontouchstart="event.stopPropagation(); this.closest('.custom-field-row').remove()" style="width: 15px; height: 15px; line-height: 15px; text-align: center; padding: 0; font-size: 9px; background: #dc3545; color: #fff; border: none; border-radius: 2px; cursor: pointer; flex-shrink: 0; position: relative; z-index: 10; pointer-events: auto !important;" title="Delete">✕</button>
        </div>
        <!-- Second row: Value + LiDAR Button -->
        <div style="display: flex; gap: 4px; align-items: center; width: 100%; box-sizing: border-box;">
            <input type="text" class="custom-val-input" placeholder="Value" value="${value}" style="flex: 1; min-width: 0; font-size: 10px; padding: 2px 4px; background: #282828; color: #fff; border: 1px solid #444; border-radius: 3px; box-sizing: border-box; outline: none;">
            ${lidarBtnHTML}
        </div>
    `;

    container.appendChild(row);
}

// 2. Reads all entered inputs and returns them as a JSON object
function getCustomFieldsValues() {
    const customFields = {};
    const rows = document.querySelectorAll('#custom-fields-container .custom-field-row');

    rows.forEach(row => {
        const keyInput = row.querySelector('.custom-key-input');
        const valInput = row.querySelector('.custom-val-input');

        const key = keyInput ? keyInput.value.trim() : '';
        const val = valInput ? valInput.value.trim() : '';

        if (key !== '') {
            customFields[key] = val;
        }
    });

    return customFields;
}
