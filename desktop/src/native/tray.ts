import { Menu, Tray, nativeImage } from "electron";

import trayIconAsset from "../../assets/icon.png?asset";
import macOsTrayIconAsset from "../../assets/iconTemplate.png?asset";
import { version } from "../../package.json";

import { mainWindow, quitApp } from "./window";

// internal tray state
let tray: Tray = null;

// Create and resize tray icon for macOS
function createTrayIcon() {
  if (process.platform === "darwin") {
    const image = nativeImage.createFromDataURL(macOsTrayIconAsset);
    const resized = image.resize({ width: 20, height: 20 });
    resized.setTemplateImage(true);
    return resized;
  } else {
    return nativeImage.createFromDataURL(trayIconAsset);
  }
}

export function initTray() {
  const trayIcon = createTrayIcon();
  tray = new Tray(trayIcon);
  tray.setImage(trayIcon);
  updateTrayMenu();
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * O que a bandeja sabe da voz — publicado pelo cliente (`vortexEstadoDeVoz`).
 *
 * ⚠ **O menu não adivinha.** Mutar pela bandeja sem saber se já está mudo
 * mostraria "Mutar" para quem está mudo; o cliente é a fonte, e cada mudança
 * de mudo, surdo ou chamada reconstrói o menu.
 */
let voz = { naChamada: false, mudo: false, surdo: false };

export function definirEstadoDeVoz(estado: typeof voz): void {
  voz = estado;
  if (tray) updateTrayMenu();
}

function comando(c: "mutar" | "ensurdecer" | "desconectar") {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("vortexComandoDeVoz", c);
}

export function updateTrayMenu() {
  if (!tray) return;
  tray.setToolTip(
    voz.naChamada ? `Vortex — em chamada${voz.mudo ? " (mudo)" : ""}` : "Vortex",
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Vortex ${version}`, type: "normal", enabled: false },
      { type: "separator" },
      {
        label: mainWindow.isVisible() ? "Esconder o Vortex" : "Abrir o Vortex",
        type: "normal",
        click() {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { type: "separator" },
      {
        /* Mudo e surdo valem fora da chamada também — são preferência, e o
           cliente os aplica ao entrar. */
        label: "Mutar microfone",
        type: "checkbox",
        checked: voz.mudo,
        click: () => comando("mutar"),
      },
      {
        label: "Ensurdecer",
        type: "checkbox",
        checked: voz.surdo,
        click: () => comando("ensurdecer"),
      },
      {
        label: "Desconectar da voz",
        type: "normal",
        enabled: voz.naChamada,
        click: () => comando("desconectar"),
      },
      { type: "separator" },
      {
        label: "Sair do Vortex",
        type: "normal",
        click: quitApp,
      },
    ]),
  );
}
