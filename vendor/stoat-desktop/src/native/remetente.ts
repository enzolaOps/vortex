import { type IpcMainEvent, type IpcMainInvokeEvent, ipcMain } from "electron";

import {
  type JanelaConferivel,
  type Remetente,
  enviadoPor,
  protegerIpc,
} from "./remetenteModelo";

/**
 * O `ipcMain` que a casca usa — a decisão mora em `remetenteModelo.ts`.
 *
 * ⚠ **As janelas chegam por getter registrado, e não por import.** `window.ts`
 * e `overlay.ts` importam módulos que registram canais no carregamento
 * (`config.ts`, `autoLaunch.ts`); importá-los daqui fecharia um ciclo em que o
 * guarda seria usado antes de existir. Este módulo não importa nada do projeto
 * além da decisão pura.
 *
 * `ipcMain.on`/`ipcMain.handle` diretos ficam proibidos fora daqui — um teste
 * varre `src/` e reprova.
 */

let principal: () => JanelaConferivel | undefined = () => undefined;
let overlay: () => JanelaConferivel | undefined = () => undefined;

export function registrarJanelaPrincipal(f: () => JanelaConferivel | undefined): void {
  principal = f;
}

export function registrarJanelaDoOverlay(f: () => JanelaConferivel | undefined): void {
  overlay = f;
}

/** O remetente é a janela principal? */
export function daJanelaPrincipal(e: Remetente): boolean {
  return enviadoPor(principal(), e);
}

/** O remetente é a janela do overlay? */
export function daJanelaDoOverlay(e: Remetente): boolean {
  return enviadoPor(overlay(), e);
}

export const ipc = protegerIpc<IpcMainEvent, IpcMainInvokeEvent>(ipcMain, () => ({
  principal: principal(),
  overlay: overlay(),
}));
