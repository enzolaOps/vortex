import { BrowserWindow, ipcMain, screen } from "electron";
import { join } from "node:path";

import { BUILD_URL, mainWindow } from "./window";

/**
 * O overlay do jogo: uma janela transparente por cima de tudo.
 *
 * ⚠ **Janela, e não injeção.** Discord desenha dentro do jogo injetando uma
 * DLL no processo dele; isso exige assinatura, é bloqueado por anti-cheat e
 * não é algo que um app Electron deva fazer. Uma janela transparente, sempre
 * no topo e que deixa o clique passar funciona em jogo em janela e em tela
 * cheia SEM BORDAS — o modo padrão da maioria dos jogos atuais. Em tela cheia
 * exclusiva o jogo toma a tela, e a tela de configurações diz isso.
 *
 * ⚠ **Carrega o MESMO cliente em `/overlay`**, só para herdar tokens, fontes e
 * componentes. Ele não abre sessão nem socket: tudo o que desenha chega por
 * aqui, publicado pela janela principal. Uma conexão por app, como o briefing
 * manda.
 *
 * Travado (o padrão), a janela ignora o mouse e o jogo recebe tudo. O atalho
 * "Alternar overlay" a deixa clicável até ela perder o foco ou o atalho vir de
 * novo — é o que torna os botões de microfone e sair alcançáveis sem sair do
 * jogo.
 */

type Estado = {
  ativo: boolean;
  voz: unknown;
  [k: string]: unknown;
};

let janela: BrowserWindow | undefined;
let estado: Estado | undefined;
let interagindo = false;

function vivo(w: BrowserWindow | undefined): w is BrowserWindow {
  return w !== undefined && !w.isDestroyed();
}

function criar(): BrowserWindow {
  const w = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  /* "screen-saver" é o nível mais alto: fica acima de janelas em tela cheia
     sem bordas, que é justamente onde o jogo está. */
  w.setAlwaysOnTop(true, "screen-saver");
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  w.setIgnoreMouseEvents(true, { forward: true });
  w.setMenu(null);
  void w.loadURL(new URL("/overlay", BUILD_URL).toString());
  /* Clicou fora (voltou ao jogo): trava de novo. */
  w.on("blur", () => definirInteracao(false));
  w.on("closed", () => {
    janela = undefined;
  });
  return w;
}

/** Cobre a tela onde está o ponteiro — é nela que a pessoa está jogando. */
function posicionar(w: BrowserWindow): void {
  const tela = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const b = tela.bounds;
  const atual = w.getBounds();
  if (atual.x !== b.x || atual.y !== b.y || atual.width !== b.width || atual.height !== b.height) {
    w.setBounds(b);
  }
}

/**
 * Mostra ou esconde conforme o estado.
 *
 * Aparece com o overlay ligado, uma chamada aberta e o Vortex SEM foco. Com o
 * Vortex à frente, a própria janela já mostra tudo — e um overlay por cima do
 * app seria o app cobrindo a si mesmo.
 */
function reavaliar(): void {
  const principalComFoco = vivo(mainWindow) && mainWindow.isFocused();
  const querer = !!estado?.ativo && !!estado.voz && !principalComFoco;

  if (!querer) {
    if (vivo(janela) && janela.isVisible()) janela.hide();
    definirInteracao(false);
    return;
  }
  janela = vivo(janela) ? janela : criar();
  posicionar(janela);
  /* `showInactive`: aparecer não pode tirar o foco do jogo. */
  if (!janela.isVisible()) janela.showInactive();
}

function definirInteracao(sim: boolean): void {
  if (interagindo === sim) return;
  interagindo = sim;
  if (!vivo(janela)) return;
  janela.setIgnoreMouseEvents(!sim, { forward: true });
  janela.setFocusable(sim);
  if (sim) {
    janela.show();
    janela.focus();
  }
  janela.webContents.send("vortexOverlayInteracao", sim);
}

/** O atalho "Alternar overlay" — chamado pelo hook de teclado. */
export function alternarOverlay(): void {
  if (!vivo(janela) || !janela.isVisible()) return;
  definirInteracao(!interagindo);
}

export function registrarOverlay(): void {
  /*
    Só a janela PRINCIPAL publica; a do overlay só lê. Conferir o remetente é o
    que impede a página do overlay — ou algo injetado nela — de reescrever o
    que ela mesma mostra.
  */
  const daPrincipal = (e: Electron.IpcMainEvent) =>
    vivo(mainWindow) && e.sender.id === mainWindow.webContents.id;
  const doOverlay = (e: Electron.IpcMainEvent) =>
    vivo(janela) && e.sender.id === janela.webContents.id;

  ipcMain.on("vortexOverlayPublicar", (e, bruto: unknown) => {
    if (!daPrincipal(e) || typeof bruto !== "object" || bruto === null) return;
    estado = bruto as Estado;
    if (vivo(janela)) janela.webContents.send("vortexOverlayEstado", estado);
    reavaliar();
  });

  ipcMain.on("vortexOverlayMensagem", (e, bruto: unknown) => {
    if (!daPrincipal(e) || typeof bruto !== "object" || bruto === null) return;
    if (!vivo(janela) || !janela.isVisible()) return;
    janela.webContents.send("vortexOverlayMensagem", bruto);
  });

  /*
    ⚠ **A página PEDE o estado ao assinar, em vez de a casca empurrá-lo no
    `did-finish-load`.** Medido no Electron: o evento chega antes de o React
    montar e registrar o ouvinte, e o primeiro estado se perdia — o overlay
    abria vazio até a chamada mudar de novo.
  */
  ipcMain.handle("vortexOverlayEstadoAtual", (e) =>
    vivo(janela) && e.sender.id === janela.webContents.id
      ? { estado, interagindo }
      : undefined,
  );

  /* Os botões do widget de voz viram o mesmo comando do atalho e da bandeja. */
  ipcMain.on("vortexOverlayComando", (e, c: unknown) => {
    if (!doOverlay(e)) return;
    if (c !== "mutar" && c !== "ensurdecer" && c !== "desconectar") return;
    if (vivo(mainWindow)) mainWindow.webContents.send("vortexComandoDeVoz", c);
  });

  if (vivo(mainWindow)) {
    mainWindow.on("focus", reavaliar);
    mainWindow.on("blur", reavaliar);
    mainWindow.on("closed", () => {
      if (vivo(janela)) janela.destroy();
    });
  }
}
