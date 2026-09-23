// js/18-voice-app-bridge.js

/**
 * Bridge tra il Voice Engine e l'interfaccia utente dell'applicazione 3D Digitizer.
 * Riceve i dati interpretati e aggiorna la form UI o attiva i comandi dell'app.
 */

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('digitizerVoiceCommand', (e) => {
        const data = e.detail;
        if (!data) return;

        console.log("Digitizer Voice Bridge - Data received:", data);

        // 1. Aggiornamento della Modalità di Acquisizione (Mode)
        if (data.mode) {
            updateSelectOrRadio('digitize-mode', data.mode);
            if (typeof window.toggleDigitizeModeUI === 'function') {
                window.toggleDigitizeModeUI();
            }
        }

        // 2. Aggiornamento del Tipo di Geometria (Geometry)
        if (data.geometry) {
            updateSelectOrRadio('input-geometry', data.geometry);
            if (typeof window.updateGeometryFields === 'function') {
                window.updateGeometryFields();
            }
        }

        // 3. Aggiornamento del Tipo di Struttura (Type)
        if (data.type) {
            updateInputValue('input-type', data.type);
        }

        // 4. Aggiornamento Formazione / Unità (Unit)
        if (data.unit) {
            updateInputValue('input-unit', data.unit);
        }

        // 5. Aggiornamento Set / Famiglia
        if (data.set) {
            updateInputValue('input-set', data.set);
        }

        // 6. Aggiornamento Senso di Movimento (Sense)
        if (data.sense) {
            updateInputValue('input-sense', data.sense);
        }

        // 7. Aggiornamento Valori Numerici Geometrici
        if (data.strike !== null) {
            updateInputValue('input-strike', data.strike);
            if (typeof window.autoCalcDipDir === 'function') {
                window.autoCalcDipDir();
            }
        }
        if (data.dipdir !== null) {
            updateInputValue('input-dipdir', data.dipdir);
            if (typeof window.autoCalcStrike === 'function') {
                window.autoCalcStrike();
            }
        }
        if (data.dip !== null) {
            updateInputValue('input-dip', data.dip);
        }
        if (data.trend !== null) {
            updateInputValue('input-trend', data.trend);
        }
        if (data.plunge !== null) {
            updateInputValue('input-plunge', data.plunge);
        }
        if (data.rake !== null) {
            updateInputValue('input-rake', data.rake);
        }

        // 8. Gestione Testo Note
        if (data.noteText) {
            const noteField = document.getElementById('note-text-content');
            if (noteField) {
                const existingText = noteField.value.trim();
                noteField.value = existingText ? `${existingText} | ${data.noteText}` : data.noteText;
                noteField.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        // 9. Esecuzione Trigger d'Azione (Scatta, Acquisisci, Salva)
        if (data.trigger_action) {
            executeCaptureTrigger();
        }
    });
});

function updateInputValue(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function updateSelectOrRadio(elementId, value) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (el.tagName === 'SELECT') {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        const radio = document.querySelector(`input[name="${elementId}"][value="${value}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

function executeCaptureTrigger() {
    const btn = document.getElementById('btn-toggle-digitize');
    if (btn) {
        console.log("Voice Bridge: Executing capture trigger action #btn-toggle-digitize");
        btn.click();
    } else {
        console.warn("Voice Bridge: Button #btn-toggle-digitize not found.");
    }
}
