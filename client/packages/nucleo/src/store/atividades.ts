/**
 * Atividades compartilhadas numa sala de voz.
 *
 * ⚠ **Duas velocidades, dois mecanismos — a mesma divisão da voz.** Que
 * atividade está aberta num canal muda por ação humana (começar, encerrar) e é
 * SNAPSHOT: store keyed por canal, `useSyncExternalStore`. O que acontece
 * DENTRO dela — cada traço de um quadro — é FLUXO: não vira snapshot, não
 * acorda componente nenhum, e vai direto para o host embutido por ouvinte.
 * Publicar cada traço como snapshot re-renderizaria o ladrilho a cada
 * movimento de caneta, e o iframe dentro dele junto.
 *
 * O registro de operações é mantido aqui para quem abre o ladrilho depois de
 * a atividade começar: o host recebe o registro inteiro ao carregar, e daí em
 * diante só o fluxo.
 */

export type OperacaoDeAtividade = {
  readonly usuario: string;
  /** Unix ms, no relógio do servidor. */
  readonly em: number;
  /** Carga opaca — texto JSON que só o host da atividade interpreta. */
  readonly op: string;
  /** Substituiu o registro (estado compactado pelo host). */
  readonly snapshot: boolean;
};

export type SessaoDeAtividade = {
  readonly id: string;
  readonly channelId: string;
  readonly tipo: string;
  readonly anfitriao: string;
  readonly iniciadaEm: number;
};

/** Teto do registro guardado aqui — o mesmo do servidor. */
export const TETO_DO_REGISTRO = 500;

/** Tamanho máximo de uma operação, em bytes UTF-8 — o mesmo do servidor. */
export const TETO_DA_OPERACAO = 4096;

type Ouvinte = () => void;
type OuvinteDeOperacao = (op: OperacaoDeAtividade) => void;

const sessoes = new Map<string, SessaoDeAtividade>();
const registros = new Map<string, OperacaoDeAtividade[]>();
const ouvintes = new Map<string, Set<Ouvinte>>();
const ouvintesDeOperacao = new Map<string, Set<OuvinteDeOperacao>>();
const assinantes = new Map<string, (o: Ouvinte) => () => void>();

function conjunto<T>(mapa: Map<string, Set<T>>, chave: string): Set<T> {
  let c = mapa.get(chave);
  if (!c) {
    c = new Set();
    mapa.set(chave, c);
  }
  return c;
}

export function lerSessao(channelId: string): SessaoDeAtividade | undefined {
  return sessoes.get(channelId);
}

/** Assinatura cacheada por canal — referência estável para o React. */
export function assinarSessao(channelId: string) {
  const pronto = assinantes.get(channelId);
  if (pronto) return pronto;
  const nova = (o: Ouvinte) => {
    conjunto(ouvintes, channelId).add(o);
    return () => {
      ouvintes.get(channelId)?.delete(o);
    };
  };
  assinantes.set(channelId, nova);
  return nova;
}

/**
 * Troca a sessão do canal. A MESMA sessão (mesmo ID) não emite nem apaga o
 * registro: `start` devolve a existente quando duas pessoas clicam juntas, e
 * zerar o quadro de quem já desenhava seria o pior resultado possível.
 */
export function definirSessao(
  channelId: string,
  sessao: SessaoDeAtividade | undefined,
  registro: readonly OperacaoDeAtividade[] = [],
): void {
  const atual = sessoes.get(channelId);
  if (atual?.id === sessao?.id) return;
  if (sessao) {
    sessoes.set(channelId, sessao);
    registros.set(channelId, registro.slice(-TETO_DO_REGISTRO));
  } else {
    sessoes.delete(channelId);
    registros.delete(channelId);
  }
  for (const o of ouvintes.get(channelId) ?? []) o();
}

/**
 * Uma operação chegou. Ignorada se for de uma sessão que não é a atual —
 * evento atrasado de uma atividade encerrada não pode cair na seguinte.
 */
export function anexarOperacao(
  channelId: string,
  atividadeId: string,
  op: OperacaoDeAtividade,
): void {
  if (sessoes.get(channelId)?.id !== atividadeId) return;
  const r = registros.get(channelId) ?? [];
  if (op.snapshot) r.length = 0;
  r.push(op);
  if (r.length > TETO_DO_REGISTRO) r.splice(0, r.length - TETO_DO_REGISTRO);
  registros.set(channelId, r);
  for (const o of ouvintesDeOperacao.get(channelId) ?? []) o(op);
}

/** Cópia do registro, para o host que carrega depois. */
export function lerRegistro(channelId: string): readonly OperacaoDeAtividade[] {
  return [...(registros.get(channelId) ?? [])];
}

export function assinarOperacoes(
  channelId: string,
  ouvinte: OuvinteDeOperacao,
): () => void {
  conjunto(ouvintesDeOperacao, channelId).add(ouvinte);
  return () => {
    ouvintesDeOperacao.get(channelId)?.delete(ouvinte);
  };
}

/** Estado limpo entre testes. */
export function limparAtividades(): void {
  sessoes.clear();
  registros.clear();
}
