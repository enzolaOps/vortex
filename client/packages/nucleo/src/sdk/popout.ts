/**
 * A janela destacada da chamada: onde ela pode existir e o que a casca faz por
 * ela. Camada anticorrupção, como `desktop.ts`.
 *
 * ⚠ **Duas portas para a mesma janela, e a pessoa não escolhe.**
 *
 * - `casca`: no Electron, `window.open("", NOME_DA_JANELA)`. A casca libera
 *   esse pedido só para esse nome e só da janela principal
 *   (`setWindowOpenHandler`, em `popoutDeVozModelo.ts`), e a janela nasce
 *   sempre no topo e sem moldura.
 * - `documento`: no navegador, o Document Picture-in-Picture. Sem ele (Firefox,
 *   Safari) NÃO existe janela destacada e o botão não aparece: um botão que
 *   abriria uma aba comum não é "destacar", é perder a chamada de vista.
 *
 * ⚠ **A janela é SUPERFÍCIE, não segunda sessão.** Ela é aberta na mesma
 * origem e no mesmo processo, e o React desenha nela por portal: uma árvore,
 * um conjunto de stores, uma conexão de voz. É o que mantém o vídeo (a
 * `MediaStreamTrack` já está neste renderer) e o que impede um segundo socket.
 *
 * ⚠ **A ponte da casca é SEPARADA de `window.vortex`, pela razão de versão de
 * sempre:** o cliente atualiza antes da casca, e um verbo novo em
 * `PonteDesktop` faria `verbosFaltandoNaPonte` tratar toda casca anterior como
 * ausente. Ausente aqui só quer dizer "sem topo nem proteção controláveis".
 */

/** O MESMO texto de `NOME_DO_POPOUT` na casca. */
export const NOME_DA_JANELA = "vortex-popout-de-voz";

/** Os dois únicos verbos que atravessam. O main valida remetente e tipo de novo. */
export type PontePopout = {
  /** Sempre no topo. A janela já nasce assim; o verbo é para quem quiser soltá-la. */
  readonly definirTopo: (sim: boolean) => Promise<void>;
  /** `setContentProtection`: a janela some de captura de tela e de transmissão. */
  readonly protegerConteudo: (sim: boolean) => Promise<void>;
};

type DocumentoPip = {
  requestWindow(opcoes?: { width?: number; height?: number }): Promise<Window>;
};

declare global {
  interface Window {
    readonly vortexPopout?: PontePopout;
  }
}

/** A ponte, se a casca a entrega por inteiro. */
export function ponteDePopout(): PontePopout | undefined {
  if (typeof window === "undefined") return undefined;
  const p = window.vortexPopout as Record<string, unknown> | undefined;
  return p && typeof p.definirTopo === "function" && typeof p.protegerConteudo === "function"
    ? window.vortexPopout
    : undefined;
}

function documentoPip(): DocumentoPip | undefined {
  if (typeof window === "undefined") return undefined;
  const d = (window as unknown as { documentPictureInPicture?: DocumentoPip }).documentPictureInPicture;
  return d && typeof d.requestWindow === "function" ? d : undefined;
}

export type ModoDeDestaque = "casca" | "documento";

/** Por onde a janela abriria aqui, ou `undefined` quando não há como. */
export function modoDeDestaque(): ModoDeDestaque | undefined {
  if (ponteDePopout()) return "casca";
  if (documentoPip()) return "documento";
  return undefined;
}

/** Destacar existe neste ambiente? É o que esconde o botão onde não existe. */
export function podeDestacar(): boolean {
  return modoDeDestaque() !== undefined;
}

/**
 * Abre a janela. Chamar de um gesto da pessoa (clique): o Document PiP exige.
 * Devolve `null` quando o navegador ou a casca recusou — sem exceção, porque
 * "não deu" é um estado normal da interface.
 */
export async function abrirJanela(
  modo: ModoDeDestaque,
  tamanho: { readonly largura: number; readonly altura: number },
): Promise<Window | null> {
  try {
    if (modo === "documento") {
      const pip = documentoPip();
      if (!pip) return null;
      return await pip.requestWindow({ width: tamanho.largura, height: tamanho.altura });
    }
    const janela = window.open("", NOME_DA_JANELA);
    if (!janela) return null;
    try {
      janela.resizeTo(tamanho.largura, tamanho.altura);
    } catch {
      // Quem decide o tamanho é a casca.
    }
    return janela;
  } catch {
    return null;
  }
}

/**
 * Liga o que só a casca sabe fazer: topo e proteção de conteúdo. Falha da casca
 * não derruba a janela — o overlay funciona sem proteção, só aparece em captura.
 */
export async function protegerJanela(modo: ModoDeDestaque): Promise<void> {
  if (modo !== "casca") return;
  const ponte = ponteDePopout();
  if (!ponte) return;
  try {
    await ponte.definirTopo(true);
    await ponte.protegerConteudo(true);
  } catch {
    // Sem a ponte a janela segue, só sem a proteção.
  }
}
