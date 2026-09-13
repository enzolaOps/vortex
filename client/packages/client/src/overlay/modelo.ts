/**
 * O overlay do jogo — o que atravessa da janela principal para a do overlay.
 *
 * ⚠ **A janela do overlay não tem sessão, socket nem store de entidade.** Ela
 * carrega o mesmo cliente numa rota própria só para herdar tokens, fontes e
 * componentes; tudo o que desenha chega pronto por aqui, publicado pela janela
 * principal (`publicador.ts`) e repassado pela casca. Uma segunda conexão por
 * janela é exatamente o que o briefing proíbe.
 */

/** As nove posições da grade do design, lidas linha a linha — 2 é cima·fim. */
export const POSICOES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
export type Posicao = (typeof POSICOES)[number];
export const POSICAO_PADRAO: Posicao = 2;

export type Vertical = "cima" | "meio" | "baixo";
export type Horizontal = "inicio" | "centro" | "fim";
export type Ancora = { readonly v: Vertical; readonly h: Horizontal };

const LINHAS: readonly Vertical[] = ["cima", "meio", "baixo"];
const COLUNAS: readonly Horizontal[] = ["inicio", "centro", "fim"];

export function ancoraDa(p: Posicao): Ancora {
  return { v: LINHAS[Math.floor(p / 3)] ?? "cima", h: COLUNAS[p % 3] ?? "fim" };
}

export function ehPosicao(v: unknown): v is Posicao {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 8;
}

/**
 * Onde cada widget fica, dada a posição escolhida para o de voz.
 *
 * O design põe a mensagem em baixo·fim e a dica em baixo·início. Quando o de
 * voz é posto num desses cantos, o outro sobe para o canto de cima do mesmo
 * lado — dois widgets empilhados no mesmo canto cobririam um ao outro.
 */
export function ancoras(p: Posicao): {
  voz: Ancora;
  mensagem: Ancora;
  dica: Ancora;
} {
  const voz = ancoraDa(p);
  const mensagem: Ancora =
    voz.v === "baixo" && voz.h === "fim" ? { v: "cima", h: "fim" } : { v: "baixo", h: "fim" };
  const dica: Ancora =
    voz.v === "baixo" && voz.h === "inicio"
      ? { v: "cima", h: "inicio" }
      : { v: "baixo", h: "inicio" };
  return { voz, mensagem, dica };
}

export type ParticipanteDoOverlay = {
  readonly id: string;
  readonly nome: string;
  readonly sigla: string | undefined;
  readonly avatarUrl: string | undefined;
  readonly falando: boolean;
  readonly mudo: boolean;
};

export type EstadoDoOverlay = {
  readonly ativo: boolean;
  readonly posicao: Posicao;
  /** Tokens de `<Combinacao>` do atalho de alternar, ou nada. */
  readonly atalho: readonly string[] | undefined;
  readonly voz:
    | {
        readonly canal: string;
        /** Epoch ms do início; o overlay conta sozinho. */
        readonly desde: number;
        readonly mudo: boolean;
        readonly surdo: boolean;
        readonly participantes: readonly ParticipanteDoOverlay[];
      }
    | undefined;
};

export type MensagemDoOverlay = {
  readonly id: string;
  readonly canal: string;
  readonly autor: string;
  readonly texto: string;
};

export type ComandoDoOverlay = "mutar" | "ensurdecer" | "desconectar";

/** A ponte da casca — separada das outras pela mesma razão de versão. */
export type PonteDeOverlay = {
  /** Janela principal: o estado mudou. */
  readonly publicar: (estado: EstadoDoOverlay) => void;
  /** Janela principal: uma mensagem que merece aparecer por cima do jogo. */
  readonly mensagem: (m: MensagemDoOverlay) => void;
  /** Janela do overlay. */
  readonly assinarEstado: (ouvinte: (e: EstadoDoOverlay) => void) => () => void;
  readonly assinarMensagens: (ouvinte: (m: MensagemDoOverlay) => void) => () => void;
  /** `true` enquanto o overlay recebe cliques (depois do atalho). */
  readonly assinarInteracao: (ouvinte: (interagindo: boolean) => void) => () => void;
  readonly comando: (c: ComandoDoOverlay) => void;
};

declare global {
  interface Window {
    readonly vortexOverlay?: PonteDeOverlay;
  }
}

const VERBOS: Record<keyof PonteDeOverlay, true> = {
  publicar: true,
  mensagem: true,
  assinarEstado: true,
  assinarMensagens: true,
  assinarInteracao: true,
  comando: true,
};

export function ponteDeOverlay(): PonteDeOverlay | undefined {
  if (typeof window === "undefined") return undefined;
  const p = window.vortexOverlay as Record<string, unknown> | undefined;
  if (!p) return undefined;
  return Object.keys(VERBOS).every((v) => typeof p[v] === "function")
    ? window.vortexOverlay
    : undefined;
}

/** A rota da janela do overlay. */
export const ROTA_DO_OVERLAY = "/overlay";

/** Segundos em `mm:ss`, ou `h:mm:ss` passando da hora. */
export function duracao(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${String(h)}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Um atalho como TEXTO mono — `⇧ \``, `Ctrl ⇧ M` —, que é como o design o
 * escreve no overlay e no cartão de configurações. `<Combinacao>` desenha
 * teclas em caixa, que dentro de uma pílula de 26px viram ruído.
 */
export function textoDoAtalho(teclas: readonly string[], mac: boolean): string {
  const nomes: Record<string, string> = mac
    ? { shift: "⇧", mod: "⌘", alt: "⌥" }
    : { shift: "⇧", mod: "Ctrl", alt: "Alt" };
  return teclas.map((t) => nomes[t] ?? t).join(" ");
}
