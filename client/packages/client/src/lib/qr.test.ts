import { describe, expect, it } from "vitest";

import {
  bitsDeFormato,
  bitsDeVersao,
  blocosDaVersao,
  gerarQr,
  mapaDeFuncao,
  multiplicarGf,
  restoRs,
  versaoPara,
  type MatrizQr,
} from "./qr";

/*
  Os vetores abaixo vêm da norma e do tutorial de referência (thonky.com):
  "HELLO WORLD" em 1-M e a tabela de bits de formato da correção M. Eles pegam
  o erro que o teste de ida e volta NÃO pega — um codificador e um decodificador
  escritos com o mesmo engano concordam entre si e discordam de toda câmera.
*/

describe("peças com vetor conhecido", () => {
  it("Reed-Solomon de HELLO WORLD em 1-M", () => {
    const dados = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(restoRs(dados, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it("bits de formato da correção M, as oito máscaras", () => {
    const esperado = [
      "101010000010010",
      "101000100100101",
      "101111001111100",
      "101101101001011",
      "100010111111001",
      "100000011001110",
      "100111110010111",
      "100101010100000",
    ];
    esperado.forEach((bits, m) => {
      expect(bitsDeFormato(m).toString(2).padStart(15, "0")).toBe(bits);
    });
  });

  it("bits de versão 7", () => {
    expect(bitsDeVersao(7).toString(2).padStart(18, "0")).toBe("000111110010010100");
  });

  it("versão mínima pela capacidade em bytes da correção M", () => {
    // Capacidades de byte da tabela oficial: v1 14, v2 26, v5 84, v10 213.
    expect(versaoPara(14)).toBe(1);
    expect(versaoPara(15)).toBe(2);
    expect(versaoPara(84)).toBe(5);
    expect(versaoPara(85)).toBe(6);
    expect(versaoPara(213)).toBe(10);
    expect(versaoPara(214)).toBeUndefined();
  });
});

/* ------------------------------------------------ decodificador de teste */

function lerFormato(m: MatrizQr): number {
  let bits = 0;
  const por = (x: number, y: number, i: number) => {
    if (m[y]![x]) bits |= 1 << i;
  };
  for (let i = 0; i <= 5; i++) por(8, i, i);
  por(8, 7, 6);
  por(8, 8, 7);
  por(7, 8, 8);
  for (let i = 9; i < 15; i++) por(14 - i, 8, i);
  return bits;
}

function avaliar(poli: readonly number[], x: number): number {
  let r = 0;
  for (const c of poli) r = multiplicarGf(r, x) ^ c;
  return r;
}

function decodificar(m: MatrizQr): string {
  const lado = m.length;
  const versao = (lado - 17) / 4;
  const formato = lerFormato(m);
  const mascara = ((formato ^ 0x5412) >>> 10) & 7;
  expect((formato ^ 0x5412) >>> 13).toBe(0); // correção M
  expect(bitsDeFormato(mascara)).toBe(formato);

  const funcao = mapaDeFuncao(versao);
  const fn: ((x: number, y: number) => boolean)[] = [
    (x, y) => (x + y) % 2 === 0,
    (_, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  const [total, ec, numBlocos] = blocosDaVersao(versao);
  const fluxo: number[] = [];
  let atual = 0;
  let n = 0;
  for (let direita = lado - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5;
    for (let vert = 0; vert < lado; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = direita - j;
        const y = ((direita + 1) & 2) === 0 ? lado - 1 - vert : vert;
        if (funcao[y]![x] || fluxo.length >= total) continue;
        const b = m[y]![x]! !== fn[mascara]!(x, y);
        atual = (atual << 1) | (b ? 1 : 0);
        if (++n === 8) {
          fluxo.push(atual);
          atual = 0;
          n = 0;
        }
      }
    }
  }
  expect(fluxo).toHaveLength(total);

  const curtos = numBlocos - (total % numBlocos);
  const tamanhoDeDados = (j: number) =>
    Math.floor(total / numBlocos) - ec + (j < curtos ? 0 : 1);
  const blocos: number[][] = Array.from({ length: numBlocos }, () => []);
  let k = 0;
  const maior = tamanhoDeDados(numBlocos - 1);
  for (let i = 0; i < maior; i++) {
    for (let j = 0; j < numBlocos; j++) {
      if (i < tamanhoDeDados(j)) blocos[j]!.push(fluxo[k++]!);
    }
  }
  for (let i = 0; i < ec; i++) {
    for (let j = 0; j < numBlocos; j++) blocos[j]!.push(fluxo[k++]!);
  }

  // Síndromes zero em todo bloco: a correção é consistente com os dados.
  let alfa = 1;
  for (let i = 0; i < ec; i++) {
    for (const b of blocos) expect(avaliar(b, alfa)).toBe(0);
    alfa = multiplicarGf(alfa, 2);
  }

  const dados = blocos.flatMap((b, j) => b.slice(0, tamanhoDeDados(j)));
  const bits = dados.flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (b >>> i) & 1));
  let p = 0;
  const ler = (q: number) => {
    let v = 0;
    for (let i = 0; i < q; i++) v = (v << 1) | bits[p++]!;
    return v;
  };
  expect(ler(4)).toBe(0b0100);
  const tamanho = ler(versao < 10 ? 8 : 16);
  const bytes = Uint8Array.from({ length: tamanho }, () => ler(8));
  return new TextDecoder().decode(bytes);
}

describe("gerarQr", () => {
  it("desenha os três localizadores e as faixas de sincronia", () => {
    const m = gerarQr("oi");
    const lado = m.length;
    expect(lado).toBe(21);
    for (const [x0, y0] of [
      [0, 0],
      [lado - 7, 0],
      [0, lado - 7],
    ] as const) {
      // Anel externo escuro, anel de dentro claro, miolo 3×3 escuro.
      expect(m[y0]![x0]).toBe(true);
      expect(m[y0 + 1]![x0 + 1]).toBe(false);
      expect(m[y0 + 3]![x0 + 3]).toBe(true);
    }
    for (let i = 8; i < lado - 8; i++) expect(m[6]![i]).toBe(i % 2 === 0);
    expect(m[lado - 8]![8]).toBe(true); // módulo sempre escuro
  });

  it.each([
    "oi",
    "http://localhost:5197/qr/abcdefghijklmnopqrstuvwxyz012345",
    "https://vortex.um-dominio-bem-comprido.example.com/qr/V1StGXR8_Z5jdHi6B-myT1StGXR8_Z5j",
    "ação — acentos e travessão em UTF-8",
    "x".repeat(213),
  ])("ida e volta: %s", (texto) => {
    expect(decodificar(gerarQr(texto))).toBe(texto);
  });

  it("toda máscara produz um QR decodificável", () => {
    const texto = "https://vortex.example.com/qr/0123456789abcdefghijklmnopqrstuv";
    for (let m = 0; m < 8; m++) expect(decodificar(gerarQr(texto, m))).toBe(texto);
  });

  it("recusa o que não cabe em vez de truncar", () => {
    expect(() => gerarQr("x".repeat(214))).toThrow();
  });
});
