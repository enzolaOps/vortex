import { describe, expect, it } from "vitest";

import { espelharEstilos, popoutVisivel } from "./popoutNoSistema";

const BASE = {
  fora: false,
  fechado: false,
  naSala: false,
  noSistema: false,
  principalComFoco: true,
} as const;

describe("popoutVisivel", () => {
  it("fora da chamada ou fechado pelo ✕, nunca aparece", () => {
    expect(popoutVisivel({ ...BASE, fora: true })).toBe(false);
    expect(popoutVisivel({ ...BASE, fechado: true })).toBe(false);
    expect(popoutVisivel({ ...BASE, noSistema: true, principalComFoco: false, fechado: true })).toBe(false);
  });

  it("lendo outro canal, aparece — cartão ou janela", () => {
    expect(popoutVisivel(BASE)).toBe(true);
    expect(popoutVisivel({ ...BASE, noSistema: true })).toBe(true);
  });

  /* O cartão com a sala aberta diria a mesma coisa duas vezes na mesma tela. */
  it("cartão: com a sala na coluna some, com foco ou sem", () => {
    expect(popoutVisivel({ ...BASE, naSala: true })).toBe(false);
    expect(popoutVisivel({ ...BASE, naSala: true, principalComFoco: false })).toBe(false);
  });

  /*
    A janela existe para quando a pessoa SAI do app: com a sala na coluna e o
    Vortex atrás de outro programa, ela é o único lugar da tela com a chamada.
  */
  it("janela: com a sala na coluna some só enquanto a principal está à frente", () => {
    expect(popoutVisivel({ ...BASE, noSistema: true, naSala: true, principalComFoco: true })).toBe(false);
    expect(popoutVisivel({ ...BASE, noSistema: true, naSala: true, principalComFoco: false })).toBe(true);
  });
});

describe("espelharEstilos", () => {
  function documentos() {
    const origem = document.implementation.createHTMLDocument("principal");
    const destino = document.implementation.createHTMLDocument("popout");
    return { origem, destino };
  }

  /* `createHTMLDocument` não tem janela: sem `MutationObserver` do reino, a
     cópia inicial acontece e o acompanhamento não. É o que os três primeiros
     casos medem. */
  it("copia as folhas e os atributos de <html> da principal", () => {
    const { origem, destino } = documentos();
    origem.documentElement.setAttribute("data-theme", "light");
    origem.documentElement.setAttribute("lang", "pt-BR");
    const estilo = origem.createElement("style");
    estilo.textContent = ".a { color: red }";
    const folha = origem.createElement("link");
    folha.rel = "stylesheet";
    folha.setAttribute("href", "/assets/index.css");
    origem.head.append(estilo, folha);

    espelharEstilos(origem, destino);

    expect(destino.documentElement.getAttribute("data-theme")).toBe("light");
    expect(destino.documentElement.getAttribute("lang")).toBe("pt-BR");
    const copias = destino.head.querySelectorAll('style, link[rel="stylesheet"]');
    expect(copias).toHaveLength(2);
    expect(copias[0]?.textContent).toBe(".a { color: red }");
  });

  it("não copia o que não é folha de estilo", () => {
    const { origem, destino } = documentos();
    const script = origem.createElement("script");
    script.textContent = "alert(1)";
    const preload = origem.createElement("link");
    preload.rel = "modulepreload";
    preload.setAttribute("href", "/assets/x.js");
    origem.head.append(script, preload);

    espelharEstilos(origem, destino);

    expect(destino.head.querySelectorAll("script, link")).toHaveLength(0);
  });

  it("atributo de <html> que só o destino tem é removido", () => {
    const { origem, destino } = documentos();
    destino.documentElement.setAttribute("data-theme", "dark");
    espelharEstilos(origem, destino);
    expect(destino.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  /* Com o documento global, que tem janela e `MutationObserver`. */
  it("acompanha: folha nova entra, folha que saiu sai, texto mudado é atualizado, tema troca", async () => {
    const origem = document;
    const destino = document.implementation.createHTMLDocument("popout");
    const primeira = origem.createElement("style");
    primeira.textContent = ".a{}";
    origem.head.append(primeira);

    const parar = espelharEstilos(origem, destino);
    const noDestino = () => destino.head.querySelectorAll("style");
    expect(noDestino()).toHaveLength(1);
    const copiaDaPrimeira = noDestino()[0];

    const segunda = origem.createElement("style");
    segunda.textContent = ".b{}";
    origem.head.append(segunda);
    primeira.textContent = ".a{color:red}";
    origem.documentElement.setAttribute("data-theme", "light");
    await new Promise((r) => setTimeout(r, 0));

    expect(noDestino()).toHaveLength(2);
    /* A cópia existente é ATUALIZADA, não trocada: trocar uma `<link>` faria
       a janela recarregar a folha e piscar sem estilo. */
    expect(noDestino()[0]).toBe(copiaDaPrimeira);
    expect(copiaDaPrimeira?.textContent).toBe(".a{color:red}");
    expect(destino.documentElement.getAttribute("data-theme")).toBe("light");

    segunda.remove();
    await new Promise((r) => setTimeout(r, 0));
    expect(noDestino()).toHaveLength(1);

    parar();
    origem.head.append(origem.createElement("style"));
    await new Promise((r) => setTimeout(r, 0));
    expect(noDestino()).toHaveLength(1);

    primeira.remove();
    origem.documentElement.removeAttribute("data-theme");
  });
});
