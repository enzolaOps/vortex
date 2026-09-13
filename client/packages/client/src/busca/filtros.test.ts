import { decodeTime, ulid } from "ulid";
import { describe, expect, it } from "vitest";

import {
  acrescentarFiltro,
  analisarConsulta,
  intervaloDasDatas,
  menorCursor,
  tipoDoFiltro,
  tirarFiltro,
} from "./filtros";

/**
 * O texto do campo é a fonte dos filtros. O que estes testes guardam é que o
 * texto livre chega LIMPO ao servidor — um `de:marina` que vazasse para a
 * busca de texto completo devolveria zero resultados sem erro nenhum — e que
 * as datas viram cursores que não perdem a borda do dia.
 */
describe("analisarConsulta", () => {
  it("separa texto livre de filtros", () => {
    const r = analisarConsulta("de:marina comparativo tem:arquivo densidade");
    expect(r.texto).toBe("comparativo densidade");
    expect(r.filtros.map((f) => f.bruto)).toEqual(["de:marina", "tem:arquivo"]);
    expect(r.filtros.every((f) => f.valido)).toBe(true);
  });

  it("aceita acento e maiúscula no tipo", () => {
    expect(tipoDoFiltro("Vídeo")).toBe("video");
    expect(tipoDoFiltro("áudio")).toBe("audio");
    expect(tipoDoFiltro("planilha")).toBeUndefined();
  });

  it("marca inválido o tipo desconhecido e a data impossível", () => {
    const r = analisarConsulta("tem:planilha durante:2026-02-31");
    expect(r.filtros.map((f) => f.valido)).toEqual([false, false]);
    expect(r.texto).toBe("");
  });

  it("não confunde `de:` no meio de uma palavra", () => {
    expect(analisarConsulta("rede:local").filtros).toEqual([]);
  });
});

describe("tirar e acrescentar", () => {
  it("o ✕ tira só aquele filtro e arruma os espaços", () => {
    expect(tirarFiltro("de:marina oi tem:arquivo", "de:marina")).toBe(
      "oi tem:arquivo",
    );
    expect(tirarFiltro("oi", "de:x")).toBe("oi");
  });

  it("o + filtro acrescenta no fim", () => {
    expect(acrescentarFiltro("", "tem:")).toBe("tem:");
    expect(acrescentarFiltro("oi  ", "de:")).toBe("oi de:");
  });
});

describe("intervaloDasDatas", () => {
  const dia = (a: number, m: number, d: number) => new Date(a, m - 1, d).getTime();

  it("durante pega a primeira e a última mensagem do dia, e nada fora", () => {
    const { antesDe, depoisDe } = intervaloDasDatas(
      analisarConsulta("durante:2026-09-12").filtros,
    );
    const meiaNoite = dia(2026, 9, 12);
    const primeira = ulid(meiaNoite);
    const ultima = ulid(dia(2026, 9, 13) - 1);
    // Os dois cursores são exclusivos no servidor.
    expect(primeira > depoisDe!).toBe(true);
    expect(ultima < antesDe!).toBe(true);
    expect(ulid(meiaNoite - 1) > depoisDe!).toBe(false);
    expect(ulid(dia(2026, 9, 13)) < antesDe!).toBe(false);
  });

  it("antes e depois viram um cursor só cada", () => {
    const antes = intervaloDasDatas(analisarConsulta("antes:2026-09-12").filtros);
    expect(antes.depoisDe).toBeUndefined();
    expect(decodeTime(antes.antesDe!)).toBe(dia(2026, 9, 12));

    const depois = intervaloDasDatas(analisarConsulta("depois:2026-09-12").filtros);
    expect(depois.antesDe).toBeUndefined();
    expect(ulid(dia(2026, 9, 13)) > depois.depoisDe!).toBe(true);
    expect(ulid(dia(2026, 9, 13) - 1) > depois.depoisDe!).toBe(false);
  });

  it("dois filtros de data estreitam, não alargam", () => {
    const r = intervaloDasDatas(
      analisarConsulta("antes:2026-09-20 antes:2026-09-10").filtros,
    );
    expect(decodeTime(r.antesDe!)).toBe(dia(2026, 9, 10));
  });

  it("filtro inválido não vira cursor", () => {
    expect(intervaloDasDatas(analisarConsulta("antes:ontem").filtros)).toEqual({
      antesDe: undefined,
      depoisDe: undefined,
    });
  });
});

describe("menorCursor", () => {
  it("a página e a data se combinam pelo menor", () => {
    expect(menorCursor("B", "A")).toBe("A");
    expect(menorCursor(undefined, "A")).toBe("A");
    expect(menorCursor("B", undefined)).toBe("B");
  });
});
