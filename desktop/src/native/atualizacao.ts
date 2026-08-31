import { app } from "electron";
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
