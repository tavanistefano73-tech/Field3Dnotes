function recenterScene() {
    toggleSetCenter(false);
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

function toggleSetCenter(forceState) {
    if (forceState !== undefined) {
        isSettingCenter = forceState;
    } else {
        if (!loadedMesh) return alert("Load a 3D model first!");
        isSettingCenter = !isSettingCenter;
    }

    const btn = document.getElementById('btn-set-center');
    if (btn) {
        if (isSettingCenter) {
            btn.style.background = '#1D9E75';
            btn.style.borderColor = '#55ff55';
            document.getElementById('status').textContent = 'Tap a point to set center 📍';
            document.getElementById('status').style.color = '#e0a800';
        } else {
            btn.style.background = '#2a2a2a';
            btn.style.borderColor = '#444';
        }
    }
}

function setCenterAtMouse(e) {
    if (!loadedMesh) return;
    updateMouseCoords(e);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(loadedMesh, true);
    if (intersects.length > 0) {
        controls.target.copy(intersects[0].point);
        controls.update();
        document.getElementById('status').textContent = 'New center set ✓';
        document.getElementById('status').style.color = '#1D9E75';
    }
    toggleSetCenter(false);
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

window.syncAndRotateModel = syncAndRotateModel;
window.applyModelRotation = applyModelRotation;
