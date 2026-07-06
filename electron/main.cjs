const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, screen } = require("electron");
const path = require("node:path");

let mainWindow;
let floatWindow;
let tray;

const devUrl = "http://127.0.0.1:1420";
const iconPath = path.join(__dirname, "..", "public", "icon.ico");
const isDev = process.env.LOCAL_PLAN_DEV === "1";

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
  const buttonSize = 56;
  floatWindow.setBounds({
    x: x + width - buttonSize - 10,
    y: y + Math.round((height - buttonSize) / 2),
    width: buttonSize,
    height: buttonSize,
  });
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
    width: 56,
    height: 56,
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
