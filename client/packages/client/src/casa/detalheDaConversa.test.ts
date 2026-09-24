import { describe, expect, it } from "vitest";

import { detalheDaConversa } from "./detalheDaConversa";

describe("detalheDaConversa", () => {
  it("grupo mostra a última mensagem com o autor", () => {
    expect(
      detalheDaConversa({
        tipo: "grupo",
        participantes: 4,
        ultima: { conteudo: "subo os cortes hoje", minha: false },
        autor: "Júlia",
      }),
    ).toBe("Júlia: subo os cortes hoje");
  });

  it("a última é minha: 'Você', e não o meu nome", () => {
    expect(
      detalheDaConversa({
        tipo: "grupo",
        participantes: 4,
        ultima: { conteudo: "ok", minha: true },
        autor: undefined,
      }),
    ).toBe("Você: ok");
  });

  /* Sem a mensagem na sessão, a contagem — nunca um texto inventado. */
  it("grupo sem mensagem carregada volta à contagem de gente", () => {
    expect(
      detalheDaConversa({ tipo: "grupo", participantes: 4, ultima: undefined, autor: undefined }),
    ).toBe("4 pessoas");
  });

  it("autor ainda não resolvido não some com a mensagem", () => {
    expect(
      detalheDaConversa({
        tipo: "grupo",
        participantes: 3,
        ultima: { conteudo: "oi", minha: false },
        autor: undefined,
      }),
    ).toBe("Alguém: oi");
  });

  it("DM mostra só o texto, sem autor", () => {
    expect(
      detalheDaConversa({
        tipo: "dm",
        participantes: 2,
        ultima: { conteudo: "te enviei", minha: false },
        autor: "Marina",
      }),
    ).toBe("te enviei");
    expect(
      detalheDaConversa({ tipo: "dm", participantes: 2, ultima: undefined, autor: undefined }),
    ).toBeUndefined();
  });
});
