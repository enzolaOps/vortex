import {
  buscarNoCanal,
  buscarNoServidor,
  POR_PAGINA,
  type OrdemDeBusca,
  type ResultadoDeBusca,
} from "../sdk/busca";

/**
 * O estado do painel de busca.
 *
 * Store module-level com `useSyncExternalStore`, lei nº 1: quem dispara uma
 * busca é o campo do painel, quem a lê é o painel E a timeline — que precisa
 * saber qual resultado está selecionado para destacá-lo e para mostrar
 * "Voltar ao presente". Duas árvores diferentes, um estado.
 *
 * ⚠ **A seleção mora AQUI e não na lista de mensagens.** Ela é o que liga as
 * duas superfícies: o cartão selecionado no painel e a linha realçada na
 * timeline são o mesmo dado. Guardá-la na lista faria o painel ter de
 * empurrá-la para lá a cada clique, e as duas divergiriam ao trocar de canal.
 */

/**
 * Onde a busca procura.
 *
 * `servidor` é do fork (`POST /servers/{id}/search`). Ele não muda o que a
 * tela desenha — cada cartão já carrega o canal de origem —, muda de onde a
 * página vem e o que acontece ao trocar de canal (ver `apontarBuscaPara`).
 */
export type EscopoDeBusca = "canal" | "servidor";

export type EstadoDeBusca = {
  readonly channelId: string | undefined;
  /** Servidor do canal apontado; `undefined` em DM, onde só existe `canal`. */
  readonly serverId: string | undefined;
  readonly escopo: EscopoDeBusca;
  readonly consulta: string;
  readonly ordem: OrdemDeBusca;
  readonly resultados: readonly ResultadoDeBusca[];
  /** `undefined` = nenhuma busca feita ainda; a tela mostra o convite. */
  readonly total: number | undefined;
  readonly buscando: boolean;
  /** 1-based, como o design numera. */
  readonly pagina: number;
  /** O resultado aberto na timeline, se houver. */
  readonly selecionado: string | undefined;
};

const VAZIO: EstadoDeBusca = {
  channelId: undefined,
  serverId: undefined,
  escopo: "canal",
  consulta: "",
  ordem: "recentes",
  resultados: [],
  total: undefined,
  buscando: false,
  pagina: 1,
  selecionado: undefined,
};

let estado = VAZIO;

/**
 * A pilha de cursores.
 *
 * ⚠ Fora do snapshot de propósito: ela é maquinário do protocolo (o `before`
 * de cada página), não estado que a tela desenha. No snapshot, cada `push`
 * trocaria a referência e acordaria o painel inteiro por um dado que nenhum
 * componente lê.
 */
let cursores: string[] = [];

const ouvintes = new Set<() => void>();

export function assinarBusca(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência cacheada — armadilha nº 1. */
export function lerBusca(): EstadoDeBusca {
  return estado;
}

function publicar(mudanca: Partial<EstadoDeBusca>): void {
  estado = { ...estado, ...mudanca };
  for (const o of ouvintes) o();
}

export function definirConsulta(consulta: string): void {
  publicar({ consulta });
}

/**
 * Troca a ordem e REFAZ a busca.
 *
 * Trocar a ordem sem refazer deixaria a lista antiga com o botão novo
 * marcado — a interface afirmando uma ordenação que os resultados na tela não
 * têm.
 */
export function definirOrdem(ordem: OrdemDeBusca): void {
  publicar({ ordem });
  if (estado.consulta.trim().length > 0) void executar(1);
}

/**
 * Abre o painel para um canal.
 *
 * ⚠ Trocar de canal LIMPA tudo, e não é zelo: os resultados carregam o nome do
 * canal de origem e o "Pular para mensagem" pede um salto naquele canal. Manter
 * a lista ao mudar de canal daria um painel que pula para outro lugar.
 */
export function apontarBuscaPara(
  channelId: string | undefined,
  serverId: string | undefined,
): void {
  if (estado.channelId === channelId && estado.serverId === serverId) return;
  /*
    ⚠ **Em escopo de SERVIDOR, trocar de canal dentro do mesmo servidor NÃO
    limpa** — e é o caso comum, não a exceção: "Pular para mensagem" num
    resultado de outro canal ABRE aquele canal, e limpar ali apagaria a lista
    no exato clique que a usou. Os resultados continuam válidos, porque cada
    um carrega o próprio canal.
  */
  if (
    estado.escopo === "servidor" &&
    serverId !== undefined &&
    estado.serverId === serverId
  ) {
    publicar({ channelId });
    return;
  }
  cursores = [];
  estado = { ...VAZIO, channelId, serverId };
  for (const o of ouvintes) o();
}

/**
 * Troca o escopo e REFAZ a busca, pela mesma razão de `definirOrdem`: a lista
 * antiga sob o rótulo novo afirmaria uma busca que ninguém fez.
 */
export function definirEscopo(escopo: EscopoDeBusca): void {
  if (escopo === "servidor" && estado.serverId === undefined) return;
  if (estado.escopo === escopo) return;
  cursores = [];
  publicar({ escopo, resultados: [], total: undefined, pagina: 1, selecionado: undefined });
  if (estado.consulta.trim().length > 0) void executar(1);
}

export function selecionarResultado(id: string | undefined): void {
  publicar({ selecionado: id });
}

/**
 * Roda a busca para uma página.
 *
 * ⚠ **A página só é alcançável em ordem**, porque o protocolo pagina por
 * CURSOR e não por número: ele sabe "antes desta mensagem", não "a terceira
 * página". A pilha guarda o cursor de cada página já visitada, e é o que
 * permite os números 1·2·3 do design — voltar é instantâneo, avançar é uma
 * chamada. É a limitação real, e ela coincide com o desenho.
 */
export async function executar(pagina: number): Promise<void> {
  const { channelId, serverId, escopo, consulta, ordem } = estado;
  const limpa = consulta.trim();
  if (channelId === undefined || limpa.length === 0) return;
  if (escopo === "servidor" && serverId === undefined) return;

  if (pagina === 1) cursores = [];
  const antesDe = pagina > 1 ? cursores[pagina - 2] : undefined;
  if (pagina > 1 && antesDe === undefined) return;

  publicar({ buscando: true });
  const r =
    escopo === "servidor" && serverId !== undefined
      ? await buscarNoServidor({ serverId, consulta: limpa, ordem, antesDe })
      : await buscarNoCanal({ channelId, consulta: limpa, ordem, antesDe });

  /*
    A resposta pode chegar depois de a pessoa trocar de escopo ou de servidor.
    Aplicá-la escreveria resultados de uma busca que já não é a da tela.
  */
  if (
    estado.escopo !== escopo ||
    estado.serverId !== serverId ||
    (escopo === "canal" && estado.channelId !== channelId)
  ) {
    return;
  }

  if (r === undefined) {
    publicar({ buscando: false });
    return;
  }

  /*
    O cursor da PRÓXIMA página é o último ID desta. Guardado por índice para
    que voltar não refaça a conta — e só quando a página veio cheia: página
    curta é a última, e oferecer um "próxima" que devolve vazio é o botão que
    ensina a não confiar na paginação.
  */
  const ultimo = r[r.length - 1];
  if (r.length === POR_PAGINA && ultimo) cursores[pagina - 1] = ultimo.id;
  else cursores.length = Math.max(0, pagina - 1);

  publicar({
    resultados: r,
    /*
      ⚠ **`total` é o que ESTA página trouxe, e a tela diz "N nesta página"** —
      não "N resultados". O protocolo não devolve contagem total, e inventar
      uma somando páginas visitadas daria um número que encolhe quando a pessoa
      volta. Mesma disciplina do "Conectado · 42 ms" que a faixa de voz
      recusou.
    */
    total: r.length,
    buscando: false,
    pagina,
    selecionado: undefined,
  });
}

/** Quantas páginas a pilha já conhece — o design mostra 1·2·3. */
export function paginasConhecidas(): number {
  return cursores.length + 1;
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparBusca(): void {
  cursores = [];
  estado = VAZIO;
}
