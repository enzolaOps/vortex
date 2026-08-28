import { describe, expect, it } from "vitest";

import { corDeFundoDe, corDoTextoDe, gradienteDe, matizDe } from "./gradiente";
import { oklchParaHex, razao } from "../tema/cor";

/**
 * A promessa do gradiente derivado, e o teste que a torna verdadeira.
 *
 * A mesma arquitetura do picker de paleta: o ID escolhe o MATIZ, o app decide
 * toda a LUMINOSIDADE. Se isso estiver certo, nenhum ID possível produz uma
 * inicial ilegível — não há o que conferir na tela, caso a caso.
 *
 * "Se estiver certo" é o que este arquivo verifica, varrendo o espaço inteiro
 * de matizes em vez de conferir três exemplos.
 */
describe("gradiente derivado do ID", () => {
  it("as iniciais são legíveis sobre QUALQUER matiz", () => {
    const ruins: string[] = [];

    // 3600 amostras: um décimo de grau, que é mais fino que a resolução do
    // hash. Se o pior caso está aqui, ele está.
    for (let i = 0; i < 3600; i++) {
      const h = i / 10;
      const fundo = corDeFundoDeMatiz(h);
      const texto = corDoTextoDeMatiz(h);
      const r = razao(texto, fundo);
      if (r < 4.5) ruins.push(`matiz ${h}: ${r.toFixed(2)}`);
    }

    expect(ruins).toEqual([]);
  });

  /**
   * IDs com PREFIXO comum precisam divergir.
   *
   * É o caso real e o que uma soma de `charCodeAt` erraria: ULID carrega o
   * tempo nos primeiros dez caracteres, então servidores criados no mesmo
   * minuto compartilham quase todo o ID. Se o hash não separasse isso, o rail
   * inteiro sairia de uma cor só — exatamente o problema que o gradiente veio
   * resolver.
   */
  it("IDs com prefixo comum não colidem de matiz", () => {
    const base = "01JQ8ZK4XY";
    const matizes = new Set(
      ["A1", "A2", "B1", "B2", "C9", "ZZ"].map((sufixo) =>
        Math.round(matizDe(base + sufixo)),
      ),
    );
    // Seis sufixos, seis matizes distintos. Uma soma simples daria dois pares
    // iguais aqui (A1/1A não existe, mas B1/1B e a soma de A2/B1 colidiriam).
    expect(matizes.size).toBe(6);
  });

  it("é estável: o mesmo ID dá sempre o mesmo gradiente", () => {
    const id = "01JQ8ZK4XYABC";
    expect(gradienteDe(id)).toBe(gradienteDe(id));
    expect(gradienteDe(id)).toContain("linear-gradient(140deg");
  });

  it("IDs diferentes dão gradientes diferentes", () => {
    expect(gradienteDe("servidor-a")).not.toBe(gradienteDe("servidor-b"));
  });

  /** O caminho de verdade, com as funções públicas. */
  it("as funções públicas concordam com a varredura", () => {
    for (const id of ["a", "vortex", "01JQ8ZK4XY", "🙂", ""]) {
      expect(razao(corDoTextoDe(id), corDeFundoDe(id))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/*
  As duas abaixo repetem as constantes de propósito.

  O teste varre o ESPAÇO de matizes; as funções públicas só alcançam os
  matizes que o hash produz. Se elas chamassem `corDoTextoDe`, a varredura
  cobriria 360 pontos escolhidos pelo hash em vez dos 3.600 possíveis — e o
  pior caso poderia ficar de fora justamente por sorte do hash.
*/
function corDeFundoDeMatiz(h: number): string {
  return oklchParaHex({ l: 0.42, c: 0.06, h });
}

function corDoTextoDeMatiz(h: number): string {
  return oklchParaHex({ l: 0.92, c: 0.04, h });
}
