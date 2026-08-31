import { app, BrowserWindow, ipcMain, session, shell } from "electron";

import { version } from "../../package.json";
import { config } from "./config";
import { mainWindow } from "./window";

/**
 * A ponte que o cliente React declara e a casca nunca implementou.
 *
 * ⚠ **Este arquivo nasce de um defeito que quem usa relatou como "não aparecem
 * os botões de minimizar, maximizar e fechar".** A causa: `customFrame: true`
 * é o padrão, então o Electron não desenha moldura; a barra custom é do
 * CLIENTE, e ela só se desenha quando `window.vortex` existe. A casca expunha
 * `native`, `desktopConfig` e `vortexTela` — nunca `vortex`. Resultado: janela
 * sem moldura do sistema E sem barra nossa. Uma janela que não pode ser
 * fechada.
 *
 * ⚠ **E ninguém percebeu porque o ARNÊS dubla a ponte** (`dev/cascaFalsa.ts`).
 * Em `/dev` a barra sempre apareceu. É a mesma família do "arnês mais rico que
 * o produto" que este projeto já registrou uma dúzia de vezes — aqui na versão
 * mais cara, porque o que ele escondia era a casca inteira.
 *
 * O contrato vive no cliente (`web-react/…/sdk/desktop.ts`, tipo
 * `PonteDesktop`), e é ele que manda: *"é o cliente que sabe o que precisa; a
 * casca implementa. Invertido, a casca ditaria a forma das telas."*
 */

/** O que a janela pode fazer consigo mesma — espelha `ControleDeJanela`. */
type ControleDeJanela = "minimizar" | "maximizar" | "restaurar" | "fechar";

const CONTROLES: Record<ControleDeJanela, (j: BrowserWindow) => void> = {
  minimizar: (j) => j.minimize(),
  maximizar: (j) => j.maximize(),
  restaurar: (j) => j.unmaximize(),
  fechar: (j) => j.close(),
};

export function registrarPonteDoVortex(): void {
  /*
    ⚠ **Valida o verbo contra um mapa fechado em vez de chamar o que vier.** O
    renderer executa conteúdo escrito por qualquer pessoa; um `j[acao]()`
    dinâmico daria a esse conteúdo qualquer método de `BrowserWindow` — de
    `setAlwaysOnTop` a `destroy`. É a mesma revalidação que o seletor de tela
    faz no `id` da fonte, e o briefing pede por nome: "IPC validado no main".
  */
  ipcMain.handle("vortexJanela", (_e, acao: unknown) => {
    const j = janela();
    if (!j) return;
    const fn = CONTROLES[acao as ControleDeJanela] as
      | ((j: BrowserWindow) => void)
      | undefined;
    if (fn) fn(j);
  });

  ipcMain.handle("vortexEstadoDaJanela", () => estado());

  ipcMain.handle("vortexLerPreferencias", () => ({
    customFrame: config.customFrame,
    minimiseToTray: config.minimiseToTray,
    startMinimisedToTray: config.startMinimisedToTray,
    spellchecker: config.spellchecker,
    hardwareAcceleration: config.hardwareAcceleration,
  }));

  /*
    ⚠ **Chave conferida contra a lista, e não repassada.** `config` é um store
    em disco: aceitar chave arbitrária do renderer deixaria conteúdo de
    terceiro escrever qualquer coisa nele, inclusive campos que o main lê para
    decidir comportamento de segurança.
  */
  ipcMain.handle("vortexGravarPreferencia", (_e, chave: unknown, valor: unknown) => {
    const permitidas = [
      "customFrame",
      "minimiseToTray",
      "startMinimisedToTray",
      "spellchecker",
      "hardwareAcceleration",
    ];
    if (typeof chave !== "string" || !permitidas.includes(chave)) return;
    (config as unknown as Record<string, unknown>)[chave] = valor;
  });

  ipcMain.handle("vortexTamanhoDoCache", () =>
    session.defaultSession.getCacheSize(),
  );

  ipcMain.handle("vortexLimparCache", () =>
    session.defaultSession.clearCache(),
  );

  ipcMain.handle("vortexAbrirPastaDeLogs", () =>
    shell.openPath(app.getPath("logs")),
  );

  /*
    O estado da janela é EMPURRADO, e não perguntado em laço.

    O cliente assina uma vez e recebe a cada mudança — maximizar, restaurar,
    ganhar e perder foco. A alternativa (o renderer perguntando de tempos em
    tempos) daria uma barra de título que demora a reagir ou um `setInterval`
    permanente num app de jornada de oito horas.

    ⚠ **`comFoco` vem daqui e não de `document.hasFocus()`**, e o comentário do
    cliente já dizia por quê: aquele é do DOCUMENTO, e uma janela sem foco com
    o DevTools por cima ainda responde `true`. Quem sabe é o main.
  */
  const j = janela();
  if (!j) return;

  const empurrar = () => {
    if (!j.isDestroyed()) j.webContents.send("vortexJanelaMudou", estado());
  };
  for (const evento of ["maximize", "unmaximize", "focus", "blur", "restore"] as const) {
    j.on(evento, empurrar);
  }
}

/**
 * A versão e a plataforma, para o preload embutir sem IPC.
 *
 * ⚠ Elas não mudam durante a execução, então pedi-las por IPC seria uma
 * promessa por leitura para um valor constante — e o cliente as usa em
 * `versaoInstalada()`, que é chamada em render.
 */
export const identidade = {
  versao: version,
  plataforma: process.platform,
  electron: process.versions.electron,
};

function janela(): BrowserWindow | undefined {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  return BrowserWindow.getAllWindows()[0];
}

function estado(): { maximizada: boolean; comFoco: boolean } {
  const j = janela();
  return {
    maximizada: j?.isMaximized() ?? false,
    comFoco: j?.isFocused() ?? false,
  };
}
