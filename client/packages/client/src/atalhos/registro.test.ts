import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ATALHOS, GRUPOS_DA_PAGINA, linhasDaPagina } from "./registro";
import { mesmaCombinacao } from "../store/atalhosDeVoz";

/**
 * O registro é o MECANISMO contra "atalho anunciado sem handler".
 *
 * A garantia mais forte é do TIPO — `escopo: "documento" | "composer"` exige
 * `executar`, e não existe variante "aparece e não faz nada". O que o tipo não
 * cobre e estes testes cobrem é o que muda depois: combinação duplicada,
 * `ligadoEm` apontando para um arquivo que sumiu, e a página deixando de
 * refletir o registro.
 */
describe("registro de atalhos", () => {
  it("nenhum atalho fica sem quem o execute", () => {
    for (const a of ATALHOS) {
      if (a.escopo === "documento" || a.escopo === "composer") {
        expect(typeof a.executar, a.id).toBe("function");
      } else if (a.escopo === "nativo") {
        /* A razão POR ESCRITO é o preço de não ter função: sem ela, "nativo"
           viraria a porta dos fundos por onde qualquer atalho entraria sem
           implementação. */
        expect(a.porque.length, a.id).toBeGreaterThan(20);
      } else {
        expect(a.ligadoEm.length, a.id).toBeGreaterThan(0);
      }
    }
  });

  /**
   * ⚠ **`ligadoEm` é prosa que envelhece sem isto.** Ela nomeia um arquivo que
   * pode ser renomeado, apagado ou perder o listener num refactor, e o sintoma
   * seria a página anunciando "Atender chamada ⌘↵" com ninguém escutando —
   * exatamente o defeito que o registro inteiro existe para matar.
   */
  it("toda superfície nomeada em `ligadoEm` existe e escuta teclado", () => {
    const raiz = fileURLToPath(new URL("..", import.meta.url));
    for (const a of ATALHOS) {
      if (a.escopo !== "superficie") continue;
      const fonte = readFileSync(raiz + a.ligadoEm, "utf8");
      expect(fonte, a.id).toContain("keydown");
    }
  });

  /**
   * Duas entradas com a mesma combinação e escopo `documento` seriam uma que
   * nunca dispara — o laço do listener para na primeira que casa, e qual das
   * duas ganha depende da ordem do array, que ninguém pensou como ordem.
   */
  it("nenhuma combinação global se repete", () => {
    const globais = ATALHOS.filter((a) => a.escopo === "documento");
    for (const a of globais) {
      const iguais = globais.filter((b) =>
        mesmaCombinacao(a.combinacao, b.combinacao),
      );
      expect(iguais.map((x) => x.id)).toEqual([a.id]);
    }
  });

  it("toda entrada da página cai num grupo da página", () => {
    for (const l of linhasDaPagina()) {
      expect(GRUPOS_DA_PAGINA, l.id).toContain(l.grupo);
    }
  });

  /**
   * O par vira UMA linha, com os modificadores escritos uma vez só.
   *
   * ⚠ Repeti-los daria `⌥⌘↑ ⌥⌘↓` — o dobro de tinta para a mesma informação,
   * e não é o que o design escreve (`⌥⌘↑/↓`).
   */
  it("junta as duas direções de um par numa linha só", () => {
    const linha = linhasDaPagina().find((l) => l.id === "servidor");
    expect(linha?.rotulo).toBe("Servidor anterior / próximo");
    expect(linha?.teclas).toEqual(["mod", "alt", "↑ / ↓"]);
  });

  /**
   * A tecla é gravada em notação NEUTRA. O glifo só aparece na exibição, e é
   * a diferença entre mostrar "Ctrl" a quem usa Mac e não mostrar.
   */
  it("nenhuma linha carrega o glifo do Mac", () => {
    for (const l of linhasDaPagina()) {
      for (const t of l.teclas) {
        expect(t, `${l.id}: ${t}`).not.toMatch(/[⌘⌥⇧]/);
      }
    }
  });

  /**
   * ⚠ **O rótulo tem de se sustentar SOZINHO, e a paleta é quem cobra.**
   * Ele aparece em duas superfícies: a página, onde o par vira "Servidor
   * anterior / próximo", e a lista de ações da paleta, onde cada entrada
   * aparece isolada. A primeira versão gravava "próximo" no `rotulo` da
   * segunda direção — certo na página e inútil na paleta, que mostrava cinco
   * linhas dizendo "próximo" e "anterior" sem dizer de quê. Quem encurta é a
   * página (`rotuloNoPar`), nunca o registro.
   */
  it("todo rótulo começa em maiúscula, para valer sozinho", () => {
    for (const a of ATALHOS) {
      expect(a.rotulo[0], a.id).toBe(a.rotulo[0]?.toUpperCase());
    }
  });

  it("os atalhos de voz entram na página com a combinação GRAVADA", () => {
    const mutar = linhasDaPagina().find((l) => l.id === "mutar");
    expect(mutar?.grupo).toBe("Voz e chamada");
    expect(mutar?.teclas).toEqual(["shift", "mod", "M"]);
  });
});
