/**
 * Os emojis que você usou por último, para reagir ou para escrever.
 *
 * Separado de `reacoesFrequentes` de propósito: aquele conta USO (só reação) e
 * alimenta a fileira rápida do menu, onde a posição não pode andar. Este é uma
 * pilha de recência, de qualquer origem, para a primeira seção do seletor —
 * onde "o último que usei" é exatamente o que se quer em cima.
 *
 * Local, como `reacoesFrequentes`: é preferência de quem digita, o protocolo
 * não tem onde guardar.
 */

const CHAVE = "vortex:emojisRecentes";
export const MAXIMO_DE_RECENTES = 24;

const VAZIO: readonly string[] = [];
/** Publicada e CACHEADA: o array guardado, nunca um recém-montado no getter. */
let recentes: readonly string[] = VAZIO;
const ouvintes = new Set<() => void>();

export function assinarEmojisRecentes(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerEmojisRecentes(): readonly string[] {
  return recentes;
}

function guardar(): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(recentes));
  } catch {
    /* Sem persistência a sessão segue; só não lembra depois. */
  }
}

/** Registra um uso: o emoji vai para o topo, sem repetir, com teto. */
export function registrarEmojiRecente(emoji: string): void {
  if (recentes[0] === emoji) return;
  recentes = [emoji, ...recentes.filter((e) => e !== emoji)].slice(0, MAXIMO_DE_RECENTES);
  guardar();
  for (const o of ouvintes) o();
}

export function restaurarEmojisRecentes(): void {
  try {
    const cru: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    if (!Array.isArray(cru)) return;
    recentes = cru.filter((e): e is string => typeof e === "string").slice(0, MAXIMO_DE_RECENTES);
  } catch {
    /* JSON corrompido é o mesmo que ausência. */
  }
}

/** Estado limpo entre testes. */
export function limparEmojisRecentes(): void {
  recentes = VAZIO;
  for (const o of ouvintes) o();
}

restaurarEmojisRecentes();
