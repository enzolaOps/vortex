import { join } from "node:path";

import {
  BrowserWindow,
  Menu,
  MenuItem,
  app,
  dialog,
  nativeImage,
  screen,
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

  // configure spellchecker context menu
  mainWindow.webContents.on("context-menu", (_, params) => {
    const menu = new Menu();

    // add all suggestions
    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        }),
      );
    }

    // allow users to add the misspelled word to the dictionary
    if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: "Add to dictionary",
          click: () =>
            mainWindow.webContents.session.addWordToSpellCheckerDictionary(
              params.misspelledWord,
            ),
        }),
      );
    }

    // add an option to toggle spellchecker
    menu.append(
      new MenuItem({
        label: "Toggle spellcheck",
        click() {
          config.spellchecker = !config.spellchecker;
        },
      }),
    );

    // show menu if we've generated enough entries
    if (menu.items.length > 0) {
      menu.popup();
    }
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
