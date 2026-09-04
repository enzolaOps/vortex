import { describe, expect, it } from "vitest";

import { paletaFinal } from "./aplicar";
import { SEMENTE_PADRAO, type Modo } from "./derivar";
import { PALETAS, paletaDe } from "./paletas";
import { falhasQueContam, verificar } from "./pares";

/**
 * As paletas curadas.
 *
 * A garantia de contraste é da DERIVAÇÃO, não da curadoria — a varredura em
 * `derivar.test.ts` já prova que nenhum matiz reprova. Este arquivo existe para
 * o caso em que alguém adicione uma paleta e a curadoria passe a depender de
 * sorte: se um dia uma delas falhar, o bug é da derivação e não da cor
 * escolhida, e é isso que a mensagem de falha vai dizer.
 */
const MODOS: Modo[] = ["escuro", "claro"];

describe("paletas curadas", () => {
  it("toda paleta passa em todos os pares, nos dois modos", () => {
    for (const modo of MODOS) {
      for (const p of PALETAS) {
        const v = verificar(paletaFinal({ ...SEMENTE_PADRAO[modo], ...p }));
        expect(
          falhasQueContam(v.falhas, modo).map(
            (f) => `${f.par.fg}/${f.par.bg} ${f.razao.toFixed(2)}`,
          ),
          `${modo} · ${p.nome}`,
        ).toEqual([]);
      }
    }
  });

  it("os ids são únicos", () => {
    const ids = PALETAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a primeira paleta é a de fábrica, e bate com a semente padrão", () => {
    const primeira = PALETAS[0]!;
    // Se estas duas divergirem, abrir o picker mostraria "nenhuma paleta
    // selecionada" num app recém-instalado — que é como se descobre que a
    // curadoria virou uma cópia desatualizada dos tokens.
    expect(primeira.matiz).toBe(SEMENTE_PADRAO.escuro.matiz);
    expect(primeira.croma).toBe(SEMENTE_PADRAO.escuro.croma);
    expect(primeira.acento).toBe(SEMENTE_PADRAO.escuro.acento);
  });

  it("paletaDe reconhece a semente de fábrica e ignora as vizinhas", () => {
    const s = SEMENTE_PADRAO.escuro;
    expect(paletaDe(s.matiz, s.croma, s.acento)).toBe("vortex");
    expect(paletaDe(s.matiz + 1, s.croma, s.acento)).toBeNull();
    expect(paletaDe(s.matiz, s.croma + 0.5, s.acento)).toBeNull();
  });

  it("cada paleta produz uma cor de ação distinguível das outras", () => {
    // Duas paletas que derivam para o mesmo acento seriam duas entradas
    // idênticas no picker — escolha sem consequência.
    const acentos = PALETAS.map(
      (p) => paletaFinal({ ...SEMENTE_PADRAO.escuro, ...p })["--vx-accent"],
    );
    expect(new Set(acentos).size).toBe(PALETAS.length);
  });
});
