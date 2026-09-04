import type { PresencaEscolhida } from "../sdk/domain";

/**
 * O meu status: a presença que escolhi e o texto que escrevi.
 *
 * Store module-level pela lei nº 1, e aqui ela é literal — quem escreve neste
 * store é um menu que vive no rodapé de uma coluna, e quem lê é o pontinho no
 * meu avatar. Não há árvore de componente entre os dois.
 *
 * ⚠ **Separado do store efêmero de presença, e a separação é obrigatória.**
 * `presence` é keyed por ID de usuário e alimentado pelo firehose — é o estado
 * de MILHARES de pessoas, atualizado dezenas de vezes por segundo, e 55% da
 * carga do gate. O meu status muda por clique humano, algumas vezes por dia, e
 * carrega uma coisa que o outro não sabe representar: `invisivel`.
 *
 * Escrevê-lo lá dentro custaria a `PresenceStatus` uma quinta variante que só
 * uma pessoa em milhares pode ter, e faria o pontinho de todo mundo assinar um
 * store que muda quando EU troco de status.
 *
 * O valor é um objeto e a referência é cacheada — armadilha nº 1 do briefing.
 */
export type MeuStatus = {
  readonly presenca: PresencaEscolhida;
  /** Vazio é ausência, não string vazia. */
  readonly texto: string | undefined;
};

const INICIAL: MeuStatus = { presenca: "online", texto: undefined };

/** Referência cacheada. Montar o objeto no getter = loop de render. */
let atual: MeuStatus = INICIAL;

const ouvintes = new Set<() => void>();

export function assinarMeuStatus(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerMeuStatus(): MeuStatus {
  return atual;
}

function publicar(novo: MeuStatus): void {
  // Comparação campo a campo antes de trocar a referência: sem isto, semear o
  // mesmo valor que já vale acordaria o avatar à toa a cada `Ready`.
  if (novo.presenca === atual.presenca && novo.texto === atual.texto) return;
  atual = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * Escreve a escolha localmente.
 *
 * Otimista de propósito, como a reação e o fixar: o pontinho acende no clique
 * e o servidor confirma no evento seguinte. Sem isso, escolher "não perturbe"
 * teria um quadro de latência em que a interface ainda diz "online" — e o que
 * a pessoa quer nesse momento é justamente a certeza de que parou de aparecer
 * disponível.
 *
 * ⚠ **Sem rollback em caso de erro**, pela mesma razão registrada em
 * `reacoes`: o servidor reenvia o estado no próximo evento do usuário, e um
 * rollback correndo contra esse evento faz o pontinho piscar duas vezes.
 */
export function definirMeuStatusLocal(presenca: PresencaEscolhida): void {
  publicar({ ...atual, presenca });
}

export function definirMeuTextoLocal(texto: string | undefined): void {
  publicar({ ...atual, texto: texto?.trim() || undefined });
}

/** Semeia do que o servidor mandou no `Ready`. Não é escolha, é leitura. */
export function semearMeuStatus(status: MeuStatus): void {
  publicar(status);
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparMeuStatus(): void {
  atual = INICIAL;
}
