import { describe, expect, it } from "vitest";

import { emFila } from "./fila";

/** Uma promessa que o teste resolve ou rejeita quando quiser. */
function adiada() {
  let resolver!: () => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<void>((r, j) => {
    resolver = r;
    rejeitar = j;
  });
  return { promessa, resolver, rejeitar };
}

const tique = () => new Promise((r) => setTimeout(r, 0));

describe("fila com concorrência limitada", () => {
  it("nunca passa do teto ao mesmo tempo", async () => {
    let emVoo = 0;
    let pico = 0;
    const itens = Array.from({ length: 20 }, (_, i) => i);
    await emFila(
      itens,
      async () => {
        emVoo += 1;
        pico = Math.max(pico, emVoo);
        await tique();
        emVoo -= 1;
      },
      4,
    );
    expect(pico).toBe(4);
  });

  it("começa só o teto, e o próximo entra quando um termina", async () => {
    const pendentes = new Map<number, ReturnType<typeof adiada>>();
    const iniciados: number[] = [];
    const fim = emFila(
      [1, 2, 3, 4],
      (n) => {
        iniciados.push(n);
        const a = adiada();
        pendentes.set(n, a);
        return a.promessa;
      },
      2,
    );
    await tique();
    expect(iniciados).toEqual([1, 2]);

    pendentes.get(1)!.resolver();
    await tique();
    expect(iniciados).toEqual([1, 2, 3]);

    pendentes.get(2)!.resolver();
    pendentes.get(3)!.resolver();
    await tique();
    pendentes.get(4)!.resolver();
    await fim;
  });

  it("uma falha não para a fila, e volta separada", async () => {
    const feitos: number[] = [];
    const r = await emFila(
      [1, 2, 3, 4, 5],
      (n) => (n === 2 ? Promise.reject(new Error("429")) : Promise.resolve()),
      2,
      (f) => feitos.push(f),
    );
    expect([...r.ok].sort()).toEqual([1, 3, 4, 5]);
    expect(r.falhas).toEqual([2]);
    expect(feitos).toEqual([1, 2, 3, 4, 5]);
  });

  it("lista vazia termina sem chamar nada", async () => {
    const r = await emFila([], () => Promise.reject(new Error("não")), 3);
    expect(r).toEqual({ ok: [], falhas: [] });
  });
});
