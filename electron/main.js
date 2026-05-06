import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron';

import { getDefaultWatermarkPath } from './assets.js';
import { processBatch } from './processor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const defaultWatermarkPath = () =>
  getDefaultWatermarkPath({
    isPackaged: app.isPackaged,
    projectRoot,
    resourcesPath: process.resourcesPath
  });

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 660,
    title: 'BatchWM批量增添水印',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 24, y: 24 },
    backgroundColor: '#fff8ef',
    icon: getDockIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(projectRoot, 'dist', 'index.html'));
  } else {
    mainWindow.loadURL(devUrl);
  }
}

app.whenReady().then(() => {
  setDockIcon();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('watermark:get-default', async () => ({
  path: defaultWatermarkPath(),
  url: await imageToDataUrl(defaultWatermarkPath()),
  name: path.basename(defaultWatermarkPath())
}));

ipcMain.handle('dialog:select-videos', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择视频',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '视频', extensions: ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm'] }]
  });
  if (result.canceled) return [];
  return result.filePaths.map((filePath) => ({
    id: `${filePath}-${Date.now()}`,
    path: filePath,
    name: path.basename(filePath),
    status: 'ready'
  }));
});

ipcMain.handle('dialog:select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择水印图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return {
    path: filePath,
    url: await imageToDataUrl(filePath),
    name: path.basename(filePath)
  };
});

ipcMain.handle('dialog:select-output-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择输出目录',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle('batch:start', async (event, payload) => {
  return processBatch(payload, (message) => {
    event.sender.send('batch:event', message);
  });
});

async function imageToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };
  const mime = mimeTypes[ext] || 'application/octet-stream';
  const data = await readFile(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

function getDockIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.icns');
  }
  return path.join(projectRoot, 'build', 'icon.png');
}

function setDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) return;
  const icon = nativeImage.createFromPath(getDockIconPath());
  if (!icon.isEmpty()) app.dock.setIcon(icon);
}
