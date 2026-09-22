import { describe, expect, it } from "vitest";

import {
  ehTeclaDeGrade,
  proximaCelula,
  type Celula,
} from "./navegacaoDeGrade";

/**
 * Uma grade regular de `colunas` por `fileiras`, células de 32×32 com 4 de vão.
 *
 * As medidas são as do painel de emoji, e os números importam: a regra de
 * fileira compara o CRUZAMENTO vertical com metade da menor altura, então uma
 * grade construída com vão zero passaria por acidente.
 */
function grade(colunas: number, fileiras: number): Celula[] {
  const celulas: Celula[] = [];
  for (let f = 0; f < fileiras; f++) {
    for (let c = 0; c < colunas; c++) {
      celulas.push({ x: c * 36, y: f * 36, largura: 32, altura: 32 });
    }
  }
  return celulas;
}

describe("ehTeclaDeGrade", () => {
  it("aceita as seis teclas de navegação e recusa o resto", () => {
    for (const t of [
      "ArrowRight",
      "ArrowLeft",
      "ArrowDown",
      "ArrowUp",
      "Home",
      "End",
    ]) {
      expect(ehTeclaDeGrade(t)).toBe(true);
    }
    /* Enter e Esc NÃO são daqui: o botão nativo já responde ao primeiro e o
       `Popover` ao segundo. Consumi-los aqui roubaria os dois. */
    for (const t of ["Enter", "Escape", " ", "Tab", "a"]) {
      expect(ehTeclaDeGrade(t)).toBe(false);
    }
  });
});

describe("proximaCelula", () => {
  it("anda em ordem de leitura na horizontal, atravessando a fileira", () => {
    const g = grade(4, 3);
    expect(proximaCelula(g, 0, "ArrowRight")).toBe(1);
    /* Da última coluna, a direita cai na primeira da fileira seguinte — é o
       que uma grade faz, e procurar o vizinho geométrico pararia aqui. */
    expect(proximaCelula(g, 3, "ArrowRight")).toBe(4);
    expect(proximaCelula(g, 4, "ArrowLeft")).toBe(3);
  });

  it("desce e sobe uma fileira mantendo a coluna", () => {
    const g = grade(4, 3);
    expect(proximaCelula(g, 1, "ArrowDown")).toBe(5);
    expect(proximaCelula(g, 5, "ArrowDown")).toBe(9);
    expect(proximaCelula(g, 9, "ArrowUp")).toBe(5);
  });

  it("devolve undefined nas bordas, para a tecla passar", () => {
    const g = grade(4, 3);
    expect(proximaCelula(g, 0, "ArrowLeft")).toBeUndefined();
    expect(proximaCelula(g, 0, "ArrowUp")).toBeUndefined();
    expect(proximaCelula(g, 11, "ArrowRight")).toBeUndefined();
    expect(proximaCelula(g, 11, "ArrowDown")).toBeUndefined();
    expect(proximaCelula(g, 0, "Home")).toBeUndefined();
    expect(proximaCelula(g, 11, "End")).toBeUndefined();
  });

  it("Home e End vão aos extremos", () => {
    const g = grade(4, 3);
    expect(proximaCelula(g, 7, "Home")).toBe(0);
    expect(proximaCelula(g, 7, "End")).toBe(11);
  });

  it("entra na primeira célula quando o foco está fora da grade", () => {
    const g = grade(4, 3);
    /* É como o teclado chega à grade: Tab pousa no container rolável, e a
       primeira seta tem de entrar em vez de rolar. */
    expect(proximaCelula(g, -1, "ArrowDown")).toBe(0);
    expect(proximaCelula(g, -1, "ArrowUp")).toBe(0);
    expect(proximaCelula(g, -1, "ArrowRight")).toBe(0);
  });

  it("grade vazia não tem para onde ir", () => {
    expect(proximaCelula([], -1, "ArrowDown")).toBeUndefined();
    expect(proximaCelula([], 0, "End")).toBeUndefined();
  });

  it("última fileira incompleta: desce para a coluna mais próxima que existe", () => {
    /*
      Duas fileiras de 4 e uma de 2. Descendo da coluna 3 (índice 7) não há
      célula naquela coluna abaixo — a resposta certa é a mais próxima na
      horizontal, e não `undefined`: a fileira EXISTE.
    */
    const g = [...grade(4, 2), { x: 0, y: 72, largura: 32, altura: 32 }, { x: 36, y: 72, largura: 32, altura: 32 }];
    expect(proximaCelula(g, 7, "ArrowDown")).toBe(9);
    expect(proximaCelula(g, 6, "ArrowDown")).toBe(9);
    expect(proximaCelula(g, 4, "ArrowDown")).toBe(8);
  });

  it("masonry: a fileira é descoberta pelo cruzamento, não pelo índice", () => {
    /*
      Três colunas de alturas diferentes, como o grid de GIF. As duas
      primeiras caixas da coluna 0 e 1 se cruzam no topo; a da coluna 2 é
      curta e a SEGUNDA dela ainda cruza a primeira fileira.

      Dividir índice por número de colunas devolveria a caixa errada aqui —
      é exatamente o caso que a heurística por cruzamento existe para cobrir.
    */
    const g: Celula[] = [
      { x: 0, y: 0, largura: 100, altura: 120 }, // 0 · coluna 0
      { x: 108, y: 0, largura: 100, altura: 80 }, // 1 · coluna 1
      { x: 216, y: 0, largura: 100, altura: 140 }, // 2 · coluna 2
      { x: 108, y: 88, largura: 100, altura: 60 }, // 3 · abaixo da 1
      { x: 0, y: 128, largura: 100, altura: 90 }, // 4 · abaixo da 0
    ];
    /* Da 1 (curta) desce para a 3, que é a próxima naquela coluna. */
    expect(proximaCelula(g, 1, "ArrowDown")).toBe(3);
    /*
      ⚠ Da 0 (alta) o destino é a 4 e NÃO a 3, e é o cruzamento que decide: a
      caixa 3 começa em y=88 e a 0 vai até 120, então as duas se cruzam em
      32px — mais da metade da altura da menor. Pelo critério, a 3 ainda é
      VIZINHA da 0, não está abaixo dela; quem está abaixo é a 4.

      O resultado é o que se quer numa masonry: descer mantém a coluna em vez
      de pular de lado por causa de uma caixa curta ao lado.
    */
    expect(proximaCelula(g, 0, "ArrowDown")).toBe(4);
    /* Subindo da 4 volta para a fileira de y=88, ou seja a 3. */
    expect(proximaCelula(g, 4, "ArrowUp")).toBe(3);
  });

  it("índice fora da lista entra na primeira, em vez de estourar", () => {
    const g = grade(2, 2);
    expect(proximaCelula(g, 99, "ArrowDown")).toBe(0);
  });
});
