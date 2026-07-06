const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, screen } = require("electron");
const path = require("node:path");

let mainWindow;
let floatWindow;
let tray;

const devUrl = "http://127.0.0.1:1420";
const iconPath = path.join(__dirname, "..", "public", "icon.ico");
const isDev = process.env.LOCAL_PLAN_DEV === "1";
const floatSize = 56;

app.setAppUserModelId("com.localplan.app");

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function positionFloatWindow() {
  if (!floatWindow) return;
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  floatWindow.setBounds({
    x: x + width - floatSize,
    y: y + Math.round((height - floatSize) / 2),
    width: floatSize,
    height: floatSize,
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function getFloatDisplay(x, y) {
  return screen.getDisplayNearestPoint({
    x: Math.round(x + floatSize / 2),
    y: Math.round(y + floatSize / 2),
  });
}

function getClampedFloatBounds(x, y) {
  const display = getFloatDisplay(x, y);
  const workArea = display.workArea;
  return {
    x: clamp(Math.round(x), workArea.x, workArea.x + workArea.width - floatSize),
    y: clamp(Math.round(y), workArea.y, workArea.y + workArea.height - floatSize),
    width: floatSize,
    height: floatSize,
  };
}

function moveFloatWindow(x, y) {
  if (!floatWindow) return;
  floatWindow.setBounds(getClampedFloatBounds(x, y));
}

function snapFloatWindowToNearestEdge() {
  if (!floatWindow) return "right";
  const current = floatWindow.getBounds();
  const bounds = getClampedFloatBounds(current.x, current.y);
  const workArea = getFloatDisplay(bounds.x, bounds.y).workArea;
  const edgeDistances = [
    { edge: "left", distance: Math.abs(bounds.x - workArea.x) },
    {
      edge: "right",
      distance: Math.abs(bounds.x + bounds.width - (workArea.x + workArea.width)),
    },
    { edge: "top", distance: Math.abs(bounds.y - workArea.y) },
    {
      edge: "bottom",
      distance: Math.abs(bounds.y + bounds.height - (workArea.y + workArea.height)),
    },
  ];
  const nearest = edgeDistances.reduce((best, item) =>
    item.distance < best.distance ? item : best,
  );

  const snapped = { ...bounds };
  if (nearest.edge === "left") snapped.x = workArea.x;
  if (nearest.edge === "right") snapped.x = workArea.x + workArea.width - floatSize;
  if (nearest.edge === "top") snapped.y = workArea.y;
  if (nearest.edge === "bottom") snapped.y = workArea.y + workArea.height - floatSize;

  floatWindow.setBounds(snapped);
  return nearest.edge;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 680,
    minWidth: 420,
    minHeight: 520,
    title: "Local Plan",
    backgroundColor: "#f7f9fc",
    icon: iconPath,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", showMainWindow);

  mainWindow.on("close", (event) => {
    if (app.isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
}

function createFloatWindow() {
  floatWindow = new BrowserWindow({
    width: floatSize,
    height: floatSize,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "float-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  floatWindow.loadFile(path.join(__dirname, "float.html"));
  floatWindow.setAlwaysOnTop(true, "floating");
  positionFloatWindow();

  screen.on("display-metrics-changed", positionFloatWindow);
  screen.on("display-added", positionFloatWindow);
  screen.on("display-removed", positionFloatWindow);
}

function createTray() {
  tray = new Tray(iconPath);
  tray.setToolTip("Local Plan");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Local Plan", click: showMainWindow },
      { label: "Hide", click: () => mainWindow?.hide() },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showMainWindow);
}

function registerShortcut() {
  const ok = globalShortcut.register("Control+Alt+Space", showMainWindow);
  if (!ok) {
    console.warn("Failed to register shortcut Control+Alt+Space");
  }
}

ipcMain.handle("local-plan:show-main", () => {
  showMainWindow();
});

ipcMain.on("local-plan:move-float", (_event, point) => {
  if (typeof point?.x !== "number" || typeof point?.y !== "number") return;
  moveFloatWindow(point.x, point.y);
});

ipcMain.handle("local-plan:snap-float", () => snapFloatWindowToNearestEdge());

app.whenReady().then(() => {
  createWindow();
  createFloatWindow();
  createTray();
  registerShortcut();
});

app.on("activate", showMainWindow);

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
