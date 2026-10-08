import type { SistemaSnapshot } from "./domain";

/**
 * Fusão de linhas de sistema seguidas do mesmo tipo: cinco "entrou" em fila
 * viram UMA linha ("Ana e mais 4 entraram"), em vez de cinco frases quase
 * idênticas.
 *
 * Mora no domínio, e não no componente, porque a fusão decide QUAIS linhas
 * existem na lista — a lista é virtualizada e o índice de cada linha tem de
 * ser o da lista que o virtualizador enxerga. As linhas absorvidas não são
 * renderizadas com altura zero (linha medindo 0px realimenta o virtualizador):
 * elas saem da lista visível.
 */

/** O que a fusão precisa saber de uma linha; `undefined` = mensagem não resolvida. */
export type LinhaParaFundir =
  | {
      readonly sistema: SistemaSnapshot | undefined;
      readonly dia: string | undefined;
      readonly primeiraNaoLida: boolean;
    }
  | undefined;

/**
 * Chave de fusão: duas linhas só se fundem se a chave for igual. `undefined`
 * = nunca funde (renomear, fixar, chamada… cada uma é um fato próprio).
 * Adicionar/remover precisa ser do MESMO autor: "Ana adicionou X" e "Bruno
 * adicionou Y" não são uma frase só.
 */
export function chaveDeFusao(s: SistemaSnapshot): string | undefined {
  switch (s.tipo) {
    case "entrou":
    case "saiu":
    case "expulso":
    case "banido":
      return s.tipo;
    case "adicionou":
    case "removeu":
      return `${s.tipo}:${s.porId}`;
    default:
      return undefined;
  }
}

/** A pessoa de que o fato trata, para as tipos que se fundem. */
function pessoaDe(s: SistemaSnapshot): string | undefined {
  switch (s.tipo) {
    case "entrou":
    case "saiu":
    case "expulso":
    case "banido":
    case "adicionou":
    case "removeu":
      return s.userId;
    default:
      return undefined;
  }
}

export type ListaAgrupada = {
  /** Os IDs que a lista renderiza: sem as linhas absorvidas. */
  readonly visiveis: readonly string[];
  /** ID da linha que abre a fusão → todas as pessoas do grupo, em ordem (a primeira inclusa). */
  readonly grupos: ReadonlyMap<string, readonly string[]>;
};

const SEM_GRUPOS: ReadonlyMap<string, readonly string[]> = new Map();

/**
 * `anterior` reaproveita a referência do array de um grupo que não mudou: a
 * linha é `memo` e compara a prop por referência, então um array novo com o
 * mesmo conteúdo acordaria todas as linhas de fusão a cada publicação.
 *
 * Sem nenhuma fusão devolve o PRÓPRIO `ids` (mesma referência) e um mapa vazio
 * compartilhado: o caso comum não aloca nada.
 */
export function agruparSistema(
  ids: readonly string[],
  ler: (id: string) => LinhaParaFundir,
  anterior?: ReadonlyMap<string, readonly string[]>,
): ListaAgrupada {
  let visiveis: string[] | undefined;
  let grupos: Map<string, string[]> | undefined;
  let cabeca: string | undefined;
  let chave: string | undefined;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i] as string;
    const linha = ler(id);
    const s = linha?.sistema;
    const k = s === undefined ? undefined : chaveDeFusao(s);
    const pessoa = s === undefined ? undefined : pessoaDe(s);

    const continua =
      cabeca !== undefined &&
      k !== undefined &&
      k === chave &&
      pessoa !== undefined &&
      linha !== undefined &&
      linha.dia === undefined &&
      !linha.primeiraNaoLida;

    if (continua && cabeca !== undefined && pessoa !== undefined) {
      if (visiveis === undefined) visiveis = ids.slice(0, i);
      grupos ??= new Map();
      let g = grupos.get(cabeca);
      if (g === undefined) {
        const s0 = ler(cabeca)?.sistema;
        g = [s0 === undefined ? "" : (pessoaDe(s0) ?? "")];
        grupos.set(cabeca, g);
      }
      g.push(pessoa);
      continue;
    }

    visiveis?.push(id);
    if (k !== undefined) {
      cabeca = id;
      chave = k;
    } else {
      cabeca = undefined;
      chave = undefined;
    }
  }

  if (visiveis === undefined || grupos === undefined) return { visiveis: ids, grupos: SEM_GRUPOS };

  // Estabiliza as referências: o mesmo conteúdo devolve o mesmo array.
  for (const [id, g] of grupos) {
    const antes = anterior?.get(id);
    if (antes !== undefined && antes.length === g.length && antes.every((u, j) => u === g[j])) {
      grupos.set(id, antes as string[]);
    }
  }
  return { visiveis, grupos };
}
