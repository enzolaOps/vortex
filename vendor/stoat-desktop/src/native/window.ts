import { join } from "node:path";

import {
  BrowserWindow,
  Menu,
  MenuItem,
  app,
  clipboard,
  dialog,
  nativeImage,
  screen,
  shell,
} from "electron";

import windowIconAsset from "../../assets/icon.png?asset";

import { config } from "./config";
import { aplicarPreferenciasNaJanela, capturarEmUso } from "./preferencias";
import {
  assinaturaDasTelas,
  cabeNasTelas,
  estadoParaRestaurar,
  guardarEstado,
} from "./preferenciasDoCliente";
import { registrarAtenuacao } from "./atenuacao";
import { registrarAudioDaJanela } from "./audioDaJanela";
import { registrarControles } from "./controles";
import { registrarNotificacoes } from "./notificacoes";
import { registrarOverlay } from "./overlay";
import { BUILD_URL } from "./enderecoDoApp";
import { registrar, registrarJanelaPrincipal, semArgumentos } from "./registroDeIpc";
import {
  idiomasDoCorretor,
  menuNativo,
  type AcaoDoMenu,
} from "./menuNativoModelo";
import { abrirNoNavegadorDoSistema } from "./privilegioModelo";
import { registrarSeletorDeTela } from "./telaCompartilhada";
import { updateTrayMenu } from "./tray";

// global reference to main window
export let mainWindow: BrowserWindow;

/* O registro de IPC confere o remetente contra ESTA janela — ver `registroDeIpc.ts`. */
registrarJanelaPrincipal(() => mainWindow);

// currently in-use build (mora em `enderecoDoApp.ts`)
export { BUILD_URL };

// internal window state
let shouldQuit = false;

// load the window icon
const windowIcon = nativeImage.createFromDataURL(windowIconAsset);

// windowIcon.setTemplateImage(true);

/**
 * Create the main application window
 */
export function createMainWindow() {
  // (CLI arg --hidden or config)
  const startHidden =
    app.commandLine.hasSwitch("hidden") || config.startMinimisedToTray;
  const isMacOS = process.platform === "darwin";

  /*
    ⚠ **O estado é do ARRANJO de monitores**, e vem antes de criar a janela
    — a posição entra no construtor em vez de um `setPosition` depois, que
    fazia a janela nascer num lugar e pular para outro. Com "Lembrar tamanho e
    posição" desligado, ou arranjo nunca visto, ela nasce no padrão centrado.
  */
  /* Antes de ler `customFrame` para a moldura: o que a janela usa é o "em uso". */
  capturarEmUso();
  const telas = screen.getAllDisplays();
  const salvo = config.lembrarJanela
    ? (estadoParaRestaurar(config.janelasPorArranjo, telas) ??
      /* A casca anterior guardava um estado só; ele ainda vale se couber. */
      (cabeNasTelas(config.windowState, telas) ? config.windowState : undefined))
    : undefined;

  // create the window
  mainWindow = new BrowserWindow({
    minWidth: 300,
    minHeight: 300,
    width: salvo?.width ?? 1280,
    height: salvo?.height ?? 720,
    ...(salvo ? { x: salvo.x, y: salvo.y } : {}),
    backgroundColor: "#191919",
    frame: isMacOS ? true : !config.customFrame,
    titleBarStyle: isMacOS ? "hidden" : "default",
    trafficLightPosition: isMacOS ? { x: 8, y: 8 } : undefined,
    icon: windowIcon,
    show: !startHidden,
    webPreferences: {
      // relative to `.vite/build`
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // hide the options
  mainWindow.setMenu(null);

  // maximise the window if it was maximised before
  if (salvo?.isMaximised && !startHidden) {
    mainWindow.maximize();
  }

  aplicarPreferenciasNaJanela();
  /* O corretor é reaplicado na PARTIDA: `webPreferences.spellcheck` liga o
     motor, mas quem escolheu desligá-lo — e em que idioma — está no store. */
  aplicarCorretor();

  // load the entrypoint
  mainWindow
    .loadURL(BUILD_URL.toString())
    .then(() => mainWindow.webContents.reload());

  /*
    "Ao fechar a janela" — bandeja, encerrar ou perguntar.

    ⚠ **`encerrar` não chama `app.quit()`: deixa o `close` seguir.** A janela
    fecha, `window-all-closed` encerra (fora do macOS, onde o app fica no dock
    como o sistema espera). E `shouldQuit` ganha de tudo: "Sair do Vortex" na
    bandeja e reiniciar não podem cair na pergunta.
  */
  mainWindow.on("close", (event) => {
    if (shouldQuit) return;
    const acao = config.aoFechar;
    if (acao === "encerrar") return;
    event.preventDefault();
    if (acao === "bandeja") {
      mainWindow.hide();
      return;
    }
    void perguntarAoFechar();
  });

  // update tray menu when window is shown/hidden
  mainWindow.on("show", updateTrayMenu);
  mainWindow.on("hide", updateTrayMenu);

  // keep track of window state
  function generateState() {
    /* Maximizada, guarda o tamanho NORMAL: restaurar de um maximizado para o
       tamanho da tela inteira deixaria "desmaximizar" sem efeito. */
    const b = mainWindow.getNormalBounds();
    const estado = {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      isMaximised: mainWindow.isMaximized(),
    };
    config.windowState = estado;
    if (config.lembrarJanela) {
      config.janelasPorArranjo = guardarEstado(
        config.janelasPorArranjo,
        assinaturaDasTelas(screen.getAllDisplays()),
        estado,
      );
    }
  }

  mainWindow.on("maximize", generateState);
  mainWindow.on("unmaximize", generateState);
  mainWindow.on("moved", generateState);
  mainWindow.on("resized", generateState);

  // rebind zoom controls to be more sensible
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && (input.key === "=" || input.key === "+")) {
      // zoom in (+)
      event.preventDefault();
      mainWindow.webContents.setZoomLevel(
        mainWindow.webContents.getZoomLevel() + 1,
      );
    } else if (input.control && input.key === "-") {
      // zoom out (-)
      event.preventDefault();
      mainWindow.webContents.setZoomLevel(
        mainWindow.webContents.getZoomLevel() - 1,
      );
    } else if (input.control && input.key === "0") {
      // reset zoom to default.
      event.preventDefault();
      mainWindow.webContents.setZoomLevel(0);
    } else if (
      input.key === "F5" ||
      ((input.control || input.meta) && input.key.toLowerCase() === "r")
    ) {
      event.preventDefault();
      mainWindow.webContents.reload();
    }
  });

  // send the config
  mainWindow.webContents.on("did-finish-load", () => config.sync());

  /*
    O menu NATIVO — e ele agora é um menu de verdade.

    ⚠ **O que havia era um menu de corretor com um botão solto**: sugestões,
    "Add to dictionary" e — sempre, em qualquer lugar, em inglês — "Toggle
    spellcheck". Como o último entrava incondicionalmente, a guarda
    `items.length > 0` era sempre verdadeira e a caixa abria em cima de
    qualquer coisa. E campo de texto não tinha recortar, copiar nem colar pelo
    ponteiro: num Electron, onde o menu do navegador não existe, isso quer
    dizer que NÃO HAVIA como colar com o mouse.

    ⚠ **Este evento só chega onde o app não abriu o próprio menu.** Quando a
    página chama `preventDefault` no `contextmenu` — o que o gatilho do Radix
    faz —, o Chromium não manda o pedido e o evento não dispara. O que sobra é
    o `textarea` do composer, os campos de login e o vão da janela.

    A DECISÃO mora em `menuNativoModelo.ts`, pura e testada; aqui ficam só os
    efeitos, que não têm o que testar sem Electron.
  */
  mainWindow.webContents.on("context-menu", (_, params) => {
    const alvo = mainWindow?.webContents;
    if (!alvo) return;

    const itens = menuNativo(
      {
        isEditable: params.isEditable,
        editFlags: {
          canCut: params.editFlags.canCut,
          canCopy: params.editFlags.canCopy,
          canPaste: params.editFlags.canPaste,
          canSelectAll: params.editFlags.canSelectAll,
        },
        selectionText: params.selectionText,
        linkURL: params.linkURL,
        mediaType: params.mediaType,
        srcURL: params.srcURL,
        misspelledWord: params.misspelledWord,
        dictionarySuggestions: params.dictionarySuggestions,
      },
      {
        corretorLigado: config.spellchecker,
        /* A MESMA função que o `setWindowOpenHandler` consulta — ver
           `privilegioModelo.ts`. Duas listas de esquema permitido divergiriam,
           e a que divergisse seria a que ninguém abriu naquela semana. */
        abrirLinkPermitido: abrirNoNavegadorDoSistema(params.linkURL),
      },
    );

    /* Lista vazia é "não abra nada", e é metade do conserto. */
    if (itens.length === 0) return;

    const menu = new Menu();
    for (const item of itens) {
      if (item.tipo === "separador") {
        menu.append(new MenuItem({ type: "separator" }));
        continue;
      }
      if (item.tipo === "sugestao") {
        menu.append(
          new MenuItem({
            label: item.palavra,
            click: () => alvo.replaceMisspelling(item.palavra),
          }),
        );
        continue;
      }
      menu.append(new MenuItem(efeitoDoItem(item.acao, item.rotulo, alvo, params)));
    }

    menu.popup();
  });

  /*
    O seletor de tela mora em `telaCompartilhada.ts`.

    ⚠ **O handler que estava aqui respondia a um pedido JÁ EM VOO** — mandava
    as fontes para a tela escolher enquanto o `getDisplayMedia` esperava. Isso
    escolhe a FONTE e nada mais: resolução e taxa de quadros são constraints
    fixadas antes do seletor existir, e o design põe as três no mesmo painel.
    Agora o cliente escolhe primeiro e pede depois.
  */
  registrarSeletorDeTela();
  registrarAudioDaJanela();
  registrarControles();
  registrarNotificacoes();
  registrarOverlay();
  registrarAtenuacao();

  // push world events to the window
  registrar("minimise", {
    via: "send",
    quem: ["principal"],
    validar: semArgumentos,
    executar: () => mainWindow.minimize(),
  });
  registrar("maximise", {
    via: "send",
    quem: ["principal"],
    validar: semArgumentos,
    executar: () =>
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(),
  });
  registrar("close", {
    via: "send",
    quem: ["principal"],
    validar: semArgumentos,
    executar: () => mainWindow.close(),
  });

  // mainWindow.webContents.openDevTools();

}

let perguntando = false;

/**
 * "Perguntar sempre": o que fazer com ESTE fechamento, e opcionalmente com os
 * próximos. Uma pergunta por vez — dois cliques no X não empilham diálogos.
 */
async function perguntarAoFechar(): Promise<void> {
  if (perguntando || !mainWindow || mainWindow.isDestroyed()) return;
  perguntando = true;
  try {
    const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
      type: "question",
      title: "Fechar o Vortex",
      message: "O que fazer ao fechar a janela?",
      detail: "Na bandeja, o Vortex continua recebendo mensagens e chamadas.",
      buttons: ["Minimizar para a bandeja", "Encerrar o app", "Cancelar"],
      defaultId: 0,
      cancelId: 2,
      checkboxLabel: "Lembrar a escolha",
      noLink: true,
    });
    if (response === 2) return;
    const acao = response === 0 ? "bandeja" : "encerrar";
    if (checkboxChecked) {
      config.aoFechar = acao;
      config.minimiseToTray = acao === "bandeja";
    }
    if (acao === "bandeja") mainWindow.hide();
    else quitApp();
  } finally {
    perguntando = false;
  }
}

/**
 * Quit the entire app
 */
export function quitApp() {
  shouldQuit = true;
  mainWindow.close();
}

// Ensure global app quit works properly
app.on("before-quit", () => {
  shouldQuit = true;
});

/**
 * O EFEITO de cada item — a metade que precisa do Electron.
 *
 * ⚠ **`checked` no item do corretor e não rótulo que alterna.** "Ligar
 * corretor"/"Desligar corretor" no mesmo lugar faz quem lê depressa clicar no
 * oposto do que quer, e é a mesma regra que o lint do cliente guarda para
 * `aria-pressed`. O menu nativo tem `type: "checkbox"`; usá-lo é de graça.
 *
 * ⚠ **`downloadURL` e não `<a download>`**: o `autumn` é de outra origem, e
 * este é o caminho de download do Electron — o mesmo que o `will-download` da
 * sessão já intercepta.
 */
function efeitoDoItem(
  acao: AcaoDoMenu,
  rotulo: string,
  alvo: Electron.WebContents,
  params: Electron.ContextMenuParams,
): Electron.MenuItemConstructorOptions {
  switch (acao) {
    case "aprenderPalavra":
      return {
        label: rotulo,
        click: () =>
          alvo.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      };
    case "alternarCorretor":
      return {
        label: rotulo,
        type: "checkbox",
        checked: config.spellchecker,
        click: () => {
          config.spellchecker = !config.spellchecker;
          aplicarCorretor();
        },
      };
    case "recortar":
      return { label: rotulo, click: () => alvo.cut() };
    case "copiar":
      return { label: rotulo, click: () => alvo.copy() };
    case "colar":
      return { label: rotulo, click: () => alvo.paste() };
    case "colarSemFormato":
      return { label: rotulo, click: () => alvo.pasteAndMatchStyle() };
    case "selecionarTudo":
      return { label: rotulo, click: () => alvo.selectAll() };
    case "abrirLink":
      return {
        label: rotulo,
        /* `shell.openExternal` entrega ao sistema uma URL escrita por outra
           pessoa — o modelo já filtrou o esquema por `abrirNoNavegadorDoSistema`,
           que é a mesma guarda do `setWindowOpenHandler`. */
        click: () => void shell.openExternal(params.linkURL),
      };
    case "copiarLink":
      return { label: rotulo, click: () => clipboard.writeText(params.linkURL) };
    case "copiarImagem":
      return { label: rotulo, click: () => alvo.copyImageAt(params.x, params.y) };
    case "salvarImagem":
      return { label: rotulo, click: () => alvo.downloadURL(params.srcURL) };
    case "copiarEnderecoDaImagem":
      return { label: rotulo, click: () => clipboard.writeText(params.srcURL) };
  }
}

/**
 * Aplica o corretor à sessão: ligado/desligado e o IDIOMA.
 *
 * ⚠ **As duas coisas nunca eram aplicadas.** `config.spellchecker` era
 * gravado pelo menu e lido por ninguém — o `webPreferences` da janela decide
 * na criação, então alternar só valia no próximo início, sem nada dizer isso.
 * E `setSpellCheckerLanguages` jamais foi chamado, então o corretor ficava em
 * inglês num app em português: toda palavra sublinhada, que é o mesmo que não
 * ter corretor com o custo de riscar a tela.
 *
 * ⚠ **A lista disponível é consultada e o pedido FILTRADO por ela** — o método
 * lança com um código que a sessão não conhece, e uma exceção no caminho de
 * partida derrubaria a janela por causa de um corretor. No macOS a lista é
 * ignorada (o corretor é o do sistema) e a chamada é no-op.
 */
export function aplicarCorretor(): void {
  const sessao = mainWindow?.webContents.session;
  if (!sessao) return;

  sessao.setSpellCheckerEnabled(config.spellchecker);
  if (!config.spellchecker) return;

  try {
    const idiomas = idiomasDoCorretor(
      app.getLocale(),
      sessao.availableSpellCheckerLanguages,
    );
    if (idiomas.length > 0) sessao.setSpellCheckerLanguages(idiomas);
  } catch {
    /* Sessão sem suporte a lista (macOS) ou código recusado: o corretor
       continua no padrão dela, que é melhor que a janela não abrir. */
  }
}
