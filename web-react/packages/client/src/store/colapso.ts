/**
 * Categorias colapsadas, por ID de categoria.
 *
 * **Não vai no preset, e a razão é a regra mais dura do projeto.** O schema do
 * preset foi desenhado para tornar dado de sessão IRREPRESENTÁVEL: `PainelId`
 * é união fechada de TIPOS de painel justamente para que "os membros do
 * servidor X" não caiba lá. Um ID de categoria é dado de servidor — cabe na
 * mesma família do que aquela decisão excluiu, e preset já compartilhado não
 * volta atrás.
 *
 * Então mora aqui: local, do dispositivo, nunca compartilhado. É preferência
 * de leitura, não identidade de layout.
 *
 * Guardamos os COLAPSADOS, não os abertos: categoria nova nasce aberta, que é
 * o que alguém espera de um grupo que acabou de aparecer no servidor.
 */

const CHAVE = "vortex:categorias-colapsadas";

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

function ler(): ReadonlySet<string> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return new Set();
    const lista: unknown = JSON.parse(bruto);
    // Defensivo de propósito: `localStorage` é editável por quem usa o app, e
    // um valor corrompido não pode derrubar a coluna de canais inteira.
    return new Set(Array.isArray(lista) ? lista.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Referência cacheada — a armadilha nº 1 do briefing.
 *
 * `getSnapshot` é chamado a cada render e comparado por `Object.is`. Ler o
 * `localStorage` e montar um `Set` a cada chamada devolveria referência nova
 * toda vez: loop de render, aba travando, e nenhum erro.
 */
let cache: ReadonlySet<string> = ler();

export function colapsadas(): ReadonlySet<string> {
  return cache;
}

export function estaColapsada(id: string): boolean {
  return cache.has(id);
}

export function alternarColapso(id: string): void {
  const proximo = new Set(cache);
  if (!proximo.delete(id)) proximo.add(id);
  cache = proximo;

  try {
    localStorage.setItem(CHAVE, JSON.stringify([...proximo]));
  } catch {
    // Modo privativo, cota cheia: a preferência vale para esta sessão e
    // acabou. Perder a persistência é aceitável; derrubar a coluna não é.
  }

  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarColapso(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
