/**
 * A chamada de voz em andamento.
 *
 * Store module-level, lei nº 1: quem muda isto é um evento do LiveKit, e
 * nenhum deles está numa árvore de componentes.
 *
 * ⚠ **Duas velocidades, dois stores, e essa separação é a razão de este
 * arquivo existir.** A LISTA de quem está na chamada muda por ação humana —
 * alguém entra, alguém sai — e cabe num store normal. **Quem está FALANDO
 * muda dezenas de vezes por segundo**, e é o estado efêmero que a lei nº 1
 * nomeia. Misturar os dois faria a coluna inteira repintar a cada sílaba.
 *
 * O `CLAUDE.md` registrou esse risco antes de a etapa existir: *"canal de voz
 * movimentado repinta a coluna inteira"*. É o único aviso do plano que descreve
 * um defeito de performance que ainda não aconteceu.
 */
import { createEphemeralStore } from "./ephemeral";

/**
 * Onde a chamada está.
 *
 * `conectando` é estado próprio e não um sinalizador: entrar numa sala leva
 * segundos de rede, e uma interface que não distingue "entrando" de "dentro"
 * faz a pessoa clicar de novo achando que não pegou.
 */
export type EstadoDaChamada =
  | "fora"
  | "conectando"
  | "dentro"
  | "reconectando";

/**
 * A qualidade da conexão de voz, como o LiveKit a reporta.
 *
 * ⚠ **Isto não é latência em milissegundos, e a diferença importa.** O design
 * mostra "Conectado · 42 ms"; o LiveKit expõe `ConnectionQuality`, que é uma
 * classificação (`excellent | good | poor | lost`) e não um número. Inventar
 * um número a partir dela seria pior que não mostrá-lo: um "42 ms" derivado de
 * "good" é dado falso numa superfície onde a pessoa toma decisão — sair da
 * chamada, trocar de rede.
 *
 * `desconhecida` é o estado antes do primeiro relatório, e não um erro: a sala
 * leva alguns segundos para medir.
 */
export type QualidadeDeVoz = "otima" | "boa" | "ruim" | "perdida" | "desconhecida";

export type Chamada = {
  readonly estado: EstadoDaChamada;
  readonly qualidade: QualidadeDeVoz;
  /** Em qual canal. Vazio quando `fora`. */
  readonly channelId: string;
  /** Quem está na sala, incluindo você. */
  readonly participantes: readonly string[];
  readonly mudo: boolean;
  readonly surdo: boolean;
  readonly camera: boolean;
  readonly tela: boolean;
};

const VAZIA: Chamada = {
  estado: "fora",
  qualidade: "desconhecida",
  channelId: "",
  participantes: [],
  mudo: false,
  surdo: false,
  camera: false,
  tela: false,
};

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

/** Referência cacheada — armadilha nº 1. */
let chamada: Chamada = VAZIA;

export function assinarChamada(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerChamada(): Chamada {
  return chamada;
}

export function definirChamada(mudanca: Partial<Chamada>): void {
  const nova = { ...chamada, ...mudanca };
  /*
    Compara campo a campo antes de publicar.

    O LiveKit emite `participantsChanged` a cada mudança de faixa, e a maioria
    não muda a lista. Sem esta comparação, cada uma acordaria o cartão de
    chamada e a coluna de canais — que é a coluna que a lei nº 1 mais protege.
  */
  if (
    nova.estado === chamada.estado &&
    nova.qualidade === chamada.qualidade &&
    nova.channelId === chamada.channelId &&
    nova.mudo === chamada.mudo &&
    nova.surdo === chamada.surdo &&
    nova.camera === chamada.camera &&
    nova.tela === chamada.tela &&
    nova.participantes.length === chamada.participantes.length &&
    nova.participantes.every((p, i) => p === chamada.participantes[i])
  ) {
    return;
  }
  chamada = nova;
  for (const ouvinte of ouvintes) ouvinte();
}

/* ------------------------------------------------- mudo e surdo: a REGRA */

/**
 * Alternar mudo, e devolver o valor novo para quem precisa aplicá-lo.
 *
 * ⚠ **A regra mora AQUI e não no motor, e a mudança de lugar tem razão.**
 * Mudo e surdo são PREFERÊNCIA, não estado de transporte: valem antes de
 * entrar na sala, sobrevivem a sair dela, e são o que `entrarNaChamada` lê
 * para decidir se abre o microfone. O motor só as APLICA no LiveKit.
 *
 * A separação passou a importar quando o painel de usuário ganhou os botões:
 * fora da chamada não há motor carregado — e carregar meio megabyte de WebRTC
 * para virar um booleano seria absurdo. Com a regra no store, os dois lados
 * chamam a mesma função e só o de dentro toca a faixa de áudio.
 */
export function alternarMudoNoStore(): boolean {
  const mudo = !chamada.mudo;
  definirChamada({ mudo });
  return mudo;
}

/**
 * Ensurdecer também emudece.
 *
 * Quem não está ouvindo não deve continuar falando: é a convenção de todo
 * cliente de voz, e a razão é social — falar sem ouvir a resposta atropela a
 * conversa. Desensurdecer NÃO desfaz o mudo automaticamente: se a pessoa já
 * estava muda antes, voltar a transmitir seria uma decisão que ela não tomou.
 *
 * A regra estava escrita dentro do motor. Duplicá-la para o caminho de fora da
 * chamada daria duas cópias que precisam concordar, e a que diverge é sempre a
 * que ninguém abriu naquela semana.
 */
export function alternarSurdoNoStore(): { surdo: boolean; mudo: boolean } {
  const surdo = !chamada.surdo;
  const mudo = surdo ? true : chamada.mudo;
  definirChamada({ surdo, mudo });
  return { surdo, mudo };
}

export function encerrarChamada(): void {
  if (chamada.estado === "fora") return;
  chamada = VAZIA;
  for (const ouvinte of ouvintes) ouvinte();
}

/* ------------------------------------------------------- quem está falando */

/**
 * O anel de fala.
 *
 * **Store efêmero, com throttle de 120ms na fronteira** — o mesmo de presença
 * e digitação, e pela mesma razão elevada ao quadrado: o LiveKit calcula nível
 * de áudio continuamente, e `activeSpeakersChanged` chega várias vezes por
 * segundo por pessoa numa sala movimentada.
 *
 * Keyed por usuário: quem assina é o avatar daquela pessoa, e ninguém mais
 * acorda quando ela começa a falar. É a lei nº 1 na granularidade mais fina
 * que o app tem.
 */
export const falando = createEphemeralStore<boolean>();

/**
 * Publica quem está falando agora.
 *
 * Recebe a lista INTEIRA e apaga quem saiu dela — o LiveKit manda o conjunto
 * ativo, não deltas. Sem apagar, o anel ficaria aceso para sempre em quem
 * falou uma vez.
 */
let ultimosFalantes: readonly string[] = [];

export function definirFalantes(ids: readonly string[]): void {
  for (const id of ultimosFalantes) {
    if (!ids.includes(id)) falando.set(id, false);
  }
  for (const id of ids) falando.set(id, true);
  ultimosFalantes = ids;
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparChamada(): void {
  chamada = VAZIA;
  ultimosFalantes = [];
}
