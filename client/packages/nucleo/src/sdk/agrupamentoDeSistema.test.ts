import { describe, expect, it } from "vitest";

import { agruparSistema, chaveDeFusao, criarAgrupadorDeSistema, type LinhaParaFundir } from "./agrupamentoDeSistema";
import type { SistemaSnapshot } from "./domain";

const entrou = (userId: string): SistemaSnapshot => ({ tipo: "entrou", userId });
const linha = (
  sistema: SistemaSnapshot | undefined,
  extra: { dia?: string; primeiraNaoLida?: boolean } = {},
): LinhaParaFundir => ({ sistema, dia: extra.dia, primeiraNaoLida: extra.primeiraNaoLida ?? false });

function de(mapa: Record<string, LinhaParaFundir>) {
  return (id: string) => mapa[id];
}

describe("agruparSistema", () => {
  it("sem nada a fundir devolve o MESMO array (nenhuma alocação no caso comum)", () => {
    const ids = ["a", "b"];
    const r = agruparSistema(ids, de({ a: linha(entrou("u1")), b: linha({ tipo: "saiu", userId: "u2" }) }));
    expect(r.visiveis).toBe(ids);
    expect(r.grupos.size).toBe(0);
  });

  it("entradas seguidas viram uma linha e carregam todas as pessoas", () => {
    const r = agruparSistema(
      ["a", "b", "c"],
      de({ a: linha(entrou("u1")), b: linha(entrou("u2")), c: linha(entrou("u3")) }),
    );
    expect(r.visiveis).toEqual(["a"]);
    expect(r.grupos.get("a")).toEqual(["u1", "u2", "u3"]);
  });

  it("uma mensagem de gente, um tipo diferente, um dia novo ou a primeira não lida quebram a fusão", () => {
    const r = agruparSistema(
      ["a", "b", "m", "c", "d", "e", "f"],
      de({
        a: linha(entrou("u1")),
        b: linha(entrou("u2")),
        m: linha(undefined),
        c: linha(entrou("u3")),
        d: linha({ tipo: "saiu", userId: "u4" }),
        e: linha({ tipo: "saiu", userId: "u5" }, { dia: "Hoje" }),
        f: linha({ tipo: "saiu", userId: "u6" }, { primeiraNaoLida: true }),
      }),
    );
    expect(r.visiveis).toEqual(["a", "m", "c", "d", "e", "f"]);
    expect(r.grupos.get("a")).toEqual(["u1", "u2"]);
    expect(r.grupos.size).toBe(1);
  });

  it("fatos que não se fundem ficam cada um na sua linha", () => {
    const r = agruparSistema(
      ["a", "b"],
      de({
        a: linha({ tipo: "fixou", porId: "u1" }),
        b: linha({ tipo: "fixou", porId: "u1" }),
      }),
    );
    expect(r.visiveis).toEqual(["a", "b"]);
  });

  it("adicionar/remover só funde quando quem fez é o mesmo", () => {
    const r = agruparSistema(
      ["a", "b", "c"],
      de({
        a: linha({ tipo: "adicionou", userId: "u1", porId: "x" }),
        b: linha({ tipo: "adicionou", userId: "u2", porId: "x" }),
        c: linha({ tipo: "adicionou", userId: "u3", porId: "y" }),
      }),
    );
    expect(r.visiveis).toEqual(["a", "c"]);
    expect(r.grupos.get("a")).toEqual(["u1", "u2"]);
  });

  it("reaproveita a referência do grupo que não mudou (a linha é memo)", () => {
    const ler = de({ a: linha(entrou("u1")), b: linha(entrou("u2")) });
    const primeira = agruparSistema(["a", "b"], ler);
    const segunda = agruparSistema(["a", "b"], ler, primeira.grupos);
    expect(segunda.grupos.get("a")).toBe(primeira.grupos.get("a"));
    const maior = agruparSistema(
      ["a", "b", "c"],
      de({ a: linha(entrou("u1")), b: linha(entrou("u2")), c: linha(entrou("u3")) }),
      primeira.grupos,
    );
    expect(maior.grupos.get("a")).not.toBe(primeira.grupos.get("a"));
  });

  it("mensagem ainda não resolvida quebra a fusão em vez de derrubá-la", () => {
    const r = agruparSistema(["a", "x", "b"], de({ a: linha(entrou("u1")), b: linha(entrou("u2")) }));
    expect(r.visiveis).toEqual(["a", "x", "b"]);
  });

  it("chaveDeFusao: só entradas, saídas, moderação e adições se fundem", () => {
    expect(chaveDeFusao(entrou("u"))).toBe("entrou");
    expect(chaveDeFusao({ tipo: "chamada", porId: "u", duracaoTexto: undefined })).toBeUndefined();
    expect(chaveDeFusao({ tipo: "desconhecido" })).toBeUndefined();
  });
});

describe("criarAgrupadorDeSistema (incremental)", () => {
  /** PRNG determinístico, para a propriedade ser reprodutível. */
  function prng(seed: number) {
    let x = seed;
    return () => {
      x = (x * 1664525 + 1013904223) % 4294967296;
      return x / 4294967296;
    };
  }
  function mundo(rnd: () => number) {
    const dados = new Map<string, LinhaParaFundir>();
    let n = 0;
    const novo = (): string => {
      const id = `m${n++}`;
      const r = rnd();
      const extra = { dia: rnd() < 0.05 ? "dia" : undefined, primeiraNaoLida: rnd() < 0.03 };
      let sis: SistemaSnapshot | undefined;
      if (r < 0.45) sis = entrou(`u${id}`);
      else if (r < 0.6) sis = { tipo: "saiu", userId: `u${id}` };
      else if (r < 0.7) sis = { tipo: "adicionou", userId: `u${id}`, porId: rnd() < 0.5 ? "x" : "y" };
      else if (r < 0.75) sis = { tipo: "fixou", porId: "x" };
      dados.set(id, linha(sis, extra));
      return id;
    };
    return { dados, novo };
  }
  const igual = (a: ReturnType<typeof agruparSistema>, b: ReturnType<typeof agruparSistema>) => {
    expect(a.visiveis).toEqual(b.visiveis);
    expect([...a.grupos.entries()].sort()).toEqual([...b.grupos.entries()].sort());
  };

  it("é igual à versão completa em listas aleatórias com append, prepend, remoção e troca", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rnd = prng(seed);
      const { dados, novo } = mundo(rnd);
      const ler = (id: string) => dados.get(id);
      const inc = criarAgrupadorDeSistema(ler);
      let ids: string[] = Array.from({ length: 1 + Math.floor(rnd() * 30) }, novo);
      igual(inc(ids), agruparSistema(ids, ler));
      for (let passo = 0; passo < 40; passo++) {
        const op = Math.floor(rnd() * 6);
        const prox = ids.slice();
        const pos = Math.floor(rnd() * (prox.length + 1));
        if (op === 0) prox.push(novo());
        else if (op === 1) prox.unshift(novo(), novo());
        else if (op === 2 && prox.length > 0) prox.splice(Math.min(pos, prox.length - 1), 1);
        else if (op === 3) prox.splice(pos, 0, novo());
        else if (op === 4 && prox.length > 0) prox.splice(Math.min(pos, prox.length - 1), 1, novo(), novo());
        else prox.push(novo(), novo(), novo());
        ids = prox;
        igual(inc(ids), agruparSistema(ids, ler));
      }
    }
  });

  it("append numa lista de 10k não percorre a lista", () => {
    const rnd = prng(7);
    const { dados, novo } = mundo(rnd);
    let visitas = 0;
    const ler = (id: string) => {
      visitas++;
      return dados.get(id);
    };
    const inc = criarAgrupadorDeSistema(ler);
    const ids = Array.from({ length: 10_000 }, novo);
    inc(ids);
    expect(visitas).toBeGreaterThanOrEqual(10_000);

    visitas = 0;
    const mais = [...ids, novo()];
    const r = inc(mais);
    expect(visitas).toBeLessThanOrEqual(3);
    igual(r, agruparSistema(mais, (id) => dados.get(id)));

    // append dentro de uma corrida longa de entradas: retoma, não refaz.
    const corrida = Array.from({ length: 5_000 }, () => {
      const id = `c${dados.size}`;
      dados.set(id, linha(entrou(`u${id}`)));
      return id;
    });
    const base = [...mais, ...corrida];
    inc(base);
    visitas = 0;
    const id = `c${dados.size}`;
    dados.set(id, linha(entrou(`u${id}`)));
    const depois = [...base, id];
    const r2 = inc(depois);
    expect(visitas).toBeLessThanOrEqual(3);
    igual(r2, agruparSistema(depois, (x) => dados.get(x)));
  });

  it("prepend e remoção no meio também ficam locais", () => {
    const rnd = prng(11);
    const { dados, novo } = mundo(rnd);
    let visitas = 0;
    const ler = (id: string) => {
      visitas++;
      return dados.get(id);
    };
    const inc = criarAgrupadorDeSistema(ler);
    const ids = Array.from({ length: 10_000 }, novo);
    inc(ids);
    visitas = 0;
    const comTopo = [novo(), ...ids];
    igual(inc(comTopo), agruparSistema(comTopo, (id) => dados.get(id)));
    expect(visitas).toBeLessThan(600);
    visitas = 0;
    const semMeio = comTopo.filter((_, i) => i !== 5000);
    igual(inc(semMeio), agruparSistema(semMeio, (id) => dados.get(id)));
    expect(visitas).toBeLessThan(600);
  });

  it("preserva identidade: mesmo ids, mesmo conteúdo e grupo intacto devolvem as mesmas referências", () => {
    const dados = new Map<string, LinhaParaFundir>([
      ["a", linha(entrou("u1"))],
      ["b", linha(entrou("u2"))],
      ["m", linha(undefined)],
      ["c", linha(undefined)],
    ]);
    const inc = criarAgrupadorDeSistema((id) => dados.get(id));
    const ids = ["a", "b", "m"];
    const r1 = inc(ids);
    expect(inc(ids)).toBe(r1);
    expect(inc([...ids])).toBe(r1);
    const r2 = inc([...ids, "c"]);
    expect(r2.visiveis).not.toBe(r1.visiveis);
    expect(r2.grupos).toBe(r1.grupos);
    expect(r2.grupos.get("a")).toBe(r1.grupos.get("a"));
  });

  it("sem fusão devolve o próprio ids", () => {
    const dados = new Map<string, LinhaParaFundir>([["a", linha(undefined)], ["b", linha(undefined)]]);
    const inc = criarAgrupadorDeSistema((id) => dados.get(id));
    const ids = ["a", "b"];
    expect(inc(ids).visiveis).toBe(ids);
  });
});
