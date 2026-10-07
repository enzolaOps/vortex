/**
 * Preferências de apresentação da jornada de salas: em qual canto o widget da
 * sala fica preso e como a gaveta de membros se mostra (lista ou só ícones).
 *
 * Do dispositivo e persistidas. Strings, então `getSnapshot` é estável por valor.
 */
export type CantoDaSala = "tl" | "tr" | "bl" | "br";
export type ModoDaGaveta = "lista" | "icones";

const CHAVE = "vortex:preferencias-da-sala";
const CANTOS: readonly CantoDaSala[] = ["tl", "tr", "bl", "br"];

type Guardado = { canto: CantoDaSala; gaveta: ModoDaGaveta };
const PADRAO: Guardado = { canto: "br", gaveta: "lista" };

const ouvintes = new Set<() => void>();

function ler(): Guardado {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return PADRAO;
    const v = JSON.parse(bruto) as { canto?: unknown; gaveta?: unknown };
    return {
      canto: CANTOS.find((c) => c === v.canto) ?? PADRAO.canto,
      gaveta: v.gaveta === "icones" ? "icones" : "lista",
    };
  } catch {
    return PADRAO;
  }
}

let atual: Guardado = ler();

function gravar(novo: Guardado): void {
  if (novo.canto === atual.canto && novo.gaveta === atual.gaveta) return;
  atual = novo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(novo));
  } catch {
    // Vale para esta sessão.
  }
  for (const o of ouvintes) o();
}

export function assinarPreferenciasDaSala(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export const lerCantoDaSala = (): CantoDaSala => atual.canto;
export const lerModoDaGaveta = (): ModoDaGaveta => atual.gaveta;

export function fixarSalaNoCanto(canto: CantoDaSala): void {
  gravar({ ...atual, canto });
}

export function definirModoDaGaveta(gaveta: ModoDaGaveta): void {
  gravar({ ...atual, gaveta });
}

export function limparPreferenciasDaSala(): void {
  atual = PADRAO;
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // Nada a fazer.
  }
  for (const o of ouvintes) o();
}
