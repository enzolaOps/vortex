import { app, ipcMain, nativeImage } from "electron";

import { mainWindow } from "./window";

/**
 * O que a notificação da web não alcança: o contador no ícone, o piscar da
 * barra de tarefas e trazer a janela para a frente.
 *
 * A notificação em si NÃO passa por aqui — `new Notification()` no renderer já
 * vira a notificação nativa do sistema no Electron.
 */

/**
 * Um ponto vermelho de 16×16, desenhado em memória.
 *
 * ⚠ **O Windows não tem contador numérico no ícone da barra de tarefas** —
 * `app.setBadgeCount` só funciona no macOS e no Linux (Unity). Lá o recurso é
 * o ícone de SOBREPOSIÇÃO, e um ponto diz "há menções" sem precisar de uma
 * imagem por número. A contagem vai no texto alternativo.
 */
function pontoVermelho() {
  const lado = 16;
  const bgra = Buffer.alloc(lado * lado * 4);
  const centro = (lado - 1) / 2;
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const d = Math.hypot(x - centro, y - centro);
      /* Borda suavizada em um pixel, senão o círculo sai serrilhado. */
      const alfa = Math.max(0, Math.min(1, 7.5 - d));
      const i = (y * lado + x) * 4;
      bgra[i] = 0x6b; // B
      bgra[i + 1] = 0x59; // G
      bgra[i + 2] = 0xe8; // R — #E8596B, o danger do design
      bgra[i + 3] = Math.round(alfa * 255);
    }
  }
  return nativeImage.createFromBitmap(bgra, { width: lado, height: lado });
}

let ponto: Electron.NativeImage | undefined;

function contador(bruto: unknown): void {
  const n =
    typeof bruto === "number" && Number.isFinite(bruto) ? Math.max(0, Math.floor(bruto)) : 0;
  if (process.platform === "win32") {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    ponto ??= pontoVermelho();
    mainWindow.setOverlayIcon(
      n > 0 ? ponto : null,
      n > 0 ? `${String(n)} ${n === 1 ? "menção" : "menções"}` : "",
    );
    return;
  }
  app.setBadgeCount(n);
}

export function registrarNotificacoes(): void {
  ipcMain.on("vortexContador", (_e, n: unknown) => contador(n));

  ipcMain.on("vortexChamarAtencao", () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFocused()) return;
    /* Pisca até alguém olhar — o Windows para sozinho quando a janela ganha
       foco, e o `focus` abaixo garante o mesmo nas outras plataformas. */
    mainWindow.flashFrame(true);
    mainWindow.once("focus", () => mainWindow.flashFrame(false));
  });

  ipcMain.on("vortexFocar", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}
