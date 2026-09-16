import { contextBridge, ipcRenderer } from "electron";

import { version } from "../../package.json";
import { CANAL_DA_PORTA } from "../native/portasDoOverlayModelo";

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
 * O áudio de UMA janela compartilhada — ver `native/audioDaJanela.ts`.
 *
 * ⚠ **Ponte SEPARADA de `vortexTela`, e a razão é versão.** O cliente é
 * carregado por URL e atualiza antes da casca; um verbo novo em `vortexTela`
 * faria toda casca antiga parecer incompleta, e o cliente desligaria o seletor
 * inteiro. Aqui a ausência só significa "janela sem som".
 *
 * O ouvinte é embrulhado como em `assinarJanela`: só o bloco de PCM atravessa,
 * nunca o `IpcRendererEvent`.
 */
contextBridge.exposeInMainWorld("vortexAudioDeJanela", {
  disponivel: () => ipcRenderer.invoke("audioJanelaDisponivel"),
  iniciar: () => ipcRenderer.invoke("audioJanelaIniciar"),
  parar: () => ipcRenderer.invoke("audioJanelaParar"),
  assinar: (ouvinte: (bloco: Uint8Array) => void) => {
    const alca = (_evento: unknown, bloco: Uint8Array) => ouvinte(bloco);
    ipcRenderer.on("audioJanelaBloco", alca);
    return () => ipcRenderer.off("audioJanelaBloco", alca);
  },
});

/**
 * Atalhos de voz globais e a bandeja — ver `native/controles.ts`.
 *
 * Ponte SEPARADA pela mesma razão de `vortexAudioDeJanela`: um verbo novo em
 * `vortex` faria cascas antigas parecerem incompletas para o cliente novo.
 *
 * Nenhuma tecla atravessa: o main manda só o COMANDO da combinação que o
 * próprio cliente cadastrou.
 */
contextBridge.exposeInMainWorld("vortexControles", {
  definirAtalhos: (atalhos: unknown) =>
    ipcRenderer.invoke("vortexDefinirAtalhos", atalhos),
  assinarComandos: (ouvinte: (c: unknown) => void) => {
    const alca = (_evento: unknown, c: unknown) => ouvinte(c);
    ipcRenderer.on("vortexComandoDeVoz", alca);
    return () => ipcRenderer.off("vortexComandoDeVoz", alca);
  },
  publicarEstadoDeVoz: (estado: unknown) =>
    ipcRenderer.send("vortexEstadoDeVoz", estado),
});

/**
 * Contador no ícone, piscar a barra de tarefas e focar a janela — ver
 * `native/notificacoes.ts`. Ponte separada pela mesma razão das outras duas.
 * Só números atravessam; o main valida.
 */
contextBridge.exposeInMainWorld("vortexNotificacoes", {
  contador: (n: number) => ipcRenderer.send("vortexContador", n),
  chamarAtencao: () => ipcRenderer.send("vortexChamarAtencao"),
  focar: () => ipcRenderer.send("vortexFocar"),
});

/**
 * O overlay do jogo — ver `native/overlay.ts`. Nesta janela a ponte só
 * PUBLICA; quem assina é a janela do overlay, com preload próprio
 * (`preloadDoOverlay.ts`).
 *
 * ⚠ **Por porta, e não por canal de IPC.** O main entrega a esta página uma
 * porta a cada carregamento (`CANAL_DA_PORTA`) e fica no meio: lê o estado
 * para decidir se o overlay aparece e repassa. Ver
 * `native/portasDoOverlayModelo.ts`.
 *
 * O último estado publicado é guardado e reenviado quando a porta chega —
 * o cliente publica assim que monta, e isso pode ser antes da entrega.
 * Mensagem não: ela só vale no instante em que acontece.
 *
 * Os quatro verbos de assinatura existem só porque o contrato do cliente
 * (`ponteDeOverlay`) exige os seis; nesta janela eles não recebem nada.
 */
let portaDoOverlay: MessagePort | undefined;
let estadoDoOverlay: unknown;

function postarNoOverlay(mensagem: unknown): void {
  try {
    portaDoOverlay?.postMessage(mensagem);
  } catch (erro) {
    /* Estado com algo que não se clona (função, nó do DOM) não derruba o app. */
    console.error("Não deu para publicar no overlay:", erro);
  }
}

ipcRenderer.on(CANAL_DA_PORTA, (evento) => {
  const nova = evento.ports[0];
  if (!nova) return;
  portaDoOverlay?.close();
  portaDoOverlay = nova;
  if (estadoDoOverlay !== undefined) postarNoOverlay({ tipo: "estado", estado: estadoDoOverlay });
});

const semAssinatura = (): (() => void) => () => undefined;

contextBridge.exposeInMainWorld("vortexOverlay", {
  publicar: (estado: unknown) => {
    estadoDoOverlay = estado;
    postarNoOverlay({ tipo: "estado", estado });
  },
  mensagem: (m: unknown) => postarNoOverlay({ tipo: "mensagem", mensagem: m }),
  assinarEstado: semAssinatura,
  assinarMensagens: semAssinatura,
  assinarInteracao: semAssinatura,
  comando: (): void => undefined,
});

/**
 * "Reiniciar agora", do aviso de preferência que só vale no próximo início —
 * ver `native/preferencias.ts`. Ponte separada pela razão de versão; nenhum
 * argumento atravessa.
 */
contextBridge.exposeInMainWorld("vortexReinicio", {
  reiniciar: () => ipcRenderer.invoke("vortexReiniciar"),
});

/**
 * "Atenuar outros apps" — ver `native/atenuacao.ts`. Um booleano atravessa,
 * nada mais. Ponte separada pela mesma razão das outras.
 */
contextBridge.exposeInMainWorld("vortexAtenuacao", {
  atenuar: (sim: boolean) => ipcRenderer.send("vortexAtenuar", sim === true),
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
