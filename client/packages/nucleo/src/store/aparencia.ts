/**
 * Os ajustes de aparência que não são cor: vidro, brilho de fundo, tamanho do
 * texto e animações. A densidade das mensagens mora em `densidade.ts`.
 *
 * Preferência do dispositivo, como o tema: gosto de quem está na frente da
 * tela, e PC fraco pede vidro sólido. Nunca vai no preset (quem recebe um
 * preset não herda a acuidade visual nem a GPU de outra pessoa).
 *
 * Os números aqui são o que a pessoa escolheu; quem os transforma em valor de
 * token é `app/src/tema/vidroEFundo.ts`, e quem os escreve no documento é
 * `personalizado.ts` — antes da primeira pintura, como a paleta.
 */

const CHAVE = "vortex:aparencia";

export const TEXTO_MIN = 90;
export const TEXTO_MAX = 125;

export interface Aparencia {
  /** 0 = sólido (sem desfoque) a 100 = a receita de vidro de fábrica. */
  readonly vidro: number;
  /** 0 = sem manchas de cor atrás do app a 100 = a intensidade de fábrica. */
  readonly brilho: number;
  /** Tamanho do texto em %, de 90 a 125. */
  readonly texto: number;
  /** `null` = segue o sistema (`prefers-reduced-motion`). */
  readonly reduzirAnimacoes: boolean | null;
}

export const APARENCIA_PADRAO: Aparencia = { vidro: 100, brilho: 100, texto: 100, reduzirAnimacoes: null };

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

function limitar(n: unknown, min: number, max: number, recuo: number): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : recuo;
}

/** Conferido na LEITURA: `localStorage` é editável, e valor inventado não vira token. */
function normalizar(o: Record<string, unknown>): Aparencia {
  return {
    vidro: limitar(o["vidro"], 0, 100, APARENCIA_PADRAO.vidro),
    brilho: limitar(o["brilho"], 0, 100, APARENCIA_PADRAO.brilho),
    texto: limitar(o["texto"], TEXTO_MIN, TEXTO_MAX, APARENCIA_PADRAO.texto),
    reduzirAnimacoes: typeof o["reduzirAnimacoes"] === "boolean" ? o["reduzirAnimacoes"] : null,
  };
}

function ler(): Aparencia {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return APARENCIA_PADRAO;
    const o: unknown = JSON.parse(cru);
    return typeof o === "object" && o !== null ? normalizar(o as Record<string, unknown>) : APARENCIA_PADRAO;
  } catch {
    return APARENCIA_PADRAO;
  }
}

/** Referência cacheada: `getSnapshot` que monta objeto a cada chamada trava a aba. */
let atual: Aparencia = ler();

export function assinarAparencia(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerAparencia(): Aparencia {
  return atual;
}

export function definirAparencia(mudanca: Partial<Aparencia>): void {
  const proxima = normalizar({ ...atual, ...mudanca });
  if (
    proxima.vidro === atual.vidro &&
    proxima.brilho === atual.brilho &&
    proxima.texto === atual.texto &&
    proxima.reduzirAnimacoes === atual.reduzirAnimacoes
  ) {
    return;
  }
  atual = proxima;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(atual));
  } catch {
    // Armazenamento bloqueado: a escolha vale nesta aba.
  }
  for (const o of ouvintes) o();
}

/** Volta tudo ao desenho de fábrica. */
export function restaurarAparencia(): void {
  definirAparencia(APARENCIA_PADRAO);
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparAparencia(): void {
  atual = APARENCIA_PADRAO;
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento */
  }
}
