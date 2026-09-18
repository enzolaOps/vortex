import { BrowserWindow, app, shell } from "electron";

import { tratarSquirrel } from "./native/atalhosDoSquirrel";
import {
  ligarAtualizacaoAutomatica,
  registrarAtualizacaoNaPonte,
} from "./native/atualizacao";
import { config } from "./native/config";
import { registrarPonteDoVortex } from "./native/ponteDoVortex";
import {
  abrirNoNavegadorDoSistema,
  navegacaoDaPrincipalPermitida,
} from "./native/privilegioModelo";
import { initTray } from "./native/tray";
import { initVirtualMic } from "./native/virtualMic";
import { BUILD_URL, createMainWindow, mainWindow } from "./native/window";

/*
  ⚠ **ANTES de qualquer janela, bandeja ou ponte.** Depois de instalar, o
  Squirrel roda o app com `--squirrel-install`; é o APP que cria o atalho e
  SAI. Enquanto isso não era feito, o instalador abria uma janela comum, o
  processo nunca encerrava, nenhum atalho era criado — e o `Setup.exe` deixava
  a animação de carregamento pendurada sobre essa janela, porque ele a mostra
  justamente enquanto espera este processo terminar.
*/
const encerrandoPeloSquirrel = tratarSquirrel();

// disable hw-accel if so requested
if (!config.hardwareAcceleration) {
  app.disableHardwareAcceleration();
}

// ensure only one copy of the application can run
const acquiredLock = !encerrandoPeloSquirrel && app.requestSingleInstanceLock();

if (acquiredLock) {
  // create and configure the app when electron is ready
  app.on("ready", () => {
    // create window and application contexts
    createMainWindow();

    // save first launch state
    if (config.firstLaunch) {
      // Doesn't do anything right now. Used to enable auto start, but that behaviour was removed.
      // Left in case it gets used in the future.
      config.firstLaunch = false;
    }

    initTray();
    initVirtualMic();
    /* ⚠ DEPOIS de `createMainWindow()`: a ponte assina eventos da janela, e
       sem janela não há o que assinar. */
    registrarPonteDoVortex();
    registrarAtualizacaoNaPonte();
    ligarAtualizacaoAutomatica();

    // Windows specific fix for notifications
    if (process.platform === "win32") {
      app.setAppUserModelId("io.github.enzolaOps.Vortex");
    }
  });

  // focus the window if we try to launch again
  app.on("second-instance", () => {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
  });

  // macOS specific behaviour to keep app active in dock:
  // (irrespective of the minimise-to-tray option)

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ensure URLs launch in external context
  /*
    Vale para TODO `webContents`, a principal inclusive: navegar só dentro da
    origem do app, e nenhuma janela nova — link externo vai para o navegador
    do sistema. O overlay troca as duas regras por "nada" ao ser criado (ver
    `overlay.ts`). A decisão mora em `privilegioModelo.ts`, com teste.
  */
  app.on("web-contents-created", (_, contents) => {
    contents.on("will-navigate", (event, navigationUrl) => {
      if (!navegacaoDaPrincipalPermitida(navigationUrl, BUILD_URL.origin)) {
        event.preventDefault();
      }
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (abrirNoNavegadorDoSistema(url)) {
        setImmediate(() => {
          void shell.openExternal(url);
        });
      }

      return { action: "deny" };
    });
  });
} else if (!encerrandoPeloSquirrel) {
  /*
    ⚠ O `quit` daqui é o da SEGUNDA instância. Quando quem manda é o Squirrel,
    quem encerra é `tratarSquirrel()`, e só depois que o `Update.exe` fecha —
    sair antes mataria a escrita do atalho no meio.
  */
  app.quit();
}
