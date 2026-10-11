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

/**
 * Versão INCREMENTAL de `agruparSistema`, com resultado idêntico.
 *
 * A fusão é uma máquina de estados da esquerda para a direita cuja única
 * memória é a corrida de sistema em andamento. Logo, depois de uma mudança em
 * `ids`, só precisa ser reavaliado o trecho que mudou:
 *  - prefixo comum: nada a refazer; se uma corrida estava aberta no fim dele, é
 *    RETOMADA (cabeça e grupo vêm do estado guardado, uma leitura de `ler`);
 *  - trecho alterado: reavaliado;
 *  - sufixo comum: reaproveitado assim que a máquina volta a "sem corrida" nos
 *    dois lados (o resultado dali em diante depende só do estado de entrada).
 *
 * Append reavalia só o que chegou; prepend, o que chegou e a corrida do ponto
 * de junção; edição/remoção, a vizinhança. O custo em `ler` e em classificação
 * é proporcional ao trecho. Sobra a comparação de IDs por referência para achar
 * prefixo e sufixo (comparação de ponteiros, sem tocar no store) e a cópia dos
 * arrays de saída — a mesma ordem da cópia do array de IDs que a ponte já faz
 * por publicação.
 *
 * Identidade preservada: mesmo `ids` ou mesmo conteúdo devolve o MESMO
 * resultado; grupo que não mudou devolve a mesma referência de array.
 */
export function criarAgrupadorDeSistema(
  ler: (id: string) => LinhaParaFundir,
): (ids: readonly string[]) => ListaAgrupada {
  let idsAnt: readonly string[] = [];
  let res: ListaAgrupada = { visiveis: idsAnt, grupos: SEM_GRUPOS };
  /** cab[i] = i − índice da cabeça da corrida aberta DEPOIS de i; −1 = sem corrida. */
  let cab: number[] = [];
  /** vc[i] = quantas linhas visíveis existem antes do índice i (length = n + 1). */
  let vc: number[] = [0];

  return (ids) => {
    if (ids === idsAnt) return res;
    const n = ids.length;
    const m = idsAnt.length;
    const menor = Math.min(n, m);
    let p = 0;
    while (p < menor && ids[p] === idsAnt[p]) p++;
    if (p === n && n === m) {
      idsAnt = ids;
      return res;
    }
    let s = 0;
    while (s < menor - p && ids[n - 1 - s] === idsAnt[m - 1 - s]) s++;

    // Estado da máquina na entrada do trecho (índice p).
    let cabeca: string | undefined;
    let cabIdx = -1;
    let chave: string | undefined;
    let pessoaCab = "";
    let gAntigo: readonly string[] | undefined;
    let totalCab = 0;
    if (p > 0 && (cab[p - 1] as number) >= 0) {
      cabIdx = p - 1 - (cab[p - 1] as number);
      const cab0 = ids[cabIdx] as string;
      cabeca = cab0;
      totalCab = (cab[p - 1] as number) + 1;
      const s0 = ler(cab0)?.sistema;
      chave = s0 === undefined ? undefined : chaveDeFusao(s0);
      pessoaCab = s0 === undefined ? "" : (pessoaDe(s0) ?? "");
      gAntigo = res.grupos.get(cab0);
    }

    const regCab: number[] = [];
    const regVis: string[] = [];
    const regVisivel: boolean[] = [];
    const regGrupos = new Map<string, string[]>();
    const retomada = cabeca;
    let gAtivo: string[] | undefined;
    if (retomada !== undefined && gAntigo !== undefined && totalCab > 1) {
      // A corrida aberta no fim do prefixo continua com os membros que ficaram antes de p.
      gAtivo = gAntigo.slice(0, totalCab);
      regGrupos.set(retomada, gAtivo);
    }
    const deltaIdx = n - m;
    let jo = m;
    let i = p;
    for (; i < n; i++) {
      if (i >= n - s && cabeca === undefined) {
        const io = i - deltaIdx;
        if (io === 0 || (cab[io - 1] as number) < 0) {
          jo = io;
          break;
        }
      }
      const id = ids[i] as string;
      const linha = ler(id);
      const sis = linha?.sistema;
      const k = sis === undefined ? undefined : chaveDeFusao(sis);
      const pessoa = sis === undefined ? undefined : pessoaDe(sis);
      const continua =
        cabeca !== undefined &&
        k !== undefined &&
        k === chave &&
        pessoa !== undefined &&
        linha !== undefined &&
        linha.dia === undefined &&
        !linha.primeiraNaoLida;

      const absorvida = continua && cabeca !== undefined && pessoa !== undefined;
      if (absorvida) {
        if (gAtivo === undefined) {
          gAtivo = [pessoaCab];
          regGrupos.set(cabeca as string, gAtivo);
        }
        gAtivo.push(pessoa);
      } else {
        regVis.push(id);
        if (k !== undefined) {
          cabeca = id;
          cabIdx = i;
          chave = k;
          pessoaCab = pessoa ?? "";
        } else {
          cabeca = undefined;
          cabIdx = -1;
          chave = undefined;
        }
        gAtivo = undefined;
      }
      regVisivel.push(!absorvida);
      regCab.push(cabeca === undefined ? -1 : i - cabIdx);
    }

    // --- visíveis ---
    const oldVis = res.visiveis;
    const visAntes = vc[p] as number;
    const visJo = vc[jo] as number;
    const dv = regVis.length - (visJo - visAntes);
    const total = (vc[m] as number) + dv;
    let visiveis: readonly string[];
    const regIgual =
      oldVis !== idsAnt &&
      dv === 0 &&
      regVis.every((v, j) => v === oldVis[visAntes + j]);
    if (regIgual) visiveis = oldVis;
    else if (total === n) visiveis = ids;
    else visiveis = [...oldVis.slice(0, visAntes), ...regVis, ...oldVis.slice(visJo)];

    // --- grupos ---
    const gAnt = res.grupos;
    let grupos: ReadonlyMap<string, readonly string[]> = gAnt;
    if (gAnt.size > 0 || regGrupos.size > 0) {
      const dropped = new Set<string>(idsAnt.slice(p, jo));
      if (retomada !== undefined) dropped.add(retomada);
      const novo = new Map<string, readonly string[]>();
      let mudou = false;
      for (const [k, v] of gAnt) {
        if (dropped.has(k)) {
          if (!regGrupos.has(k)) mudou = true;
        } else novo.set(k, v);
      }
      for (const [k, g] of regGrupos) {
        const antes = gAnt.get(k);
        if (antes !== undefined && antes.length === g.length && antes.every((u, j) => u === g[j])) {
          novo.set(k, antes);
        } else {
          novo.set(k, g);
          mudou = true;
        }
      }
      grupos = mudou ? (novo.size === 0 ? SEM_GRUPOS : novo) : gAnt;
    }

    // --- índices auxiliares ---
    let c = visAntes;
    const contagem = regVisivel.map((v) => (v ? ++c : c));
    if (jo === m) {
      cab.length = p;
      vc.length = p + 1;
      for (let j = 0; j < regCab.length; j++) {
        cab.push(regCab[j] as number);
        vc.push(contagem[j] as number);
      }
    } else {
      const vcNovo = vc.slice(0, p + 1).concat(contagem);
      for (let j = jo + 1; j <= m; j++) vcNovo.push((vc[j] as number) + dv);
      cab = cab.slice(0, p).concat(regCab, cab.slice(jo));
      vc = vcNovo;
    }

    idsAnt = ids;
    res = { visiveis, grupos };
    return res;
  };
}
