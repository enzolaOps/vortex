import { app, autoUpdater, BrowserWindow, ipcMain } from "electron";
import { updateElectronApp } from "update-electron-app";

/**
 * Atualização automática da casca.
 *
 * ⚠ **A casca precisa se atualizar por uma razão que a URL remota NÃO
 * resolve.** Ela carrega o cliente pela rede, então o app web muda no deploy
 * sem tocar aqui — mas quem EXECUTA conteúdo escrito por qualquer pessoa é o
 * Chromium embutido nesta casca. Chromium parado é navegador desatualizado
 * rodando conteúdo de terceiro, que é a única coisa que o `CLAUDE.md` chama de
 * inegociável. O Electron publica major nova a cada ~8 semanas e dá suporte de
 * segurança às três mais recentes.
 *
 * A segunda razão é o contrato: o `PonteDeTela` do cliente é validado em
 * runtime justamente porque "casca velha + cliente novo" é o estado normal
 * depois de toda subida. Sem atualizador, esse estado é PERMANENTE para quem
 * não reinstalar à mão.
 *
 * ⚠ **`update.electronjs.org` não atende Linux, e isso não é lacuna nossa.**
 * O serviço cobre Windows e macOS; no Linux quem atualiza é o gestor de
 * pacotes — `flatpak update` para o Flatpak que o CI publica. Sair cedo aqui é
 * dizer isso em código, em vez de deixar a biblioteca falhar em silêncio.
 *
 * ⚠ **macOS não é construído**, então nem chega aqui: atualização automática no
 * macOS exige assinatura com conta de desenvolvedor da Apple, e sem ela o
 * pacote é recusado pelo próprio mecanismo. Está escrito para quando houver.
 */
export function ligarAtualizacaoAutomatica(): void {
  /*
    Em desenvolvimento não há o que atualizar, e tentar seria pior que não
    fazer nada: `update-electron-app` reclama em cima de um app que roda do
    código-fonte, e o aviso não descreve defeito nenhum.
  */
  if (!app.isPackaged) return;

  if (process.platform === "linux") return;

  /*
    O feed sai de `repository` no `package.json` — `enzolaOps/vortex`, que é
    PÚBLICO, o que é requisito do serviço. Uma hora entre checagens: a casca
    fica aberta o dia inteiro, e dez minutos (o padrão) seria pedir a mesma
    resposta 48 vezes por jornada para uma versão que sai a cada semanas.
  */
  updateElectronApp({
    updateInterval: "1 hour",
    /*
      ⚠ **Sem diálogo automático, e é decisão.** O padrão da biblioteca abre um
      modal "reiniciar agora?" no instante em que o download termina — e este
      app fica aberto durante CHAMADA DE VOZ. Um modal de sistema sobre alguém
      apresentando a tela é o pior momento possível. `notifyUser: false` faz a
      atualização ficar pronta e ser aplicada no próximo encerramento, que é o
      que já acontece com o navegador de todo mundo.
    */
    notifyUser: false,
  });
}

/**
 * O ciclo de vida da atualização, no vocabulário do cliente.
 *
 * ⚠ **A tela de atualização do cliente existe desde antes desta casca** —
 * `desktop/Atualizacao.tsx`, com os seis estados que o design desenha — e
 * nunca recebeu um evento, porque `window.vortex` não existia. Construída e
 * inalcançável, como o painel de fixadas.
 *
 * ⚠ **Os eventos vêm do `autoUpdater` do Electron, não da biblioteca.** O
 * `update-electron-app` é uma casca fina em cima dele: quem emite
 * `checking-for-update`, `update-available` e `update-downloaded` é o módulo
 * nativo. Assinar ali é assinar a fonte.
 *
 * ⚠ **`baixando` com progresso é o estado que NÃO temos.** O `autoUpdater` do
 * Squirrel.Windows não reporta bytes — ele avisa que começou e que terminou. O
 * cliente tem `progresso`, e mandar um número inventado seria a mesma mentira
 * do "Conectado · 42 ms" que a faixa de voz recusou. Vai `0`, e a tela mostra
 * "baixando" sem barra.
 */
type EstadoDeAtualizacao =
  | "em-dia"
  | "verificando"
  | "baixando"
  | "pronta"
  | "obrigatoria"
  | "falhou";

let atual: { estado: EstadoDeAtualizacao; versao: string | undefined; progresso: number } = {
  estado: "em-dia",
  versao: undefined,
  progresso: 0,
};

export function registrarAtualizacaoNaPonte(): void {
  const emitir = (
    estado: EstadoDeAtualizacao,
    versao?: string,
  ) => {
    atual = { estado, versao: versao ?? atual.versao, progresso: 0 };
    for (const j of BrowserWindow.getAllWindows()) {
      if (!j.isDestroyed()) j.webContents.send("vortexAtualizacao", atual);
    }
  };

  ipcMain.handle("vortexEstadoDaAtualizacao", () => atual);

  /*
    ⚠ **Os três verbos existem mesmo sem atualizador de pé** — no Linux e em
    desenvolvimento o `autoUpdater` não tem feed. Devolver `em-dia` é honesto:
    não há atualização esperando. Lançar faria a tela do cliente quebrar num
    lugar onde não há defeito nenhum.
  */
  ipcMain.handle("vortexVerificarAtualizacao", () => {
    if (!app.isPackaged || process.platform === "linux") return;
    try {
      autoUpdater.checkForUpdates();
    } catch {
      emitir("falhou");
    }
  });

  ipcMain.handle("vortexInstalarEReiniciar", () => {
    if (atual.estado !== "pronta") return;
    autoUpdater.quitAndInstall();
  });

  if (!app.isPackaged || process.platform === "linux") return;

  autoUpdater.on("checking-for-update", () => emitir("verificando"));
  autoUpdater.on("update-available", () => emitir("baixando"));
  autoUpdater.on("update-not-available", () => emitir("em-dia"));
  autoUpdater.on("error", () => emitir("falhou"));
  autoUpdater.on("update-downloaded", (_e, _notas, nome) =>
    emitir("pronta", typeof nome === "string" ? nome : undefined),
  );
}
