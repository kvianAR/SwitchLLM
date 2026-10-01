// Built to build/preload-popover.cjs. Exposes the minimal IPC surface the
// popover UI needs — no Node access in the renderer.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('switchllm', {
  snapshot: () => ipcRenderer.invoke('switchllm:snapshot'),
  openDashboard: () => ipcRenderer.invoke('switchllm:open-dashboard'),
  copyBaseUrl: () => ipcRenderer.invoke('switchllm:copy-base-url'),
  copyApiKey: () => ipcRenderer.invoke('switchllm:copy-api-key'),
  setLoginItem: (open: boolean) => ipcRenderer.invoke('switchllm:set-login-item', open),
  quit: () => ipcRenderer.invoke('switchllm:quit'),
  onRefresh: (cb: () => void) => ipcRenderer.on('switchllm:refresh', cb),
});
