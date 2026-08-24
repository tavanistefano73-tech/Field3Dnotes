function updateUI() {
            const nodeCnt = document.getElementById('node-count');
            if (nodeCnt) nodeCnt.textContent = currentPoints.length;
        }

function animate() {
    requestAnimationFrame(animate);

    if (typeof controls !== 'undefined' && controls) {
        controls.update();
    }

    // ==========================================
    // ADDITION FOR 3TZ: Dynamic tile update
    // ==========================================
    if (window.active3dTiles) {
        camera.updateMatrixWorld();
        window.active3dTiles.update();
    }

    // Safety checks: execute only if the functions exist
    if (typeof updateSpotDisksScale === 'function') {
        updateSpotDisksScale();
    }
    if (typeof updateNoteMarkersScale === 'function') {
        updateNoteMarkersScale();
    }

    const renderWidth = window.innerWidth;
    const renderHeight = window.innerHeight;

    renderer.autoClear = false;
    renderer.clear();
    renderer.setViewport(0, 0, renderWidth, renderHeight);
    renderer.render(scene, camera);

    const camDir = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (camDir.lengthSq() > 0) {
        camDir.setLength(3.8);
        gizmoCamera.position.copy(camDir);
        gizmoCamera.lookAt(0, 0, 0);
    }

    const gizmoSize = 120, margin = 10;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(renderWidth - gizmoSize - margin, margin, gizmoSize, gizmoSize);
    renderer.setViewport(renderWidth - gizmoSize - margin, margin, gizmoSize, gizmoSize);
    renderer.render(gizmoScene, gizmoCamera);
    renderer.setScissorTest(false);
}
animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (document.getElementById('stereonet-window').classList.contains('show')) {
                drawStereonet();
            }
        });
