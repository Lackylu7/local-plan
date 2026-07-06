const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localPlanFloat", {
  open: () => ipcRenderer.invoke("local-plan:show-main"),
});
