const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localPlanSettings", {
  getFloatVisible: () => ipcRenderer.invoke("local-plan:get-float-visible"),
  setFloatVisible: (visible) => ipcRenderer.invoke("local-plan:set-float-visible", visible),
});
