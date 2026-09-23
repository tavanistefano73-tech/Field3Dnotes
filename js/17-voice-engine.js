// js/17-voice-engine_3.js

window.toggleVoiceRecording = async function(lang) {
    var btn = document.getElementById('digitizer-voice-btn');
    
    if (btn) btn.textContent = '1️⃣ STEP 1';
    
    if (!window.transformers) {
        if (btn) btn.textContent = '❌ NO TRANSFORMERS';
        console.error("Libreria transformers non trovata in window");
        return;
    }

    if (btn) btn.textContent = '2️⃣ CHECK MIC';

    try {
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (btn) btn.textContent = '🔴 REC OK!';
        
        // Chiudi lo stream per il test
        stream.getTracks().forEach(function(track) { track.stop(); });
    } catch (err) {
        if (btn) btn.textContent = '❌ MIC ERROR';
        console.error("Errore microfono:", err);
    }
};
