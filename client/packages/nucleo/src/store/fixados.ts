import { buscarFixadas } from "../sdk/fixados";

/**
 * O painel de fixados e a lista de fixadas de cada canal.
 *
 * Store module-level com `useSyncExternalStore` (lei nº 1): quem muda a lista é
 * o evento de fixar/desafixar, que não está em árvore de componente nenhuma.
 *
 * ⚠ **A lista é buscada UMA vez por canal e depois mantida pelos eventos.**
 * `Channel.search` é a única fonte de fixadas ANTIGAS (a lista de mensagens só
 * conhece a janela que carregou), mas refazê-la a cada fixar/desafixar seria
 * uma chamada por evento. Fixar acrescenta o ID, desafixar e apagar o tiram.
 * Evento que chega ENQUANTO a busca está em voo é guardado e aplicado sobre a
 * resposta — senão a resposta, mais velha que o evento, o desfaria.
 */

export type StatusDaCarga = "carregando" | "pronta" | "erro";

export type CargaDeFixadas = {
  readonly status: StatusDaCarga;
  /** Do mais novo para o mais antigo (ULID: ordem de texto é ordem de tempo). */
  readonly ids: readonly string[];
  /** Há mais páginas que o botão "carregar mais" busca. */
  readonly temMais: boolean;
  readonly carregandoMais: boolean;
};

export type EstadoDeFixados = {
  readonly aberto: boolean;
  readonly channelId: string | undefined;
  /** O item que a pessoa abriu na timeline. */
  readonly selecionado: string | undefined;
  readonly cargas: Readonly<Record<string, CargaDeFixadas>>;
};

const VAZIO: EstadoDeFixados = { aberto: false, channelId: undefined, selecionado: undefined, cargas: {} };

let estado = VAZIO;
const ouvintes = new Set<() => void>();
/** Qual busca vale, por canal: resposta de uma busca invalidada é ignorada. */
const geracoes = new Map<string, number>();
/** Eventos que chegaram com a busca em voo: id → fixada? */
const durante = new Map<string, Map<string, boolean>>();

export function assinarFixados(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência cacheada — armadilha nº 1. */
export function lerFixados(): EstadoDeFixados {
  return estado;
}

function publicar(mudanca: Partial<EstadoDeFixados>): void {
  estado = { ...estado, ...mudanca };
  for (const o of ouvintes) o();
}

function escreverCarga(channelId: string, carga: CargaDeFixadas): void {
  publicar({ cargas: { ...estado.cargas, [channelId]: carga } });
}

function inserir(ids: readonly string[], id: string): readonly string[] {
  if (ids.includes(id)) return ids;
  return [...ids, id].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

function aplicarEmLista(
  ids: readonly string[],
  aplicados: ReadonlyMap<string, boolean>,
): readonly string[] {
  let saida = ids;
  for (const [id, fixada] of aplicados) {
    saida = fixada ? inserir(saida, id) : saida.filter((x) => x !== id);
  }
  return saida;
}

export function abrirFixados(channelId: string): void {
  if (estado.channelId !== channelId) publicar({ channelId, selecionado: undefined });
  if (!estado.aberto) publicar({ aberto: true });
}

export function fecharFixados(): void {
  if (!estado.aberto) return;
  publicar({ aberto: false });
}

export function selecionarFixada(id: string | undefined): void {
  publicar({ selecionado: id });
}

/**
 * Carrega a lista do canal se ainda não há (ou se a última tentativa falhou).
 * `forcar` refaz mesmo com lista pronta — a volta da conexão, que pode ter
 * perdido eventos —, sem esvaziar a tela enquanto isso.
 */
export async function carregarFixadas(channelId: string, forcar = false): Promise<void> {
  const atual = estado.cargas[channelId];
  if (atual?.status === "carregando") return;
  if (atual?.status === "pronta" && !forcar) return;

  const geracao = (geracoes.get(channelId) ?? 0) + 1;
  geracoes.set(channelId, geracao);
  durante.set(channelId, new Map());
  if (atual?.status !== "pronta") {
    escreverCarga(channelId, { status: "carregando", ids: [], temMais: false, carregandoMais: false });
  }
  const pagina = await buscarFixadas(channelId);
  if (geracoes.get(channelId) !== geracao) return;
  const eventos = durante.get(channelId) ?? new Map<string, boolean>();
  durante.delete(channelId);

  if (pagina === undefined) {
    /* Refresh silencioso que falha mantém a lista que a tela já tem. */
    if (atual?.status !== "pronta") {
      escreverCarga(channelId, { status: "erro", ids: [], temMais: false, carregandoMais: false });
    }
    return;
  }
  escreverCarga(channelId, {
    status: "pronta",
    ids: aplicarEmLista(pagina.ids, eventos),
    temMais: pagina.temMais,
    carregandoMais: false,
  });
}

/** A página seguinte, acrescentada à lista (botão, sem scroll infinito). */
export async function carregarMaisFixadas(channelId: string): Promise<void> {
  const atual = estado.cargas[channelId];
  if (atual?.status !== "pronta" || !atual.temMais || atual.carregandoMais) return;
  const geracao = geracoes.get(channelId) ?? 0;
  const ultimo = atual.ids[atual.ids.length - 1];
  escreverCarga(channelId, { ...atual, carregandoMais: true });
  const pagina = await buscarFixadas(channelId, ultimo);
  if (geracoes.get(channelId) !== geracao) return;
  const agora = estado.cargas[channelId];
  if (agora?.status !== "pronta") return;
  if (pagina === undefined) {
    escreverCarga(channelId, { ...agora, carregandoMais: false });
    return;
  }
  const jaTem = new Set(agora.ids);
  escreverCarga(channelId, {
    ...agora,
    ids: [...agora.ids, ...pagina.ids.filter((id) => !jaTem.has(id))],
    temMais: pagina.temMais,
    carregandoMais: false,
  });
}

/**
 * Alguém (ou eu) fixou/desafixou. Mantém a lista sem refazer a busca.
 * Sem lista carregada para o canal não há o que manter: a primeira abertura busca.
 */
export function aplicarFixacao(channelId: string, id: string, fixada: boolean): void {
  const emVoo = durante.get(channelId);
  if (emVoo) emVoo.set(id, fixada);
  const atual = estado.cargas[channelId];
  if (atual?.status !== "pronta") return;
  const ids = fixada ? inserir(atual.ids, id) : atual.ids.filter((x) => x !== id);
  if (ids.length === atual.ids.length) return;
  escreverCarga(channelId, { ...atual, ids });
}

/** A mensagem foi apagada: sai da lista como se tivesse sido desafixada. */
export function removerFixada(channelId: string, id: string): void {
  aplicarFixacao(channelId, id, false);
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparFixados(): void {
  geracoes.clear();
  durante.clear();
  estado = VAZIO;
}
