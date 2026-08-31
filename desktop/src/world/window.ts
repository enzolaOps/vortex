import { contextBridge, ipcRenderer } from "electron";

import { version } from "../../package.json";

contextBridge.exposeInMainWorld("native", {
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    desktop: () => version,
  },

  minimise: () => ipcRenderer.send("minimise"),
  maximise: () => ipcRenderer.send("maximise"),
  close: () => ipcRenderer.send("close"),

  isWayland: () => ipcRenderer.invoke("getIsWayland"),
});

/**
 * O seletor de tela, numa ponte PRÓPRIA e estreita.
 *
 * ⚠ **Separada de `native` de propósito, e o nome é o contrato do cliente.**
 * `native` é a ponte do cliente Solid (`web/`); esta é consumida pelo cliente
 * React, cujo contrato vive em `web-react/…/sdk/seletorDeTela.ts`. Misturar as
 * duas faria uma casca ditar a forma da outra — e o briefing manda o contrário:
 * o cliente declara o que precisa, a casca implementa.
 *
 * Três verbos, e nada além deles atravessa. Nenhum aceita callback do
 * renderer, nenhum devolve objeto do Electron: só dados simples, e o main
 * revalida o `id` do lado dele.
 */
contextBridge.exposeInMainWorld("vortexTela", {
  seletorProprio: () => ipcRenderer.invoke("telaSeletorProprio"),
  fontes: () => ipcRenderer.invoke("telaFontes"),
  escolher: (id: string, audio: boolean) =>
    ipcRenderer.invoke("telaEscolher", id, audio),
  cancelar: () => ipcRenderer.invoke("telaCancelar"),
});
