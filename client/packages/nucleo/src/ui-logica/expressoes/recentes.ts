/**
 * As figurinhas usadas por último, nesta máquina.
 *
 * Conveniência de quem usa, como o volume do painel — `localStorage` e não
 * servidor. Só IDs: nome e URL vêm do store `figurinhas`, e uma figurinha
 * apagada some sozinha quando a busca dela não volta.
 */
type Ouvinte = () => void;

const CHAVE = "vx:figurinhas:recentes";
export const MAXIMO_DE_RECENTES = 6;

function lerGuardadas(): readonly string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, MAXIMO_DE_RECENTES)
      : [];
  } catch {
    return [];
  }
}

let recentes = lerGuardadas();
const ouvintes = new Set<Ouvinte>();

export function assinarRecentes(o: Ouvinte): () => void {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function lerRecentes(): readonly string[] {
  return recentes;
}

/** A usada vai para a frente; repetida não duplica; o fim sai do teto. */
export function usarFigurinha(id: string): void {
  recentes = [id, ...recentes.filter((x) => x !== id)].slice(0, MAXIMO_DE_RECENTES);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(recentes));
  } catch {
    /* Armazenamento bloqueado: vale para esta sessão. */
  }
  for (const o of ouvintes) o();
}
