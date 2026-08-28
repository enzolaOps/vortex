import { describe, expect, it } from "vitest";

import { JANELA_DE_GRUPO_MS, calcularLayout, rotuloDeDia } from "./agrupamento";

const AGORA = new Date("2026-08-26T15:00:00").getTime();
const em = (iso: string) => new Date(iso).getTime();

describe("rótulo de dia", () => {
  it("usa relativo para hoje e ontem", () => {
    expect(rotuloDeDia(em("2026-08-26T09:00:00"), AGORA)).toBe("Hoje");
    expect(rotuloDeDia(em("2026-08-25T23:59:00"), AGORA)).toBe("Ontem");
  });

  it("data por extenso para o resto", () => {
    // Datar tudo por extenso obriga a pessoa a calcular o que a data significa;
    // relativizar tudo esconde a informação quando o histórico é antigo.
    expect(rotuloDeDia(em("2026-08-20T10:00:00"), AGORA)).toMatch(/agosto/);
  });

  it("vira Ontem por meia-noite local, não por 24h corridas", () => {
    // 23:59 de ontem e 00:01 de hoje distam 2 minutos, mas são dias diferentes
    // para quem lê. Comparar por diferença de tempo daria "Hoje" nos dois.
    expect(rotuloDeDia(em("2026-08-25T23:59:00"), AGORA)).toBe("Ontem");
    expect(rotuloDeDia(em("2026-08-26T00:01:00"), AGORA)).toBe("Hoje");
  });
});

describe("layout da linha", () => {
  const autor = "u1";

  it("a primeira carregada abre grupo e abre dia", () => {
    const l = calcularLayout({ authorId: autor, createdAt: AGORA }, null, AGORA);
    expect(l.iniciaGrupo).toBe(true);
    expect(l.dia).toBe("Hoje");
  });

  it("mesma pessoa, logo em seguida, continua o grupo", () => {
    const l = calcularLayout(
      { authorId: autor, createdAt: AGORA },
      { authorId: autor, createdAt: AGORA - 60_000 },
      AGORA,
    );
    expect(l.iniciaGrupo).toBe(false);
    expect(l.dia).toBeUndefined();
  });

  it("outra pessoa abre grupo", () => {
    const l = calcularLayout(
      { authorId: "u2", createdAt: AGORA },
      { authorId: autor, createdAt: AGORA - 60_000 },
      AGORA,
    );
    expect(l.iniciaGrupo).toBe(true);
  });

  it("mesma pessoa depois da janela abre grupo", () => {
    const dentro = calcularLayout(
      { authorId: autor, createdAt: AGORA },
      { authorId: autor, createdAt: AGORA - JANELA_DE_GRUPO_MS + 1000 },
      AGORA,
    );
    const fora = calcularLayout(
      { authorId: autor, createdAt: AGORA },
      { authorId: autor, createdAt: AGORA - JANELA_DE_GRUPO_MS - 1000 },
      AGORA,
    );

    expect(dentro.iniciaGrupo).toBe(false);
    expect(fora.iniciaGrupo).toBe(true);
  });

  it("dia novo sempre abre grupo, mesmo autor e minutos de distância", () => {
    const l = calcularLayout(
      { authorId: autor, createdAt: em("2026-08-26T00:01:00") },
      { authorId: autor, createdAt: em("2026-08-25T23:59:00") },
      AGORA,
    );

    // Um cabeçalho continuando por cima de um divisor de data leria como se a
    // fala tivesse atravessado a meia-noite sem pausa.
    expect(l.iniciaGrupo).toBe(true);
    expect(l.dia).toBe("Hoje");
  });

  it("só o divisor carrega rótulo; as linhas de dentro não", () => {
    const abre = calcularLayout(
      { authorId: autor, createdAt: em("2026-08-26T10:00:00") },
      { authorId: autor, createdAt: em("2026-08-25T10:00:00") },
      AGORA,
    );
    const dentro = calcularLayout(
      { authorId: autor, createdAt: em("2026-08-26T10:01:00") },
      { authorId: autor, createdAt: em("2026-08-26T10:00:00") },
      AGORA,
    );

    expect(abre.dia).toBe("Hoje");
    expect(dentro.dia).toBeUndefined();
  });
});
