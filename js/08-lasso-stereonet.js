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
            <label for="stereo-color-by" style="font-size: 11px; color: #aaa; white-space: nowrap;">Color by:</label>
            <select id="stereo-color-by" style="width: 100%; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 3px 6px; font-size: 11px; outline: none;">
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
                dot.style.border = '1px solid #555';
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
    const rakeRad = ((3.141592 - rake) * Math.PI) / 180;

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
    const cy = size / 2;
    const R = (size / 2) * 0.82;

    // Cerchio esterno
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Reticolo centrale
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();

    const showPoles = document.getElementById('stereo-show-poles')?.checked;
    const showGC = document.getElementById('stereo-show-gc')?.checked;
    const showLines = document.getElementById('stereo-show-lines')?.checked;
    const showKinematic = document.getElementById('stereo-show-kinematic')?.checked;

    // Counter for visible features
    let projectedCount = 0;

    stereonetData.features.forEach(f => {
        // Safe check with (f.prop || '') to avoid trim() crashes on undefined values
        if (f.is_note || f.is_simple_polyline) return;
        
        const tVal = (f.f_type || '').trim() || '(Unspecified)';
        const uVal = (f.unit || '').trim() || '(Unspecified)';
        const sVal = (f.set || '').trim() || '(Unspecified)';

        if (stereonetData.filters.type[tVal]?.checked === false) return;
        if (stereonetData.filters.unit[uVal]?.checked === false) return;
        if (stereonetData.filters.set[sVal]?.checked === false) return;

        // Increment count for visible features
        projectedCount++;

        const color = getColorForFeature(f);

        const isPlaneAndLine = f.geometry === 'plane&line' || (f.rake !== undefined && f.strike !== undefined);
        const isPureLinear = !isPlaneAndLine && (
            f.geometry === 'line' || f.is_linear ||
            (f.trend !== undefined && f.plunge !== undefined) ||
            (f.f_type && f.f_type.toLowerCase().includes('line') && !f.f_type.toLowerCase().includes('plane'))
        );

        if (isPureLinear) {
            // ================= ELEMENTI LINEARI PURI =================
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
            // ================= ELEMENTI PLANARI E PLANE&LINE =================
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

            // 1. Polo
            if (showPoles) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(px, py, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // 2. Grande Cerchio
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

            // 3. Stria e Freccia Cinematica (Plane & Line)
            if (isPlaneAndLine && showKinematic) {
                let trend = f.trend, plunge = f.plunge;

                // Calcolo Trend e Plunge dal Rake se non già presenti
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

                // Disegna il pallino di origine della stria
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Disegna i vettori cinematici
                drawKinematicArrow(ctx, lx, ly, trendRad, f, color);
            }
        }
    });

    // Update total count badge in DOM (fuori dal ciclo forEach)
    const totalBadge = document.getElementById('stereo-total-count');
    if (totalBadge) {
        totalBadge.textContent = projectedCount;
    }
}

// Ridimensiona e ridisegna lo stereonet durante il resize o cambio orientamento
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
