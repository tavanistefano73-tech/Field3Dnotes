const { app, BrowserWindow } = require('electron');
const path = require('path');

// Permette l'esecuzione corretta della GPU anche dentro macchine virtuali o cartelle condivise
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=32768');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Field3Dnotes",
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

// Forziamo la chiusura completa dell'app alla chiusura della finestra sia su Windows che su Mac
app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
