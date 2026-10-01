import {
  type BrowserWindow,
  type HandlerDetails,
  type WebContents,
  type WindowOpenHandlerResponse,
  screen,
  shell,
} from "electron";

import {
  NIVEL_DO_TOPO,
  NOME_DO_POPOUT,
  aberturaLegitima,
  boundsAncorados,
  decidirJanelaNova,
  opcoesDoPopout,
} from "./popoutDeVozModelo";
import { protegerConteudoDoOverlay } from "./privilegioModelo";
import { BUILD_URL, mainWindow } from "./window";

/**
 * O popout da chamada como janela do sistema — o EFEITO, fino. A decisão
 * mora em `popoutDeVozModelo.ts`, com teste.
 *
 * ⚠ **Nenhum canal de IPC.** Quem desenha a janela é a principal, por portal
 * React sobre o documento `about:blank` que ela mesma abriu; o main só decide
 * se a janela pode existir, com que forma, e a mantém no topo. Uma conexão de
 * voz por app, e a janela é superfície dela.
 */

let popout: BrowserWindow | undefined;

function vivo(w: BrowserWindow | undefined): w is BrowserWindow {
  return w !== undefined && !w.isDestroyed();
}

function daPrincipal(contents: WebContents): boolean {
  return vivo(mainWindow) && contents === mainWindow.webContents;
}

/**
 * O `setWindowOpenHandler` de TODO `webContents` — ver `main.ts`. Fora o
 * popout, a regra é a de antes: link externo ao navegador, o resto negado.
 */
export function tratarJanelaNova(
  contents: WebContents,
  detalhes: Pick<HandlerDetails, "url" | "frameName">,
): WindowOpenHandlerResponse {
  const decisao = decidirJanelaNova(
    { url: detalhes.url, frameName: detalhes.frameName },
    { daPrincipal: daPrincipal(contents), popoutAberto: vivo(popout) },
  );

  if (decisao === "popout") {
    const area = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
    return {
      action: "allow",
      overrideBrowserWindowOptions: opcoesDoPopout(area),
      /*
        ⚠ Morre com a principal. A janela é desenhada POR ela: com a
        principal fechada o portal não tem mais dono, e uma janela sempre no
        topo com o último quadro congelado seria uma chamada fantasma. É
        também o que deixa `window-all-closed` encerrar o app.
      */
      outlivesOpener: false,
    };
  }

  if (decisao === "externo") {
    setImmediate(() => {
      void shell.openExternal(detalhes.url);
    });
  }
  return { action: "deny" };
}

/**
 * Prepara a janela recém-criada — o `did-create-window` da principal.
 *
 * ⚠ **Confere de novo QUEM abriu**, porque o handler não sabe o frame (ver
 * `aberturaLegitima`). Janela que não passa é destruída antes de aparecer.
 */
export function prepararJanelaNova(
  janela: BrowserWindow,
  detalhes: { frameName: string },
): void {
  if (detalhes.frameName !== NOME_DO_POPOUT) return;

  const legitima = aberturaLegitima(
    janela.webContents.opener,
    vivo(mainWindow) ? mainWindow.webContents.mainFrame : undefined,
    BUILD_URL.origin,
  );
  if (!legitima) {
    janela.destroy();
    return;
  }

  popout = janela;
  janela.on("closed", () => {
    if (popout === janela) popout = undefined;
  });

  /* Acima de janelas comuns, também sobre as de tela cheia sem bordas; o
     overlay do jogo fica acima dela (`screen-saver`). */
  janela.setAlwaysOnTop(true, NIVEL_DO_TOPO);
  janela.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  janela.setMenu(null);

  /*
    Nunca navega e nunca abre janela: é um documento em branco onde a
    principal escreve. Depois do `web-contents-created` de `main.ts`, que
    liberava navegação na origem do app — esta regra é mais estreita e soma a
    ela (qualquer ouvinte que chame `preventDefault` barra).
  */
  protegerConteudoDoOverlay(janela.webContents);

  /*
    O cliente pede o tamanho do conteúdo por `resizeTo` ao trocar de forma, e
    a posição é decidida AQUI — ver `boundsAncorados`, que diz por que a conta
    não pode ser feita no renderer.
  */
  janela.webContents.on("content-bounds-updated", (evento, pedido) => {
    evento.preventDefault();
    const atual = janela.getBounds();
    const area = screen.getDisplayMatching(atual).workArea;
    janela.setBounds(boundsAncorados(atual, pedido, area));
  });

  /*
    ⚠ **Sem isto a janela aparece VAZIA, e foi medido no Electron 44.** Ela
    nasce com `show: false` e o renderer dela fica `visibilityState: hidden`
    mesmo depois do `showInactive()`: nenhum `requestAnimationFrame`, nenhum
    `ResizeObserver`, nenhum quadro pintado — uma janela transparente, sempre
    no topo, sem nada dentro. O conteúdo estava lá (a captura por CDP o
    mostrava inteiro); quem não pintava era a janela. Desligar o throttling
    também desliga o "escondido" deste `webContents`, e é o certo para uma
    janela cuja razão de existir é ficar à vista por cima de outro app.
  */
  janela.webContents.setBackgroundThrottling(false);

  /* Aparecer não rouba o foco — ver `opcoesDoPopout`. */
  janela.showInactive();
}
