/**
 * Quem pode chamar cada canal de IPC — a DECISÃO, sem Electron.
 *
 * ⚠ **O renderer executa conteúdo escrito por qualquer pessoa, e há DUAS
 * janelas.** A do overlay do jogo carrega o mesmo cliente; um canal que não
 * confere o remetente deixaria a página do overlay (ou algo injetado nela)
 * fechar a janela principal, ligar o hook global de teclado, mexer no volume
 * do sistema ou gravar preferência. O preload do overlay já não expõe nada
 * disso — esta é a segunda camada: mesmo com uma ponte a mais, o main recusa.
 *
 * A regra é por CANAL e fechada: os três canais que o overlay usa aceitam só a
 * janela do overlay; TODO o resto aceita só a principal. Canal novo nasce
 * restrito à principal sem ninguém precisar lembrar.
 */

/** O mínimo de `BrowserWindow` que a decisão lê. */
export type JanelaConferivel = {
  isDestroyed(): boolean;
  webContents: { id: number };
};

/** O mínimo de `IpcMainEvent`/`IpcMainInvokeEvent` que a decisão lê. */
export type Remetente = { sender: { id: number } };

export type Janelas = {
  principal: JanelaConferivel | undefined;
  overlay: JanelaConferivel | undefined;
};

/** Os únicos canais que a janela do overlay chama. */
export const CANAIS_DO_OVERLAY: ReadonlySet<string> = new Set([
  "vortexOverlayEstadoAtual",
  "vortexOverlaySilencioAtual",
  "vortexOverlayComando",
]);

export function enviadoPor(janela: JanelaConferivel | undefined, e: Remetente): boolean {
  return janela !== undefined && !janela.isDestroyed() && e.sender.id === janela.webContents.id;
}

export function autorizado(canal: string, e: Remetente, janelas: Janelas): boolean {
  return CANAIS_DO_OVERLAY.has(canal)
    ? enviadoPor(janelas.overlay, e)
    : enviadoPor(janelas.principal, e);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- a assinatura é a do `ipcMain` */
type Ouvinte<E> = (e: E, ...args: any[]) => unknown;

export type IpcComoOMain<EOn extends Remetente, EHandle extends Remetente> = {
  on(canal: string, ouvinte: Ouvinte<EOn>): unknown;
  handle(canal: string, ouvinte: Ouvinte<EHandle>): unknown;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Embrulha um `ipcMain` para que nenhum ouvinte rode com remetente errado.
 *
 * `on` recusado não faz nada; `handle` recusado resolve `undefined` — o mesmo
 * que várias respostas "não se aplica" já devolvem, então recusar não abre
 * caminho de erro novo do lado do cliente.
 */
export function protegerIpc<EOn extends Remetente, EHandle extends Remetente>(
  ipc: IpcComoOMain<EOn, EHandle>,
  janelas: () => Janelas,
): IpcComoOMain<EOn, EHandle> {
  const recusar = (canal: string) =>
    console.warn(`IPC recusado: "${canal}" chamado por uma janela sem permissão.`);
  return {
    on: (canal, ouvinte) =>
      ipc.on(canal, (e: EOn, ...args: unknown[]) => {
        if (!autorizado(canal, e, janelas())) return recusar(canal);
        ouvinte(e, ...args);
      }),
    handle: (canal, ouvinte) =>
      ipc.handle(canal, (e: EHandle, ...args: unknown[]) => {
        if (!autorizado(canal, e, janelas())) {
          recusar(canal);
          return undefined;
        }
        return ouvinte(e, ...args);
      }),
  };
}
