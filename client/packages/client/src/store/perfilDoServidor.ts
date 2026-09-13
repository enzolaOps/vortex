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
 * Pendurá-los no `ServerSnapshot` exigiria que o efeito Solid do servidor
 * acordasse por um dado que não passa pelo Solid; aqui a publicação é direta.
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
const exibem = new Set<ChaveDeMembro>();

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
  conjunto.add(ouvinte);
  return () => {
    conjunto.delete(ouvinte);
    if (conjunto.size === 0) mapa.delete(chave);
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
  if (!perfis.delete(serverId)) return;
  avisar(ouvintesDePerfil, serverId);
}

export function exibeTag(serverId: string, userId: string): boolean {
  return exibem.has(chaveDeMembro(serverId, userId));
}

export function definirExibeTag(
  serverId: string,
  userId: string,
  exibe: boolean,
): void {
  const chave = chaveDeMembro(serverId, userId);
  if (exibem.has(chave) === exibe) return;
  if (exibe) exibem.add(chave);
  else exibem.delete(chave);
  avisar(ouvintesDeExibe, chave);
}

export function usePerfilDoServidor(serverId: string): PerfilDoServidor {
  const assinarPerfil = useCallback(
    (o: () => void) => assinar(ouvintesDePerfil, serverId, o),
    [serverId],
  );
  return useSyncExternalStore(assinarPerfil, () => lerPerfilDoServidor(serverId));
}

/**
 * A tag que ESTA pessoa exibe neste servidor, ou nada.
 *
 * Duas condições, e as duas são do servidor: a pessoa ligou a exibição E o
 * servidor tem tag. Ligar sem tag não mostra nada, e apagar a tag some com ela
 * de todo mundo sem ninguém precisar desligar.
 */
export function useTagExibida(serverId: string, userId: string): string | undefined {
  const chave = chaveDeMembro(serverId, userId);
  const assinarExibe = useCallback(
    (o: () => void) => assinar(ouvintesDeExibe, chave, o),
    [chave],
  );
  const exibe = useSyncExternalStore(assinarExibe, () => exibem.has(chave));
  const { tag } = usePerfilDoServidor(serverId);
  return exibe ? tag : undefined;
}

/** Estado limpo entre testes. */
export function limparPerfisDeServidor(): void {
  perfis.clear();
  exibem.clear();
}
