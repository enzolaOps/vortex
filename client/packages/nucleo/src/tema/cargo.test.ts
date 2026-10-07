import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  corDeCargo,
  ehHolografico,
  FIM_DO_GRADIENTE,
  gradienteParaGravar,
  HOLOGRAFICO,
  lerGradiente,
  pinturaDeCargo,
  TINTA_HOLOGRAFICA,
} from "./cargo";
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

describe("gradiente de cargo", () => {
  /*
    ⚠ **O pareamento com o SERVIDOR, lido do disco.** O editor grava uma
    string que o `api` valida com `RE_COLOUR`; se a forma daqui divergir da
    regex de lá, salvar o cargo volta 400 e a pessoa vê "não deu para salvar"
    sem saber por quê. Copiar a regex para este arquivo seria a duplicação
    que apodreceu em `corDeFundoDeMatiz` — então ela é lida de onde o
    servidor a compila.
  */
  const rust = readFileSync(
    new URL(
      "../../../../../server/crates/core/models/src/v0/server_members.rs",
      import.meta.url,
    ),
    "utf8",
  );
  const fonte = /RE_COLOUR[\s\S]*?Regex::new\(r"(.*)"\)/.exec(rust)?.[1];

  it("a regex do servidor foi encontrada — sem ela o teste abaixo não prova nada", () => {
    expect(fonte).toBeDefined();
    expect(fonte).toContain("gradient");
  });

  const RE_COLOUR = new RegExp((fonte ?? "$^").replace(/^\(\?i\)/, ""), "i");
  const AMOSTRAS = ["#35C2CC", "#46C98A", "#E2B15C", "#E8596B", "#8B7BE8", "#6E7783"];

  it("o que o editor grava o servidor aceita — para toda amostra", () => {
    for (const de of AMOSTRAS) {
      const gravada = gradienteParaGravar(de, FIM_DO_GRADIENTE);
      expect(RE_COLOUR.test(gravada), gravada).toBe(true);
      expect(gravada.length).toBeLessThanOrEqual(128);
    }
  });

  it("volta a ler o que gravou, com as mesmas paradas", () => {
    const g = lerGradiente(gradienteParaGravar("#35c2cc", FIM_DO_GRADIENTE))!;
    expect(g.direcao).toBe("90deg");
    expect(g.paradas.map((p) => p.hex)).toEqual(["#35c2cc", "#8b7be8"]);
  });

  it("aceita a gramática do servidor que dá para desenhar com contraste", () => {
    expect(lerGradiente("linear-gradient(to right, #fff, #000)")?.direcao).toBe("to right");
    expect(lerGradiente("linear-gradient(#fff, #000)")?.direcao).toBe("180deg");
    expect(lerGradiente("linear-gradient(100deg in oklch, #8FE9F0, #C9B6F5 45%, #F3C6A8)")?.paradas)
      .toEqual([{ hex: "#8fe9f0" }, { hex: "#c9b6f5", pos: 45 }, { hex: "#f3c6a8" }]);
  });

  /*
    ⚠ **Segurança, não gosto.** `colour` é escrito por quem administra
    QUALQUER servidor onde a pessoa esteja, e o `RE_COLOUR` aceita `var(--…)`,
    que leria os tokens deste app. Cada caso abaixo é um jeito de fazer um
    caractere de terceiro chegar ao `style`.
  */
  it("recusa tudo que não é hex reconstruível", () => {
    for (const hostil of [
      "linear-gradient(90deg, #fff, url(https://x/y.png))",
      "linear-gradient(90deg, var(--vx-accent), #000)",
      "linear-gradient(90deg, rgb(1, 2, 3), #000)",
      "linear-gradient(90deg, #fff, #000);background:url(https://x)",
      "linear-gradient(90deg, red, blue)",
      "linear-gradient(90deg, #fff)",
      "linear-gradient(, #fff, #000)",
      "linear-gradient(90deg, #fff, #000) , url(x)",
      "expression(alert(1))",
    ]) {
      expect(lerGradiente(hostil), hostil).toBeUndefined();
      expect(pinturaDeCargo(hostil, "escuro"), hostil).toBeUndefined();
    }
  });

  it("a saída é RECONSTRUÍDA — a caixa e o espaço de quem escreveu não sobrevivem", () => {
    const p = pinturaDeCargo("LINEAR-GRADIENT(  90DEG ,  #FFFFFF ,#000000  )", "escuro");
    expect(p?.tipo).toBe("gradiente");
    if (p?.tipo !== "gradiente") return;
    expect(p.texto).toMatch(/^linear-gradient\(in oklab 90deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
  });

  it("toda parada passa 4,5:1 em todas as superfícies, e a interpolação é oklab", () => {
    for (const modo of MODOS) {
      const tokens = derivar(SEMENTE_PADRAO[modo]);
      for (const de of MATIZES) {
        const bruta = gradienteParaGravar(
          corBruta(de, 0.16),
          corBruta((de + 120) % 360, 0.37),
        );
        const p = pinturaDeCargo(bruta, modo);
        expect(p?.tipo).toBe("gradiente");
        if (p?.tipo !== "gradiente") continue;
        // Interpolar em sRGB passaria por L diferente entre duas paradas de
        // mesmo L; é o `in oklab` que estende a garantia ao gradiente inteiro.
        expect(p.texto).toContain("in oklab");
        for (const hex of p.texto.match(/#[0-9a-f]{6}/g)!) {
          for (const s of SUPERFICIES) {
            expect(razao(hex, tokens[s]), `${bruta} ${modo} ${s}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });

  it("onde o gradiente não entra, sobra a PRIMEIRA parada — e não mais a ausência", () => {
    const bruta = gradienteParaGravar("#35C2CC", FIM_DO_GRADIENTE);
    expect(corDeCargo(bruta, "escuro")).toBe(corDeCargo("#35C2CC", "escuro"));
  });

  describe("holográfico", () => {
    it("o preset passa no RE_COLOUR do servidor", () => {
      expect(RE_COLOUR.test(HOLOGRAFICO), HOLOGRAFICO).toBe(true);
    });

    it("é reconhecido pelas PARADAS, não pelo texto", () => {
      expect(ehHolografico(lerGradiente(HOLOGRAFICO))).toBe(true);
      expect(
        ehHolografico(lerGradiente("LINEAR-GRADIENT(100deg,#8fe9f0,#c9b6f5 45%,#f3c6a8)")),
      ).toBe(true);
      // Uma parada fora do lugar é um gradiente comum.
      expect(
        ehHolografico(lerGradiente("linear-gradient(100deg, #8FE9F0, #C9B6F5 40%, #F3C6A8)")),
      ).toBe(false);
      expect(pinturaDeCargo(gradienteParaGravar("#8FE9F0", "#F3C6A8"), "escuro")?.tipo).toBe(
        "gradiente",
      );
    });

    it("toda parada do nome passa 4,5:1 nas quatro superfícies, nos dois temas", () => {
      for (const modo of MODOS) {
        const tokens = derivar(SEMENTE_PADRAO[modo]);
        const p = pinturaDeCargo(HOLOGRAFICO, modo);
        expect(p?.tipo).toBe("holografico");
        if (p?.tipo !== "holografico") continue;
        const paradas = p.texto.match(/#[0-9a-f]{6}/g)!;
        expect(paradas).toHaveLength(3);
        for (const hex of paradas) {
          for (const s of SUPERFICIES) {
            expect(razao(hex, tokens[s]), `${modo} ${hex} ${s}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    });

    it("no escuro o nome é o do design byte a byte; no claro vai para o clamp", () => {
      const escuro = pinturaDeCargo(HOLOGRAFICO, "escuro");
      const claro = pinturaDeCargo(HOLOGRAFICO, "claro");
      if (escuro?.tipo !== "holografico" || claro?.tipo !== "holografico") {
        throw new Error("não reconheceu o preset");
      }
      expect(escuro.texto).toBe(
        "linear-gradient(in oklab 100deg, #8fe9f0, #c9b6f5 45%, #f3c6a8)",
      );
      expect(claro.texto).not.toContain("#8fe9f0");
    });

    it("a tinta da pílula passa 4,5:1 contra as três paradas do fundo", () => {
      for (const hex of ["#8FE9F0", "#C9B6F5", "#F3C6A8"]) {
        expect(razao(TINTA_HOLOGRAFICA, hex), hex).toBeGreaterThanOrEqual(4.5);
      }
      expect(pinturaDeCargo(HOLOGRAFICO, "claro")?.tipo === "holografico" &&
        pinturaDeCargo(HOLOGRAFICO, "claro")).toMatchObject({ fundo: HOLOGRAFICO });
    });
  });

  it("cônico e radial degradam para a primeira parada", () => {
    const p = pinturaDeCargo("conic-gradient(#35C2CC, #8B7BE8)", "claro");
    expect(p).toEqual({ tipo: "solida", cor: corDeCargo("#35C2CC", "claro") });
  });
});
