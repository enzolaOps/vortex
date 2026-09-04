import { abrirModal, fecharModal } from "./modais";
import type { Resolucao, Taxa } from "../sdk/seletorDeTela";

/**
 * O pedido de escolha de tela, em voo.
 *
 * ⚠ **Store com PROMESSA, e é o único do projeto assim.** Os outros modais são
 * disparados por um clique e terminam ali; este é perguntado pelo motor de voz,
 * que precisa da resposta para continuar — sem ela não há o que passar ao
 * `getDisplayMedia`. O `resolver` guardado é o que transforma um modal numa
 * pergunta.
 *
 * ⚠ **A promessa resolve SEMPRE, com `undefined` no cancelamento.** Rejeitar
 * obrigaria o chamador a um `try/catch` para um caminho que não é erro —
 * desistir de compartilhar é uso normal. É a mesma escolha de `enviarMensagem`
 * devolvendo `undefined` em vez de lançar.
 */
export type EscolhaDeTela = {
  readonly fonteId: string;
  readonly audio: boolean;
  readonly resolucao: Resolucao;
  readonly taxa: Taxa;
};

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

/** Referência cacheada — armadilha nº 1. */
let pendente: { readonly aberto: boolean } = { aberto: false };
let resolver: ((e: EscolhaDeTela | undefined) => void) | undefined;

export function assinarSeletorDeTela(o: Ouvinte): () => void {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function lerSeletorDeTela(): { readonly aberto: boolean } {
  return pendente;
}

function publicar(aberto: boolean): void {
  if (aberto === pendente.aberto) return;
  pendente = { aberto };
  for (const o of ouvintes) o();
}

/**
 * Abre o seletor e espera a escolha.
 *
 * ⚠ **Um pedido por vez.** Se já houver um em voo, o novo é recusado na hora
 * em vez de enfileirado: dois seletores abertos disputariam o mesmo
 * `getDisplayMedia`, e o segundo a responder armaria uma fonte que o primeiro
 * pedido já teria consumido.
 */
export function pedirEscolhaDeTela(): Promise<EscolhaDeTela | undefined> {
  if (resolver) return Promise.resolve(undefined);

  publicar(true);
  abrirModal("tela");

  return new Promise((r) => {
    resolver = r;
  });
}

/**
 * Responde o pedido em voo.
 *
 * `undefined` = cancelou. Fechar o modal por `Esc` ou pelo véu passa por aqui
 * com `undefined`, e é o que garante que o motor não fique esperando para
 * sempre por uma resposta que ninguém vai dar.
 */
export function responderEscolhaDeTela(e: EscolhaDeTela | undefined): void {
  const r = resolver;
  resolver = undefined;
  publicar(false);
  fecharModal();
  r?.(e);
}
