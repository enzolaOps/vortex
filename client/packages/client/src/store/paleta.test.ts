import { afterEach, describe, expect, it } from "vitest";

import { limparModais, lerModal } from "./modais";
import { abrirPaleta, abrirPaletaCom, lerBuscaInicial } from "./paleta";

describe("busca inicial da paleta", () => {
  afterEach(() => limparModais());

  it("abrir com um filtro escreve o prefixo no campo", () => {
    abrirPaletaCom("@");
    expect(lerModal()).toBe("paleta");
    expect(lerBuscaInicial()).toBe("@");
  });

  /* O atalho e o botão da coluna de canais abrem SEM filtro — um `@` que
     sobrasse da última abertura filtraria a paleta sem ninguém ter pedido. */
  it("abrir pelo atalho zera o filtro que sobrou", () => {
    abrirPaletaCom("@");
    limparModais();
    abrirPaleta();
    expect(lerModal()).toBe("paleta");
    expect(lerBuscaInicial()).toBe("");
  });

  /* Leitura pura: o `StrictMode` chama o inicializador do `useState` duas
     vezes, e um valor consumido na primeira faria a segunda abrir sem filtro. */
  it("ler não consome", () => {
    abrirPaletaCom("@");
    lerBuscaInicial();
    expect(lerBuscaInicial()).toBe("@");
  });
});
