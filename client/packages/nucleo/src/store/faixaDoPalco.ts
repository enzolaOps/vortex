/**
 * A faixa de miniaturas do palco está recolhida?
 *
 * Preferência de leitura do dispositivo: não vai no preset e não sincroniza.
 * Recolhida, a faixa vira uma barra fina e NENHUMA miniatura monta, então
 * nenhuma assinatura de vídeo existe para o que ninguém vê.
 */

const CHAVE = "vortex:faixa-do-palco-recolhida";

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

function ler(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

/** Referência cacheada (booleano): `getSnapshot` estável. */
let recolhida = ler();

export function assinarFaixaDoPalco(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerFaixaRecolhida(): boolean {
  return recolhida;
}

export function definirFaixaRecolhida(nova: boolean): void {
  if (nova === recolhida) return;
  recolhida = nova;
  try {
    localStorage.setItem(CHAVE, nova ? "1" : "0");
  } catch {
    // Armazenamento bloqueado: vale nesta aba, perde-se só a memória.
  }
  for (const o of ouvintes) o();
}

/** Estado limpo entre testes. */
export function limparFaixaDoPalco(): void {
  recolhida = false;
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // ignorado
  }
  for (const o of ouvintes) o();
}
