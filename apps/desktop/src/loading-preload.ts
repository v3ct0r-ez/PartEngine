import { contextBridge, ipcRenderer } from 'electron';

// Locked-down bridge for the loading/progress window: it can only subscribe to
// progress events pushed by the main process.
contextBridge.exposeInMainWorld('peLoading', {
  onStatus: (cb: (payload: { label: string; state: 'active' | 'done' | 'error' }) => void) => {
    ipcRenderer.on('pe:status', (_e, payload) => cb(payload));
  },
});
