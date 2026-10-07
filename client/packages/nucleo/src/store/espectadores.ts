/**
 * Quem está assistindo cada transmissão, e em que qualidade.
 *
 * ⚠ **Estado efêmero, keyed por pessoa — lei nº 1.** O anúncio de cada
 * participante muda quando ele abre ou fecha uma tela, quando a rede corta a
 * resolução e quando entra em tela cheia; numa sala cheia isso é frequente e
 * não tem nada a ver com canais nem mensagens. Mora aqui, com o throttle de
 * `createEphemeralStore` na fronteira, e quem assina é a LINHA daquela pessoa
 * na coluna do palco e o chip de contagem — a coluna de canais e a lista de
 * mensagens nunca acordam por isso.
 *
 * Dois stores, duas perguntas:
 * - `anuncioDe(pessoa)` — o que ESTA pessoa assiste (a linha da coluna);
 * - `espectadoresDe(dono)` — quem assiste ESTA tela (a contagem e a ordem).
 *
 * O segundo é derivado do primeiro na escrita, só para os donos que o anúncio
 * tocou, e só republica quando a lista muda — `getSnapshot` devolve sempre a
 * mesma referência enquanto nada mudou.
 */

import { createEphemeralStore } from "./ephemeral";

/** O que uma pessoa diz sobre UMA transmissão que está assistindo. */
export interface Assistindo {
  /** De quem é a tela (identity do LiveKit, que é o ID de usuário). */
  readonly dono: string;
  /** Altura do quadro que está CHEGANDO, em pixels. Ausente se ainda não medida. */
  readonly altura?: number;
  /** Recebe abaixo do que é publicado sem ter pedido — a rede cortou. */
  readonly rede: boolean;
  /** Está em tela cheia. */
  readonly cheia: boolean;
}

const VAZIO: readonly Assistindo[] = [];
const NINGUEM: readonly string[] = [];

/** pessoa → o que ela anuncia assistir. */
const anuncios = new Map<string, readonly Assistindo[]>();
/** dono da tela → quem a assiste, em ordem estável. */
const porDono = new Map<string, readonly string[]>();

const storeDeAnuncio = createEphemeralStore<readonly Assistindo[]>();
const storeDeEspectadores = createEphemeralStore<readonly string[]>();

function iguais(a: readonly Assistindo[], b: readonly Assistindo[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return (
      y !== undefined &&
      x.dono === y.dono &&
      x.altura === y.altura &&
      x.rede === y.rede &&
      x.cheia === y.cheia
    );
  });
}

function recalcular(dono: string): void {
  const quem: string[] = [];
  for (const [pessoa, lista] of anuncios) {
    if (pessoa === dono) continue;
    if (lista.some((a) => a.dono === dono)) quem.push(pessoa);
  }
  quem.sort();
  const antes = porDono.get(dono) ?? NINGUEM;
  if (antes.length === quem.length && antes.every((id, i) => id === quem[i])) return;
  if (quem.length === 0) {
    porDono.delete(dono);
    storeDeEspectadores.apagar(dono);
  } else {
    porDono.set(dono, quem);
    storeDeEspectadores.set(dono, quem);
  }
}

/**
 * Registra o que uma pessoa anuncia.
 *
 * Recebe a lista INTEIRA: o atributo é o estado atual, não um delta. Anúncio
 * igual ao anterior não acorda ninguém.
 */
export function definirAnuncio(pessoa: string, lista: readonly Assistindo[]): void {
  const antes = anuncios.get(pessoa) ?? VAZIO;
  if (iguais(antes, lista)) return;
  if (lista.length === 0) {
    anuncios.delete(pessoa);
    storeDeAnuncio.apagar(pessoa);
  } else {
    anuncios.set(pessoa, lista);
    storeDeAnuncio.set(pessoa, lista);
  }
  const tocados = new Set<string>();
  for (const a of antes) tocados.add(a.dono);
  for (const a of lista) tocados.add(a.dono);
  for (const dono of tocados) recalcular(dono);
}

/** A pessoa saiu da sala: o anúncio dela morre com ela. */
export function esquecerAnuncio(pessoa: string): void {
  definirAnuncio(pessoa, VAZIO);
}

/** Fim da chamada: nada do que foi anunciado sobrevive à sala. */
export function limparEspectadores(): void {
  anuncios.clear();
  porDono.clear();
  storeDeAnuncio.limpar();
  storeDeEspectadores.limpar();
  definirContagemDisponivel(false);
}

export function assinarAnuncio(pessoa: string) {
  return storeDeAnuncio.subscriber(pessoa);
}

export function lerAnuncio(pessoa: string): readonly Assistindo[] {
  return storeDeAnuncio.getSnapshot(pessoa) ?? VAZIO;
}

export function assinarEspectadores(dono: string) {
  return storeDeEspectadores.subscriber(dono);
}

export function lerEspectadores(dono: string): readonly string[] {
  return storeDeEspectadores.getSnapshot(dono) ?? NINGUEM;
}

/* ----------------------------------------------------- disponibilidade */

/**
 * O servidor deixa anunciar?
 *
 * ⚠ **É o que decide entre "N assistindo" e "N na sala".** Um servidor sem o
 * grant novo (`can_update_own_metadata`) não deixa ninguém escrever o
 * atributo, e ali a contagem de espectadores seria SEMPRE zero — um "0
 * assistindo" com três pessoas olhando é pior que não contar. A permissão da
 * PRÓPRIA conexão é o termômetro: o token de todo mundo sai do mesmo
 * servidor, com os mesmos grants.
 */
let disponivel = false;
const ouvintes = new Set<() => void>();

export function definirContagemDisponivel(sim: boolean): void {
  if (disponivel === sim) return;
  disponivel = sim;
  for (const o of ouvintes) o();
}

export function assinarContagemDisponivel(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function contagemDisponivel(): boolean {
  return disponivel;
}
