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
 * React, cujo contrato vive em `client/…/sdk/seletorDeTela.ts`. Misturar as
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
  permissao: () => ipcRenderer.invoke("telaPermissao"),
  abrirAjustes: () => ipcRenderer.invoke("telaAbrirAjustes"),
});

/**
 * `window.vortex` — o contrato que o cliente React declara.
 *
 * ⚠ **Ele NUNCA existiu, e o sintoma foi "não aparecem os botões de
 * minimizar, maximizar e fechar".** `customFrame: true` é o padrão, então o
 * Electron não desenha moldura; a barra é do cliente, e ela só se desenha
 * quando esta ponte existe. Sem ela: janela sem moldura do sistema e sem barra
 * nossa — uma janela que não pode ser fechada.
 *
 * O contrato é `PonteDesktop`, em `client/…/sdk/desktop.ts`. Verbo que
 * faltar aqui faz `verbosFaltandoNaPonte` acusar do lado do cliente, que cai
 * na barra nativa em vez de deixar a janela sem controle nenhum.
 *
 * ⚠ **`versao`, `plataforma` e `electron` são VALORES e não funções**, ao
 * contrário do `native.versions` acima — que, medido no Electron, chega ao
 * renderer como `{node:{},chrome:{},electron:{}}`: o `contextBridge` não
 * atravessa função aninhada em objeto do jeito que aquele código espera. Valor
 * simples atravessa.
 */
contextBridge.exposeInMainWorld("vortex", {
  versao: version,
  plataforma: process.platform,
  electron: process.versions.electron,

  janela: (o: string) => ipcRenderer.invoke("vortexJanela", o),

  /*
    ⚠ **O ouvinte é embrulhado, e o `ipcRenderer` nunca o alcança direto.** Se
    a função do renderer fosse registrada como handler, o primeiro argumento
    que ela receberia seria o `IpcRendererEvent` — um objeto do Electron
    atravessando para o lado que executa conteúdo de terceiro. Aqui só o
    estado passa, e o `off` devolvido fecha a assinatura.
  */
  assinarJanela: (ouvinte: (e: unknown) => void) => {
    const alca = (_evento: unknown, estado: unknown) => ouvinte(estado);
    ipcRenderer.on("vortexJanelaMudou", alca);
    void ipcRenderer.invoke("vortexEstadoDaJanela").then(ouvinte);
    return () => ipcRenderer.off("vortexJanelaMudou", alca);
  },

  lerPreferencias: () => ipcRenderer.invoke("vortexLerPreferencias"),
  gravarPreferencia: (chave: string, valor: unknown) =>
    ipcRenderer.invoke("vortexGravarPreferencia", chave, valor),

  assinarAtualizacao: (ouvinte: (a: unknown) => void) => {
    const alca = (_evento: unknown, a: unknown) => ouvinte(a);
    ipcRenderer.on("vortexAtualizacao", alca);
    void ipcRenderer.invoke("vortexEstadoDaAtualizacao").then(ouvinte);
    return () => ipcRenderer.off("vortexAtualizacao", alca);
  },
  verificarAtualizacao: () => ipcRenderer.invoke("vortexVerificarAtualizacao"),
  instalarEReiniciar: () => ipcRenderer.invoke("vortexInstalarEReiniciar"),

  tamanhoDoCache: () => ipcRenderer.invoke("vortexTamanhoDoCache"),
  limparCache: () => ipcRenderer.invoke("vortexLimparCache"),
  abrirPastaDeLogs: () => ipcRenderer.invoke("vortexAbrirPastaDeLogs"),
});
