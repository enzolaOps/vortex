import { describe, expect, it } from "vitest";

import { recortarComDestaque, termosDaConsulta, textoDaPrevia } from "./trecho";

const nome = (id: string) => (id === "U1" ? "Ana" : "Alguém");

describe("textoDaPrevia", () => {
  it("tira a marcação e resolve a menção para o nome", () => {
    expect(textoDaPrevia("**oi** <@U1>, veja [isto](https://a.com)\n\nfim", nome)).toBe(
      "oi @Ana, veja isto fim",
    );
  });

  it("não explode com conteúdo vazio", () => {
    expect(textoDaPrevia("", nome)).toBe("");
  });
});

describe("termosDaConsulta", () => {
  it("separa palavras sem repetir", () => {
    expect(termosDaConsulta("  prazo  entrega prazo ")).toEqual(["prazo", "entrega"]);
  });
});

describe("recortarComDestaque", () => {
  const junto = (p: ReturnType<typeof recortarComDestaque>) => p.map((x) => x.texto).join("");

  it("marca sem diferenciar caixa nem acento", () => {
    const r = recortarComDestaque("Falei com o João ontem", ["joao"]);
    expect(r.filter((p) => p.destaque).map((p) => p.texto)).toEqual(["João"]);
    expect(junto(r)).toBe("Falei com o João ontem");
  });

  it("marca todas as ocorrências", () => {
    const r = recortarComDestaque("sim e sim", ["sim"]);
    expect(r.filter((p) => p.destaque)).toHaveLength(2);
  });

  it("recorta em volta do primeiro termo quando o texto é longo", () => {
    const longo = `${"a ".repeat(200)}procurado ${"b ".repeat(200)}`;
    const r = recortarComDestaque(longo, ["procurado"], 80);
    expect(junto(r).length).toBeLessThanOrEqual(82);
    expect(r[0]?.texto).toBe("…");
    expect(r.some((p) => p.destaque && p.texto === "procurado")).toBe(true);
  });

  it("sem termo devolve o começo, sem destaque", () => {
    const r = recortarComDestaque("olá mundo", []);
    expect(r).toEqual([{ texto: "olá mundo", destaque: false }]);
  });

  it("trata caractere especial como texto", () => {
    const r = recortarComDestaque("custa (R$ 5)", ["(R$"]);
    expect(r.find((p) => p.destaque)?.texto).toBe("(R$");
  });
});
