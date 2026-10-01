import { describe, expect, it } from "vitest";
import { ulid } from "ulid";

import type { TopicoSnapshot } from "../sdk/domain";
import { recortarForum } from "./recorte";

/**
 * O recorte da tela do fórum.
 *
 * Nada aqui dá erro quando quebra: dá um post fixado no meio da lista, um
 * filtro de tag que deixa passar o que não tem a tag, ou o rótulo "Fixados"
 * sobre um resultado de busca.
 */

function post(extra: Partial<TopicoSnapshot> & { id: string }): TopicoSnapshot {
  return {
    nome: "post",
    paiId: "01FORUM",
    serverId: "01SRV",
    donoId: "01DONO",
    aberturaId: undefined,
    arquivado: false,
    fixado: false,
    emAnalise: false,
    tags: [],
    seguidores: [],
    seguindo: false,
    respostas: 0,
    ultimaEm: 0,
    ultimoAutorId: undefined,
    abertura: undefined,
    ...extra,
  };
}

// Na ordem que a lista do canal já traz: última atividade primeiro.
const recente = post({ id: ulid(1_000), nome: "Tri-state precisa de atalho", respostas: 5, tags: ["melhoria"] });
const fixadoVelho = post({ id: ulid(2_000), nome: "Rail duplica a pasta", respostas: 12, fixado: true, tags: ["bug"] });
const ativo = post({ id: ulid(500), nome: "Estudo ultrawide", respostas: 14, tags: ["pesquisa"] });
const semContagem = post({
  id: ulid(3_000),
  nome: "Cor de cargo",
  respostas: undefined,
  tags: ["bug"],
  abertura: {
    id: "01M",
    autorId: "01A",
    texto: "No claro o gradiente cai para 2.1:1",
    noTopico: true,
    midia: undefined,
    reacao: undefined,
  },
});

const todos = [recente, fixadoVelho, ativo, semContagem];
const mapa = new Map(todos.map((t) => [t.id, t]));
const ler = (id: string) => mapa.get(id);
const ids = [...todos.map((t) => t.id), "01DESCONHECIDO"];
const sem = { busca: "", tag: undefined, ordem: "recentes" as const };

describe("recortarForum", () => {
  it("Recentes: fixados no topo, o resto na ordem da lista, e o rótulo conta os fixados", () => {
    expect(recortarForum(ids, ler, sem)).toEqual({
      ids: [fixadoVelho.id, recente.id, ativo.id, semContagem.id],
      fixados: 1,
    });
  });

  it("com filtro os fixados continuam em cima, mas sem o rótulo", () => {
    const r = recortarForum(ids, ler, { ...sem, tag: "bug" });
    expect(r.ids).toEqual([fixadoVelho.id, semContagem.id]);
    expect(r.fixados).toBe(0);
    expect(recortarForum(ids, ler, { ...sem, busca: "rail" }).fixados).toBe(0);
  });

  it("busca casa título e texto da abertura, sem caixa", () => {
    expect(recortarForum(ids, ler, { ...sem, busca: "  TRI-STATE " }).ids).toEqual([recente.id]);
    expect(recortarForum(ids, ler, { ...sem, busca: "gradiente" }).ids).toEqual([semContagem.id]);
  });

  it("Mais ativos: por respostas, e 'não sei' conta como zero", () => {
    const r = recortarForum(ids, ler, { ...sem, ordem: "ativos" });
    expect(r.ids).toEqual([ativo.id, fixadoVelho.id, recente.id, semContagem.id]);
    expect(r.fixados).toBe(0);
  });

  it("Novos: pela criação (ULID), ignorando fixado e atividade", () => {
    expect(recortarForum(ids, ler, { ...sem, ordem: "novos" }).ids).toEqual([
      semContagem.id,
      fixadoVelho.id,
      recente.id,
      ativo.id,
    ]);
  });
});
