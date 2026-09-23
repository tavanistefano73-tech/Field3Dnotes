// ==========================================
// 14-ntrip.js - MODULO NTRIP & SWITCH SORGENTE
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadNtripSettings();
});

function toggleNtripModal() {
    const modal = document.getElementById('ntripModal');
    if (!modal) return;

    const isHidden = modal.style.display === 'none' || modal.style.display === '';
    
    if (isHidden) {
        loadNtripSettings();
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
}

window.addEventListener('click', (event) => {
    const modal = document.getElementById('ntripModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

function loadNtripSettings() {
    const saved = localStorage.getItem('ntripConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            if (document.getElementById('ntripHost')) document.getElementById('ntripHost').value = config.host || '';
            if (document.getElementById('ntripPort')) document.getElementById('ntripPort').value = config.port || 2101;
            if (document.getElementById('ntripMount')) document.getElementById('ntripMount').value = config.mountpoint || '';
            if (document.getElementById('ntripUser')) document.getElementById('ntripUser').value = config.user || '';
            if (document.getElementById('ntripPass')) document.getElementById('ntripPass').value = config.pass || '';
        } catch(e) {
            console.error("NTRIP settings loading error:", e);
        }
    }
    const savedSource = localStorage.getItem('gpsSource') || 'internal';
    const sourceSelect = document.getElementById('gpsSource');
    if (sourceSelect) sourceSelect.value = savedSource;

    // Sincronizza subito la sorgente con Swift all'avvio
    changeGpsSource(savedSource);
}

function saveAndConnectNtrip() {
    const config = {
        host: document.getElementById('ntripHost').value.trim(),
        port: parseInt(document.getElementById('ntripPort').value, 10) || 2101,
        mountpoint: document.getElementById('ntripMount').value.trim(),
        user: document.getElementById('ntripUser').value.trim(),
        pass: document.getElementById('ntripPass').value.trim()
    };

    if (!config.host || !config.mountpoint) {
        alert("Please enter Host and Mountpoint.");
        return;
    }

    localStorage.setItem('ntripConfig', JSON.stringify(config));

    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.updateNtripConfig) {
        window.webkit.messageHandlers.updateNtripConfig.postMessage(config);
    }

    toggleNtripModal();
}

function changeGpsSource(source) {
    localStorage.setItem('gpsSource', source);
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.setPositionSource) {
        window.webkit.messageHandlers.setPositionSource.postMessage({ source: source });
        console.log("📡 Source switch sent to Swift: " + source);
    }
}

window.handleNtripStatus = function(status, message, color) {
    const label = document.getElementById('ntripStatusLabel');
    const dot = document.getElementById('ntripStatusDot');

    if (label && message) label.textContent = message;

    if (dot) {
        dot.className = 'status-dot';
        switch (status) {
            case 'RTK_FIX':
                dot.classList.add('status-rtk-fix');
                break;
            case 'RTK_FLOAT':
                dot.classList.add('status-rtk-float');
                break;
            case 'CASTER_ONLY':
                dot.classList.add('status-caster-only');
                break;
            case 'ANTENNA_ONLY':
                dot.classList.add('status-antenna-only');
                break;
            case 'DISCONNECTED':
            default:
                dot.classList.add('status-disconnected');
                break;
        }
    }
};

// ESPOSIZIONE GLOBALE
window.toggleNtripModal = toggleNtripModal;
window.saveAndConnectNtrip = saveAndConnectNtrip;
window.changeGpsSource = changeGpsSource;
window.changeLocationSource = changeGpsSource;
