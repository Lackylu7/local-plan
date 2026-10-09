const { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain, screen } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

let mainWindow;
let floatWindow;
let tray;
let isFloatVisible = true;
let hasShownTrayNotice = false;
let trayNoticeMarkerPath;

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

function setFloatVisible(visible) {
  isFloatVisible = visible;
  if (!floatWindow) return isFloatVisible;

  if (visible) {
    floatWindow.showInactive();
    floatWindow.setAlwaysOnTop(true, "floating");
  } else {
    floatWindow.hide();
  }

  return isFloatVisible;
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
    height: 820,
    minWidth: 420,
    minHeight: 520,
    title: "Local Plan",
    backgroundColor: "#f7f9fc",
    icon: iconPath,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
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
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on("close", (event) => {
    if (app.isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    if (!hasShownTrayNotice && tray) {
      hasShownTrayNotice = true;
      tray.displayBalloon({
        title: "Local Plan 仍在运行",
        content: "窗口已隐藏到系统托盘，可从托盘图标重新打开。",
        iconType: "info",
      });
      if (trayNoticeMarkerPath) {
        fs.writeFile(trayNoticeMarkerPath, "shown", "utf8").catch(() => {});
      }
    }
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
  setFloatVisible(isFloatVisible);

  screen.on("display-metrics-changed", positionFloatWindow);
  screen.on("display-added", positionFloatWindow);
  screen.on("display-removed", positionFloatWindow);
}

function createTray() {
  tray = new Tray(iconPath);
  tray.setToolTip("Local Plan");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开 Local Plan", click: showMainWindow },
      { label: "隐藏窗口", click: () => mainWindow?.hide() },
      { type: "separator" },
      {
        label: "退出",
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

ipcMain.handle("local-plan:get-float-visible", () => isFloatVisible);

ipcMain.handle("local-plan:set-float-visible", (_event, visible) => {
  if (typeof visible !== "boolean") return isFloatVisible;
  return setFloatVisible(visible);
});

ipcMain.on("local-plan:move-float", (_event, point) => {
  if (typeof point?.x !== "number" || typeof point?.y !== "number") return;
  moveFloatWindow(point.x, point.y);
});

ipcMain.handle("local-plan:snap-float", () => snapFloatWindowToNearestEdge());

ipcMain.handle("local-plan:export-backup", async (_event, payload) => {
  if (typeof payload?.content !== "string" || typeof payload?.suggestedName !== "string") {
    return { status: "error", error: "Invalid backup export request." };
  }

  const suggestedName = path.basename(payload.suggestedName).replace(/[<>:"/\\|?*]/g, "-");
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "导出 Local Plan 备份",
      defaultPath: path.join(app.getPath("documents"), suggestedName),
      filters: [{ name: "JSON 备份", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return { status: "cancelled" };

    await fs.writeFile(result.filePath, payload.content, "utf8");
    return { status: "saved", path: result.filePath };
  } catch (error) {
    return { status: "error", error: error instanceof Error ? error.message : "Backup export failed." };
  }
});

ipcMain.handle("local-plan:import-backup", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "导入 Local Plan 备份",
      properties: ["openFile"],
      filters: [{ name: "JSON 备份", extensions: ["json"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { status: "cancelled" };

    const content = await fs.readFile(result.filePaths[0], "utf8");
    return { status: "selected", content, path: result.filePaths[0] };
  } catch (error) {
    return { status: "error", error: error instanceof Error ? error.message : "Backup import failed." };
  }
});

ipcMain.handle("local-plan:auto-backup", async (_event, payload) => {
  if (typeof payload?.content !== "string") {
    return { status: "error", error: "Invalid automatic backup request." };
  }

  try {
    const savedAt = new Date();
    const backupDirectory = path.join(app.getPath("userData"), "backups");
    const fileName = `local-plan-auto-${savedAt.toISOString().slice(0, 10)}.json`;
    const filePath = path.join(backupDirectory, fileName);
    await fs.mkdir(backupDirectory, { recursive: true });
    await fs.writeFile(filePath, payload.content, "utf8");

    const entries = await fs.readdir(backupDirectory, { withFileTypes: true });
    const backupFiles = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.startsWith("local-plan-auto-") && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const stats = await fs.stat(path.join(backupDirectory, entry.name));
          return { name: entry.name, modifiedAt: stats.mtimeMs };
        }),
    );
    const { selectBackupFilesToDelete } = await import("./backup-policy.js");
    const filesToDelete = selectBackupFilesToDelete(backupFiles, 7);
    await Promise.all(
      filesToDelete.map((name) => fs.unlink(path.join(backupDirectory, name))),
    );

    return { status: "saved", path: filePath, savedAt: savedAt.toISOString() };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Automatic backup failed.",
    };
  }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  trayNoticeMarkerPath = path.join(app.getPath("userData"), ".tray-notice-shown");
  try {
    await fs.access(trayNoticeMarkerPath);
    hasShownTrayNotice = true;
  } catch {
    hasShownTrayNotice = false;
  }
  createWindow();
  createFloatWindow();
  createTray();
  registerShortcut();
});

app.on("activate", showMainWindow);

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
