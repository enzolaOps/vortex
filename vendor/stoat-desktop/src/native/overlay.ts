import {
  BrowserWindow,
  MessageChannelMain,
  type MessagePortMain,
  Notification,
  type Session,
  type WebContents,
  screen,
  session,
} from "electron";
import { join } from "node:path";

import { config } from "./config";
import {
  CANAL_DA_PORTA,
  type EstadoDoOverlay,
  type MensagemDoOverlay,
  type Papel,
  criarComutador,
} from "./portasDoOverlayModelo";
import { registrarJanelaDoOverlay } from "./registroDeIpc";
import {
  PARTICAO_DO_OVERLAY,
  protegerConteudoDoOverlay,
  protegerSessaoDoOverlay,
} from "./privilegioModelo";
import { lerTelaCheia } from "./telaCheia";
import { decidir, nomeParaMostrar, registrarAvisado } from "./telaCheiaModelo";
import { BUILD_URL, mainWindow } from "./window";

/**
 * O overlay do jogo: uma janela transparente por cima de tudo.
 *
 * ⚠ **Janela, e não injeção.** Discord desenha dentro do jogo injetando uma
 * DLL no processo dele; isso exige assinatura, é bloqueado por anti-cheat e
 * não é algo que um app Electron deva fazer. Uma janela transparente, sempre
 * no topo e que deixa o clique passar funciona em jogo em janela e em tela
 * cheia SEM BORDAS — o modo padrão da maioria dos jogos atuais. Em tela cheia
 * exclusiva o jogo toma a tela: a casca detecta (`telaCheia.ts`), esconde o
 * overlay e avisa uma vez por jogo.
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

let janela: BrowserWindow | undefined;
let estado: EstadoDoOverlay | undefined;
let interagindo = false;

/*
  O registro de IPC conhece esta janela pelo papel "overlay". Hoje nenhum canal
  aceita esse papel — o overlay fala só pela porta —, e é isso que torna
  qualquer `ipcRenderer.send` vindo dele uma recusa.
*/
registrarJanelaDoOverlay(() => janela);

function vivo(w: BrowserWindow | undefined): w is BrowserWindow {
  return w !== undefined && !w.isDestroyed();
}

function daOrigemDoApp(url: string): boolean {
  try {
    return new URL(url).origin === BUILD_URL.origin;
  } catch {
    return false;
  }
}

/* ------------------------------------------- o canal privado (portas) */

/** Ver `portasDoOverlayModelo.ts`. */
const portas = criarComutador({
  criarPar: () => new MessageChannelMain(),
  entregar: (papel, porta) => {
    const w = papel === "principal" ? mainWindow : janela;
    /* A porta só vai para a página do APP: uma janela que navegou para
       outro lugar não recebe canal nenhum. */
    if (!vivo(w) || !daOrigemDoApp(w.webContents.getURL())) return false;
    w.webContents.postMessage(CANAL_DA_PORTA, null, [porta as MessagePortMain]);
    return true;
  },
  daPrincipal: (m) => {
    if (m.tipo === "estado") publicarEstado(m.estado);
    else repassarMensagem(m.mensagem);
  },
  /* Os botões do widget de voz viram o mesmo comando do atalho e da bandeja. */
  doOverlay: (m) => {
    if (vivo(mainWindow)) mainWindow.webContents.send("vortexComandoDeVoz", m.comando);
  },
  /*
    ⚠ **O overlay recebe o retrato ao CONECTAR, e o preload o guarda.** Medido
    no Electron quando isto era IPC: empurrar no `did-finish-load` chegava
    antes de o React registrar o ouvinte, e o primeiro estado se perdia. A
    porta chega ao preload — que roda antes da página — e ele reentrega o
    último valor a cada ouvinte novo.
  */
  aoConectar: (papel) => {
    if (papel !== "overlay") return;
    if (estado) portas.enviarAoOverlay({ tipo: "estado", estado });
    portas.enviarAoOverlay({ tipo: "interacao", interagindo });
    portas.enviarAoOverlay({ tipo: "silencio", silenciadas });
  },
  /* A principal recarregou ou fechou: a chamada que ela publicou não existe
     mais, e o overlay não pode continuar mostrando-a. */
  aoDesconectar: (papel) => {
    if (papel !== "principal") return;
    estado = undefined;
    reavaliar();
  },
});

/**
 * Liga o ciclo de vida da porta a um `webContents`: porta nova a cada página
 * carregada, porta fechada quando a página sai, o renderer cai ou a janela
 * fecha.
 */
function vigiarPorta(papel: Papel, wc: WebContents): void {
  wc.on("did-finish-load", () => portas.conectar(papel));
  wc.on("did-start-navigation", (e) => {
    if (e.isMainFrame && !e.isSameDocument) portas.desconectar(papel);
  });
  wc.on("render-process-gone", () => portas.desconectar(papel));
  wc.once("destroyed", () => portas.desconectar(papel));
}

function publicarEstado(novo: EstadoDoOverlay): void {
  estado = novo;
  portas.enviarAoOverlay({ tipo: "estado", estado });
  reavaliar();
}

function repassarMensagem(m: MensagemDoOverlay): void {
  if (!vivo(janela) || !janela.isVisible() || silenciadas) return;
  portas.enviarAoOverlay({ tipo: "mensagem", mensagem: m });
}

let sessaoProtegida: Session | undefined;

/**
 * A sessão do overlay, protegida ANTES da primeira requisição — ver
 * `privilegioModelo.ts`. Uma só por execução: `fromPartition` devolve a mesma
 * sessão, e registrar os handlers de novo a cada janela seria trabalho à toa.
 */
function sessaoDoOverlay(): Session {
  if (!sessaoProtegida) {
    sessaoProtegida = session.fromPartition(PARTICAO_DO_OVERLAY);
    protegerSessaoDoOverlay(sessaoProtegida, () => BUILD_URL.origin);
  }
  return sessaoProtegida;
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
      /*
        ⚠ **Preload PRÓPRIO, e não o da janela principal.** O principal expõe
        fechar a janela, o hook global de teclado, o volume do sistema e as
        preferências; aqui só atravessam as pontes do overlay (estado,
        silêncio, comando), e elas falam por uma PORTA entregue pelo main
        (`portasDoOverlayModelo.ts`), não por canal de IPC. A ponte que não
        existe é a que não vaza.
      */
      preload: join(__dirname, "preloadDoOverlay.js"),
      /* Sessão própria, só em memória, sem rede além dos assets e sem
         permissão nenhuma — ver `privilegioModelo.ts`. */
      session: sessaoDoOverlay(),
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
  /* Depois do construtor: o `web-contents-created` de `main.ts` já pôs a
     regra da principal (abrir link no navegador), e esta a substitui. */
  protegerConteudoDoOverlay(w.webContents);
  vigiarPorta("overlay", w.webContents);
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

  /* A vigia de tela cheia só roda enquanto o overlay QUER aparecer. */
  vigiarTelaCheia(querer);

  if (!querer || telaCheiaExclusiva) {
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
  portas.enviarAoOverlay({ tipo: "interacao", interagindo: sim });
}

/** O atalho "Alternar overlay" — chamado pelo hook de teclado. */
export function alternarOverlay(): void {
  if (!vivo(janela) || !janela.isVisible()) return;
  definirInteracao(!interagindo);
}

/* ------------------------------------------------ silenciar mensagens */

/**
 * As mensagens por cima do jogo estão silenciadas?
 *
 * ⚠ **Na casca, e só na memória desta sessão.** Quem aperta o atalho está
 * dentro do jogo, com a janela principal sem foco — é o hook do main que o
 * ouve, como o de alternar. E é um gesto de momento ("agora não, estou numa
 * partida"): lembrar entre inícios faria alguém abrir o app amanhã sem
 * mensagens no overlay sem saber por quê.
 */
let silenciadas = false;

function publicarSilencio(): void {
  portas.enviarAoOverlay({ tipo: "silencio", silenciadas });
}

/** O atalho "Silenciar mensagens no overlay" — chamado pelo hook de teclado. */
export function alternarSilencioDoOverlay(): void {
  /* Sem overlay na tela o gesto não teria retorno visível nenhum, e a pessoa
     descobriria o silêncio só na próxima partida. */
  if (!vivo(janela) || !janela.isVisible()) return;
  silenciadas = !silenciadas;
  publicarSilencio();
}

/* ------------------------------------------- tela cheia exclusiva */

/** A cada quanto perguntar. Barato (quatro chamadas de sistema), e o jogo
    entra em tela cheia sem evento nenhum que o Electron veja. */
const VIGIA_MS = 3000;

let vigia: ReturnType<typeof setInterval> | undefined;
let telaCheiaExclusiva = false;

function vigiarTelaCheia(ligar: boolean): void {
  if (process.platform !== "win32") return;
  if (ligar && !vigia) {
    vigia = setInterval(() => void conferirTelaCheia(), VIGIA_MS);
    void conferirTelaCheia();
  } else if (!ligar && vigia) {
    clearInterval(vigia);
    vigia = undefined;
    telaCheiaExclusiva = false;
  }
}

async function conferirTelaCheia(): Promise<void> {
  const d = decidir(await lerTelaCheia(), config.jogosAvisadosDeTelaCheia);
  if (d.avisar) {
    config.jogosAvisadosDeTelaCheia = registrarAvisado(config.jogosAvisadosDeTelaCheia, d.avisar);
    avisarTelaCheia(d.avisar);
  }
  if (d.esconder === telaCheiaExclusiva) return;
  telaCheiaExclusiva = d.esconder;
  reavaliar();
}

/**
 * O aviso, UMA vez por jogo.
 *
 * ⚠ **Notificação do sistema, e não algo desenhado pelo overlay** — que é
 * justamente a janela que não aparece. O Windows segura notificações com um
 * jogo em tela cheia e as entrega na central de ações; o texto é escrito para
 * ser lido depois da partida.
 */
function avisarTelaCheia(chave: string): void {
  if (!Notification.isSupported()) return;
  new Notification({
    title: "O overlay não aparece neste jogo",
    body: `${nomeParaMostrar(chave)} está em tela cheia exclusiva, que desenha por cima de qualquer janela. Use "tela cheia sem bordas" nas opções de vídeo do jogo. Este aviso não se repete para ele.`,
    silent: true,
  }).show();
}

export function registrarOverlay(): void {
  /*
    Nenhum canal de IPC: a principal publica pela porta DELA, o overlay pede
    pela DELE, e o main valida e repassa — ver `portasDoOverlayModelo.ts`.
  */
  if (vivo(mainWindow)) vigiarPorta("principal", mainWindow.webContents);

  if (vivo(mainWindow)) {
    mainWindow.on("focus", reavaliar);
    mainWindow.on("blur", reavaliar);
    mainWindow.on("closed", () => {
      if (vivo(janela)) janela.destroy();
    });
  }
}
