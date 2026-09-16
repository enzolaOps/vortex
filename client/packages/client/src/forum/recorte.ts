import type { TopicoSnapshot } from "../sdk/domain";

/**
 * O recorte da tela do fórum: busca, tag e ordem sobre os posts do canal.
 *
 * Função pura, fora do componente, porque é aqui que a tela decide o que
 * EXISTE na lista — e é a parte que quebra em silêncio: uma ordem errada
 * renderiza, só que mente.
 */

export type OrdemDoForum = "recentes" | "ativos" | "novos";

export type Recorte = {
  readonly ids: readonly string[];
  /**
   * Quantos dos primeiros `ids` são fixados. Só em "Recentes" sem filtro,
   * que é a única vista em que o topo é o topo do fórum — com busca, tag ou
   * outra ordem, "Fixados" seria um rótulo sobre uma posição que não é dele.
   */
  readonly fixados: number;
};

export function recortarForum(
  ids: readonly string[],
  ler: (id: string) => TopicoSnapshot | undefined,
  { busca, tag, ordem }: { busca: string; tag: string | undefined; ordem: OrdemDoForum },
): Recorte {
  const termo = busca.trim().toLowerCase();
  const visiveis: TopicoSnapshot[] = [];
  for (const id of ids) {
    const t = ler(id);
    if (!t) continue;
    if (tag !== undefined && !t.tags.includes(tag)) continue;
    if (
      termo !== "" &&
      !t.nome.toLowerCase().includes(termo) &&
      !(t.abertura?.texto.toLowerCase().includes(termo) ?? false)
    ) {
      continue;
    }
    visiveis.push(t);
  }

  if (ordem === "ativos") {
    // Estável: empate mantém a última atividade, que é a ordem de chegada.
    visiveis.sort((a, b) => (b.respostas ?? 0) - (a.respostas ?? 0));
    return { ids: visiveis.map((t) => t.id), fixados: 0 };
  }
  if (ordem === "novos") {
    // ULID ordena por criação — mais novo primeiro.
    visiveis.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    return { ids: visiveis.map((t) => t.id), fixados: 0 };
  }

  // "Recentes": fixados no topo, cada grupo na ordem de última atividade que
  // a lista do canal já traz.
  const fixados = visiveis.filter((t) => t.fixado);
  const soltos = visiveis.filter((t) => !t.fixado);
  const semFiltro = termo === "" && tag === undefined;
  return {
    ids: [...fixados, ...soltos].map((t) => t.id),
    fixados: semFiltro ? fixados.length : 0,
  };
}
