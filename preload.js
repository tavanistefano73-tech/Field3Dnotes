// preload.js
window.nodeRequire = require;
window.nodeProcess = process;

// Salva un riferimento se serve, poi rimuovi per Three.js
window.__oldModule = module;
window.__oldExports = exports;

delete window.module;
delete window.exports;
