const { app, BrowserWindow } = require('electron');
const path = require('path');

// Allocazione Memoria fino a 32GB per file pesanti
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=32768');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Field3Dnotes",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
