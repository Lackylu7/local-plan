const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localPlanSettings", {
  getFloatVisible: () => ipcRenderer.invoke("local-plan:get-float-visible"),
  setFloatVisible: (visible) => ipcRenderer.invoke("local-plan:set-float-visible", visible),
});

contextBridge.exposeInMainWorld("localPlanBackup", {
  exportBackup: (payload) => ipcRenderer.invoke("local-plan:export-backup", payload),
  importBackup: () => ipcRenderer.invoke("local-plan:import-backup"),
  autoBackup: (payload) => ipcRenderer.invoke("local-plan:auto-backup", payload),
});
