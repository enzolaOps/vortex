/**
 * Canais +18 que esta pessoa já confirmou ter idade para ver (D-CCANAL-06).
 *
 * O design diz que a restrição "exige confirmação na entrada". Até aqui nada
 * no app lia `restritoPorIdade` fora da tela de configurações: marcar um canal
 * como +18 gravava `nsfw` no servidor e não mudava coisa nenhuma para quem o
 * abria.
 *
 * **Local e por canal, como `colapso.ts`.** A confirmação é declaração DESTA
 * pessoa neste dispositivo, e o protocolo não tem onde guardá-la — nem precisa:
 * o servidor não tem como verificar idade, então guardar lá daria à resposta
 * um peso que ela não tem. Por canal e não global: quem aceitou ver um canal
 * não aceitou ver todos os que alguém venha a marcar depois.
 *
 * Guardamos os CONFIRMADOS: canal novo nasce pedindo confirmação, que é o
 * lado seguro do erro.
 */

const CHAVE = "vortex:idade-confirmada";

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

function ler(): ReadonlySet<string> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return new Set();
    const lista: unknown = JSON.parse(bruto);
    // Defensivo: valor corrompido não pode derrubar a coluna de conteúdo.
    return new Set(Array.isArray(lista) ? lista.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/* Referência cacheada: `getSnapshot` compara por `Object.is` (armadilha nº 1). */
let cache: ReadonlySet<string> = ler();

export function idadeConfirmada(channelId: string): boolean {
  return cache.has(channelId);
}

export function confirmarIdade(channelId: string): void {
  if (cache.has(channelId)) return;
  const proximo = new Set(cache);
  proximo.add(channelId);
  cache = proximo;

  try {
    localStorage.setItem(CHAVE, JSON.stringify([...proximo]));
  } catch {
    // Modo privativo, cota cheia: vale para esta sessão. Perder a persistência
    // custa uma pergunta a mais amanhã; derrubar a coluna custaria o canal.
  }

  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarIdade(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

