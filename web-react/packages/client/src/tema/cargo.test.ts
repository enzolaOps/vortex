import { describe, expect, it } from "vitest";

import { corDeCargo } from "./cargo";
import { hexParaOklch, oklchParaHex, razao } from "./cor";
import { derivar, SEMENTE_PADRAO, type Modo } from "./derivar";

/**
 * A cor de cargo é legível em QUALQUER matiz, nos dois temas.
 *
 * Este teste existe porque a alternativa — validar e avisar — protege quem lê
 * o aviso. Aqui o contraste é garantido por construção: o matiz é do servidor,
 * a luminosidade é do app, e em OKLCH o L é perceptualmente uniforme, então um
 * L fixo entrega o mesmo contraste em qualquer matiz.
 *
 * A varredura é a prova. Sem ela, "é previsível" seria só uma afirmação num
 * comentário — que foi exatamente o que existia antes, e o que deixou 22 de 22
 * nomes reprovando no tema claro.
 */

const SUPERFICIES = [
  "--vx-surface-0",
  "--vx-surface-1",
  "--vx-surface-2",
  "--vx-surface-3",
] as const;

const MODOS: Modo[] = ["escuro", "claro"];

/** Passo de 15° cobre as 24 famílias de matiz sem varrer 360 vezes. */
const MATIZES = Array.from({ length: 24 }, (_, i) => i * 15);

/** Croma cru do servidor: cinza, moderado, e além do gamut sRGB. */
const CROMAS = [0, 0.08, 0.16, 0.37];

/** Um hex qualquer com aquele matiz e croma — é o que o servidor mandaria. */
function corBruta(matiz: number, croma: number): string {
  // O L aqui é irrelevante de propósito: `corDeCargo` o substitui, e usar um
  // valor médio prova isso sem esconder o efeito.
  return oklchParaHex({ l: 0.5, c: croma, h: matiz });
}

describe("cor de cargo", () => {
  for (const modo of MODOS) {
    const tokens = derivar(SEMENTE_PADRAO[modo]);

    it(`passa 4,5:1 em todas as superfícies, todo matiz — tema ${modo}`, () => {
      const reprovados: string[] = [];

      for (const matiz of MATIZES) {
        for (const croma of CROMAS) {
          const cor = corDeCargo(corBruta(matiz, croma), modo)!;
          expect(cor).toBeDefined();

          for (const s of SUPERFICIES) {
            const r = razao(cor, tokens[s]);
            if (r < 4.5) {
              reprovados.push(
                `matiz ${matiz} croma ${croma} sobre ${s}: ${r.toFixed(2)}:1`,
              );
            }
          }
        }
      }

      expect(reprovados).toEqual([]);
    });
  }

  it("o L do servidor é DESCARTADO — é o que fecha o furo", () => {
    /*
      Um cargo quase branco e um quase preto, mesmo matiz, têm que sair com a
      MESMA luminosidade — porque é o L que decide legibilidade, e ele passou
      a ser do app.

      A asserção NÃO é igualdade de hex, e as duas primeiras versões deste
      teste erraram por isso. Hex tem 8 bits por canal: o croma recuperado de
      uma cor clara tem precisão muito mais grossa que o de uma escura, então
      os dois hexes diferem no último dígito mesmo com o L já igualado. Isso é
      quantização, não o clamp falhando — e afirmar igualdade exata testaria a
      aritmética de ponto flutuante em vez da propriedade que importa.

      O que importa é: mesmo L, logo mesmo contraste, logo legível dos dois
      lados. É isso que está escrito abaixo.
    */
    const quaseBranco = oklchParaHex({ l: 0.95, c: 0.04, h: 280 });
    const quasePreto = oklchParaHex({ l: 0.15, c: 0.04, h: 280 });

    const lDe = (hex: string) => hexParaOklch(corDeCargo(hex, "claro")!).l;
    expect(lDe(quaseBranco)).toBeCloseTo(lDe(quasePreto), 2);

    const claro = derivar(SEMENTE_PADRAO.claro);
    for (const bruta of [quaseBranco, quasePreto]) {
      expect(
        razao(corDeCargo(bruta, "claro")!, claro["--vx-surface-3"]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("o MATIZ do servidor sobrevive — o cargo continua reconhecível", () => {
    // O outro lado do contrato: se o clamp achatasse o matiz junto, todo
    // cargo sairia da mesma cor e o recurso perderia o sentido.
    const verde = corDeCargo(oklchParaHex({ l: 0.5, c: 0.12, h: 150 }), "escuro")!;
    const vermelho = corDeCargo(oklchParaHex({ l: 0.5, c: 0.12, h: 25 }), "escuro")!;

    expect(verde).not.toBe(vermelho);
  });

  it("cor ausente ou inválida vira ausência, nunca uma string crua", () => {
    expect(corDeCargo(undefined, "escuro")).toBeUndefined();
    // O protocolo permite gradiente CSS em cargo; devolver a string crua
    // reabriria o furo que este arquivo existe para fechar.
    expect(corDeCargo("linear-gradient(red, blue)", "escuro")).toBeUndefined();
  });
});
