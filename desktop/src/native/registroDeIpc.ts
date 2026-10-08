import { type IpcMainEvent, type IpcMainInvokeEvent, ipcMain } from "electron";

import { BUILD_URL } from "./enderecoDoApp";
import {
  type DefinicaoDeEvento,
  type DefinicaoDePedido,
  type JanelaConferivel,
  criarRegistro,
} from "./registroDeIpcModelo";

/**
 * O registro de IPC que a casca usa — a decisão mora em
 * `registroDeIpcModelo.ts`.
 *
 * ⚠ **As janelas chegam por getter registrado, e não por import.** `window.ts`
 * e `overlay.ts` importam módulos que registram canais no carregamento
 * (`config.ts`, `autoLaunch.ts`); importá-los daqui fecharia um ciclo em que o
 * registro seria usado antes de existir.
 *
 * `ipcMain` fica proibido fora daqui — um teste varre `src/` e reprova.
 *
 * Canal novo:
 *
 *     registrar("vortexAlgo", {
 *       via: "invoke",
 *       quem: ["principal"],
 *       validar: (x) => booleano(x),
 *       executar: (sim, e) => …,
 *     });
 */

let principal: () => JanelaConferivel | undefined = () => undefined;
let overlay: () => JanelaConferivel | undefined = () => undefined;

export function registrarJanelaPrincipal(f: () => JanelaConferivel | undefined): void {
  principal = f;
}

export function registrarJanelaDoOverlay(f: () => JanelaConferivel | undefined): void {
  overlay = f;
}

const registro = criarRegistro<IpcMainEvent, IpcMainInvokeEvent>(ipcMain, () => ({
  janelas: { principal: principal(), overlay: overlay() },
  origem: BUILD_URL.origin,
}));

export function registrar<T>(
  canal: string,
  def: DefinicaoDeEvento<IpcMainEvent, T> | DefinicaoDePedido<IpcMainInvokeEvent, T>,
): void {
  registro.registrar(canal, def);
}

export {
  booleano,
  numeroFinito,
  objeto,
  semArgumentos,
  umDe,
} from "./registroDeIpcModelo";
