import { describe, expect, it } from "vitest";

import { estadoDoTransmitir, motivoDoTransmitir } from "./estadoDoTransmitir";

const BASE = {
  fase: "escolhendo",
  modo: "casca",
  temFonte: true,
  podeVideo: true,
  suportaCaptura: true,
} as const;

describe("estadoDoTransmitir — os quatro estados do design", () => {
  it("fonte escolhida e permissão: pronto", () => {
    expect(estadoDoTransmitir(BASE).tipo).toBe("pronto");
  });

  it("sem fonte na casca: pede fonte", () => {
    expect(estadoDoTransmitir({ ...BASE, temFonte: false }).tipo).toBe(
      "semFonte",
    );
  });

  it("no modo sistema a fonte vem depois do clique, nunca falta", () => {
    expect(
      estadoDoTransmitir({ ...BASE, modo: "sistema", temFonte: false }).tipo,
    ).toBe("pronto");
  });

  it("sem permissão GANHA de sem fonte — escolher não resolveria", () => {
    const e = estadoDoTransmitir({
      ...BASE,
      temFonte: false,
      podeVideo: false,
    });
    expect(e.tipo).toBe("semPermissao");
    expect(motivoDoTransmitir(e, "casca")).toEqual({
      texto: 'sem permissão "Vídeo" neste canal',
      perigo: true,
    });
  });

  it("navegador sem getDisplayMedia só bloqueia no modo sistema", () => {
    expect(
      estadoDoTransmitir({ ...BASE, modo: "sistema", suportaCaptura: false })
        .tipo,
    ).toBe("semCaptura");
    expect(estadoDoTransmitir({ ...BASE, suportaCaptura: false }).tipo).toBe(
      "pronto",
    );
  });

  it("iniciando ganha de tudo, e o motivo muda com o modo", () => {
    const e = estadoDoTransmitir({ ...BASE, fase: "iniciando", podeVideo: false });
    expect(e.tipo).toBe("iniciando");
    expect(motivoDoTransmitir(e, "casca")?.texto).toBe("negociando codec");
    expect(motivoDoTransmitir(e, "sistema")?.texto).toBe(
      "escolha a fonte na janela do navegador",
    );
  });

  it("pronto não tem motivo — o rodapé mostra a consequência", () => {
    expect(motivoDoTransmitir({ tipo: "pronto" }, "casca")).toBeUndefined();
  });
});
