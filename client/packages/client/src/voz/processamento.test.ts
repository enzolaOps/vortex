import { describe, expect, it } from "vitest";

import {
  coalescer,
  fundoEfetivo,
  planoDeFundo,
  querRuidoForte,
} from "./processamento";

describe("querRuidoForte", () => {
  it("só a agressiva liga o RNNoise", () => {
    expect(querRuidoForte("agressiva")).toBe(true);
    expect(querRuidoForte("padrao")).toBe(false);
    expect(querRuidoForte("desligada")).toBe(false);
  });
});

describe("fundoEfetivo", () => {
  it("com a câmera ligada, vale a preferência", () => {
    expect(fundoEfetivo("desfoque", true)).toBe("desfoque");
    expect(fundoEfetivo("imagem", true)).toBe("imagem");
  });

  it("com a câmera desligada, nada — o segmentador não roda sem câmera", () => {
    expect(fundoEfetivo("desfoque", false)).toBe("nenhum");
    expect(fundoEfetivo("imagem", false)).toBe("nenhum");
  });
});

describe("planoDeFundo", () => {
  it("sem processador e com efeito pedido, cria", () => {
    expect(planoDeFundo("nenhum", "desfoque")).toBe("criar");
    expect(planoDeFundo("nenhum", "imagem")).toBe("criar");
  });

  it("entre dois efeitos, troca sem recriar o segmentador", () => {
    expect(planoDeFundo("desfoque", "imagem")).toBe("trocar");
    expect(planoDeFundo("imagem", "desfoque")).toBe("trocar");
  });

  it("nenhum remove — não deixa o modelo rodando desligado", () => {
    expect(planoDeFundo("desfoque", "nenhum")).toBe("remover");
    expect(planoDeFundo("imagem", "nenhum")).toBe("remover");
  });

  it("igual não faz nada", () => {
    expect(planoDeFundo("nenhum", "nenhum")).toBe("nada");
    expect(planoDeFundo("imagem", "imagem")).toBe("nada");
  });
});

describe("coalescer", () => {
  function adiada() {
    let soltar!: () => void;
    const p = new Promise<void>((r) => (soltar = r));
    return { p, soltar };
  }

  it("pedidos durante a execução viram UMA repetição, nunca execução paralela", async () => {
    let emCurso = 0;
    let maxParalelo = 0;
    let voltas = 0;
    const portas: (() => void)[] = [];
    const fila = coalescer(async () => {
      voltas++;
      emCurso++;
      maxParalelo = Math.max(maxParalelo, emCurso);
      const d = adiada();
      portas.push(d.soltar);
      await d.p;
      emCurso--;
    });

    const primeira = fila();
    void fila();
    void fila();
    void fila();
    await Promise.resolve();
    expect(voltas).toBe(1);

    portas[0]?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(voltas).toBe(2);
    portas[1]?.();
    await primeira;

    expect(voltas).toBe(2);
    expect(maxParalelo).toBe(1);
  });

  it("a repetição vê o estado mais recente", async () => {
    let desejado = "a";
    const aplicados: string[] = [];
    let porta = adiada();
    const fila = coalescer(async () => {
      aplicados.push(desejado);
      await porta.p;
    });

    const p = fila();
    desejado = "b";
    void fila();
    desejado = "c";
    void fila();
    const primeira = porta;
    porta = { p: Promise.resolve(), soltar: () => {} };
    primeira.soltar();
    await p;

    expect(aplicados).toEqual(["a", "c"]);
  });

  it("erro numa volta não trava a fila", async () => {
    let voltas = 0;
    const fila = coalescer(() => {
      voltas++;
      return voltas === 1 ? Promise.reject(new Error("wasm")) : Promise.resolve();
    });
    await fila();
    await fila();
    expect(voltas).toBe(2);
  });

  it("depois de assentar, um pedido novo roda de novo", async () => {
    let voltas = 0;
    const fila = coalescer(() => {
      voltas++;
      return Promise.resolve();
    });
    await fila();
    await fila();
    await fila();
    expect(voltas).toBe(3);
  });
});
