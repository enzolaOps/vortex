import { useCallback, useSyncExternalStore } from "react";

import { chaveDeMembro, type ChaveDeMembro } from "../sdk/domain";

/**
 * Tag, emblema e características do servidor — e quem exibe a tag.
 *
 * ⚠ **Store próprio, fora do `ServerSnapshot`, e a razão é o SDK.** Os quatro
 * campos são do fork do serviço `api` (`Server.tag`, `Server.tag_badge`,
 * `Server.characteristics`, `Member.show_tag`), e a hidratação do `stoat.js`
 * lista as chaves que conhece: o resto é descartado antes de chegar a qualquer
 * getter. Quem os traduz é `sdk/perfilDoServidor.ts`, lendo o evento CRU — o
 * mesmo caminho que o adapter já usa para `can_publish`.
 *
 * Duas chaves, duas subscrições (lei nº 1): a coluna de canais assina o
 * servidor, o nome na timeline assina `servidor × pessoa`. Uma pessoa ligar a
 * própria tag acorda as linhas DELA, não a timeline inteira.
 */

export type PerfilDoServidor = {
  /** 2 a 4 caracteres, A-Z e 0-9. Ausente quando o servidor não tem tag. */
  readonly tag: string | undefined;
  readonly emblemaUrl: string | undefined;
  /** Até cinco, na ordem em que quem administra as pôs. */
  readonly caracteristicas: readonly string[];
};

const VAZIO: PerfilDoServidor = {
  tag: undefined,
  emblemaUrl: undefined,
  caracteristicas: [],
};

const perfis = new Map<string, PerfilDoServidor>();
/** Por servidor, quem exibe a tag. Conjunto por servidor para trocar a lista inteira de uma vez. */
const exibem = new Map<string, Set<string>>();

const ouvintesDePerfil = new Map<string, Set<() => void>>();
const ouvintesDeExibe = new Map<ChaveDeMembro, Set<() => void>>();

function avisar<K>(mapa: Map<K, Set<() => void>>, chave: K): void {
  for (const o of mapa.get(chave) ?? []) o();
}

function assinar<K>(
  mapa: Map<K, Set<() => void>>,
  chave: K,
  ouvinte: () => void,
): () => void {
  let conjunto = mapa.get(chave);
  if (!conjunto) {
    conjunto = new Set();
    mapa.set(chave, conjunto);
  }
  const c = conjunto;
  c.add(ouvinte);
  return () => {
    c.delete(ouvinte);
    if (c.size === 0) mapa.delete(chave);
  };
}

/** Referência cacheada — armadilha nº 1. */
export function lerPerfilDoServidor(serverId: string): PerfilDoServidor {
  return perfis.get(serverId) ?? VAZIO;
}

function mesmaLista(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Mescla uma mudança parcial.
 *
 * ⚠ **Só troca a referência quando algum valor mudou.** O `ServerUpdate` do
 * protocolo chega também por nome, ícone e categoria; publicar sempre faria o
 * nome de cada autor na tela re-renderizar a cada canal arrastado.
 */
export function definirPerfilDoServidor(
  serverId: string,
  mudanca: Partial<PerfilDoServidor>,
): void {
  const atual = lerPerfilDoServidor(serverId);
  const proximo: PerfilDoServidor = { ...atual, ...mudanca };
  if (
    proximo.tag === atual.tag &&
    proximo.emblemaUrl === atual.emblemaUrl &&
    mesmaLista(proximo.caracteristicas, atual.caracteristicas)
  ) {
    return;
  }
  perfis.set(serverId, proximo);
  avisar(ouvintesDePerfil, serverId);
}

export function esquecerServidor(serverId: string): void {
  const tinhaPerfil = perfis.delete(serverId);
  const quem = exibem.get(serverId);
  exibem.delete(serverId);
  if (tinhaPerfil) avisar(ouvintesDePerfil, serverId);
  for (const userId of quem ?? []) {
    avisar(ouvintesDeExibe, chaveDeMembro(serverId, userId));
  }
}

export function exibeTag(serverId: string, userId: string): boolean {
  return exibem.get(serverId)?.has(userId) ?? false;
}

export function definirExibeTag(
  serverId: string,
  userId: string,
  exibe: boolean,
): void {
  if (exibeTag(serverId, userId) === exibe) return;
  let quem = exibem.get(serverId);
  if (!quem) {
    quem = new Set();
    exibem.set(serverId, quem);
  }
  if (exibe) quem.add(userId);
  else quem.delete(userId);
  avisar(ouvintesDeExibe, chaveDeMembro(serverId, userId));
}

/**
 * Troca a lista inteira de quem exibe, avisando SÓ quem mudou.
 *
 * A rota devolve todo mundo de uma vez; avisar todos acordaria cada linha de
 * cada autor na tela por uma resposta que, na maioria das vezes, não muda nada.
 */
export function definirQuemExibeTag(
  serverId: string,
  userIds: readonly string[],
): void {
  const antes = exibem.get(serverId) ?? new Set<string>();
  const depois = new Set(userIds);
  exibem.set(serverId, depois);
  for (const id of antes) {
    if (!depois.has(id)) avisar(ouvintesDeExibe, chaveDeMembro(serverId, id));
  }
  for (const id of depois) {
    if (!antes.has(id)) avisar(ouvintesDeExibe, chaveDeMembro(serverId, id));
  }
}

export function usePerfilDoServidor(serverId: string): PerfilDoServidor {
  const assinarPerfil = useCallback(
    (o: () => void) => assinar(ouvintesDePerfil, serverId, o),
    [serverId],
  );
  return useSyncExternalStore(assinarPerfil, () => lerPerfilDoServidor(serverId));
}

/** Ouve a escolha de UMA pessoa num servidor — é a chave da linha na timeline. */
export function assinarExibeTag(
  serverId: string,
  userId: string,
  ouvinte: () => void,
): () => void {
  return assinar(ouvintesDeExibe, chaveDeMembro(serverId, userId), ouvinte);
}

/** Se ESTA pessoa escolheu exibir a tag neste servidor. */
export function useExibeTag(serverId: string, userId: string): boolean {
  const assinarExibe = useCallback(
    (o: () => void) => assinarExibeTag(serverId, userId, o),
    [serverId, userId],
  );
  return useSyncExternalStore(assinarExibe, () => exibeTag(serverId, userId));
}

/**
 * A tag que ESTA pessoa exibe neste servidor, ou nada.
 *
 * Duas condições, e as duas são do servidor: a pessoa ligou a exibição E o
 * servidor tem tag. Ligar sem tag não mostra nada, e apagar a tag some com ela
 * de todo mundo sem ninguém precisar desligar.
 */
export function useTagExibida(serverId: string, userId: string): string | undefined {
  const exibe = useExibeTag(serverId, userId);
  const { tag } = usePerfilDoServidor(serverId);
  return exibe ? tag : undefined;
}

/** Estado limpo entre testes. */
export function limparPerfisDeServidor(): void {
  perfis.clear();
  exibem.clear();
}
