const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localPlanFloat", {
  open: () => ipcRenderer.invoke("local-plan:show-main"),
  move: (x, y) => ipcRenderer.send("local-plan:move-float", { x, y }),
  snap: () => ipcRenderer.invoke("local-plan:snap-float"),
});
