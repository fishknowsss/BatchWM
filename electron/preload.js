import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('batchWM', {
  getDefaultWatermark: () => ipcRenderer.invoke('watermark:get-default'),
  selectVideos: () => ipcRenderer.invoke('dialog:select-videos'),
  selectImage: () => ipcRenderer.invoke('dialog:select-image'),
  selectOutputDir: () => ipcRenderer.invoke('dialog:select-output-dir'),
  startBatch: (payload) => ipcRenderer.invoke('batch:start', payload),
  onBatchEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('batch:event', listener);
    return () => ipcRenderer.removeListener('batch:event', listener);
  }
});
