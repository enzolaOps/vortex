import { describe, expect, it } from "vitest";

import { executarEmLote } from "./lote";

/** Uma promessa que o teste resolve na mão — é o que deixa medir o teto. */
function adiada() {
  let resolver!: () => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<void>((s, j) => {
    resolver = s;
    rejeitar = j;
  });
  return { promessa, resolver, rejeitar };
}

const esvaziar = () => new Promise((r) => setTimeout(r, 0));

describe("executarEmLote", () => {
  it("nunca passa do teto de simultaneidade", async () => {
    const pendentes = new Map<number, ReturnType<typeof adiada>>();
    let emCurso = 0;
    let pico = 0;

    const fim = executarEmLote(
      [1, 2, 3, 4, 5, 6, 7],
      (n) => {
        emCurso++;
        pico = Math.max(pico, emCurso);
        const a = adiada();
        pendentes.set(n, a);
        return a.promessa.finally(() => {
          emCurso--;
        });
      },
      { concorrencia: 3 },
    );

    for (let i = 0; i < 7; i++) {
      await esvaziar();
      const [n, a] = [...pendentes.entries()][0]!;
      pendentes.delete(n);
      a.resolver();
    }

    const r = await fim;
    expect(pico).toBe(3);
    expect(r.feitos).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("uma falha não derruba as outras, e cada uma leva o próprio motivo", async () => {
    const r = await executarEmLote(
      ["ana", "bia", "caio", "davi"],
      (nome) =>
        nome === "bia" || nome === "davi"
          ? Promise.reject(new Error(`recusou ${nome}`))
          : Promise.resolve(),
    );

    expect(r.feitos).toEqual(["ana", "caio"]);
    expect(r.falhas).toEqual([
      { item: "bia", motivo: "recusou bia" },
      { item: "davi", motivo: "recusou davi" },
    ]);
  });

  it("o resultado sai na ordem da ENTRADA, não na de chegada", async () => {
    const r = await executarEmLote(
      [30, 10, 20],
      (ms) => new Promise((s) => setTimeout(s, ms)),
      { concorrencia: 3 },
    );
    expect(r.feitos).toEqual([30, 10, 20]);
  });

  it("repete só quando o servidor mandou esperar, e esperando o que ele disse", async () => {
    const esperas: number[] = [];
    let chamadas = 0;

    const r = await executarEmLote(
      ["x"],
      () => {
        chamadas++;
        return chamadas < 3
          ? Promise.reject(Object.assign(new Error("429"), { retry_after: 1500 }))
          : Promise.resolve();
      },
      {
        esperaDe: (e) => (e as { retry_after?: number }).retry_after,
        dormir: (ms) => {
          esperas.push(ms);
          return Promise.resolve();
        },
      },
    );

    expect(r.feitos).toEqual(["x"]);
    expect(chamadas).toBe(3);
    expect(esperas).toEqual([1500, 1500]);
  });

  it("erro sem espera não é repetido", async () => {
    let chamadas = 0;
    const r = await executarEmLote(
      ["x"],
      () => {
        chamadas++;
        return Promise.reject(new Error("sem permissão"));
      },
      { esperaDe: () => undefined, dormir: () => Promise.resolve() },
    );
    expect(chamadas).toBe(1);
    expect(r.falhas).toHaveLength(1);
  });

  it("desiste depois das repetições e reporta a falha", async () => {
    let chamadas = 0;
    const r = await executarEmLote(
      ["x"],
      () => {
        chamadas++;
        return Promise.reject(new Error("limite"));
      },
      {
        esperaDe: () => 10,
        repeticoes: 2,
        motivoDe: () => "Tentativas demais.",
        dormir: () => Promise.resolve(),
      },
    );
    expect(chamadas).toBe(3);
    expect(r.falhas).toEqual([{ item: "x", motivo: "Tentativas demais." }]);
  });

  it("o progresso conta TERMINADOS, até o total", async () => {
    const vistos: [number, number][] = [];
    await executarEmLote([1, 2, 3], () => Promise.resolve(), {
      concorrencia: 2,
      aoProgredir: (t, total) => vistos.push([t, total]),
    });
    expect(vistos).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("lista vazia resolve sem chamar nada", async () => {
    let chamadas = 0;
    const r = await executarEmLote([], () => {
      chamadas++;
      return Promise.resolve();
    });
    expect(chamadas).toBe(0);
    expect(r).toEqual({ feitos: [], falhas: [] });
  });
});
