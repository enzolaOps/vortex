/**
 * O tom de pele padrão dos emojis de pessoa.
 *
 * Preferência de quem ESCREVE, e por isso local, como `densidade.ts`: não vai
 * no preset (quem recebe um preset não herda a mão de outra pessoa) e não
 * encosta no adapter — o tom é aplicado no glifo antes de ele virar texto, e
 * o que chega ao protocolo é Unicode comum.
 */

import { TONS, type TomDePele } from "../seletores/tomDePele";

const CHAVE = "vortex:tomDePele";

function ler(): TomDePele {
  try {
    // União fechada conferida na LEITURA: valor inventado vira o padrão.
    const cru = localStorage.getItem(CHAVE);
    return TONS.find((t) => t === cru) ?? "padrao";
  } catch {
    return "padrao";
  }
}

/** Referência cacheada — armadilha nº 1. */
let tom: TomDePele = ler();

const ouvintes = new Set<() => void>();

export function assinarTomDePele(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerTomDePele(): TomDePele {
  return tom;
}

export function definirTomDePele(novo: TomDePele): void {
  if (novo === tom) return;
  tom = novo;
  try {
    localStorage.setItem(CHAVE, novo);
  } catch {
    /* Vale nesta aba — mesma decisão de `densidade.ts`. */
  }
  for (const o of ouvintes) o();
}

/** Estado limpo entre testes. */
export function limparTomDePele(): void {
  tom = "padrao";
}
