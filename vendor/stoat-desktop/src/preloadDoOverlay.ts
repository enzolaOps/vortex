import { contextBridge, ipcRenderer } from "electron";

/**
 * O preload da janela do OVERLAY do jogo — ver `native/overlay.ts`.
 *
 * ⚠ **Separado de `preload.ts`, e é o conserto de segurança.** A janela do
 * overlay carregava o mesmo preload da principal, e com ele `native.close`
 * (que fecha a janela PRINCIPAL), `vortexControles.definirAtalhos` (hook
 * global de teclado), `vortexAtenuacao.atenuar` (volume do sistema) e
 * `vortex.gravarPreferencia`/`reiniciar`/`limparCache`. Nada disso tem motivo
 * para existir numa página que só desenha o que a principal publica.
 *
 * Aqui atravessam DUAS pontes, e só elas: `vortexOverlay` (estado, mensagens,
 * interação e o comando dos botões de voz) e `vortexOverlaySilencio`. O main
 * ainda confere o remetente de todo canal (`native/remetente.ts`).
 *
 * ⚠ **`publicar` e `mensagem` existem e não fazem nada.** O contrato do
 * cliente (`ponteDeOverlay` em `client/…/overlay/modelo.ts`) só reconhece a
 * ponte com os seis verbos; tirar os dois faria o overlay não se desenhar.
 * Publicar é papel da principal, e o main recusaria de qualquer forma — aqui
 * eles nem chegam ao IPC.
 */
contextBridge.exposeInMainWorld("vortexOverlay", {
  publicar: (): void => undefined,
  mensagem: (): void => undefined,
  assinarEstado: (ouvinte: (e: unknown) => void) => {
    const alca = (_evento: unknown, e: unknown) => ouvinte(e);
    ipcRenderer.on("vortexOverlayEstado", alca);
    void ipcRenderer
      .invoke("vortexOverlayEstadoAtual")
      .then((atual?: { estado?: unknown }) => {
        if (atual?.estado) ouvinte(atual.estado);
      });
    return () => ipcRenderer.off("vortexOverlayEstado", alca);
  },
  assinarMensagens: (ouvinte: (m: unknown) => void) => {
    const alca = (_evento: unknown, m: unknown) => ouvinte(m);
    ipcRenderer.on("vortexOverlayMensagem", alca);
    return () => ipcRenderer.off("vortexOverlayMensagem", alca);
  },
  assinarInteracao: (ouvinte: (sim: unknown) => void) => {
    const alca = (_evento: unknown, sim: unknown) => ouvinte(sim);
    ipcRenderer.on("vortexOverlayInteracao", alca);
    void ipcRenderer
      .invoke("vortexOverlayEstadoAtual")
      .then((atual?: { interagindo?: unknown }) => {
        if (atual) ouvinte(atual.interagindo === true);
      });
    return () => ipcRenderer.off("vortexOverlayInteracao", alca);
  },
  comando: (c: unknown) => ipcRenderer.send("vortexOverlayComando", c),
});

/** Ver `alternarSilencioDoOverlay`. Um booleano atravessa. */
contextBridge.exposeInMainWorld("vortexOverlaySilencio", {
  assinar: (ouvinte: (silenciadas: boolean) => void) => {
    const alca = (_evento: unknown, sim: unknown) => ouvinte(sim === true);
    ipcRenderer.on("vortexOverlaySilencio", alca);
    void ipcRenderer.invoke("vortexOverlaySilencioAtual").then((atual: unknown) => {
      if (typeof atual === "boolean") ouvinte(atual);
    });
    return () => ipcRenderer.off("vortexOverlaySilencio", alca);
  },
});
