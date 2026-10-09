import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { packager } from "@electron/packager";

const require = createRequire(import.meta.url);
const electronVersion = require("electron/package.json").version;
const zipName = `electron-v${electronVersion}-win32-x64.zip`;

function findCachedElectronZip() {
  const localAppData = process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local");
  const cacheRoot = path.join(localAppData, "electron", "Cache");

  if (!existsSync(cacheRoot)) {
    return undefined;
  }

  for (const entry of readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = path.join(cacheRoot, entry.name, zipName);
    if (existsSync(candidate)) {
      return path.dirname(candidate);
    }
  }

  return undefined;
}

const electronZipDir = findCachedElectronZip();

if (electronZipDir) {
  console.log(`Using cached Electron ${electronVersion} from ${electronZipDir}`);
}

const outputPaths = await packager({
  dir: process.cwd(),
  name: "Local Plan",
  platform: "win32",
  arch: "x64",
  out: path.resolve(process.cwd(), "../../outputs"),
  overwrite: true,
  icon: path.resolve(process.cwd(), "public/icon.ico"),
  electronVersion,
  electronZipDir,
  ignore: [
    /^\/src-tauri($|\/)/,
    /^\/scripts\/capture-electron\.cjs$/,
    /^\/local-plan-screenshot\.png$/,
    /^\/desktop-start\..*\.log$/,
  ],
});

console.log(`Packaged Local Plan to ${outputPaths.join(", ")}`);
