


// ==================== NOTES FEATURE ====================

        let currentNoteType = 'text';
        let pendingPhotoBase64 = null;
        let pendingPhotoFilename = null;
let pendingSketchBase64 = null;
let pendingSketchFilename = null;
let pendingSketchCaption = '';
        const NOTE_ICONS = { text: '📄', photo: '📷', sketch: '✏️', audio: '🎤' };

        function selectNoteType(type) {
            currentNoteType = type;
            ['text', 'photo', 'sketch', 'audio'].forEach(t => {
                const tabBtn = document.getElementById('note-tab-' + t);
                const panel = document.getElementById('note-panel-' + t);
                if (tabBtn) tabBtn.classList.toggle('active', t === type);
                if (panel) panel.style.display = (t === type) ? 'block' : 'none';
            });
        }

        // ---- Bridge verso Swift (scrittura/cancellazione file su disco) ----

        let noteMediaCallbacks = {};
        let noteMediaCallbackCounter = 0;

        window.__noteMediaCallback = function(callbackId, success) {
            const cb = noteMediaCallbacks[callbackId];
            if (cb) { cb(success); delete noteMediaCallbacks[callbackId]; }
        };



        function deleteNoteMediaFromDisk(filename) {
            if (!filename) return;
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.deleteNoteMedia) {
                window.webkit.messageHandlers.deleteNoteMedia.postMessage({ filename });
            }
        }

        // ---- Cattura e compressione foto ----

        function handleNotePhotoSelected(files) {
            if (!files || files.length === 0) return;
            const file = files[0];

            const img = new Image();
            const reader = new FileReader();
            reader.onload = function(e) {
                img.onload = function() {
                    const MAX_SIDE = 1600;
                    let w = img.width, h = img.height;
                    if (w > h && w > MAX_SIDE) { h = Math.round(h * MAX_SIDE / w); w = MAX_SIDE; }
                    else if (h >= w && h > MAX_SIDE) { w = Math.round(w * MAX_SIDE / h); h = MAX_SIDE; }

                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                    pendingPhotoBase64 = dataUrl.split(',')[1];
                    pendingPhotoFilename = 'note_' + Date.now() + '.jpg';

                    document.getElementById('note-photo-preview').src = dataUrl;
                    document.getElementById('note-photo-preview-wrapper').style.display = 'block';
                    document.getElementById('note-photo-capture-btn').style.display = 'none';
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

function clearNotePhoto() {
            pendingPhotoBase64 = null;
            pendingPhotoFilename = null;
            document.getElementById('note-photo-preview-wrapper').style.display = 'none';
            document.getElementById('note-photo-capture-btn').style.display = 'block';
            document.getElementById('note-photo-input').value = '';
            document.getElementById('note-photo-caption').value = '';
        }

        // ---- Piazzamento nota sul modello ----
// ---- Gestione Registrazione Audio ----
function clearSketchNote() {
    pendingSketchBase64 = null;
    pendingSketchFilename = null;
    pendingSketchCaption = '';
    
    const wrapper = document.getElementById('sketch-preview-wrapper');
    const btn = document.getElementById('sketch-open-btn');
    if (wrapper) wrapper.style.display = 'none';
    if (btn) btn.style.display = 'block';
}

let mediaRecorder = null;
let audioChunks = [];
let pendingAudioBase64 = null;
let pendingAudioFilename = null;
let audioTimerInterval = null;
let audioRecordStartTime = 0;

async function toggleAudioRecording() {
    const btn = document.getElementById('btn-record-audio');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        btn.textContent = '🎤 Record';
        btn.style.background = '#dc3545';
        clearInterval(audioTimerInterval);
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeCandidates = ['audio/mp4', 'audio/webm', ''];
                        const supportedMime = mimeCandidates.find(m => m === '' || MediaRecorder.isTypeSupported(m));
                        mediaRecorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
            
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/mp4' });
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    const dataUrl = reader.result;
                    pendingAudioBase64 = dataUrl.split(',')[1];
                    pendingAudioFilename = 'note_audio_' + Date.now() + '.m4a';

                    document.getElementById('audio-preview').src = dataUrl;
                    document.getElementById('audio-preview-wrapper').style.display = 'block';
                    btn.style.display = 'none';
                };
                reader.readAsDataURL(audioBlob);

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            btn.textContent = '⏹️ Stop Recording';
            btn.style.background = '#28a745';

            audioRecordStartTime = Date.now();
            audioTimerInterval = setInterval(() => {
                const seconds = Math.floor((Date.now() - audioRecordStartTime) / 1000);
                const m = String(Math.floor(seconds / 60)).padStart(2, '0');
                const s = String(seconds % 60).padStart(2, '0');
                document.getElementById('audio-timer').textContent = `${m}:${s}`;
            }, 1000);

        } catch (err) {
            alert('Unable to access microphone: ' + err.message);
        }
    }
}

function clearAudioNote() {
    pendingAudioBase64 = null;
    pendingAudioFilename = null;
    audioChunks = [];
    document.getElementById('audio-preview-wrapper').style.display = 'none';
    document.getElementById('btn-record-audio').style.display = 'inline-block';
    document.getElementById('audio-timer').textContent = '00:00';
    document.getElementById('note-audio-caption').value = '';
}

function addNoteAtMouse(e) {
    updateMouseCoords(e);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(loadedMesh, true);
    if (intersects.length === 0) return;

    // --- NOTA AUDIO ---
    if (currentNoteType === 'audio') {
        if (!pendingAudioBase64 || !pendingAudioFilename) return alert('Record an audio note before placing it.');

        const pt = intersects[0].point.clone();
        const captionVal = document.getElementById('note-audio-caption').value.trim();

        placeNoteFeature(pt, 'audio', {
            audio_file: pendingAudioFilename,
            audio_data: 'data:audio/mp4;base64,' + pendingAudioBase64,
            text: captionVal
        });
        clearAudioNote();
        return;
    }

    // --- NOTA SKETCH ---
    if (currentNoteType === 'sketch') {
        if (!pendingSketchBase64 || !pendingSketchFilename) return alert('Draw a sketch before placing it.');

        const pt = intersects[0].point.clone();

        placeNoteFeature(pt, 'sketch', {
            sketch_file: pendingSketchFilename,
            sketch_data: 'data:image/png;base64,' + pendingSketchBase64,
            text: pendingSketchCaption
        });
        clearSketchNote();
        return;
    }

    // --- NOTA TESTO ---
    if (currentNoteType === 'text') {
        const textVal = document.getElementById('note-text-content').value.trim();
        if (!textVal) return alert('Please enter text for the note before placing it.');
        placeNoteFeature(intersects[0].point.clone(), 'text', { text: textVal });
        document.getElementById('note-text-content').value = '';
        return;
    }

    // --- NOTA FOTO ---
    if (currentNoteType === 'photo') {
        if (!pendingPhotoBase64 || !pendingPhotoFilename) return alert('Take or select a photo before placing it.');

        const pt = intersects[0].point.clone();
        const captionVal = document.getElementById('note-photo-caption').value.trim();

        placeNoteFeature(pt, 'photo', {
            photo_file: pendingPhotoFilename,
            photo_data: 'data:image/jpeg;base64,' + pendingPhotoBase64,
            text: captionVal
        });
        clearNotePhoto();
        return;
    }
}

        function placeNoteFeature(pt, noteType, extraData) {
            const currentFeatId = featureCounter++;
            const markerGroup = createNoteMarker(pt, noteType);
            markerGroup.userData = { featureId: currentFeatId };
            markerGroup.traverse(c => c.userData = { featureId: currentFeatId });
            scene.add(markerGroup);

            const gisPt = [
                pt.x + threeCenter.x + pythonOffset.x,
                -pt.z - threeCenter.z + pythonOffset.y,
                pt.y + threeCenter.y + pythonOffset.z
            ];

            const featData = Object.assign({
                id: currentFeatId,
                is_note: true,
                note_type: noteType,
                f_type: document.getElementById('input-type').value || '',
                unit: document.getElementById('input-unit').value || '',
                set: document.getElementById('input-set').value || '',
                point: gisPt,
                group: markerGroup
            }, extraData);

            digitizedFeatures.push(featData);

                        updateVisibilityFiltersUI(); updateUI();
                        document.getElementById('status').textContent = 'Note #' + currentFeatId + ' Saved ✓';
                        document.getElementById('status').style.color = '#1D9E75';

                        stopDigitizing();
                    }

        // ---- Marker 3D (icona generica per tipo) ----

        function createNoteMarker(centerThree, noteType) {
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(23, 162, 184, 0.95)';
            ctx.beginPath();
            ctx.arc(32, 32, 28, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = '30px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(NOTE_ICONS[noteType] || '📄', 32, 34);

            const texture = new THREE.CanvasTexture(canvas);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, sizeAttenuation: true }));

            const group = new THREE.Group();
            group.position.copy(centerThree);
            group.add(sprite);
            return group;
        }

        function updateNoteMarkersScale() {
            const userPixelSize = 40;
            const currentH = window.innerHeight;
            const vFOV = THREE.MathUtils.degToRad(camera.fov);
            const factor = (userPixelSize / currentH) * 2.0 * Math.tan(vFOV / 2.0);

            digitizedFeatures.forEach(f => {
                if (f.is_note && f.group) {
                    const distance = camera.position.distanceTo(f.group.position);
                    const worldRadius = distance * factor;
                    f.group.children[0].scale.set(worldRadius, worldRadius, 1);
                }
            });
        }
// ==================== SKETCH SUBSYSTEM ====================

        const SKETCH_DEFAULT_W = 900, SKETCH_DEFAULT_H = 650, SKETCH_MAX_DIM = 1000;

        let pendingSketchPoint = null;
        let sketchBgCanvas = null, sketchDrawCanvas = null, sketchBgCtx = null, sketchDrawCtx = null;
        let sketchHistory = [], sketchHistoryIndex = -1;
        let isSketchErasing = false;
        let isSketchDrawing = false;
        let sketchLastX = 0, sketchLastY = 0;

function openSketchOverlay() {
    sketchBgCanvas = document.getElementById('sketch-bg-canvas');
    sketchDrawCanvas = document.getElementById('sketch-draw-canvas');
    sketchBgCtx = sketchBgCanvas.getContext('2d');
    sketchDrawCtx = sketchDrawCanvas.getContext('2d');

    setSketchBackground('blank');
    //document.getElementById('sketch-caption').value = pendingSketchCaption || '';
    document.getElementById('sketch-window').classList.add('show');

    sketchDrawCanvas.removeEventListener('pointerdown', sketchPointerDown);
    sketchDrawCanvas.removeEventListener('pointermove', sketchPointerMove);
    sketchDrawCanvas.removeEventListener('pointerup', sketchPointerUp);
    sketchDrawCanvas.removeEventListener('pointercancel', sketchPointerUp);
    sketchDrawCanvas.addEventListener('pointerdown', sketchPointerDown);
    sketchDrawCanvas.addEventListener('pointermove', sketchPointerMove);
    sketchDrawCanvas.addEventListener('pointerup', sketchPointerUp);
    sketchDrawCanvas.addEventListener('pointercancel', sketchPointerUp);
}

function closeSketchOverlay() {
    document.getElementById('sketch-window').classList.remove('show');
}

        function cancelSketch() {
            closeSketchOverlay();
        }

function initSketchCanvasSize(w, h) {
            [sketchBgCanvas, sketchDrawCanvas].forEach(c => { c.width = w; c.height = h; });
            sketchBgCtx.fillStyle = '#ffffff';
            sketchBgCtx.fillRect(0, 0, w, h);
            sketchDrawCtx.clearRect(0, 0, w, h);
            sketchHistory = [sketchDrawCtx.getImageData(0, 0, w, h)];
            sketchHistoryIndex = 0;
            updateSketchUndoRedoButtons();
            resizeSketchStackToFit(w, h);
        }

        function resizeSketchStackToFit(w, h) {
            const stack = document.getElementById('sketch-canvas-stack');
            const wrapper = document.getElementById('sketch-canvas-wrapper');
            const availW = wrapper.clientWidth - 12;
            const availH = wrapper.clientHeight - 12;

            const scale = Math.min(availW / w, availH / h, 1);
            const renderW = Math.round(w * scale);
            const renderH = Math.round(h * scale);

            stack.style.width = renderW + 'px';
            stack.style.height = renderH + 'px';
            sketchBgCanvas.style.width = renderW + 'px';
            sketchBgCanvas.style.height = renderH + 'px';
            sketchDrawCanvas.style.width = renderW + 'px';
            sketchDrawCanvas.style.height = renderH + 'px';
        }

        function setSketchBackground(type) {
            document.getElementById('sketch-bg-blank-btn').classList.toggle('active', type === 'blank');
            document.getElementById('sketch-bg-photo-btn').classList.toggle('active', type === 'photo');
            if (type === 'blank') {
                initSketchCanvasSize(SKETCH_DEFAULT_W, SKETCH_DEFAULT_H);
            }
        }

        function loadSketchBackgroundPhoto(files) {
            if (!files || files.length === 0) return;
            const file = files[0];
            const img = new Image();
            const reader = new FileReader();
            reader.onload = function(e) {
                img.onload = function() {
                    let w = img.width, h = img.height;
                    if (w >= h && w > SKETCH_MAX_DIM) { h = Math.round(h * SKETCH_MAX_DIM / w); w = SKETCH_MAX_DIM; }
                    else if (h > w && h > SKETCH_MAX_DIM) { w = Math.round(w * SKETCH_MAX_DIM / h); h = SKETCH_MAX_DIM; }

                    initSketchCanvasSize(w, h);
                    sketchBgCtx.drawImage(img, 0, 0, w, h);
                    document.getElementById('sketch-bg-blank-btn').classList.remove('active');
                    document.getElementById('sketch-bg-photo-btn').classList.add('active');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        function getSketchCoords(e) {
            const rect = sketchDrawCanvas.getBoundingClientRect();
            const scaleX = sketchDrawCanvas.width / rect.width;
            const scaleY = sketchDrawCanvas.height / rect.height;
            return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
        }

        function sketchPointerDown(e) {
            e.preventDefault();
            isSketchDrawing = true;
            sketchDrawCanvas.setPointerCapture(e.pointerId);
            const p = getSketchCoords(e);
            sketchLastX = p.x; sketchLastY = p.y;

            sketchDrawCtx.beginPath();
            sketchDrawCtx.arc(p.x, p.y, (parseFloat(document.getElementById('sketch-thickness-input').value) || 4) / 2, 0, Math.PI * 2);
            sketchDrawCtx.fillStyle = document.getElementById('sketch-color-input').value;
            sketchDrawCtx.globalCompositeOperation = isSketchErasing ? 'destination-out' : 'source-over';
            sketchDrawCtx.fill();
        }

        function sketchPointerMove(e) {
            if (!isSketchDrawing) return;
            e.preventDefault();
            const p = getSketchCoords(e);

            sketchDrawCtx.globalCompositeOperation = isSketchErasing ? 'destination-out' : 'source-over';
            sketchDrawCtx.strokeStyle = document.getElementById('sketch-color-input').value;
            sketchDrawCtx.lineWidth = parseFloat(document.getElementById('sketch-thickness-input').value) || 4;
            sketchDrawCtx.lineCap = 'round';
            sketchDrawCtx.lineJoin = 'round';

            sketchDrawCtx.beginPath();
            sketchDrawCtx.moveTo(sketchLastX, sketchLastY);
            sketchDrawCtx.lineTo(p.x, p.y);
            sketchDrawCtx.stroke();

            sketchLastX = p.x; sketchLastY = p.y;
        }

        function sketchPointerUp(e) {
            if (!isSketchDrawing) return;
            isSketchDrawing = false;
            pushSketchHistory();
        }

function pushSketchHistory() {
    const snapshot = sketchDrawCtx.getImageData(0, 0, sketchDrawCanvas.width, sketchDrawCanvas.height);
    sketchHistory = sketchHistory.slice(0, sketchHistoryIndex + 1);
    sketchHistory.push(snapshot);
    if (sketchHistory.length > 15) sketchHistory.shift();
    sketchHistoryIndex = sketchHistory.length - 1;
    updateSketchUndoRedoButtons();
}

        function sketchUndo() {
            if (sketchHistoryIndex <= 0) return;
            sketchHistoryIndex--;
            sketchDrawCtx.putImageData(sketchHistory[sketchHistoryIndex], 0, 0);
            updateSketchUndoRedoButtons();
        }

        function sketchRedo() {
            if (sketchHistoryIndex >= sketchHistory.length - 1) return;
            sketchHistoryIndex++;
            sketchDrawCtx.putImageData(sketchHistory[sketchHistoryIndex], 0, 0);
            updateSketchUndoRedoButtons();
        }

        function updateSketchUndoRedoButtons() {
            const undoBtn = document.getElementById('sketch-undo-btn');
            const redoBtn = document.getElementById('sketch-redo-btn');
            if (undoBtn) undoBtn.style.opacity = (sketchHistoryIndex <= 0) ? '0.4' : '1';
            if (redoBtn) redoBtn.style.opacity = (sketchHistoryIndex >= sketchHistory.length - 1) ? '0.4' : '1';
        }

        function sketchClearAll() {
            sketchDrawCtx.clearRect(0, 0, sketchDrawCanvas.width, sketchDrawCanvas.height);
            pushSketchHistory();
        }

        function toggleSketchEraser() {
            isSketchErasing = !isSketchErasing;
            document.getElementById('sketch-eraser-btn').classList.toggle('active', isSketchErasing);
        }

function saveSketchNote() {
    if (sketchHistoryIndex <= 0) return alert('Draw something before saving the sketch.');

    const w = sketchDrawCanvas.width, h = sketchDrawCanvas.height;
    const composite = document.createElement('canvas');
    composite.width = w; composite.height = h;
    const compositeCtx = composite.getContext('2d');
    compositeCtx.drawImage(sketchBgCanvas, 0, 0);
    compositeCtx.drawImage(sketchDrawCanvas, 0, 0);

    const dataUrl = composite.toDataURL('image/png');
    pendingSketchBase64 = dataUrl.split(',')[1];
    pendingSketchFilename = 'note_sketch_' + Date.now() + '.png';
    //pendingSketchCaption = document.getElementById('sketch-caption').value.trim();

    // Aggiorna anteprima nel pannello laterale
    const imgPreview = document.getElementById('sketch-preview');
    if (imgPreview) imgPreview.src = dataUrl;
    
    const wrapper = document.getElementById('sketch-preview-wrapper');
    const btn = document.getElementById('sketch-open-btn');
    if (wrapper) wrapper.style.display = 'block';
    if (btn) btn.style.display = 'none';

    closeSketchOverlay();
}
