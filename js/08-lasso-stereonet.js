// ==================== STEREONET & LASSO FUNCTIONS ====================

let isLassoMode = false;
let isDrawingLasso = false;
let lassoPoints = [];
let lassoCanvas = null;
let lassoCtx = null;
let stereonetData = {
    features: [],
    colorMap: {},
    filters: { type: {}, unit: {}, set: {} },
    colorBy: 'set'
};

const stereonetColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E2', '#F8B88B', '#82E0AA', '#F1948A', '#AED6F1'
];
let colorIndex = 0;

function toggleLassoMode() {
    isLassoMode = !isLassoMode;
    const btn = document.getElementById('btn-lasso');
    if (isLassoMode) {
        btn.style.background = '#1D9E75';
        btn.style.color = '#fff';
        controls.enabled = false;
        createLassoCanvas();
        lassoCanvas.addEventListener('mousedown', lassoMouseDown);
        lassoCanvas.addEventListener('touchstart', lassoTouchStart);
    } else {
        btn.style.background = '';
        btn.style.color = '';
        controls.enabled = true;
        if (lassoCanvas) {
            lassoCanvas.removeEventListener('mousedown', lassoMouseDown);
            lassoCanvas.removeEventListener('touchstart', lassoTouchStart);
            lassoCanvas.removeEventListener('mousemove', lassoMouseMove);
            lassoCanvas.removeEventListener('touchmove', lassoTouchMove);
            lassoCanvas.removeEventListener('mouseup', lassoMouseUp);
            lassoCanvas.removeEventListener('touchend', lassoTouchEnd);
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
        }
    }
}

function createLassoCanvas() {
    if (lassoCanvas) lassoCanvas.remove();
    lassoCanvas = document.createElement('canvas');
    lassoCanvas.width = window.innerWidth;
    lassoCanvas.height = window.innerHeight;
    lassoCanvas.style.position = 'fixed';
    lassoCanvas.style.top = '0';
    lassoCanvas.style.left = '0';
    lassoCanvas.style.zIndex = '999';
    lassoCanvas.style.cursor = 'crosshair';
    document.body.appendChild(lassoCanvas);
    lassoCtx = lassoCanvas.getContext('2d');
}

function lassoMouseDown(e) {
    e.preventDefault();
    if (!isLassoMode) return;
    
    isDrawingLasso = true;
    lassoPoints = [{x: e.clientX, y: e.clientY}];
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    lassoCtx.strokeStyle = '#1D9E75';
    lassoCtx.lineWidth = 2;
    lassoCtx.beginPath();
    lassoCtx.moveTo(e.clientX, e.clientY);
    
    lassoCanvas.addEventListener('mousemove', lassoMouseMove);
    lassoCanvas.addEventListener('mouseup', lassoMouseUp);
}

function lassoMouseMove(e) {
    e.preventDefault();
    if (!isDrawingLasso || !lassoCtx) return;
    lassoPoints.push({x: e.clientX, y: e.clientY});
    lassoCtx.lineTo(e.clientX, e.clientY);
    lassoCtx.stroke();
}

function lassoMouseUp(e) {
    e.preventDefault();
    if (!isDrawingLasso) return;
    isDrawingLasso = false;
    lassoCtx.closePath();
    lassoCtx.stroke();
    
    lassoCanvas.removeEventListener('mousemove', lassoMouseMove);
    lassoCanvas.removeEventListener('mouseup', lassoMouseUp);
    
    if (lassoPoints.length > 5) {
        const selected = selectFeaturesInLasso(lassoPoints);
        if (selected.length > 0) {
            openStereonetWindow(selected);
        } else {
            alert('No features found in lasso');
        }
    }
    
    setTimeout(() => {
        if (lassoCanvas) lassoCanvas.remove();
        lassoCanvas = null;
        lassoCtx = null;
        isLassoMode = false;
        controls.enabled = true;
        const btn = document.getElementById('btn-lasso');
        btn.style.background = '';
        btn.style.color = '';
    }, 300);
}

function lassoTouchStart(e) {
    e.preventDefault();
    if (!isLassoMode) return;
    
    const touch = e.touches[0];
    isDrawingLasso = true;
    lassoPoints = [{x: touch.clientX, y: touch.clientY}];
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    lassoCtx.strokeStyle = '#1D9E75';
    lassoCtx.lineWidth = 2;
    lassoCtx.beginPath();
    lassoCtx.moveTo(touch.clientX, touch.clientY);
    
    lassoCanvas.addEventListener('touchmove', lassoTouchMove);
    lassoCanvas.addEventListener('touchend', lassoTouchEnd);
}

function lassoTouchMove(e) {
    e.preventDefault();
    if (!isDrawingLasso || !lassoCtx) return;
    const touch = e.touches[0];
    lassoPoints.push({x: touch.clientX, y: touch.clientY});
    lassoCtx.lineTo(touch.clientX, touch.clientY);
    lassoCtx.stroke();
}

function lassoTouchEnd(e) {
    e.preventDefault();
    if (!isDrawingLasso) return;
    isDrawingLasso = false;
    lassoCtx.closePath();
    lassoCtx.stroke();
    
    lassoCanvas.removeEventListener('touchmove', lassoTouchMove);
    lassoCanvas.removeEventListener('touchend', lassoTouchEnd);
    
    if (lassoPoints.length > 5) {
        const selected = selectFeaturesInLasso(lassoPoints);
        if (selected.length > 0) {
            openStereonetWindow(selected);
        } else {
            alert('No features found in lasso');
        }
    }
    
    setTimeout(() => {
        if (lassoCanvas) lassoCanvas.remove();
        lassoCanvas = null;
        lassoCtx = null;
        isLassoMode = false;
        controls.enabled = true;
        const btn = document.getElementById('btn-lasso');
        btn.style.background = '';
        btn.style.color = '';
    }, 300);
}

function pointInPolygon(point, polygon) {
    const {x, y} = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function selectFeaturesInLasso(lassoPoints) {
    const selected = [];
    const v = new THREE.Vector3();
    
    if (!digitizedFeatures || digitizedFeatures.length === 0) return selected;
    
    digitizedFeatures.forEach(f => {
        if (!f.group) return;
        
        const worldPos = new THREE.Vector3();
        const box = new THREE.Box3().setFromObject(f.group);
        box.getCenter(worldPos);
        
        const screenPos = v.copy(worldPos).project(camera);
        const x = (screenPos.x + 1) / 2 * window.innerWidth;
        const y = (-screenPos.y + 1) / 2 * window.innerHeight;
        
        if (pointInPolygon({x, y}, lassoPoints)) {
            selected.push(f);
        }
    });
    
    return selected;
}

function getColorKey(f) {
    const mode = stereonetData.colorBy || 'set';
    let val = '';

    if (mode === 'set') val = (f.set || '').trim();
    else if (mode === 'type') val = (f.f_type || f.type || '').trim();
    else if (mode === 'unit') val = (f.unit || '').trim();

    return val ? `${mode}:${val}` : `${mode}:unspecified`;
}

function getColorForFeature(f) {
    const key = getColorKey(f);
    if (!stereonetData.colorMap[key]) {
        stereonetData.colorMap[key] = stereonetColors[colorIndex++ % stereonetColors.length];
    }
    return stereonetData.colorMap[key];
}

/**
 * Minimizes or expands the controls panel and redraws the stereonet
 */
function toggleStereonetControls() {
    const controls = document.getElementById('stereonet-controls');
    const btn = document.getElementById('stereonet-toggle-btn');
    if (!controls) return;

    controls.classList.toggle('collapsed');
    if (btn) btn.classList.toggle('active');

    setTimeout(() => {
        drawStereonet();
    }, 50);
}

function openStereonetWindow(selectedFeatures) {
    stereonetData.features = selectedFeatures;
    stereonetData.filters = { type: {}, unit: {}, set: {} };
    stereonetData.colorMap = {};
    colorIndex = 0;

    selectedFeatures.forEach(f => {
        const color = getColorForFeature(f);
        const tVal = (f.f_type || '').trim() || '(Unspecified)';
        const uVal = (f.unit || '').trim() || '(Unspecified)';
        const sVal = (f.set || '').trim() || '(Unspecified)';

        if (!stereonetData.filters.type[tVal]) stereonetData.filters.type[tVal] = { checked: true, count: 0, color };
        stereonetData.filters.type[tVal].count++;

        if (!stereonetData.filters.unit[uVal]) stereonetData.filters.unit[uVal] = { checked: true, count: 0, color };
        stereonetData.filters.unit[uVal].count++;

        if (!stereonetData.filters.set[sVal]) stereonetData.filters.set[sVal] = { checked: true, count: 0, color };
        stereonetData.filters.set[sVal].count++;
    });

    renderStereonetControls();

    const win = document.getElementById('stereonet-window');
    if (win) win.classList.add('show');

    const btmControls = document.getElementById('bottom-left-controls');
    if (btmControls) btmControls.style.display = 'none';

    setTimeout(() => {
        drawStereonet();
    }, 50);
}

function closeStereonetWindow() {
    const win = document.getElementById('stereonet-window');
    if (win) win.classList.remove('show');

    // RESTORE BOTTOM-LEFT BUTTONS
    const btmControls = document.getElementById('bottom-left-controls');
    if (btmControls) btmControls.style.display = 'flex';
}

function renderStereonetControls() {
    const controlsDiv = document.getElementById('stereonet-controls');
    controlsDiv.innerHTML = '';

    const displaySection = document.createElement('div');
    displaySection.className = 'stereo-section';
    displaySection.innerHTML = `
                <div class="stereo-section-title">Coloring & Display</div>
                <div class="field-group" style="margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <label for="stereo-color-by" class="stereo-label" style="font-size: 11px; white-space: nowrap;">Color by:</label>
                    <select id="stereo-color-by" class="stereo-select" style="width: 100%; border-radius: 4px; padding: 3px 6px; font-size: 11px; outline: none;">
                        <option value="set" ${stereonetData.colorBy === 'set' ? 'selected' : ''}>Set</option>
                        <option value="type" ${stereonetData.colorBy === 'type' ? 'selected' : ''}>Type</option>
                        <option value="unit" ${stereonetData.colorBy === 'unit' ? 'selected' : ''}>Unit</option>
                    </select>
                </div>
                <label class="stereo-toggle">
                    <input type="checkbox" id="stereo-show-poles" checked onchange="drawStereonet()">
                    <span>Poles</span>
                </label>
                <label class="stereo-toggle">
                    <input type="checkbox" id="stereo-show-gc" checked onchange="drawStereonet()">
                    <span>Great Circles</span>
                </label>
                <label class="stereo-toggle">
                    <input type="checkbox" id="stereo-show-lines" checked onchange="drawStereonet()">
                    <span>Lines / Lineations</span>
                </label>
                <label class="stereo-toggle">
                    <input type="checkbox" id="stereo-show-kinematic" checked onchange="drawStereonet()">
                    <span>Kinematic Arrows</span>
                </label>
                <label class="stereo-toggle">
                    <input type="checkbox" id="stereo-show-slip-normal" checked onchange="drawStereonet()">
                    <span>Slip Normal</span>
                </label>
                <label class="stereo-toggle">
                    <input type="checkbox" id="stereo-show-contours" onchange="drawStereonet()">
                    <span>Contours</span>
                </label>
            <label class="stereo-toggle">
                                <input type="checkbox" id="stereo-show-beta-axis" onchange="drawStereonet()">
                                <span>Beta Axis (PCA)</span>
                            </label>
                <div class="stereo-subsection" style="margin-top: 10px; padding: 8px; border-radius: 4px;">
                                    <div class="stereo-section-title">Contouring Options</div>
                                    <label style="display: block; margin-top: 5px; font-size: 11px;">Color Palette: 
                                        <select id="contour-color-ramp" class="stereo-select" style="width: 100%; margin-top: 3px; border-radius: 4px; padding: 3px 6px; font-size: 11px;" onchange="drawStereonet()">
                                            <option value="rainbow">Rainbow (Blue-Green-Red)</option>
                                            <option value="warm">Warm (Yellow-Orange-Red)</option>
                                            <option value="grayscale">Grayscale (Black-White)</option>
                                            <option value="viridis">Viridis</option>
                                            <option value="magma">Magma</option>
                                        </select>
                                    </label>
                                    <label style="display: block; margin-top: 5px; font-size: 11px;">Contour Levels: 
                                        <input type="number" id="contour-levels" class="stereo-input" value="5" min="2" max="20" style="width: 50px;" onchange="drawStereonet()">
                                    </label>
                                    <label style="display: block; margin-top: 5px; font-size: 11px;">Min Density (%): 
                                        <input type="number" id="contour-min-density" class="stereo-input" placeholder="Auto" step="0.5" style="width: 50px;" onchange="drawStereonet()">
                                    </label>
                                    <label style="display: block; margin-top: 5px; font-size: 11px;">Max Density (%): 
                                        <input type="number" id="contour-max-density" class="stereo-input" placeholder="Auto" step="0.5" style="width: 50px;" onchange="drawStereonet()">
                                    </label>
                                </div>
            `;
    controlsDiv.appendChild(displaySection);

    const colorSelect = displaySection.querySelector('#stereo-color-by');
    if (colorSelect) {
        colorSelect.addEventListener('change', (e) => {
            stereonetData.colorBy = e.target.value;
            stereonetData.colorMap = {};
            colorIndex = 0;
            renderStereonetControls();
            drawStereonet();
        });
    }

    const createFilterSection = (title, categoryKey) => {
        const dict = stereonetData.filters[categoryKey];
        if (Object.keys(dict).length === 0) return;

        const section = document.createElement('div');
        section.className = 'stereo-section';
        section.innerHTML = `<div class="stereo-section-title">${title}</div>`;

        const isCurrentColorMode = (categoryKey === stereonetData.colorBy);

        for (let key in dict) {
            const item = dict[key];
            const label = document.createElement('label');
            label.className = 'stereo-filter-item';
            
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = item.checked;
            chk.addEventListener('change', (e) => {
                item.checked = e.target.checked;
                drawStereonet();
            });

            const dot = document.createElement('span');
            dot.className = 'stereo-color-dot';
            if (isCurrentColorMode) {
                const lookupVal = key === '(Unspecified)' ? '' : key;
                const dummyFeature = { [categoryKey]: lookupVal };
                dot.style.background = getColorForFeature(dummyFeature);
            } else {
                dot.style.background = 'transparent';
                dot.className += ' stereo-dot-border';
            }

            const textSpan = document.createElement('span');
            textSpan.className = 'stereo-filter-label';
            textSpan.textContent = key;

            const countSpan = document.createElement('span');
            countSpan.className = 'stereo-count';
            countSpan.textContent = `(${item.count})`;

            label.appendChild(chk);
            label.appendChild(dot);
            label.appendChild(textSpan);
            label.appendChild(countSpan);
            section.appendChild(label);
        }
        controlsDiv.appendChild(section);
    };

    createFilterSection('By Set', 'set');
    createFilterSection('By Type', 'type');
    createFilterSection('By Unit', 'unit');
}
/**
 * Converte Strike, Dip e Rake nel Trend e Plunge della stria (lineazione)
 */
function strikeDipRakeToTrendPlunge(strike, dip, rake) {
    const strikeRad = (strike * Math.PI) / 180;
    const dipRad = (dip * Math.PI) / 180;
    const rakeRad = Math.PI - (rake * Math.PI) / 180;

    // Vettore Strike (GIS: E, N, Z=0)
    const sE = Math.sin(strikeRad);
    const sN = Math.cos(strikeRad);

    // Vettore Dip (rivolto verso l'alto sul piano di faglia)
    const dipDirRad = strikeRad + Math.PI / 2;
    const upE = -Math.sin(dipDirRad) * Math.cos(dipRad);
    const upN = -Math.cos(dipDirRad) * Math.cos(dipRad);
    const upZ = Math.sin(dipRad);

    // Vettore lineazione sul piano
    const lE = Math.cos(rakeRad) * sE + Math.sin(rakeRad) * upE;
    const lN = Math.cos(rakeRad) * sN + Math.sin(rakeRad) * upN;
    const lZ = Math.sin(rakeRad) * upZ;

    // Proiezione nell'emisfero inferiore (se lZ > 0 invertiamo il vettore)
    let dirE = lE, dirN = lN, dirZ = lZ;
    if (dirZ > 0) {
        dirE = -dirE; dirN = -dirN; dirZ = -dirZ;
    }

    const plunge = Math.asin(Math.max(-1, Math.min(1, -dirZ))) * (180 / Math.PI);
    let trend = Math.atan2(dirE, dirN) * (180 / Math.PI);
    trend = (trend + 360) % 360;

    return { trend, plunge };
}

/**
 * Disegna la freccia cinematica 2D sulla stria proiettata nello stereoplot
 */
function drawKinematicArrow(ctx, lx, ly, trendRad, feature, color) {
    const senseVal = (feature.sense || '').toLowerCase().trim();

    // Se la cinematica è NA, non specificata o vuota, interrompe la funzione
    if (!senseVal || senseVal === 'na' || senseVal === 'n/a' || senseVal === 'none' || senseVal === 'undefined') {
        return;
    }

    // Vettore radiale lungo la linea centro-stria
    const uRad = { x: Math.sin(trendRad), y: -Math.cos(trendRad) };
    // Vettore perpendicolare (tangenziale)
    const uTang = { x: Math.cos(trendRad), y: Math.sin(trendRad) };

    const isNormal   = senseVal.includes('normal')  || senseVal.includes('normale') || senseVal.includes('norm');
    const isReverse  = senseVal.includes('reverse') || senseVal.includes('inversa') || senseVal.includes('inv');
    const isDextral  = senseVal.includes('dextral') || senseVal.includes('destra')  || senseVal.includes('right') || senseVal.includes('dex');
    const isSinistral = senseVal.includes('sinistral') || senseVal.includes('sinistra') || senseVal.includes('left') || senseVal.includes('sin');

    let radFactor = 0;  // +1 = normale, -1 = inversa
    let tangFactor = 0; // +1 = destra, -1 = sinistra

    if (isNormal) radFactor = 1;
    else if (isReverse) radFactor = -1;

    if (isDextral) tangFactor = 1;
    else if (isSinistral) tangFactor = -1;

    // Se non è stato riconosciuto alcun movimento cinematico valido
    if (radFactor === 0 && tangFactor === 0) {
        return;
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;

    // ================= 1. TRASCORRENZE (DESTRA / SINISTRA) =================
    if (isSinistral || isDextral || (tangFactor !== 0 && radFactor === 0)) {
        const isRight = isDextral || tangFactor > 0;

        const circleRadius = 5; // Raggio del cerchio centrale stria
        const lineLen = 28;     // Lunghezza linea tangenziale
        const barbLen = 10;     // Lunghezza ardiglione

        const Vx = uRad.x, Vy = uRad.y;
        const Nx = uTang.x, Ny = uTang.y;

        const dirTop = isRight ? -1 : 1;
        const dirBot = -dirTop;

        // --- Linea Superiore (Tangente in +N) ---
        const topStartX = lx + Nx * circleRadius;
        const topStartY = ly + Ny * circleRadius;
        const topEndX   = topStartX + Vx * lineLen * dirTop;
        const topEndY   = topStartY + Vy * lineLen * dirTop;

        ctx.beginPath();
        ctx.moveTo(topStartX, topStartY);
        ctx.lineTo(topEndX, topEndY);
        ctx.stroke();

        // Barbetta superiore
        const topBackX = -Vx * dirTop;
        const topBackY = -Vy * dirTop;
        const barbTopX = (topBackX * Math.cos(Math.PI / 6) + Nx * Math.sin(Math.PI / 6)) * barbLen;
        const barbTopY = (topBackY * Math.cos(Math.PI / 6) + Ny * Math.sin(Math.PI / 6)) * barbLen;

        ctx.beginPath();
        ctx.moveTo(topEndX, topEndY);
        ctx.lineTo(topEndX + barbTopX, topEndY + barbTopY);
        ctx.stroke();

        // --- Linea Inferiore (Tangente in -N) ---
        const botStartX = lx - Nx * circleRadius;
        const botStartY = ly - Ny * circleRadius;
        const botEndX   = botStartX + Vx * lineLen * dirBot;
        const botEndY   = botStartY + Vy * lineLen * dirBot;

        ctx.beginPath();
        ctx.moveTo(botStartX, botStartY);
        ctx.lineTo(botEndX, botEndY);
        ctx.stroke();

        // Barbetta inferiore
        const botBackX = -Vx * dirBot;
        const botBackY = -Vy * dirBot;
        const barbBotX = (botBackX * Math.cos(Math.PI / 6) - Nx * Math.sin(Math.PI / 6)) * barbLen;
        const barbBotY = (botBackY * Math.cos(Math.PI / 6) - Ny * Math.sin(Math.PI / 6)) * barbLen;

        ctx.beginPath();
        ctx.moveTo(botEndX, botEndY);
        ctx.lineTo(botEndX + barbBotX, botEndY + barbBotY);
        ctx.stroke();

        return;
    }

    // ================= 2. DIP-SLIP (NORMALE / INVERSA / OBLIQUA) =================
    const dirX = radFactor * uRad.x + tangFactor * uTang.x;
    const dirY = radFactor * uRad.y + tangFactor * uTang.y;

    const norm = Math.hypot(dirX, dirY);
    if (norm === 0) return;

    const length = 30;
    const headSize = 12;

    const dx = (dirX / norm) * length;
    const dy = (dirY / norm) * length;

    const endX = lx + dx;
    const endY = ly + dy;

    // Asta
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Punta
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headSize * Math.cos(angle - Math.PI / 6), endY - headSize * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(endX - headSize * Math.cos(angle + Math.PI / 6), endY - headSize * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function drawStereonet() {
    const canvas = document.getElementById('stereonet-canvas');
    if (!canvas) return;
    const wrapper = document.getElementById('stereonet-canvas-wrapper');
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) * 0.9;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2 - 25;
    const R = (size / 2) * 0.72;

    const showContours = document.getElementById('stereo-show-contours')?.checked;

    // ================= 1.  CONTOURING (POLIGONI COLORATI) =================
    if (showContours) {
        const lineations = getVisibleLineations();

        if (lineations.length > 4) {
            const numLevels = Math.max(2, parseInt(document.getElementById('contour-levels')?.value || 5));
            const rawGridData = computeDensityGrid(lineations, 120, 10);
            const smoothedGrid = smoothGrid(rawGridData.grid, rawGridData.gridSize);
            const gridData = { grid: smoothedGrid, gridSize: rawGridData.gridSize };

            const grid = gridData.grid;
            let calcMin = Infinity;
            let calcMax = -Infinity;

            for (let j = 0; j < grid.length; j++) {
                for (let i = 0; i < grid[j].length; i++) {
                    const val = grid[j][i];
                    if (val !== null) {
                        if (val < calcMin) calcMin = val;
                        if (val > calcMax) calcMax = val;
                    }
                }
            }

            const inputMin = parseFloat(document.getElementById('contour-min-density')?.value);
            const inputMax = parseFloat(document.getElementById('contour-max-density')?.value);

            const minDensity = !isNaN(inputMin) ? inputMin : calcMin;
            const maxDensity = !isNaN(inputMax) ? inputMax : calcMax;

            if (minDensity < maxDensity) {
                const levels = [];
                for (let i = 0; i < numLevels; i++) {
                    levels.push(minDensity + (i / (numLevels - 1)) * (maxDensity - minDensity));
                }

                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, R, 0, Math.PI * 2);
                ctx.clip(); // Ritaglio perfetto dei poligoni dentro lo stereonet

                drawContours(ctx, gridData, levels, cx, cy, R);

                ctx.restore();
                
                
                drawColorbar(ctx, minDensity, maxDensity, levels, size, R, cy);
            }
        } else {
            ctx.fillStyle = '#999';
            ctx.font = '12px Arial';
            ctx.fillText(`Contouring requires >4 features (found: ${lineations.length})`, cx - 110, 30);
        }
    }

    // ================= 2. GRIGLIA E PRIMITIVA STEREONET =================
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();

    // ================= 3. DISEGNO FEATURE (SOLO SE CONTOURS È DISATTIVATO) =================
    let projectedCount = 0;

    // MODIFICA 1: Se il contouring è ATTIVO, non disegniamo poli/linee/strie
    if (!showContours) {
        const showPoles = document.getElementById('stereo-show-poles')?.checked;
        const showGC = document.getElementById('stereo-show-gc')?.checked;
        const showLines = document.getElementById('stereo-show-lines')?.checked;
        const showKinematic = document.getElementById('stereo-show-kinematic')?.checked;
        const showSlipNormal = document.getElementById('stereo-show-slip-normal')?.checked;

        stereonetData.features.forEach(f => {
            if (f.is_note || f.is_simple_polyline) return;
            
            const tVal = (f.f_type || '').trim() || '(Unspecified)';
            const uVal = (f.unit || '').trim() || '(Unspecified)';
            const sVal = (f.set || '').trim() || '(Unspecified)';

            if (stereonetData.filters.type[tVal]?.checked === false) return;
            if (stereonetData.filters.unit[uVal]?.checked === false) return;
            if (stereonetData.filters.set[sVal]?.checked === false) return;

            projectedCount++;
            const color = getColorForFeature(f);

            const isPlaneAndLine = f.geometry === 'plane&line' || (f.rake !== undefined && f.strike !== undefined);
            const isPureLinear = !isPlaneAndLine && (
                f.geometry === 'line' || f.is_linear ||
                (f.trend !== undefined && f.plunge !== undefined) ||
                (f.f_type && f.f_type.toLowerCase().includes('line') && !f.f_type.toLowerCase().includes('plane'))
            );

            if (isPureLinear) {
                if (!showLines) return;

                let trend = 0, plunge = 0;
                if (f.is_manual_spot || f.trend !== undefined) {
                    trend = f.trend || 0;
                    plunge = f.plunge || 0;
                } else if (f.line && f.line.length >= 2) {
                    const pca = calculatePCAAndOrientationJS(f.line);
                    trend = pca.trend !== undefined ? pca.trend : pca.strike;
                    plunge = pca.plunge !== undefined ? pca.plunge : pca.dip;
                }

                const trendRad = (trend * Math.PI) / 180;
                const plungeRad = (plunge * Math.PI) / 180;
                const rLine = R * Math.SQRT2 * Math.sin((Math.PI / 4) - (plungeRad / 2));

                const lx = cx + rLine * Math.sin(trendRad);
                const ly = cy - rLine * Math.cos(trendRad);

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.rect(lx - 4, ly - 4, 8, 8);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.stroke();

            } else {
                let strike = 0, dipDir = 0, dip = 0;

                if (f.is_manual_spot) {
                    strike = f.strike; dipDir = f.dip_dir; dip = f.dip;
                } else if (f.line && f.line.length >= 3) {
                    const pca = calculatePCAAndOrientationJS(f.line);
                    strike = pca.strike; dipDir = pca.dipDir; dip = pca.dip;
                } else return;

                const dipRad = (dip * Math.PI) / 180;
                const poleTrendRad = ((dipDir + 180) % 360) * Math.PI / 180;
                const polePlungeRad = (90 - dip) * Math.PI / 180;
                const rPole = R * Math.SQRT2 * Math.sin((Math.PI / 4) - (polePlungeRad / 2));

                const px = cx + rPole * Math.sin(poleTrendRad);
                const py = cy - rPole * Math.cos(poleTrendRad);

                if (showPoles) {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(px, py, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                if (showGC && dip > 0) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    const strikeRad = (strike * Math.PI) / 180;
                    let started = false;
                    for (let a = -90; a <= 90; a += 2) {
                        const aRad = (a * Math.PI) / 180;
                        const appDip = Math.atan(Math.tan(dipRad) * Math.cos(aRad));
                        const rGC = R * Math.SQRT2 * Math.sin((Math.PI / 4) - (appDip / 2));
                        const angle = strikeRad + aRad + Math.PI / 2;
                        const gx = cx + rGC * Math.sin(angle);
                        const gy = cy - rGC * Math.cos(angle);
                        if (!started) { ctx.moveTo(gx, gy); started = true; }
                        else { ctx.lineTo(gx, gy); }
                    }
                    ctx.stroke();
                }

                if (isPlaneAndLine && showKinematic) {
                    let trend = f.trend, plunge = f.plunge;

                    if (trend === undefined || plunge === undefined) {
                        const tp = strikeDipRakeToTrendPlunge(strike, dip, f.rake !== undefined ? f.rake : 90);
                        trend = tp.trend;
                        plunge = tp.plunge;
                    }

                    const trendRad = (trend * Math.PI) / 180;
                    const plungeRad = (plunge * Math.PI) / 180;
                    const rLine = R * Math.SQRT2 * Math.sin((Math.PI / 4) - (plungeRad / 2));

                    const lx = cx + rLine * Math.sin(trendRad);
                    const ly = cy - rLine * Math.cos(trendRad);

                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    drawKinematicArrow(ctx, lx, ly, trendRad, f, color);
                }

                if (isPlaneAndLine && showSlipNormal) {
                    const slipRake = ((f.rake !== undefined ? f.rake : 90) + 90) % 180;
                    const tp = strikeDipRakeToTrendPlunge(strike, dip, slipRake);
                    const trend = tp.trend;
                    const plunge = tp.plunge;
                    
                    const trendRad = (trend * Math.PI) / 180;
                    const plungeRad = (plunge * Math.PI) / 180;
                    const rLine = R * Math.SQRT2 * Math.sin((Math.PI / 4) - (plungeRad / 2));
                    const sx = cx + rLine * Math.sin(trendRad);
                    const sy = cy - rLine * Math.cos(trendRad);
                    
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        });
    } else {
        // Se i contorni sono attivi, aggiorna comunque il conteggio totale delle feature visibili
        stereonetData.features.forEach(f => {
            if (f.is_note || f.is_simple_polyline) return;
            const tVal = (f.f_type || '').trim() || '(Unspecified)';
            const uVal = (f.unit || '').trim() || '(Unspecified)';
            const sVal = (f.set || '').trim() || '(Unspecified)';
            if (stereonetData.filters.type[tVal]?.checked !== false &&
                stereonetData.filters.unit[uVal]?.checked !== false &&
                stereonetData.filters.set[sVal]?.checked !== false) {
                projectedCount++;
            }
        });
    }

    const totalBadge = document.getElementById('stereo-total-count');
    if (totalBadge) {
        totalBadge.textContent = projectedCount;
    }
    
    // ================= 4. DISEGNO BETA AXIS (PCA) E SCRITTA TITOLO =================
        const showBetaAxis = document.getElementById('stereo-show-beta-axis')?.checked;
        const titleHeader = document.querySelector('.stereo-section-title') || document.getElementById('stereo-title');

        if (showBetaAxis) {
            const pcaResult = calculateBetaAxisPCA();

            if (pcaResult) {
                const { eMax, eInt, eMin } = pcaResult;

                // Formattazione sintetica per il titolo
                const fmt = (tp) => `${String(tp.trend).padStart(3, '0')}/${String(tp.plunge).padStart(2, '0')}`;
                if (titleHeader) {
                    titleHeader.textContent = `Stereonet | V1:${fmt(eMax)} V2:${fmt(eInt)} β:${fmt(eMin)}`;
                }

                const projectToCanvas = (trend, plunge) => {
                    const trendRad = (trend * Math.PI) / 180;
                    const plungeRad = (plunge * Math.PI) / 180;
                    const r = R * Math.SQRT2 * Math.sin((Math.PI / 4) - (plungeRad / 2));
                    return {
                        x: cx + r * Math.sin(trendRad),
                        y: cy - r * Math.cos(trendRad)
                    };
                };

                // 1. Piano Pi Perpendicolare ad eMin (Beta Axis)
                const piDip = 90 - eMin.plunge;
                const piStrike = (eMin.trend + 90) % 360;

                if (piDip > 0) {
                    const dipRad = (piDip * Math.PI) / 180;
                    const strikeRad = (piStrike * Math.PI) / 180;

                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 2.25;
                    ctx.setLineDash([6, 3]);
                    ctx.beginPath();
                    let started = false;
                    for (let a = -90; a <= 90; a += 2) {
                        const aRad = (a * Math.PI) / 180;
                        const appDip = Math.atan(Math.tan(dipRad) * Math.cos(aRad));
                        const rGC = R * Math.SQRT2 * Math.sin((Math.PI / 4) - (appDip / 2));
                        const angle = strikeRad + aRad + Math.PI / 2;
                        const gx = cx + rGC * Math.sin(angle);
                        const gy = cy - rGC * Math.cos(angle);
                        if (!started) { ctx.moveTo(gx, gy); started = true; }
                        else { ctx.lineTo(gx, gy); }
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // 2. V1 (Max) - Verde
                const pMax = projectToCanvas(eMax.trend, eMax.plunge);
                ctx.fillStyle = '#00FF00';
                ctx.beginPath(); ctx.arc(pMax.x, pMax.y, 4, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();

                // 3. V2 (Int) - Ciano
                const pInt = projectToCanvas(eInt.trend, eInt.plunge);
                ctx.fillStyle = '#00FFFF';
                ctx.beginPath(); ctx.arc(pInt.x, pInt.y, 4, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();

                // 4. V3 / Beta Axis (Min) - Pallino Nero 180%
                const pMin = projectToCanvas(eMin.trend, eMin.plunge);
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(pMin.x, pMin.y, 7.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        } else {
            // Ripristina titolo predefinito se l'opzione è disattivata
            if (titleHeader && titleHeader.textContent.includes('V1:')) {
                titleHeader.textContent = 'Stereonet';
            }
        }
    }

window.addEventListener('resize', () => {
    const win = document.getElementById('stereonet-window');
    if (win && win.classList.contains('show')) {
        drawStereonet();
    }
});

window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        const win = document.getElementById('stereonet-window');
        if (win && win.classList.contains('show')) {
            drawStereonet();
        }
    }, 150);
});

function greatCircleDistance(t1, p1, t2, p2) {
    const t1r = (t1 * Math.PI) / 180, p1r = (p1 * Math.PI) / 180;
    const t2r = (t2 * Math.PI) / 180, p2r = (p2 * Math.PI) / 180;
    
    // Vettori 3D dei due punti
    const x1 = Math.cos(p1r) * Math.sin(t1r);
    const y1 = Math.cos(p1r) * Math.cos(t1r);
    const z1 = Math.sin(p1r);
    
    const x2 = Math.cos(p2r) * Math.sin(t2r);
    const y2 = Math.cos(p2r) * Math.cos(t2r);
    const z2 = Math.sin(p2r);
    
    // Prodotto scalare
    const dot = x1 * x2 + y1 * y2 + z1 * z2;
    
    // Math.abs(dot) gestisce la circolarità antipodale (080/89 == 260/89)
    return Math.acos(Math.min(1, Math.abs(dot))) * (180 / Math.PI);
}

function computeDensityGrid(lineations, gridSize = 120, countingRadius = 10) {
    const grid = [];
    const N = lineations.length;
    if (N === 0) return { grid: [], gridSize };

    const radLimit = (countingRadius * Math.PI) / 180;

    for (let j = 0; j < gridSize; j++) {
        const row = [];
        const ny = (j / (gridSize - 1)) * 2 - 1;

        for (let i = 0; i < gridSize; i++) {
            const nx = (i / (gridSize - 1)) * 2 - 1;
            const r2 = nx * nx + ny * ny;
            const r = Math.sqrt(r2);

            // Rimuoviamo il controllo r > maxR -> calcoliamo SEMPRE la direzione 3D.
            // La matematica di proiezione gestisce la direzione sulla sfera
            // anche oltre l'equatore.
            const sinVal = Math.max(-1, Math.min(1, r / Math.SQRT2));
            const plungeRad = (Math.PI / 2) - 2 * Math.asin(sinVal);

            let trendRad = Math.atan2(nx, -ny);
            if (trendRad < 0) trendRad += 2 * Math.PI;

            const trend = (trendRad * 180) / Math.PI;
            const plunge = (plungeRad * 180) / Math.PI;

            let count = 0;
            lineations.forEach(lin => {
                const dist = greatCircleDistance(trend, plunge, lin.trend, lin.plunge);
                if ((dist * Math.PI) / 180 <= radLimit) count++;
            });

            const kambDensity = (count / N) * 100;
            row.push(kambDensity);
        }
        grid.push(row);
    }

    return { grid, gridSize };
}

function drawContours(ctx, gridData, levels, cx, cy, R) {
    const grid = gridData.grid;
    const size = gridData.gridSize;
    if (!grid || size < 2) return;

    const cellSize = (R * 2) / (size - 1);

    // 1. Rendering dei Poligoni d'Intervallo (Filled Vector Bands)
    for (let l = 0; l < levels.length; l++) {
        const threshold = levels[l];
        const ratio = levels.length > 1 ? l / (levels.length - 1) : 0;
        
        // Usa direttamente getContourColor con la variabile 'ratio'
        ctx.fillStyle = getContourColor(ratio);

        ctx.beginPath();
        for (let j = 0; j < size - 1; j++) {
            for (let i = 0; i < size - 1; i++) {
                const v0 = grid[j][i];         // Top-Left
                const v1 = grid[j][i + 1];     // Top-Right
                const v2 = grid[j + 1][i + 1]; // Bottom-Right
                const v3 = grid[j + 1][i];     // Bottom-Left

                if (v0 === null || v1 === null || v2 === null || v3 === null) continue;

                // Calcolo della maschera binaria a 4 bit per la cella
                let cellState = 0;
                if (v0 >= threshold) cellState |= 1;
                if (v1 >= threshold) cellState |= 2;
                if (v2 >= threshold) cellState |= 4;
                if (v3 >= threshold) cellState |= 8;

                if (cellState === 0) continue;

                const x0 = cx - R + i * cellSize;
                const y0 = cy - R + j * cellSize;

                // Se la cella è completamente sopra la soglia, disegna un poligono pieno
                if (cellState === 15) {
                    ctx.rect(x0, y0, cellSize + 0.4, cellSize + 0.4);
                } else {
                    // Sotto-poligono interpolato per il bordo vettoriale della cella
                    drawCellSubPolygon(ctx, cellState, v0, v1, v2, v3, threshold, x0, y0, cellSize);
                }
            }
        }
        ctx.fill();
    }

    // 2. Tracciamento dei Bordi Neri Sottili sulle Isolinee
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.8; // Bordo nero sottile
    
    for (let l = 0; l < levels.length; l++) {
        const threshold = levels[l];
        ctx.beginPath();
        for (let j = 0; j < size - 1; j++) {
            for (let i = 0; i < size - 1; i++) {
                const v0 = grid[j][i], v1 = grid[j][i + 1];
                const v2 = grid[j + 1][i + 1], v3 = grid[j + 1][i];
                if (v0 === null || v1 === null || v2 === null || v3 === null) continue;

                let cellState = 0;
                if (v0 >= threshold) cellState |= 1;
                if (v1 >= threshold) cellState |= 2;
                if (v2 >= threshold) cellState |= 4;
                if (v3 >= threshold) cellState |= 8;

                if (cellState === 0 || cellState === 15) continue;

                const x0 = cx - R + i * cellSize;
                const y0 = cy - R + j * cellSize;
                traceCellContourLines(ctx, cellState, v0, v1, v2, v3, threshold, x0, y0, cellSize);
            }
        }
        ctx.stroke();
    }
}
// Helper: Interpola la posizione del punto lungo l'asse del valore di soglia
function interp(valA, valB, target) {
    if (Math.abs(valB - valA) < 1e-6) return 0.5;
    return (target - valA) / (valB - valA);
}

// Helper: Disegna i segmenti del bordo nero all'interno della cella
function traceCellContourLines(ctx, state, v0, v1, v2, v3, target, x, y, size) {
    const top = { x: x + interp(v0, v1, target) * size, y: y };
    const right = { x: x + size, y: y + interp(v1, v2, target) * size };
    const bottom = { x: x + interp(v3, v2, target) * size, y: y + size };
    const left = { x: x, y: y + interp(v0, v3, target) * size };

    switch (state) {
        case 1: case 14: ctx.moveTo(top.x, top.y); ctx.lineTo(left.x, left.y); break;
        case 2: case 13: ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); break;
        case 3: case 12: ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y); break;
        case 4: case 11: ctx.moveTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y); break;
        case 5:
            ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y);
            ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y);
            break;
        case 6: case 9: ctx.moveTo(top.x, top.y); ctx.lineTo(bottom.x, bottom.y); break;
        case 7: case 8: ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y); break;
        case 10:
            ctx.moveTo(top.x, top.y); ctx.lineTo(left.x, left.y);
            ctx.moveTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y);
            break;
    }
}

// Helper: Costruisce la geometria interpolata del poligono di livello
function drawCellSubPolygon(ctx, state, v0, v1, v2, v3, target, x, y, size) {
    const top = { x: x + interp(v0, v1, target) * size, y: y };
    const right = { x: x + size, y: y + interp(v1, v2, target) * size };
    const bottom = { x: x + interp(v3, v2, target) * size, y: y + size };
    const left = { x: x, y: y + interp(v0, v3, target) * size };

    const TL = { x: x, y: y }, TR = { x: x + size, y: y };
    const BR = { x: x + size, y: y + size }, BL = { x: x, y: y + size };

    const poly = (pts) => {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    };

    switch (state) {
        case 1: poly([TL, top, left]); break;
        case 2: poly([top, TR, right]); break;
        case 3: poly([TL, TR, right, left]); break;
        case 4: poly([right, BR, bottom]); break;
        case 5: poly([TL, top, right, BR, bottom, left]); break;
        case 6: poly([top, TR, BR, bottom]); break;
        case 7: poly([TL, TR, BR, bottom, left]); break;
        case 8: poly([left, bottom, BL]); break;
        case 9: poly([TL, top, bottom, BL]); break;
        case 10: poly([top, TR, right, bottom, BL, left]); break;
        case 11: poly([TL, TR, right, bottom, BL]); break;
        case 12: poly([left, right, BR, BL]); break;
        case 13: poly([TL, top, right, BR, BL]); break;
        case 14: poly([top, TR, BR, BL, left]); break;
    }
}


function getVisibleLineations() {
    const lineations = [];
    
    const showPoles = document.getElementById('stereo-show-poles')?.checked;
    const showLines = document.getElementById('stereo-show-lines')?.checked;
    const showKinematic = document.getElementById('stereo-show-kinematic')?.checked;
    const showSlipNormal = document.getElementById('stereo-show-slip-normal')?.checked;
    
    stereonetData.features.forEach(f => {
        // Filtri globali
        const tVal = (f.f_type || '').trim() || '(Unspecified)';
        const uVal = (f.unit || '').trim() || '(Unspecified)';
        const sVal = (f.set || '').trim() || '(Unspecified)';
        
        if (stereonetData.filters.type[tVal]?.checked === false) return;
        if (stereonetData.filters.unit[uVal]?.checked === false) return;
        if (stereonetData.filters.set[sVal]?.checked === false) return;
        
        if (f.is_note || f.is_simple_polyline) return;
        
        // Identificazione tipo di geometria
        const isPlaneAndLine = f.geometry === 'plane&line' || (f.rake !== undefined && f.strike !== undefined);
        const isPureLinear = !isPlaneAndLine && (
            f.geometry === 'line' || f.is_linear ||
            (f.trend !== undefined && f.plunge !== undefined) ||
            (f.f_type && f.f_type.toLowerCase().includes('line') && !f.f_type.toLowerCase().includes('plane'))
        );

        // ========== 1. LINEE PURE ==========
        if (isPureLinear && showLines) {
            let trend = 0, plunge = 0;
            if (f.trend !== undefined && f.plunge !== undefined) {
                trend = f.trend;
                plunge = f.plunge;
            } else if (f.line && f.line.length >= 2) {
                const pca = calculatePCAAndOrientationJS(f.line);
                trend = pca.trend !== undefined ? pca.trend : pca.strike;
                plunge = pca.plunge !== undefined ? pca.plunge : pca.dip;
            }
            lineations.push({ trend, plunge, type: 'line' });
            return;
        }
        
        // ========== 2. PIANI (PURI E PLANE&LINE) ==========
        let strike = 0, dip = 0, dipDir = 0;
        if (f.is_manual_spot) {
            strike = f.strike; dip = f.dip; dipDir = f.dip_dir;
        } else if (f.line && f.line.length >= 3) {
            const pca = calculatePCAAndOrientationJS(f.line);
            strike = pca.strike; dip = pca.dip; dipDir = pca.dipDir;
        } else return;

        // Estrazione POLI (per sia 'plane' che 'plane&line')
        if (showPoles) {
            const poloTrend = (dipDir + 180) % 360;
            const poloPlunge = 90 - dip;
            lineations.push({ trend: poloTrend, plunge: poloPlunge, type: 'pole' });
        }
        
        // Estrazione specifiche per PLANE & LINE
        if (isPlaneAndLine) {
            const rake = f.rake !== undefined ? f.rake : 90;

            // Kinematic / Stria
            if (showKinematic) {
                const tp = strikeDipRakeToTrendPlunge(strike, dip, rake);
                lineations.push({ trend: tp.trend, plunge: tp.plunge, type: 'lineation' });
            }

            // Slip Normal
            if (showSlipNormal) {
                const slipRake = (rake + 90) % 180;
                const tp = strikeDipRakeToTrendPlunge(strike, dip, slipRake);
                lineations.push({ trend: tp.trend, plunge: tp.plunge, type: 'slip-normal' });
            }
        }
    });
    
    return lineations;
}
function smoothGrid(grid, gridSize) {
    const smoothed = [];
    
    // Kernel Gaussiano 5x5 per griglie ad alta densità (es. 120x120)
    const kernel = [
        [1,  4,  7,  4, 1],
        [4, 16, 26, 16, 4],
        [7, 26, 41, 26, 7],
        [4, 16, 26, 16, 4],
        [1,  4,  7,  4, 1]
    ];
    const kernelSum = 273; // Somma totale dei pesi del kernel

    for (let j = 0; j < gridSize; j++) {
        const row = [];
        for (let i = 0; i < gridSize; i++) {
            if (grid[j][i] === null) {
                row.push(null);
                continue;
            }

            let sum = 0;
            let weightSum = 0;

            for (let dj = -2; dj <= 2; dj++) {
                for (let di = -2; di <= 2; di++) {
                    const nj = j + dj;
                    const ni = i + di;

                    if (nj >= 0 && nj < gridSize && ni >= 0 && ni < gridSize) {
                        const val = grid[nj][ni];
                        if (val !== null) {
                            const w = kernel[dj + 2][di + 2];
                            sum += val * w;
                            weightSum += w;
                        }
                    }
                }
            }
            row.push(weightSum > 0 ? sum / weightSum : grid[j][i]);
        }
        smoothed.push(row);
    }
    return smoothed;
}
// Aggiunto il parametro 'isDark' alla fine (default: true)
function drawColorbar(ctx, minVal, maxVal, levels, size, R, cy) {
    const numLevels = levels.length;
    if (numLevels < 2) return;

    // Rilevamento basato sulla classe 'light-theme'
    const isLight = document.body.classList.contains('light-theme');

    const textColor = isLight ? '#000000' : '#ffffff';
    const strokeColor = isLight ? '#000000' : '#ffffff';
    const gridLineColor = isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)';

    const barWidth = R * 2;
    const barHeight = 12;
    const barX = (size / 2) - (barWidth / 2);
    const barY = cy + R + 14;

    ctx.save();

    // 1. Disegno blocchi cromatici discreti
    const numBands = numLevels - 1;
    const bandWidth = barWidth / numBands;

    for (let b = 0; b < numBands; b++) {
        const ratio = b / (numLevels - 1);
        const x = barX + b * bandWidth;

        // Usa la funzione globale getContourColor
        ctx.fillStyle = getContourColor(ratio);
        ctx.fillRect(x, barY, bandWidth, barHeight);

        // Linee interne di separazione
        ctx.strokeStyle = gridLineColor;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x, barY, bandWidth, barHeight);
    }

    // Bordo esterno barra
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // 2. Tacche e numeri
    ctx.fillStyle = textColor;
    ctx.strokeStyle = strokeColor;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < numLevels; i++) {
        const ratio = i / (numLevels - 1);
        const x = barX + ratio * barWidth;
        const val = levels[i];

        ctx.beginPath();
        ctx.moveTo(x, barY + barHeight);
        ctx.lineTo(x, barY + barHeight + 5);
        ctx.stroke();

        ctx.fillText(`${val.toFixed(1)}%`, x, barY + barHeight + 7);
    }

    ctx.restore();
}


function getContourColor(ratio) {
    const ramp = document.getElementById('contour-color-ramp')?.value || 'rainbow';

    // Clampa ratio tra 0 e 1
    ratio = Math.max(0, Math.min(1, ratio));

    let r = 0, g = 0, b = 0;

    if (ramp === 'grayscale') {
        // Da Bianco/Grigio a Nero
        const val = Math.floor(255 * (1 - ratio));
        return `rgb(${val}, ${val}, ${val})`;
    }
    else if (ramp === 'warm') {
        // Giallo -> Arancione -> Rosso
        r = 255;
        g = Math.floor(255 * (1 - ratio));
        b = 0;
        return `rgb(${r}, ${g}, ${b})`;
    }
    else if (ramp === 'magma') {
        // Giallo chiaro -> Viola / Nero
        r = Math.floor(255 * Math.pow(1 - ratio, 0.5));
        g = Math.floor(200 * Math.pow(1 - ratio, 1.5));
        b = Math.floor(255 * ratio);
        return `rgb(${r}, ${g}, ${b})`;
    }
    else if (ramp === 'viridis') {
        // Giallo -> Verde -> Blu/Viola
        r = Math.floor(255 * (1 - ratio) * 0.9);
        g = Math.floor(230 * Math.sin(ratio * Math.PI));
        b = Math.floor(255 * ratio);
        return `rgb(${r}, ${g}, ${b})`;
    }
    else {
        // Rainbow: Blu (0,0,255) -> Verde (0,255,0) -> Rosso (255,0,0)
        if (ratio < 0.5) {
            const norm = ratio * 2;
            r = 0;
            g = Math.round(255 * norm);
            b = Math.round(255 * (1 - norm));
        } else {
            const norm = (ratio - 0.5) * 2;
            r = Math.round(255 * norm);
            g = Math.round(255 * (1 - norm));
            b = 0;
        }
        return `rgb(${r}, ${g}, ${b})`;
    }
}

/**
 * Calcola la PCA 3D sui vettori normali dei piani selezionati per estrarre:
 * - V1: Autovettore Max (Direzione principale dei poli)
 * - V2: Autovettore Intermedio
 * - V3: Autovettore Min (Asse Beta / Asse di piega)
 */
/**
 * Calcola la PCA sui vettori 3D forniti da getVisibleLineations()
 * per garantire perfetta corrispondenza con i dati del Contouring.
 */
/**
 * Calcola la PCA estraendo sia le Lineazioni/Strie sia i Poli dei Piani visibili.
 */
function calculateBetaAxisPCA() {
    const normals = [];

    // 1. Cicla su tutte le feature applicando i filtri di visibilità dell'interfaccia
    stereonetData.features.forEach(f => {
        if (f.is_note || f.is_simple_polyline) return;

        const tVal = (f.f_type || '').trim() || '(Unspecified)';
        const uVal = (f.unit || '').trim() || '(Unspecified)';
        const sVal = (f.set || '').trim() || '(Unspecified)';

        if (stereonetData.filters.type[tVal]?.checked === false) return;
        if (stereonetData.filters.unit[uVal]?.checked === false) return;
        if (stereonetData.filters.set[sVal]?.checked === false) return;

        let trend = null;
        let plunge = null;

        const isPlaneAndLine = f.geometry === 'plane&line' || (f.rake !== undefined && f.strike !== undefined);
        const isPureLinear = !isPlaneAndLine && (
            f.geometry === 'line' || f.is_linear ||
            (f.trend !== undefined && f.plunge !== undefined) ||
            (f.f_type && f.f_type.toLowerCase().includes('line') && !f.f_type.toLowerCase().includes('plane'))
        );

        if (isPureLinear) {
            // È una lineazione / stria
            if (f.is_manual_spot || f.trend !== undefined) {
                trend = f.trend || 0;
                plunge = f.plunge || 0;
            } else if (f.line && f.line.length >= 2) {
                const pca = calculatePCAAndOrientationJS(f.line);
                trend = pca.trend !== undefined ? pca.trend : pca.strike;
                plunge = pca.plunge !== undefined ? pca.plunge : pca.dip;
            }
        } else {
            // È un piano -> Estragga il POLO (perpendicolare al piano)
            let dipDir = 0, dip = 0;
            if (f.is_manual_spot) {
                dipDir = f.dip_dir; dip = f.dip;
            } else if (f.line && f.line.length >= 3) {
                const pca = calculatePCAAndOrientationJS(f.line);
                dipDir = pca.dipDir; dip = pca.dip;
            }

            if (dip !== undefined && dipDir !== undefined) {
                // Il Polo di un piano ha Trend = (DipDir + 180) % 360 e Plunge = 90 - Dip
                trend = (dipDir + 180) % 360;
                plunge = 90 - dip;
            }
        }

        // Se abbiamo estretto correttamente trend e plunge, convertiamo in vettore 3D
        if (trend !== null && plunge !== null) {
            const trendRad = (trend * Math.PI) / 180;
            const plungeRad = (plunge * Math.PI) / 180;

            // Coordinate 3D geologiche (X: Est, Y: Nord, Z: Basso)
            const x = Math.sin(trendRad) * Math.cos(plungeRad);
            const y = Math.cos(trendRad) * Math.cos(plungeRad);
            const z = Math.sin(plungeRad);

            normals.push([x, y, z]);
        }
    });

    if (normals.length < 3) return null;

    // 2. Costruzione Matrice di Orientazione M
    let M = [[0,0,0], [0,0,0], [0,0,0]];
    const N = normals.length;

    normals.forEach(v => {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                M[r][c] += (v[r] * v[c]) / N;
            }
        }
    });

    // 3. Diagonalizzazione Jacobi 3x3
    let V = [[1,0,0], [0,1,0], [0,0,1]];
    let A = M.map(row => [...row]);

    for (let iter = 0; iter < 50; iter++) {
        let maxOff = 0, p = 0, q = 1;
        for (let r = 0; r < 3; r++) {
            for (let c = r + 1; c < 3; c++) {
                if (Math.abs(A[r][c]) > maxOff) {
                    maxOff = Math.abs(A[r][c]);
                    p = r; q = c;
                }
            }
        }
        if (maxOff < 1e-9) break;

        let theta = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
        let c = Math.cos(theta), s = Math.sin(theta);

        let J = [[1,0,0], [0,1,0], [0,0,1]];
        J[p][p] = c; J[p][q] = s;
        J[q][p] = -s; J[q][q] = c;

        let newA = [[0,0,0],[0,0,0],[0,0,0]];
        for (let r = 0; r < 3; r++) {
            for (let col = 0; col < 3; col++) {
                for (let k = 0; k < 3; k++) {
                    for (let l = 0; l < 3; l++) {
                        newA[r][col] += J[k][r] * A[k][l] * J[l][col];
                    }
                }
            }
        }
        A = newA;

        let newV = [[0,0,0],[0,0,0],[0,0,0]];
        for (let r = 0; r < 3; r++) {
            for (let col = 0; col < 3; col++) {
                for (let k = 0; k < 3; k++) {
                    newV[r][col] += V[r][k] * J[k][col];
                }
            }
        }
        V = newV;
    }

    // 4. Ordinamento Autovalori (Max, Int, Min)
    let eig = [
        { val: A[0][0], vec: [V[0][0], V[1][0], V[2][0]] },
        { val: A[1][1], vec: [V[0][1], V[1][1], V[2][1]] },
        { val: A[2][2], vec: [V[0][2], V[1][2], V[2][2]] }
    ];
    eig.sort((a, b) => b.val - a.val);

    const vecToTrendPlunge = (v) => {
        let x = v[0], y = v[1], z = v[2];
        if (z < 0) { x = -x; y = -y; z = -z; } // Assicura Emisfero Inferiore (Z >= 0)
        const plunge = Math.asin(Math.max(-1, Math.min(1, z))) * (180 / Math.PI);
        let trend = Math.atan2(x, y) * (180 / Math.PI);
        trend = (trend + 360) % 360;
        return {
            trend: Math.round(trend),
            plunge: Math.round(plunge)
        };
    };

    return {
        eMax: vecToTrendPlunge(eig[0].vec),
        eInt: vecToTrendPlunge(eig[1].vec),
        eMin: vecToTrendPlunge(eig[2].vec)
    };
}
