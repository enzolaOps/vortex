/**
 * O seletor de tela da casca — contrato e ponte.
 *
 * ⚠ **Ponte PRÓPRIA, separada de `PonteDesktop`, e a razão é medida.** O
 * cliente Solid da casca expõe `window.native`; `sdk/desktop.ts` declara
 * `window.vortex`, que a casca ainda não implementa — então `naDesktop()` é
 * `false` mesmo rodando dentro do Electron, e todo verbo daquele contrato é
 * inalcançável hoje.
 *
 * Pendurar o seletor lá o deixaria inalcançável junto. E não dá para expor um
 * `window.vortex` PARCIAL: todo consumidor chama `ponte()?.x()`, onde o `?.`
 * guarda a ponte ausente e não o método ausente — com metade do contrato no
 * ar, "Limpar cache" lançaria `x is not a function`. Uma ponte estreita e
 * completa vale mais que meia ponte larga.
 *
 * ⚠ **Quatro verbos, e a ordem entre eles é o mecanismo.** A casca escolhe
 * ANTES de a captura ser pedida — ver `desktop/src/native/telaCompartilhada.ts`
 * para o porquê. Aqui isso aparece como: pergunte se há seletor próprio, liste,
 * arme a escolha, e só então peça a captura ao LiveKit.
 */

/** Uma fonte de captura — um monitor ou uma janela. */
export type FonteDeTela = {
  readonly id: string;
  readonly nome: string;
  readonly tipo: "tela" | "janela";
  /**
   * A segunda linha do cartão — "ultrawide principal", "3440×1440".
   *
   * ⚠ **Só as TELAS têm.** `desktopCapturer` não devolve o tamanho da fonte; o
   * das telas sai de `screen.getAllDisplays()`, casado por `display_id`. Para
   * janela não há de onde tirar, e a referência mostra "janela · 1728×1080"
   * com dado de fixture. Inventar a dimensão de uma janela seria a mesma
   * família do "Conectado · 42 ms" que a faixa de voz recusou.
   */
  readonly meta: string | undefined;
  /** Miniatura ao vivo, em data URL. */
  readonly miniatura: string;
  /** Ícone do aplicativo, só nas janelas. */
  readonly icone: string | undefined;
};

export type PonteDeTela = {
  /**
   * A casca deve abrir o seletor do Vortex?
   *
   * `false` onde o SISTEMA manda — Wayland e macOS recente desenham o próprio
   * seletor e nem chamam o handler da casca. Ali o painel do Vortex não teria o
   * que oferecer.
   */
  readonly seletorProprio: () => Promise<boolean>;
  readonly fontes: () => Promise<readonly FonteDeTela[]>;
  /** Arma a escolha para o PRÓXIMO pedido de captura. Uso único. */
  readonly escolher: (id: string, audio: boolean) => Promise<boolean>;
  readonly cancelar: () => Promise<void>;
  /**
   * O sistema já autorizou a captura?
   *
   * ⚠ Só o macOS tem esse portão — Windows não pede, e no Linux quem decide é
   * o portal do Wayland no momento da captura. Nos dois a casca devolve
   * `concedida`, que é o que eles fazem.
   */
  readonly permissao: () => Promise<"concedida" | "pendente">;
  readonly abrirAjustes: () => Promise<void>;
};

declare global {
  interface Window {
    /** Injetada pelo preload da casca. Ausente no navegador. */
    readonly vortexTela?: PonteDeTela;
  }
}

export function ponteDeTela(): PonteDeTela | undefined {
  return typeof window === "undefined" ? undefined : window.vortexTela;
}

/**
 * As resoluções que o design oferece, e o que elas viram em constraint.
 *
 * ⚠ **Só a ALTURA entra na constraint.** `getDisplayMedia` recebe
 * `width`/`height` como teto, e travar a largura junto distorceria uma tela
 * ultrawide — 3440×1440 pedida em 1920×1080 volta esticada ou com barras. Com
 * teto só na altura, a proporção da fonte é preservada.
 */
export const RESOLUCOES = ["720p", "1080p", "1440p", "Fonte"] as const;
export type Resolucao = (typeof RESOLUCOES)[number];

export const ALTURA_DE: Record<Resolucao, number | undefined> = {
  "720p": 720,
  "1080p": 1080,
  "1440p": 1440,
  /* `Fonte` = sem teto: transmite na resolução nativa. */
  Fonte: undefined,
};

export const TAXAS = [15, 30, 60] as const;
export type Taxa = (typeof TAXAS)[number];

/**
 * O aviso de troca do design — o que se ganha e o que se perde.
 *
 * Ele existe porque resolução e taxa são a decisão menos óbvia do painel: a
 * pessoa escolhe "1440p 60" achando que é melhor, e o que acontece é a rede
 * cair para 22 fps. Dizer a consequência ANTES é mais barato que descobrir
 * transmitindo.
 */
export function trocaDe(resolucao: Resolucao, taxa: Taxa): string {
  /* As duas frases são as da referência, palavra por palavra: ela separa em
     "pesado" e "recomendado", e não em quatro casos como eu tinha escrito. */
  const pesado = resolucao === "1440p" || resolucao === "Fonte" || taxa === 60;
  return pesado
    ? "1440p ou 60 fps consomem ~8 Mbps de upload; espectadores em rede fraca caem para 720p automaticamente."
    : "Combinação recomendada: legível para texto e estável em upload doméstico.";
}
