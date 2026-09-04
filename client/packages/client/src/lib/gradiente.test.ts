import { describe, expect, it } from "vitest";

import {
  corDeFundoDe,
  corDoTextoDe,
  gradienteDe,
  indiceDe,
  PALETAS,
  PALETA_DA_MARCA,
} from "./gradiente";
import { razao } from "../tema/cor";

/**
 * A promessa mudou junto com o mecanismo, e o teste mudou com ela.
 *
 * ⚠ **A versão anterior varria 3.600 matizes**, porque o gradiente era
 * derivado e o espaço de saída era contínuo — "nenhum ID possível produz uma
 * inicial ilegível" só podia ser provado varrendo. Com quatro paletas curadas
 * o espaço tem QUATRO pontos, e varrer deixou de ser a forma certa: medir os
 * quatro é exaustivo por construção.
 *
 * A varredura antiga também tinha uma dívida que este arquivo mata de
 * passagem: `corDeFundoDeMatiz` REPETIA as constantes "de propósito", e quando
 * o croma do gradiente foi de 0,06 para 0,075 a cópia ficou para trás. O teste
 * media uma cor que o app não produzia mais, e nada acusou. Aqui não há cópia:
 * as paletas vêm do módulo.
 */
describe("gradientes do design", () => {
  /**
   * As TRÊS de entidade, a 4,5:1 — elas aparecem em avatar de 22px, onde a
   * inicial não é texto grande e o mínimo cheio vale.
   */
  it("as iniciais são legíveis nas três famílias de entidade", () => {
    const entidades = PALETAS.filter((p) => p !== PALETA_DA_MARCA);
    const ruins = entidades
      .filter((p) => razao(p.texto, p.fundo) < 4.5)
      .map((p) => `${p.gradiente}: ${razao(p.texto, p.fundo).toFixed(2)}`);
    expect(ruins).toEqual([]);
    expect(entidades).toHaveLength(3);
  });

  /**
   * ⚠ **A da marca fica em 3,91:1 no pior ponto, e isso é aceito — com razão
   * escrita, não por omissão.**
   *
   * O texto dela é escuro (`#04181B`) sobre um teal que escurece até
   * `#1E7F92`: 8,46 no início do gradiente e 3,91 no fim. É a paleta do
   * design, byte a byte, e o critério aplicável é o de TEXTO GRANDE (3:1):
   * ela só aparece na marca, sempre em 44px ou mais e em peso 700 — as 35
   * ocorrências do design são todas `V` ou `VX`.
   *
   * O teste trava nos dois sentidos. Se alguém a sortear para uma entidade, o
   * caso acima falha; se ela melhorar ou piorar, este falha. Uma exceção que
   * parou de ser exceção é lixo que mente sobre uma decisão.
   */
  it("a da marca cumpre o mínimo de texto grande, e não mais que isso", () => {
    const r = razao(PALETA_DA_MARCA.texto, PALETA_DA_MARCA.fundo);
    expect(r).toBeGreaterThanOrEqual(3);
    expect(r).toBeLessThan(4.5);
  });

  /**
   * O ponto medido é o PIOR dos dois, e não o mais claro.
   *
   * ⚠ Escrevi "o mais claro" na primeira versão e o teste ficou vermelho: com
   * texto claro sobre fundo escuro o pior ponto é o claro, mas na paleta da
   * marca — texto escuro sobre teal brilhante — a relação inverte. Um campo
   * que sempre pegasse o `de` mediria o melhor caso da marca e o chamaria de
   * garantia.
   */
  it("o ponto medido é o pior dos dois, em cada paleta", () => {
    for (const p of PALETAS) {
      const m = /\(140deg, (#\w+), (#\w+)\)/.exec(p.gradiente);
      const de = m![1]!;
      const para = m![2]!;
      expect(p.fundo).toBe(razao(p.texto, de) <= razao(p.texto, para) ? de : para);
    }
  });

  /** Os hexes são os do design, e é isso que "1:1" quer dizer aqui. */
  it("reproduz o design byte a byte", () => {
    expect(PALETAS.map((p) => p.gradiente)).toEqual([
      "linear-gradient(140deg, #3c4653, #222833)",
      "linear-gradient(140deg, #2c6e7a, #173c46)",
      "linear-gradient(140deg, #4a3f6b, #241f38)",
      "linear-gradient(140deg, #35c2cc, #1e7f92)",
    ]);
  });

  /**
   * ⚠ A paleta da MARCA não pode sair do sorteio.
   *
   * Ela é o acento, e o design a usa só em `V`/`VX`. Se um ID a alcançasse, a
   * cor de "isto está ativo" apareceria em pessoas aleatórias — a disciplina
   * de acento que já custou uma correção neste projeto.
   */
  it("o acento nunca é sorteado para uma entidade", () => {
    for (let i = 0; i < 4000; i++) {
      expect(gradienteDe(`id-${i}`)).not.toBe(PALETA_DA_MARCA.gradiente);
    }
  });

  /**
   * IDs com PREFIXO comum precisam divergir.
   *
   * ⚠ Com três famílias o hash importa MAIS, não menos: o espaço de saída é
   * pequeno, então um hash que ignore os últimos caracteres põe o rail inteiro
   * numa cor só. ULID carrega o tempo nos primeiros dez, que é exatamente o
   * caso real.
   */
  it("IDs com prefixo comum se espalham pelas três", () => {
    const base = "01JQ8ZK4XY";
    const vistos = new Set(
      ["A1", "A2", "B1", "B2", "C9", "ZZ", "Q7", "M3", "X0"].map((s) =>
        indiceDe(base + s),
      ),
    );
    expect(vistos.size).toBe(3);
  });

  /** Distribuição: nenhuma família pode ficar com menos de um quinto. */
  it("as três saem em proporção parecida", () => {
    const conta = [0, 0, 0];
    for (let i = 0; i < 3000; i++) conta[indiceDe(`01JQ8ZK4XY${i}`)]! += 1;
    for (const n of conta) expect(n).toBeGreaterThan(3000 / 5);
  });

  it("é estável: o mesmo ID dá sempre o mesmo gradiente", () => {
    const id = "01JQ8ZK4XYABC";
    expect(gradienteDe(id)).toBe(gradienteDe(id));
    expect(gradienteDe(id)).toContain("linear-gradient(140deg");
  });

  /** O caminho de verdade, com as funções públicas. */
  it("as funções públicas concordam", () => {
    for (const id of ["a", "vortex", "01JQ8ZK4XY", "🙂", ""]) {
      expect(razao(corDoTextoDe(id), corDeFundoDe(id))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
