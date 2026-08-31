import { desktopCapturer, ipcMain, session } from "electron";

/**
 * O seletor de tela do Vortex, no processo main.
 *
 * ⚠ **A escolha acontece ANTES do `getDisplayMedia`, e essa inversão é o
 * ponto.** O arranjo do upstream responde a uma requisição JÁ EM VOO: o
 * renderer pede a captura, o handler intercepta, manda as fontes para a tela
 * escolher e devolve a escolhida. Funciona para escolher a FONTE — e torna
 * resolução e taxa de quadros impossíveis, porque as constraints de
 * `getDisplayMedia` são fixadas no momento da chamada, antes de qualquer
 * seletor aparecer.
 *
 * O design põe as três decisões no mesmo painel. Para cumprir isso, o cliente
 * pergunta primeiro (`telaFontes`), ARMA a escolha (`telaEscolher`) e só então
 * pede a captura já com as constraints certas. O handler abaixo consome a
 * escolha armada em vez de perguntar.
 *
 * ⚠ **A escolha é de USO ÚNICO.** Ela é consumida pelo primeiro pedido que
 * chegar e some. Sem isso, um pedido posterior — outra aba, outra chamada —
 * herdaria em silêncio a fonte escolhida numa transmissão anterior, que é a
 * pior falha possível aqui: compartilhar a tela errada sem ninguém escolher.
 *
 * ⚠ **`useSystemPicker: false`.** Com ele ligado, o sistema desenha o próprio
 * seletor e o handler nunca roda — que é exatamente o que este arquivo existe
 * para substituir. Ele fica ligado só onde não há alternativa (ver `SO_SISTEMA`).
 */

/** Miniatura em 320×180: 16:9, e é o tamanho do cartão do design. */
const MINIATURA = { width: 320, height: 180 };

/** Ícone do app, quando a fonte é uma janela. */
const ICONE = 64;

export type FonteDeTela = {
  readonly id: string;
  readonly nome: string;
  /** `tela` para monitor inteiro, `janela` para uma janela de aplicativo. */
  readonly tipo: "tela" | "janela";
  /** Miniatura ao vivo, em data URL. */
  readonly miniatura: string;
  /** Ícone do aplicativo, só nas janelas. */
  readonly icone: string | undefined;
};

/**
 * A escolha armada, esperando o próximo pedido de captura.
 *
 * `undefined` = ninguém escolheu, e o pedido deve ser RECUSADO. Recusar é o
 * certo: um pedido de captura que não passou pelo seletor não veio de um
 * clique em "compartilhar tela" desta interface.
 */
let armada: { id: string; audio: boolean } | undefined;

/**
 * Plataformas onde o seletor do sistema é obrigatório.
 *
 * ⚠ **Wayland não deixa o aplicativo enumerar telas.** O portal do
 * `xdg-desktop-portal` é quem mostra a lista e devolve UMA fonte já escolhida
 * pela pessoa — por isso `getSources` costuma voltar com um item só ali. Nesse
 * caso o seletor próprio não teria o que oferecer, e insistir nele daria um
 * painel com um cartão. O sistema desenha, e o cliente não abre o dele.
 *
 * macOS tem seletor próprio do sistema a partir do Sequoia, e o Electron o usa
 * quando `useSystemPicker` está ligado. Fica igual: o sistema manda.
 */
function soSistema(): boolean {
  return (
    process.platform === "darwin" ||
    process.env.XDG_SESSION_TYPE === "wayland" ||
    Boolean(process.env.WAYLAND_DISPLAY)
  );
}

export function registrarSeletorDeTela(): void {
  const sistema = soSistema();

  /** O cliente pergunta se deve abrir o seletor próprio. */
  ipcMain.handle("telaSeletorProprio", () => !sistema);

  ipcMain.handle("telaFontes", async (): Promise<FonteDeTela[]> => {
    const fontes = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: MINIATURA,
      fetchWindowIcons: true,
    });

    return fontes.map((f) => ({
      id: f.id,
      nome: f.name,
      /*
        O prefixo do ID é o que o Electron garante — `screen:…` e `window:…`.
        `f.display_id` só existe em tela e nem sempre, então testá-lo daria
        janela classificada como tela em algumas plataformas.
      */
      tipo: f.id.startsWith("screen") ? "tela" : "janela",
      miniatura: f.thumbnail.toDataURL(),
      icone: f.appIcon?.resize({ width: ICONE, height: ICONE }).toDataURL(),
    }));
  });

  ipcMain.handle("telaEscolher", (_e, id: unknown, audio: unknown) => {
    /*
      ⚠ Validado AQUI e não só no cliente. O preload é uma superfície que
      conteúdo de terceiro alcança se houver XSS, e o briefing manda o main
      revalidar tudo. `id` que não seja string de fonte é descartado.
    */
    if (typeof id !== "string" || !/^(screen|window):/.test(id)) return false;
    armada = { id, audio: audio === true };
    return true;
  });

  ipcMain.handle("telaCancelar", () => {
    armada = undefined;
  });

  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      /*
        Sem escolha armada o pedido é recusado — exceto onde o sistema manda,
        e ali o Electron nem chega a chamar este handler.

        `callback({})` é como o Electron diz "negado"; o `getDisplayMedia` do
        renderer rejeita, e o cliente trata rejeição como cancelamento.
      */
      const escolha = armada;
      armada = undefined;
      if (!escolha) {
        callback({});
        return;
      }

      void desktopCapturer
        .getSources({ types: ["screen", "window"] })
        .then((fontes) => {
          const fonte = fontes.find((f) => f.id === escolha.id);
          if (!fonte) {
            // A janela pode ter fechado entre escolher e pedir.
            callback({});
            return;
          }
          callback(
            escolha.audio && request.audioRequested
              ? { video: fonte, audio: "loopback" }
              : { video: fonte },
          );
        });
    },
    { useSystemPicker: sistema },
  );
}
