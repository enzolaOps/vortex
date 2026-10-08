import { app, autoUpdater, BrowserWindow } from "electron";
import { criarAtualizacao, validarPedidoDeInstalacao } from "./atualizacaoModelo";
import { registrar, semArgumentos } from "./registroDeIpc";
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
 * ⚠ **A decisão mora em `atualizacaoModelo.ts`**, que é puro e testado; aqui
 * só se liga o `autoUpdater` a ela. A divisão existe porque o defeito que ela
 * conserta era de DECISÃO: a tela de bloqueio pedia instalação e o canal só
 * agia em `pronta`, então a atualização obrigatória nunca instalava.
 *
 * ⚠ **Os eventos vêm do `autoUpdater` do Electron, não da biblioteca.** O
 * `update-electron-app` é uma casca fina em cima dele: quem emite
 * `checking-for-update`, `update-available` e `update-downloaded` é o módulo
 * nativo. Assinar ali é assinar a fonte.
 *
 * ⚠ **Sem progresso intermediário.** O Squirrel.Windows não reporta bytes; o
 * modelo manda 0 enquanto baixa e 100 quando está pronta.
 */
export function registrarAtualizacaoNaPonte(): void {
  const disponivel = app.isPackaged && process.platform !== "linux";

  const ciclo = criarAtualizacao({
    disponivel,
    checar: () => void autoUpdater.checkForUpdates(),
    instalar: () => autoUpdater.quitAndInstall(),
    emitir: (atual) => {
      for (const j of BrowserWindow.getAllWindows()) {
        if (!j.isDestroyed()) j.webContents.send("vortexAtualizacao", atual);
      }
    },
  });

  registrar("vortexEstadoDaAtualizacao", {
    via: "invoke",
    quem: ["principal"],
    validar: semArgumentos,
    executar: () => ciclo.estado(),
  });

  /*
    ⚠ **Os três verbos existem mesmo sem atualizador de pé** — no Linux e em
    desenvolvimento o `autoUpdater` não tem feed. Verificar vira no-op e
    `em-dia` segue honesto; só o pedido OBRIGATÓRIO falha, porque ali "não há
    como atualizar" é exatamente o que a pessoa bloqueada precisa saber para
    baixar à mão.
  */
  registrar("vortexVerificarAtualizacao", {
    via: "invoke",
    quem: ["principal"],
    validar: semArgumentos,
    executar: () => ciclo.verificar(),
  });

  /*
    ⚠ **Argumento opcional e não verbo novo.** `{ obrigatoria: true }` vem da
    tela de bloqueio. Um verbo novo em `PonteDesktop` faria o cliente tratar
    toda casca anterior como ausente; um argumento a mais é ignorado pelo
    preload antigo, e o cliente cai no "baixar manualmente".
  */
  registrar("vortexInstalarEReiniciar", {
    via: "invoke",
    quem: ["principal"],
    validar: validarPedidoDeInstalacao,
    executar: (pedido) => ciclo.pedirInstalacao(pedido),
  });

  if (!disponivel) return;

  autoUpdater.on("checking-for-update", () => ciclo.aoEvento({ tipo: "verificando" }));
  autoUpdater.on("update-available", () => ciclo.aoEvento({ tipo: "disponivel" }));
  autoUpdater.on("update-not-available", () => ciclo.aoEvento({ tipo: "nada" }));
  autoUpdater.on("error", () => ciclo.aoEvento({ tipo: "erro" }));
  autoUpdater.on("update-downloaded", (_e, _notas, nome) =>
    ciclo.aoEvento({
      tipo: "baixada",
      versao: typeof nome === "string" ? nome : undefined,
    }),
  );
}
