/**
 * O popout da chamada como janela do SISTEMA — a DECISÃO, sem Electron.
 *
 * O design (D-VOZ-15) pede a janelinha da chamada "sempre no topo, arrastável,
 * sem rail nem sidebar". No navegador ela é um cartão dentro da página; aqui
 * ela sai para uma janela própria, que continua visível com o Vortex atrás de
 * outro app — que é o caso inteiro para o qual ela existe.
 *
 * ⚠ **A janela é SUPERFÍCIE, não segunda sessão, e por isso é `window.open`
 * e não um `BrowserWindow` com rota própria.** O overlay do jogo carrega o
 * cliente numa rota e recebe um retrato do estado por porta, porque vive num
 * processo à parte e não pode ter conexão. O popout faz o contrário: a
 * PRINCIPAL abre uma janela `about:blank`, mesma origem e mesmo processo, e
 * desenha nela por portal React. Uma árvore, um store, uma conexão de voz — e
 * o vídeo continua funcionando, porque a faixa já está neste renderer. Um
 * retrato por porta não atravessaria um `MediaStreamTrack`.
 *
 * ⚠ **Nenhuma ponte nova.** A capacidade é o próprio `window.open` ser
 * permitido: casca antiga nega (`about:blank` não é link externo), o cliente
 * recebe `null` e fica com o cartão. A ponte que não existe é a que não vaza.
 *
 * O que a casca libera é estreito de propósito: UMA janela, com UM nome, em
 * `about:blank`, pedida pela janela principal. Qualquer outro `window.open`
 * segue a regra de sempre — link externo vai ao navegador do sistema, o resto
 * é negado.
 */
import { abrirNoNavegadorDoSistema } from "./privilegioModelo";

/** O nome da janela — o cliente passa este mesmo texto a `window.open`. */
export const NOME_DO_POPOUT = "vortex-popout-de-voz";

/**
 * `window.open("", nome)` chega ao main como `about:blank`; os dois valem.
 *
 * ⚠ **Vazio e não `about:blank` no cliente**: com URL vazia a janela fica no
 * documento inicial, sem navegação nenhuma — e é nele que o portal escreve.
 */
const URLS_DO_POPOUT: readonly string[] = ["", "about:blank"];

export type PedidoDeJanela = {
  readonly url: string;
  readonly frameName: string;
};

export type DecisaoDeJanela = "popout" | "externo" | "negar";

export type ContextoDoPedido = {
  /** O pedido veio do `webContents` da janela principal. */
  readonly daPrincipal: boolean;
  /** Já existe um popout aberto — um por app. */
  readonly popoutAberto: boolean;
};

/**
 * O que fazer com um `window.open`.
 *
 * ⚠ **O nome sozinho não basta, e a URL sozinha também não.** `about:blank`
 * sem o nome é o que qualquer script pediria para desenhar o que quisesse por
 * cima de tudo; o nome com outra URL seria uma página de terceiro sempre no
 * topo. Só os dois juntos, e só da principal.
 */
export function decidirJanelaNova(
  p: PedidoDeJanela,
  ctx: ContextoDoPedido,
): DecisaoDeJanela {
  if (p.frameName === NOME_DO_POPOUT && URLS_DO_POPOUT.includes(p.url)) {
    return ctx.daPrincipal && !ctx.popoutAberto ? "popout" : "negar";
  }
  return abrirNoNavegadorDoSistema(p.url) ? "externo" : "negar";
}

/* ---------------------------------------------- quem pediu, de verdade */

/** O mínimo de `WebFrameMain` que a conferência lê. */
export type FrameConferivel = {
  readonly url: string;
  readonly processId: number;
  readonly routingId: number;
};

function origemDe(bruta: string): string | undefined {
  try {
    return new URL(bruta).origin;
  } catch {
    return undefined;
  }
}

/**
 * A janela criada foi aberta pelo frame PRINCIPAL da janela principal, na
 * origem do app?
 *
 * ⚠ **O `setWindowOpenHandler` não diz qual frame pediu** — um iframe dentro
 * da principal chega com o mesmo `webContents`. Hoje o único iframe do app
 * (atividades) é `sandbox="allow-scripts"`, sem `allow-popups`, e o Chromium
 * nem deixa o pedido sair; esta conferência é a segunda camada, para o dia em
 * que alguém acrescentar um embed sem saber disto. Janela que não passa é
 * destruída antes de aparecer.
 */
export function aberturaLegitima(
  opener: FrameConferivel | null | undefined,
  principal: FrameConferivel | undefined,
  origemDoApp: string,
): boolean {
  if (!opener || !principal) return false;
  if (
    opener.processId !== principal.processId ||
    opener.routingId !== principal.routingId
  ) {
    return false;
  }
  return origemDe(opener.url) === origemDoApp;
}

/* ------------------------------------------------ a janela, em números */

export type Retangulo = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * O tamanho com que a janela NASCE: o popout grande do design,
 * `420 × (28 + 190 + 52)` mais as duas bordas. O cliente mede o conteúdo e
 * ajusta logo em seguida; o número daqui só decide o primeiro quadro e o
 * canto de onde ela parte.
 */
export const TAMANHO_INICIAL = { width: 420, height: 272 } as const;

/** Do canto da área de trabalho — o mesmo recuo do cartão dentro do app. */
export const RECUO = 16;

/**
 * Onde a janela nasce: canto inferior do fim da área de trabalho da tela onde
 * está a principal — o mesmo canto do cartão, agora na tela.
 *
 * `workArea` e não `bounds`: a barra de tarefas não cobre a janelinha. Área
 * menor que a janela (tela minúscula, escala absurda) encosta no início em
 * vez de nascer com coordenada negativa.
 */
export function posicaoInicial(
  area: Retangulo,
  tamanho: {
    readonly width: number;
    readonly height: number;
  } = TAMANHO_INICIAL,
): { x: number; y: number } {
  return {
    x: Math.round(
      Math.max(area.x, area.x + area.width - tamanho.width - RECUO),
    ),
    y: Math.round(
      Math.max(area.y, area.y + area.height - tamanho.height - RECUO),
    ),
  };
}

/**
 * As opções da janela — o que `overrideBrowserWindowOptions` recebe.
 *
 * - **Sem moldura e transparente**: a moldura é a do popout, com o raio do
 *   design; a do sistema desenharia uma segunda barra acima da de 28px.
 * - **Sempre no topo** é o pedido do design. O NÍVEL é aplicado depois, no
 *   `did-create-window` (`floating`), porque a opção do construtor não o
 *   recebe.
 * - **`show: false`**, e quem mostra é `showInactive`: a janela aparece quando
 *   a pessoa sai do canal da chamada, muitas vezes no meio de uma frase no
 *   composer. Abrir roubando o foco engoliria o resto da frase.
 * - **Não redimensionável pela borda**: o tamanho é do conteúdo (as duas
 *   formas do design), e o cliente o ajusta por `resizeTo`.
 * - **Na barra de tarefas**, de propósito: é o caminho de teclado até ela
 *   (Alt+Tab). Uma janela sempre no topo que só o mouse alcança excluiria
 *   quem não usa mouse.
 */
export function opcoesDoPopout(area: Retangulo) {
  const { x, y } = posicaoInicial(area);
  return {
    x,
    y,
    width: TAMANHO_INICIAL.width,
    height: TAMANHO_INICIAL.height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: "Chamada",
  } as const;
}

/**
 * Onde a janela vai quando o conteúdo pede outro tamanho (`window.resizeTo`
 * no cliente, ao trocar entre as duas formas do design).
 *
 * ⚠ **O canto de BAIXO e do FIM fica parado**, que é o canto de onde ela
 * nasce: encolher de 420 para a forma mínima de 216 mantendo o de cima e do
 * começo faria a janelinha pular para longe de onde estava.
 *
 * ⚠ **Quem posiciona é o main, e não o cliente.** Medido no Electron 44: numa
 * janela aberta por `window.open` no mesmo processo, `screenX` e
 * `outerWidth` devolvem os valores da JANELA PRINCIPAL (728 e 1296, com o
 * popout em 2316 e 422). A conta feita lá mandaria o popout para o meio da
 * tela. Aqui a fonte é `getBounds()` da própria janela.
 *
 * E fica dentro da área de trabalho: um conteúdo que crescesse além dela, ou
 * uma janela arrastada até a borda, não sai da tela por causa da troca.
 */
export function boundsAncorados(
  atual: Retangulo,
  pedido: { readonly width: number; readonly height: number },
  area: Retangulo,
): Retangulo {
  const width = Math.max(1, Math.round(Math.min(pedido.width, area.width)));
  const height = Math.max(1, Math.round(Math.min(pedido.height, area.height)));
  const x = atual.x + atual.width - width;
  const y = atual.y + atual.height - height;
  return {
    x: Math.min(Math.max(x, area.x), area.x + area.width - width),
    y: Math.min(Math.max(y, area.y), area.y + area.height - height),
    width,
    height,
  };
}

/** O nível do "sempre no topo": acima de janelas comuns, abaixo do overlay. */
export const NIVEL_DO_TOPO = "floating" as const;
