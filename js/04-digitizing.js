window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('pointerdown', e => {
    mouseDownPos.x = e.clientX; mouseDownPos.y = e.clientY; wasDragging = false;
});

window.addEventListener('pointermove', e => {
    if (e.buttons > 0 && Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y) > 4) wasDragging = true;
});

window.addEventListener('pointerup', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.closest('#ui') || e.target.closest('#sensor-ui') || e.target.closest('#polyline-metrics-ui') || e.target.closest('#declination-ui') || e.target.closest('#bottom-left-controls') || e.target.closest('#feature-info-popup') || e.target.closest('#feature-delete-popup')) return;
    if (document.activeElement) document.activeElement.blur();

    if (Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y) <= 4 && !wasDragging) {
        if (isSettingCenter) { setCenterAtMouse(e); return; }
        if (e.button === 0) {
            if (isDigitizing) {
                const mode = document.getElementById('digitize-mode').value;
                if (mode === 'note') addNoteAtMouse(e);
                else addPointAtMouse(e);
            } else {
                selectFeatureAtMouse(e);
            }
        }
        else if (e.button === 2) isDigitizing ? stopDigitizing() : deselectFeature();
    }
});

function supportsOrientation(type) {
    return type === 'polyline';
}

function toggleDigitizing() {
    if (!loadedMesh) return alert("Load a 3D model first!");
    deselectFeature();
    
    if (!isDigitizing) {
        cancelCurrentDigitizing();

        isDigitizing = true;
        const btn = document.getElementById('btn-toggle-digitize');
        if (btn) {
            btn.textContent = "⏹ Stop Digitizing";
            btn.className = "stop-btn";
        }
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.textContent = 'Digitizing Active...';
    } else {
        stopDigitizing();
    }
}

function cancelCurrentDigitizing() {
    isDigitizing = false;
    
    if (typeof currentPlaneMesh !== 'undefined' && currentPlaneMesh) { scene.remove(currentPlaneMesh); safeDispose(currentPlaneMesh); currentPlaneMesh = null; }
    if (typeof currentPlaneWireframe !== 'undefined' && currentPlaneWireframe) { scene.remove(currentPlaneWireframe); safeDispose(currentPlaneWireframe); currentPlaneWireframe = null; }
    if (typeof currentPointsObj !== 'undefined' && currentPointsObj) { scene.remove(currentPointsObj); safeDispose(currentPointsObj); currentPointsObj = null; }
    if (typeof currentLineMesh !== 'undefined' && currentLineMesh) { scene.remove(currentLineMesh); safeDispose(currentLineMesh); currentLineMesh = null; }
    
    currentPoints = [];
    currentPlaneCorners = null;

    const btn = document.getElementById('btn-toggle-digitize');
    if (btn) {
        const mode = document.getElementById('digitize-mode')?.value;
        if (mode === 'note') btn.textContent = "▶ Place Note";
        else if (mode === 'draped_polygon') btn.textContent = "▶ Draw Polygon";
        else btn.textContent = "▶ Start Digitizing";
        
        btn.className = "start-btn";
    }
    if (typeof updateUI === 'function') updateUI();
}

function stopDigitizing() {
    isDigitizing = false;
    try {
        finishFeature();
    } catch (err) {
        console.error("Error while finishing feature:", err);
    } finally {
        const btn = document.getElementById('btn-toggle-digitize');
        if (btn) {
            const mode = document.getElementById('digitize-mode')?.value;
            if (mode === 'note') btn.textContent = "▶ Place Note";
            else if (mode === 'draped_polygon') btn.textContent = "▶ Draw Polygon";
            else btn.textContent = "▶ Start Digitizing";
            
            btn.className = "start-btn";
        }
    }
}

function getEigen3x3(cov) {
    let A = [[cov.xx, cov.xy, cov.xz], [cov.xy, cov.yy, cov.yz], [cov.xz, cov.yz, cov.zz]];
    let V = [[1,0,0],[0,1,0],[0,0,1]];
    for (let iter = 0; iter < 20; iter++) {
        let p = 0, q = 1, maxVal = Math.abs(A[0][1]);
        if (Math.abs(A[0][2]) > maxVal) { p = 0; q = 2; maxVal = Math.abs(A[0][2]); }
        if (Math.abs(A[1][2]) > maxVal) { p = 1; q = 2; maxVal = Math.abs(A[1][2]); }
        if (maxVal < 1e-12) break;
        let app = A[p][p], aqq = A[q][q], apq = A[p][q];
        let phi = 0.5 * Math.atan2(2 * apq, aqq - app);
        let c = Math.cos(phi), s = Math.sin(phi);
        A[p][p] = c*c*app - 2*s*c*apq + s*s*aqq; A[q][q] = s*s*app + 2*s*c*apq + c*c*aqq;
        A[p][q] = 0; A[q][p] = 0;
        let other = 3 - p - q;
        let ap_o = A[p][other], aq_o = A[q][other];
        A[p][other] = c * ap_o - s * aq_o; A[other][p] = A[p][other];
        A[q][other] = s * ap_o + c * aq_o; A[other][q] = A[q][other];
        for (let i = 0; i < 3; i++) {
            let vip = V[i][p], viq = V[i][q];
            V[i][p] = c * vip - s * viq; V[i][q] = s * vip + c * viq;
        }
    }
    let items = [
        { val: A[0][0], vec: new THREE.Vector3(V[0][0], V[1][0], V[2][0]).normalize() },
        { val: A[1][1], vec: new THREE.Vector3(V[0][1], V[1][1], V[2][1]).normalize() },
        { val: A[2][2], vec: new THREE.Vector3(V[0][2], V[1][2], V[2][2]).normalize() }
    ].sort((a, b) => a.val - b.val);
    return { valMin: items[0].val, valMed: items[1].val, valMax: items[2].val, vecMin: items[0].vec, vecMed: items[1].vec, vecMax: items[2].vec };
}

function calculatePlaneCornersForPoints(points) {
    if (points.length < 3) return null;
    const centroid = new THREE.Vector3();
    points.forEach(p => centroid.add(p)); centroid.divideScalar(points.length);

    let xx=0, xy=0, xz=0, yy=0, yz=0, zz=0;
    points.forEach(p => {
        let dx = p.x - centroid.x, dy = p.y - centroid.y, dz = p.z - centroid.z;
        xx += dx*dx; xy += dx*dy; xz += dx*dz; yy += dy*dy; yz += dy*dz; zz += dz*dz;
    });
    let N = points.length;
    let eig = getEigen3x3({ xx: xx/N, xy: xy/N, xz: xz/N, yy: yy/N, yz: yz/N, zz: zz/N });

    let uMax = 0, vMax = 0, uVals = [], vVals = [];
    points.forEach(p => {
        let rel = new THREE.Vector3().subVectors(p, centroid);
        let u = rel.dot(eig.vecMax), v = rel.dot(eig.vecMed);
        uVals.push(u); vVals.push(v);
        if (Math.abs(u) > uMax) uMax = Math.abs(u);
        if (Math.abs(v) > vMax) vMax = Math.abs(v);
    });
    let a0 = uMax || 0.01, b0 = vMax || 0.01, kMax = 1.0;
    for (let i = 0; i < points.length; i++) {
        let r = Math.sqrt((uVals[i]*uVals[i])/(a0*a0) + (vVals[i]*vVals[i])/(b0*b0));
        if (r > kMax) kMax = r;
    }
    let a = a0 * kMax * 1.02, b = b0 * kMax * 1.02;

    let ellipsePoints = [];
    for (let i = 0; i < 36; i++) {
        let theta = (i / 36) * Math.PI * 2;
        ellipsePoints.push(new THREE.Vector3().copy(centroid).addScaledVector(eig.vecMax, a * Math.cos(theta)).addScaledVector(eig.vecMed, b * Math.sin(theta)));
    }
    return ellipsePoints;
}

function resetBestFitUI() {
    const ids = ['collinear-val', 'coplanar-val', 'strike-val', 'dipdir-val', 'dip-val', 'bestfit-strike', 'bestfit-dipdir', 'bestfit-dip'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
}

function updateBestFitPlane() {
    if (currentPlaneMesh) { scene.remove(currentPlaneMesh); safeDispose(currentPlaneMesh); currentPlaneMesh = null; }
    if (currentPlaneWireframe) { scene.remove(currentPlaneWireframe); safeDispose(currentPlaneWireframe); currentPlaneWireframe = null; }
    
    if (!currentPoints || currentPoints.length < 3) {
        if (typeof resetBestFitUI === 'function') resetBestFitUI();
        return;
    }

    // 1. Converti i punti locali Three.js in coordinate GIS [x, y, z] (stesso formato usato dal GeoJSON)
    const tc = typeof threeCenter !== 'undefined' ? threeCenter : { x: 0, y: 0, z: 0 };
    const po = typeof pythonOffset !== 'undefined' ? pythonOffset : { x: 0, y: 0, z: 0 };

    const gisPoints = currentPoints.map(p => [
        p.x + tc.x + po.x,
        -p.z - tc.z + po.y,
        p.y + tc.y + po.z
    ]);

    // 2. Esegui la PCA SOLO ed ESCLUSIVAMENTE per le polilinee 'polyline'
    const mode = document.getElementById('digitize-mode')?.value;
    if (supportsOrientation(mode) && typeof calculatePCAAndOrientationJS === 'function') {
        try {
            const pca = calculatePCAAndOrientationJS(gisPoints);
            
            setTxt('strike-val', pca.strike.toFixed(1) + '°');
            setTxt('dipdir-val', pca.dipDir.toFixed(1) + '°');
            setTxt('dip-val', pca.dip.toFixed(1) + '°');
            
            setTxt('collinear-val', pca.valMed > 1e-7 ? (pca.valMax / pca.valMed).toFixed(2) : "∞");
            setTxt('coplanar-val', pca.valMin > 1e-7 ? (1.0 / pca.valMin).toFixed(2) : "∞");
        } catch (e) {
            console.warn("Real-time PCA calculation error:", e);
        }
    } else {
        if (typeof resetBestFitUI === 'function') resetBestFitUI();
    }

    // 3. Genera la geometria del Best Fit Plane solo per polyline
    if (supportsOrientation(mode) && typeof calculatePlaneCornersForPoints === 'function') {
        currentPlaneCorners = calculatePlaneCornersForPoints(currentPoints);

        if (currentPlaneCorners) {
            const centroid = new THREE.Vector3();
            currentPoints.forEach(p => centroid.add(p));
            centroid.divideScalar(currentPoints.length);

            let vertices = [];
            for (let i = 0; i < currentPlaneCorners.length; i++) {
                let p1 = currentPlaneCorners[i], p2 = currentPlaneCorners[(i + 1) % currentPlaneCorners.length];
                vertices.push(centroid.x, centroid.y, centroid.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            }
            const planeGeo = new THREE.BufferGeometry();
            planeGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            planeGeo.computeVertexNormals();

            currentPlaneMesh = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
            scene.add(currentPlaneMesh);

            const lineGeo = new THREE.BufferGeometry().setFromPoints([...currentPlaneCorners, currentPlaneCorners[0]]);
            currentPlaneWireframe = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 }));
            scene.add(currentPlaneWireframe);
        }
    }
}

function createOrientedDiskGroup(centerThree, dipDir, dip) {
    const alpha = (dipDir * Math.PI) / 180.0;
    const delta = (dip * Math.PI) / 180.0;

    const nx_gis = Math.sin(alpha) * Math.sin(delta);
    const ny_gis = Math.cos(alpha) * Math.sin(delta);
    const nz_gis = Math.cos(delta);

    const normalThree = new THREE.Vector3(nx_gis, nz_gis, -ny_gis).normalize();

    const circleGeo = new THREE.CircleGeometry(1.0, 28);
    const diskMesh = new THREE.Mesh(circleGeo, new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    diskMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalThree);

    const edges = new THREE.EdgesGeometry(circleGeo);
    const ringLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff88ff, linewidth: 2 }));
    ringLine.quaternion.copy(diskMesh.quaternion);

    const pointMesh = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]),
        new THREE.PointsMaterial({ color: 0xff00ff, size: 8, sizeAttenuation: false })
    );

    const group = new THREE.Group();
    group.position.copy(centerThree);
    group.add(diskMesh); group.add(ringLine); group.add(pointMesh);
    return group;
}

function createLineArrowGroup(centerThree, trend, plunge) {
    const alpha = (trend * Math.PI) / 180.0;
    const delta = (plunge * Math.PI) / 180.0;

    const e_gis = Math.sin(alpha) * Math.cos(delta);
    const n_gis = Math.cos(alpha) * Math.cos(delta);
    const z_gis = -Math.sin(delta);

    const dirThree = new THREE.Vector3(e_gis, z_gis, -n_gis).normalize();

    const arrow = new THREE.ArrowHelper(dirThree, new THREE.Vector3(0, 0, 0), 1.3, 0xff00ff, 0.4, 0.25);

    const pointMesh = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]),
        new THREE.PointsMaterial({ color: 0xff00ff, size: 8, sizeAttenuation: false })
    );

    const group = new THREE.Group();
    group.position.copy(centerThree);
    group.add(arrow); group.add(pointMesh);
    return group;
}

function createRakeIndicator(strike, dip, rake, sense) {
    const strikeRad = (strike * Math.PI) / 180.0;
    const dipDirRad = ((strike + 90) * Math.PI) / 180.0;
    const dipRad = (dip * Math.PI) / 180.0;
    const rakeRad = (rake * Math.PI) / 180.0;

    const strikeVec = { e: Math.sin(strikeRad), n: Math.cos(strikeRad), z: 0 };
    const dipVec = {
        e: Math.sin(dipDirRad) * Math.cos(dipRad),
        n: Math.cos(dipDirRad) * Math.cos(dipRad),
        z: -Math.sin(dipRad)
    };

    const e = Math.cos(rakeRad) * strikeVec.e + Math.sin(rakeRad) * dipVec.e;
    const n = Math.cos(rakeRad) * strikeVec.n + Math.sin(rakeRad) * dipVec.n;
    const z = Math.cos(rakeRad) * strikeVec.z + Math.sin(rakeRad) * dipVec.z;

    const dirThree = new THREE.Vector3(e, z, -n).normalize();

    const nx_gis = Math.sin(dipDirRad) * Math.sin(dipRad);
    const ny_gis = Math.cos(dipDirRad) * Math.sin(dipRad);
    const nz_gis = Math.cos(dipRad);
    const normalThree = new THREE.Vector3(nx_gis, nz_gis, -ny_gis).normalize();

    const senseVal = (sense || 'NA').toLowerCase();
    const hasNormal = senseVal.includes('normal');
    const hasReverse = senseVal.includes('reverse');
    const hasLeft = senseVal.includes('left');
    const hasRight = senseVal.includes('right');

    if (hasReverse) dirThree.negate();

    if (hasNormal || hasReverse) {
        const arrow = new THREE.ArrowHelper(dirThree, new THREE.Vector3(0, 0, 0), 1.3, 0xffff00, 0.4, 0.25);
        arrow.traverse(c => c.userData.isIndicator = true);
        return arrow;
    }
    else if (hasLeft || hasRight) {
        const group = new THREE.Group();
        const sideVec = new THREE.Vector3().crossVectors(normalThree, dirThree).normalize();
        const circleRadius = 0.9;

        const startPt = dirThree.clone().multiplyScalar(-circleRadius);
        const endPt = dirThree.clone().multiplyScalar(circleRadius);
        const lineGeo = new THREE.BufferGeometry().setFromPoints([startPt, endPt]);
        const lineMesh = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 }));
        group.add(lineMesh);

        function createHalfCone(tipDir, tipPosition, sideOffsetDir, rotate180 = false) {
            const radius = 0.14;
            const height = 0.35;

            const coneGeo = new THREE.ConeGeometry(radius, height, 16, 1, false, 0, Math.PI);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
            
            const coneMesh = new THREE.Mesh(coneGeo, mat);
            coneMesh.position.set(0, -height / 2, 0);

            const coneGroup = new THREE.Group();
            coneGroup.add(coneMesh);

            const yLocal = tipDir.clone().normalize();
            const zLocal = sideOffsetDir.clone().normalize();
            const xLocal = new THREE.Vector3().crossVectors(yLocal, zLocal).normalize();

            const rotMatrix = new THREE.Matrix4().makeBasis(xLocal, yLocal, zLocal);
            coneGroup.rotation.setFromRotationMatrix(rotMatrix);

            if (rotate180) {
                coneGroup.rotateY(Math.PI);
            }

            coneGroup.position.copy(tipPosition);
            return coneGroup;
        }

        const dirTop = dirThree.clone().negate();
        const dirBottom = dirThree.clone();

        const posTipTop = dirThree.clone().multiplyScalar(-circleRadius);
        const posTipBottom = dirThree.clone().multiplyScalar(circleRadius);

        const coneTop = createHalfCone(dirTop, posTipTop, sideVec, false);
        const coneBottom = createHalfCone(dirBottom, posTipBottom, sideVec.clone().negate(), true);

        group.add(coneTop);
        group.add(coneBottom);

        const absRake = Math.abs(rake);
        const shouldFlip = (hasLeft && absRake > 90) || (hasRight && absRake < 90);

        if (shouldFlip) {
            group.rotateOnAxis(normalThree, Math.PI);
        }

        group.traverse(c => c.userData.isIndicator = true);
        return group;
    }
    else {
        const start = dirThree.clone().multiplyScalar(-1.3);
        const end = dirThree.clone().multiplyScalar(1.3);
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 }));
        line.traverse(c => c.userData.isIndicator = true);
        return line;
    }
}

function updateSpotDisksScale() {
    const userPixelSize = parseFloat(document.getElementById('input-disk-size')?.value) || 35;
    const currentH = window.innerHeight;
    const vFOV = THREE.MathUtils.degToRad(camera.fov);
    const factor = (userPixelSize / currentH) * 2.0 * Math.tan(vFOV / 2.0);

    digitizedFeatures.forEach(f => {
        if (f.is_manual_spot && f.group) {
            const distance = camera.position.distanceTo(f.group.position);
            const worldRadius = distance * factor;
            f.group.scale.set(worldRadius, worldRadius, worldRadius);
        }
    });
}

function updatePolygonPreviewLine() {
    if (currentLineMesh) { scene.remove(currentLineMesh); safeDispose(currentLineMesh); currentLineMesh = null; }
    if (currentPointsObj) { scene.remove(currentPointsObj); safeDispose(currentPointsObj); currentPointsObj = null; }

    if (currentPoints.length === 0) return;

    currentPointsObj = new THREE.Points(new THREE.BufferGeometry().setFromPoints(currentPoints), activePointsMat);
    scene.add(currentPointsObj);

    if (currentPoints.length < 2) return;

    const pointsToRender = [...currentPoints];
    if (currentPoints.length >= 3) {
        pointsToRender.push(currentPoints[0]);
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints(pointsToRender);
    currentLineMesh = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x00e676, linewidth: 2 }));
    scene.add(currentLineMesh);
}

function addPointAtMouse(e) {
    if (!loadedMesh) return;
    updateMouseCoords(e);
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(loadedMesh, true);
    if (intersects.length === 0) return;

    let pt = intersects[0].point.clone();
    const mode = document.getElementById('digitize-mode').value;

    if (mode === 'spot_point') {
        const currentFeatId = featureCounter++;
        const geometryType = document.getElementById('input-geometry').value || 'plane';

        const strikeVal = parseFloat(document.getElementById('input-strike').value) || 0;
        const dipDirVal = parseFloat(document.getElementById('input-dipdir').value) || 0;
        const dipVal = parseFloat(document.getElementById('input-dip').value) || 0;
        const rakeVal = parseFloat(document.getElementById('input-rake').value) || 90;
        const trendVal = parseFloat(document.getElementById('input-trend').value) || 0;
        const plungeVal = parseFloat(document.getElementById('input-plunge').value) || 0;
        const senseVal = document.getElementById('input-sense').value || 'NA';

        let spotGroup;
        if (geometryType === 'line') {
            spotGroup = createLineArrowGroup(pt, trendVal, plungeVal);
        } else if (geometryType === 'plane') {
            spotGroup = createOrientedDiskGroup(pt, dipDirVal, dipVal);
        } else {
            spotGroup = createOrientedDiskGroup(pt, dipDirVal, dipVal);
            spotGroup.add(createRakeIndicator(strikeVal, dipVal, rakeVal, senseVal));
        }

        spotGroup.userData.featureId = currentFeatId;
        spotGroup.traverse(c => { c.userData.featureId = currentFeatId; });
        scene.add(spotGroup);

        const gisPt = [
            pt.x + threeCenter.x + pythonOffset.x,
            -pt.z - threeCenter.z + pythonOffset.y,
            pt.y + threeCenter.y + pythonOffset.z
        ];

        const spotData = {
            id: currentFeatId,
            is_manual_spot: true,
            f_type: document.getElementById('input-type').value || '',
            unit: document.getElementById('input-unit').value || '',
            set: document.getElementById('input-set').value || '',
            custom_fields: typeof getCustomFieldsValues === 'function' ? getCustomFieldsValues() : {},
            point: gisPt,
            geometry: geometryType,
            group: spotGroup
        };

        if (geometryType === 'line') {
            spotData.trend = trendVal;
            spotData.plunge = plungeVal;
        } else if (geometryType === 'plane') {
            spotData.strike = strikeVal;
            spotData.dip_dir = dipDirVal;
            spotData.dip = dipVal;
        } else if (geometryType === 'plane&line') {
            spotData.strike = strikeVal;
            spotData.dip_dir = dipDirVal;
            spotData.dip = dipVal;
            spotData.rake = rakeVal;
            spotData.sense = senseVal;
        }

        digitizedFeatures.push(spotData);

        updateVisibilityFiltersUI();
        updateUI();
        document.getElementById('status').textContent = 'Spot Orientation Point #' + currentFeatId + ' Saved ✓';
        return;
    }

    currentPoints.push(pt);

    if (mode === 'draped_polygon') {
        updatePolygonPreviewLine();
        updateUI();
        document.getElementById('status').textContent = 'Polygon Point #' + currentPoints.length + ' Added';
        return;
    }

    if (currentPointsObj) { scene.remove(currentPointsObj); safeDispose(currentPointsObj); }
    currentPointsObj = new THREE.Points(new THREE.BufferGeometry().setFromPoints(currentPoints), activePointsMat);
    scene.add(currentPointsObj);

    if (currentPoints.length > 1) {
        if (currentLineMesh) { scene.remove(currentLineMesh); safeDispose(currentLineMesh); }
        currentLineMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(currentPoints), new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 }));
        scene.add(currentLineMesh);
    }

    if (supportsOrientation(mode)) {
        updateBestFitPlane();
    } else {
        if (typeof currentPlaneMesh !== 'undefined' && currentPlaneMesh) {
            safeDispose(currentPlaneMesh);
            currentPlaneMesh = null;
        }
        if (typeof resetBestFitUI === 'function') resetBestFitUI();
    }

    updateUI();
}

function createFeatureGroup(savedPoints, savedCorners) {
    const featGroup = new THREE.Group();
    featGroup.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(savedPoints), new THREE.PointsMaterial({ color: 0x00ff00, size: 5, sizeAttenuation: false })));

    if (savedPoints.length >= 2) {
        featGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(savedPoints), new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })));
    }

    if (savedCorners && savedCorners.length >= 3) {
        const centroid = new THREE.Vector3(); savedPoints.forEach(p => centroid.add(p)); centroid.divideScalar(savedPoints.length);
        let vertices = [];
        for (let i = 0; i < savedCorners.length; i++) {
            let p1 = savedCorners[i], p2 = savedCorners[(i + 1) % savedCorners.length];
            vertices.push(centroid.x, centroid.y, centroid.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
        const planeGeo = new THREE.BufferGeometry();
        planeGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        featGroup.add(new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.25, side: THREE.DoubleSide })));
        featGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([...savedCorners, savedCorners[0]]), new THREE.LineBasicMaterial({ color: 0x00cccc, linewidth: 1 })));

        const centerGeo = new THREE.BufferGeometry().setFromPoints([centroid]);
        featGroup.add(new THREE.Points(centerGeo, new THREE.PointsMaterial({ color: 0xff00ff, size: 8, sizeAttenuation: false })));
    }
    return featGroup;
}

// Funzione helper per fotografare la vista e il clipping attuali
function captureSceneState() {
    return {
        camera: {
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: (typeof controls !== 'undefined' && controls.target)
                ? [controls.target.x, controls.target.y, controls.target.z]
                : [0, 0, 0],
            fov: camera.fov
        },
        clipping: {
            enabled: (typeof renderer !== 'undefined') ? renderer.localClippingEnabled || false : false,
            plane: (typeof clippingPlane !== 'undefined' && clippingPlane) ? {
                normal: [clippingPlane.normal.x, clippingPlane.normal.y, clippingPlane.normal.z],
                constant: clippingPlane.constant
            } : null
        }
    };
}

async function finishFeature() {
    const mode = document.getElementById('digitize-mode')?.value;

    try {
        // ==========================================
        // 1. POLIGONO DRAPPEGGIATO (is_draped_polygon: true)
        // ==========================================
        // ==========================================
                // 1. POLIGONO DRAPPEGGIATO (is_draped_polygon: true)
                // ==========================================
                if (mode === 'draped_polygon') {
                    if (currentPoints.length < 3) {
                                    alert("Please add at least 3 points to define the polygon perimeter.");
                                    return;
                                }

                                const initialColor = document.getElementById('input-color')?.value || '#00e676';
                                const selectedColor = await askColorWithPicker(initialColor);
                                if (!selectedColor) return;

                                const currentFeatId = featureCounter++;
                                const closedPoints = [...currentPoints, currentPoints[0].clone()];
                                const planeBasis = getPolygonPlaneBasis(closedPoints);

                                // Riscampiona proiettando direttamente con la camera corrente
                                const resampled3DPoints = resamplePathOnMesh(closedPoints, loadedMesh, planeBasis, 10, camera);
                                const polyGroup = createColoredDrapedMesh(resampled3DPoints, closedPoints, loadedMesh, parseInt(selectedColor.replace('#', ''), 16));

                                polyGroup.userData.featureId = currentFeatId;
                                polyGroup.traverse(c => { c.userData.featureId = currentFeatId; });
                                scene.add(polyGroup);

                                // CAPTURA DEI PARAMETRI ESATTI DELLA SCENA AL MOMENTO DEL SALVATAGGIO
                                const currentViewContext = {
                                    camera_position: [camera.position.x, camera.position.y, camera.position.z],
                                    camera_rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z],
                                    camera_fov: camera.fov,
                                    clipping_planes: (typeof renderer !== 'undefined' && renderer.clippingPlanes) ?
                                        renderer.clippingPlanes.map(p => ({ normal: [p.normal.x, p.normal.y, p.normal.z], constant: p.constant })) : []
                                };

                                const gisPoints = closedPoints.map(p => [
                                    p.x + threeCenter.x + pythonOffset.x,
                                    -p.z - threeCenter.z + pythonOffset.y,
                                    p.y + threeCenter.y + pythonOffset.z
                                ]);

                                digitizedFeatures.push({
                                    id: currentFeatId,
                                    is_manual_spot: false,
                                    is_draped_polygon: true,
                                    is_simple_polyline: false,
                                    color: selectedColor,
                                    strike: null,
                                    dip_dir: null,
                                    dip: null,
                                    f_type: document.getElementById('input-type')?.value || '',
                                    unit: document.getElementById('input-unit')?.value || '',
                                    set: document.getElementById('input-set')?.value || '',
                                    custom_fields: typeof getCustomFieldsValues === 'function' ? getCustomFieldsValues() : {},
                                    points: gisPoints,
                                    polygon: gisPoints,
                                    line: gisPoints,
                                    points_count: gisPoints.length,
                                    group: polyGroup,
                                    mode: mode,
                                    // SALVATAGGIO PARAMETRI SCENA NELL'OGGETTO FEATURE
                                    view_context: currentViewContext
                                });

                                if (typeof selectedFeatureId !== 'undefined') selectedFeatureId = currentFeatId;
                                document.getElementById('status').textContent = 'Draped Polygon #' + currentFeatId + ' Saved ✓';
                            }

        // ==========================================
        // 2. POLILINEA BEST-FIT (orientation)
        // ==========================================
        else if (mode === 'polyline') {
            if (currentPoints.length < 2) return;

            const currentFeatId = featureCounter++;
            const gisPoints = currentPoints.map(p => [
                p.x + threeCenter.x + pythonOffset.x,
                -p.z - threeCenter.z + pythonOffset.y,
                p.y + threeCenter.y + pythonOffset.z
            ]);

            const cornersToSave = currentPoints.length >= 3 ? calculatePlaneCornersForPoints(currentPoints) : null;
            const featGroup = createFeatureGroup(currentPoints, cornersToSave);
            featGroup.userData.featureId = currentFeatId;
            featGroup.traverse(c => { c.userData.featureId = currentFeatId; });
            scene.add(featGroup);

            // Calcolo orientamento PCA SOLO ed ESCLUSIVAMENTE per il Best-Fit ('polyline')
            const pcaStats = calculatePCAAndOrientationJS(gisPoints);

            const featureData = {
                id: currentFeatId,
                is_manual_spot: false,
                is_draped_polygon: false,
                is_simple_polyline: false,
                f_type: document.getElementById('input-type')?.value || '',
                unit: document.getElementById('input-unit')?.value || '',
                set: document.getElementById('input-set')?.value || '',
                custom_fields: typeof getCustomFieldsValues === 'function' ? getCustomFieldsValues() : {},
                points: gisPoints,
                line: gisPoints,
                points_count: gisPoints.length,
                group: featGroup,
                mode: mode
            };

            if (currentPoints.length >= 3) {
                featureData.strike = pcaStats.strike;
                featureData.dip_dir = pcaStats.dipDir;
                featureData.dip = pcaStats.dip;
                featureData.val_min = pcaStats.valMin;
                featureData.val_med = pcaStats.valMed;
                featureData.val_max = pcaStats.valMax;
            }

            digitizedFeatures.push(featureData);
            if (typeof selectedFeatureId !== 'undefined') selectedFeatureId = currentFeatId;
            document.getElementById('status').textContent = 'Best-Fit Polyline #' + currentFeatId + ' Saved ✓';
        }

        // ==========================================
        // 3. POLILINEA SEMPLICE (is_simple_polyline: true)
        // ==========================================
        else if (mode === 'simple_polyline') {
            if (currentPoints.length < 2) return;

            const currentFeatId = featureCounter++;
            const gisPoints = currentPoints.map(p => [
                p.x + threeCenter.x + pythonOffset.x,
                -p.z - threeCenter.z + pythonOffset.y,
                p.y + threeCenter.y + pythonOffset.z
            ]);

            const featGroup = createFeatureGroup(currentPoints, null);
            featGroup.userData.featureId = currentFeatId;
            featGroup.traverse(c => { c.userData.featureId = currentFeatId; });
            scene.add(featGroup);

            digitizedFeatures.push({
                id: currentFeatId,
                is_manual_spot: false,
                is_draped_polygon: false,
                is_simple_polyline: true,
                f_type: document.getElementById('input-type')?.value || '',
                unit: document.getElementById('input-unit')?.value || '',
                set: document.getElementById('input-set')?.value || '',
                custom_fields: typeof getCustomFieldsValues === 'function' ? getCustomFieldsValues() : {},
                points: gisPoints,
                line: gisPoints,
                points_count: gisPoints.length,
                group: featGroup,
                mode: mode
            });

            if (typeof selectedFeatureId !== 'undefined') selectedFeatureId = currentFeatId;
            document.getElementById('status').textContent = 'Simple Polyline #' + currentFeatId + ' Saved ✓';
        }

    } finally {
        if (currentPlaneMesh) { scene.remove(currentPlaneMesh); safeDispose(currentPlaneMesh); currentPlaneMesh = null; }
        if (currentPlaneWireframe) { scene.remove(currentPlaneWireframe); safeDispose(currentPlaneWireframe); currentPlaneWireframe = null; }
        if (currentPointsObj) { scene.remove(currentPointsObj); safeDispose(currentPointsObj); currentPointsObj = null; }
        if (currentLineMesh) { scene.remove(currentLineMesh); safeDispose(currentLineMesh); currentLineMesh = null; }

        currentPoints = [];
        currentPlaneCorners = null;

        updateVisibilityFiltersUI();
        updateUI();
    }
}

function calculatePCAAndOrientationJS(pointsGis) {
    if (pointsGis.length < 3) return { valMin: 0, valMed: 0, valMax: 0, strike: 0, dipDir: 0, dip: 0 };
    const N = pointsGis.length;
    let cx = 0, cy = 0, cz = 0;
    pointsGis.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; });
    cx /= N; cy /= N; cz /= N;

    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    pointsGis.forEach(p => {
        let dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz;
        xx += dx*dx; xy += dx*dy; xz += dx*dz; yy += dy*dy; yz += dy*dz; zz += dz*dz;
    });

    const eig = getEigen3x3({ xx: xx/N, xy: xy/N, xz: xz/N, yy: yy/N, yz: yz/N, zz: zz/N });
    const sumEig = eig.valMin + eig.valMed + eig.valMax;

    let nx = eig.vecMin.x, ny = eig.vecMin.y, nz = eig.vecMin.z;
    let normLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (normLen < 1e-9) return { valMin: 0, valMed: 0, valMax: 0, strike: 0, dipDir: 0, dip: 0 };

    nx /= normLen; ny /= normLen; nz /= normLen;
    let dip = Math.acos(Math.min(1.0, Math.abs(nz))) * (180.0 / Math.PI);

    let dnx = nz < 0 ? -nx : nx;
    let dny = nz < 0 ? -ny : ny;

    let dipDir = 0, strike = 0;
    if (Math.abs(dnx) >= 1e-9 || Math.abs(dny) >= 1e-9) {
        dipDir = (Math.atan2(dnx, dny) * (180.0 / Math.PI) + 360.0) % 360.0;
        strike = (dipDir - 90.0 + 360.0) % 360.0;
    }

    return {
        valMin: sumEig > 0 ? eig.valMin / sumEig : 0,
        valMed: sumEig > 0 ? eig.valMed / sumEig : 0,
        valMax: sumEig > 0 ? eig.valMax / sumEig : 0,
        strike: parseFloat(strike.toFixed(2)),
        dipDir: parseFloat(dipDir.toFixed(2)),
        dip: parseFloat(dip.toFixed(2))
    };
}

function getPolygonPlaneBasis(points) {
    const centroid = new THREE.Vector3();
    points.forEach(p => centroid.add(p));
    centroid.divideScalar(points.length);

    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    points.forEach(p => {
        const dx = p.x - centroid.x, dy = p.y - centroid.y, dz = p.z - centroid.z;
        xx += dx * dx; xy += dx * dy; xz += dx * dz;
        yy += dy * dy; yz += dy * dz; zz += dz * dz;
    });

    const N = points.length;
    const eig = getEigen3x3({ xx: xx / N, xy: xy / N, xz: xz / N, yy: yy / N, yz: yz / N, zz: zz / N });

    return {
        centroid: centroid,
        uAxis: eig.vecMax.clone().normalize(),
        vAxis: eig.vecMed.clone().normalize(),
        normal: eig.vecMin.clone().normalize()
    };
}

function projectToPlane2D(point3D, planeBasis) {
    const rel = new THREE.Vector3().subVectors(point3D, planeBasis.centroid);
    return {
        x: rel.dot(planeBasis.uAxis),
        y: rel.dot(planeBasis.vAxis)
    };
}

function resamplePathOnMesh(points, terrainMesh, planeBasis, samplesPerSegment = 8, activeCamera = null) {
    if (!terrainMesh || points.length < 2) return points;

    const resampled = [];
    const raycaster = new THREE.Raycaster();

    // 1. Applica i piani di clipping attivi al raycaster per rispettare le sezioni di taglio
    if (typeof renderer !== 'undefined' && renderer.clippingPlanes && renderer.clippingPlanes.length > 0) {
        raycaster.clippingPlanes = renderer.clippingPlanes;
    }

    const cam = activeCamera || camera;
    const camPos = cam.position.clone(); // Posizione nativa della camera in Three.js

    for (let i = 0; i < points.length - 1; i++) {
        const pA = points[i]; // Coordinate gia' in spazio Three.js
        const pB = points[i + 1];

        resampled.push(pA.clone());

        for (let s = 1; s < samplesPerSegment; s++) {
            const t = s / samplesPerSegment;
            // Interpolazione nello spazio Three.js (senza scambiare Y e Z!)
            const interp = new THREE.Vector3().lerpVectors(pA, pB, t);

            // Vettore direzione reale: dalla Camera (3D) verso il Punto nello schermo (3D)
            const rayDir = new THREE.Vector3().subVectors(interp, camPos).normalize();

            // Raycast in coordinate native Three.js
            raycaster.set(camPos, rayDir);
            let intersects = raycaster.intersectObject(terrainMesh, true);

            if (intersects.length > 0) {
                const hitPt = intersects[0].point.clone();
                // Calcola la normale di superficie per staccare leggermente il poligono (anti z-fighting)
                const surfNorm = intersects[0].face
                    ? intersects[0].face.normal.clone().transformDirection(intersects[0].object.matrixWorld)
                    : planeBasis.normal;
                
                hitPt.addScaledVector(surfNorm, 0.03);
                resampled.push(hitPt);
            } else {
                resampled.push(interp);
            }
        }
    }
    resampled.push(points[points.length - 1].clone());
    return resampled;
}
function createColoredDrapedMesh(resampled3DPoints, originalBoundaryPoints, terrainMesh, colorHex) {
    const group = new THREE.Group();

    // 1. Linea di bordo (perimetro visibile)
    const lineGeo = new THREE.BufferGeometry().setFromPoints(resampled3DPoints);
    const lineMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 });
    const lineMesh = new THREE.Line(lineGeo, lineMat);
    group.add(lineMesh);

    // 2. Generazione superficie riempita (senza estrusioni a 90 gradi)
    if (resampled3DPoints.length >= 3) {
        // Triangolazione 2D rispetto al piano di vista dello schermo
        const shape = new THREE.Shape();
        
        // Convertiamo i punti in coordinate dello schermo per triangolare correttamente dalla vista attuale
        const projPoints = resampled3DPoints.map(pt => {
            const p = pt.clone().project(camera);
            return new THREE.Vector2(p.x, p.y);
        });

        shape.moveTo(projPoints[0].x, projPoints[0].y);
        for (let i = 1; i < projPoints.length; i++) {
            shape.lineTo(projPoints[i].x, projPoints[i].y);
        }

        const shapeGeo = new THREE.ShapeGeometry(shape);
        const posAttr = shapeGeo.attributes.position;

        // Rimappiamo ogni vertice triangolato 2D al suo corrispondente punto 3D reale sulla superficie
        // evitando estrusioni o estensioni lungo l'asse Z/Y
        for (let i = 0; i < posAttr.count; i++) {
            const idx = Math.min(i, resampled3DPoints.length - 1);
            posAttr.setXYZ(i, resampled3DPoints[idx].x, resampled3DPoints[idx].y, resampled3DPoints[idx].z);
        }
        
        shapeGeo.computeVertexNormals();

        const meshMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: false // Evita sovrapposizioni errate
        });

        const fillMesh = new THREE.Mesh(shapeGeo, meshMat);
        group.add(fillMesh);
    }

    return group;
}

function pointInPolygon2D(px, py, polygon2D) {
    let inside = false;
    for (let i = 0, j = polygon2D.length - 1; i < polygon2D.length; j = i++) {
        const xi = polygon2D[i].x, yi = polygon2D[i].y;
        const xj = polygon2D[j].x, yj = polygon2D[j].y;
        
        const intersect = ((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function askColorWithPicker(defaultColor = '#00e676') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.5); display: flex; align-items: center;
            justify-content: center; z-index: 10000; font-family: sans-serif;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #ffffff; padding: 20px 25px; border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); text-align: center; min-width: 240px;
        `;
        modal.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #333;">Select color</h4>
            <input type="color" id="popup-color-picker" value="${defaultColor}" 
                   style="width: 80px; height: 45px; border: none; cursor: pointer; background: none;">
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                <button id="btn-color-ok" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Apply</button>
                <button id="btn-color-cancel" style="padding: 8px 16px; background: #e0e0e0; color: #333; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const colorInput = modal.querySelector('#popup-color-picker');
        const btnOk = modal.querySelector('#btn-color-ok');
        const btnCancel = modal.querySelector('#btn-color-cancel');

        setTimeout(() => colorInput.click(), 100);

        btnOk.onclick = () => {
            const chosenColor = colorInput.value;
            document.body.removeChild(overlay);
            resolve(chosenColor);
        };

        btnCancel.onclick = () => {
            document.body.removeChild(overlay);
            resolve(null);
        };
    });
}
