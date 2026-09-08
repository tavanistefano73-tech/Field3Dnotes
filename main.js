const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const obj2gltf = require('obj2gltf');
const os = require('os');

// SENZA appendSwitch!

// 2. IPC Handler: OBJ → GLB + Draco
ipcMain.handle('convert-obj-to-glb', async (event, objFilePath) => {
    try {
        console.log("🔄 Conversione OBJ → GLB iniziata:", objFilePath);
        
        const tempDir = path.resolve(os.tmpdir(), 'field3d-conversion');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const outputPath = path.join(tempDir, path.basename(objFilePath, '.obj') + '.glb');
        
        const glb = await obj2gltf({
            inputFile: objFilePath,
            outputFile: outputPath,
            draco: {
                enabled: true,
                compressionLevel: 7
            },
            separate: false,
            separateTextures: false
        });
        
        console.log("✅ Conversione completata:", outputPath);
        const glbBuffer = fs.readFileSync(outputPath);
        
        return {
            success: true,
            path: outputPath,
            originalSize: fs.statSync(objFilePath).size,
            convertedSize: glbBuffer.length,
            compressionRatio: ((1 - glbBuffer.length / fs.statSync(objFilePath).size) * 100).toFixed(2) + '%'
        };
        
    } catch (err) {
        console.error("❌ Errore conversione OBJ:", err);
        return {
            success: false,
            error: err.message
        };
    }
});

ipcMain.handle('cleanup-temp-file', async (event, filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🗑️ File temporaneo eliminato:", filePath);
        }
        return { success: true };
    } catch (err) {
        console.error("❌ Errore cleanup:", err);
        return { success: false, error: err.message };
    }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Field3Dnotes",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
