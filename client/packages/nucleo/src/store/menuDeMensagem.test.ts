import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  alvoDeMensagem,
  alvoNoDom,
  assinarMenuDeMensagem,
  definirAlvoDoMenu,
  lerAlvoDoMenu,
  mirarAlvoDoMenu,
} from "./menuDeMensagem";

/**
 * O store que permitiu UM `ContextMenu` na lista em vez de um por linha.
 *
 * O que os testes guardam é a economia, não a feature: cada linha montada
 * assina este store, então "notificar só quando muda de verdade" é o que
 * separa acordar duas linhas de acordar as trinta visíveis a cada clique
 * direito. Um `if` a menos aqui não quebra nada visível e devolve o custo que
 * a mudança inteira existiu para eliminar.
 *
 * ⚠ **O alvo virou UNIÃO** — mensagem ou usuário —, e a mudança tem uma
 * consequência que estes testes existem para segurar: quem chama monta o
 * objeto no handler, então a comparação passou a ser por CAMPO. Fosse por
 * referência, dois cliques direitos na mesma linha produziriam dois objetos
 * diferentes e acordariam a lista à toa — exatamente o que o store veio
 * eliminar.
 */
describe("alvo do menu de mensagem", () => {
  beforeEach(() => definirAlvoDoMenu(null));

  it("guarda e devolve o alvo", () => {
    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(alvoDeMensagem()).toBe("m1");
    definirAlvoDoMenu(null);
    expect(lerAlvoDoMenu()).toBeNull();
    expect(alvoDeMensagem()).toBeNull();
  });

  it("NÃO avisa quando o alvo é o mesmo, ainda que o objeto seja outro", () => {
    const ouvinte = vi.fn();
    const parar = assinarMenuDeMensagem(ouvinte);

    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(ouvinte).toHaveBeenCalledTimes(1);

    // Clique direito duas vezes na MESMA linha: acontece o tempo todo, e cada
    // clique monta um objeto NOVO no handler. A segunda não deve acordar
    // ninguém — é o caso que a comparação por campo existe para cobrir.
    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(ouvinte).toHaveBeenCalledTimes(1);

    definirAlvoDoMenu({ tipo: "mensagem", id: "m2" });
    expect(ouvinte).toHaveBeenCalledTimes(2);
    parar();
  });

  it("mensagem e usuário de mesmo id são alvos DIFERENTES", () => {
    /*
      Os dois menus são o mesmo `ContextMenu`, e o que os separa é só o `tipo`.
      Comparar apenas o identificador faria o clique direito no autor abrir o
      menu da mensagem — sem erro nenhum, porque o alvo "não mudou".
    */
    const ouvinte = vi.fn();
    const parar = assinarMenuDeMensagem(ouvinte);

    definirAlvoDoMenu({ tipo: "mensagem", id: "x" });
    definirAlvoDoMenu({ tipo: "usuario", userId: "x" });
    expect(ouvinte).toHaveBeenCalledTimes(2);
    expect(lerAlvoDoMenu()).toEqual({ tipo: "usuario", userId: "x" });
    // E o atalho da linha diz "não sou eu" para alvo de usuário.
    expect(alvoDeMensagem()).toBeNull();
    parar();
  });

  it("para de avisar depois de cancelar a assinatura", () => {
    // Linha desmonta na velocidade do scroll. Ouvinte sem cleanup aqui é o
    // erro nº 5 do briefing — vazamento que só aparece na sexta hora.
    const ouvinte = vi.fn();
    assinarMenuDeMensagem(ouvinte)();

    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it("os getters devolvem valor comparável — nunca objeto novo", () => {
    /*
      A linha assina `alvoDeMensagem() === id`, um booleano sobre uma STRING, e
      é isso que faz trinta subscrições custarem duas re-renderizações.

      `lerAlvoDoMenu` devolve o objeto GUARDADO, não um recém-montado: quem o
      assina é o menu, um só, e um objeto novo a cada leitura seria a armadilha
      nº 1 do projeto — `useSyncExternalStore` concluindo que mudou a cada
      render, e loop.
    */
    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(Object.is(alvoDeMensagem(), alvoDeMensagem())).toBe(true);
    expect(typeof alvoDeMensagem()).toBe("string");
    expect(Object.is(lerAlvoDoMenu(), lerAlvoDoMenu())).toBe(true);
  });
});

/**
 * A guarda que a auditoria de clique direito pediu: **nenhum gatilho abre
 * menu vazio**.
 *
 * Três das seis quebras eram exatamente isso — mensagem de sistema, vão da
 * member list e cabeçalho de seção abriam uma caixa sem nenhum item. Uma caixa
 * vazia não dá erro, não some sozinha e parece um menu quebrado; quem a vê
 * conclui que o app está com defeito, e está certo.
 *
 * ⚠ **Estes casos vêm do DOM real das superfícies**, e é o que faz o teste
 * valer: a resolução deixou de ser um handler por linha e passou a ser uma
 * função pura sobre atributos. Errar um nome de atributo aqui devolveria
 * exatamente o defeito que a mudança veio matar.
 */
describe("alvo resolvido do DOM", () => {
  beforeEach(() => {
    definirAlvoDoMenu(null);
    document.body.innerHTML = "";
  });

  function montar(html: string): void {
    document.body.innerHTML = html;
  }

  function em(seletor: string): Element {
    const no = document.querySelector(seletor);
    if (!no) throw new Error(`sem ${seletor}`);
    return no;
  }

  it("a linha de mensagem devolve a mensagem", () => {
    montar('<article data-menu-mensagem="m1"><p id="texto">oi</p></article>');
    expect(alvoNoDom(em("#texto"))).toEqual({ tipo: "mensagem", id: "m1" });
  });

  it("a calha do autor GANHA da linha — clicar no avatar pergunta pela pessoa", () => {
    montar(
      '<article data-menu-mensagem="m1"><div data-menu-usuario="u1"><img id="avatar"></div></article>',
    );
    expect(alvoNoDom(em("#avatar"))).toEqual({ tipo: "usuario", userId: "u1" });
  });

  it("a linha da member list devolve a pessoa", () => {
    montar('<span data-menu-usuario="u9"><span id="nome">Ana</span></span>');
    expect(alvoNoDom(em("#nome"))).toEqual({ tipo: "usuario", userId: "u9" });
  });

  /*
    ⚠ Os quatro casos que abriam caixa vazia. A linha de SISTEMA é um
    `<article>` como as outras — era por `closest("article")` que ela passava.
  */
  it("sistema, vão, cabeçalho de seção e fora de tudo NÃO têm alvo", () => {
    montar(`
      <div id="vao"></div>
      <article id="sistema"><span id="frase">Marina entrou no canal</span></article>
      <div role="presentation"><h2 id="secao">fundação — 12</h2></div>
    `);
    expect(alvoNoDom(em("#vao"))).toBeNull();
    expect(alvoNoDom(em("#frase"))).toBeNull();
    expect(alvoNoDom(em("#secao"))).toBeNull();
    expect(alvoNoDom(null)).toBeNull();
  });

  /* Pato e não `instanceof`: no popout o alvo vem de outro `window`. */
  it("alvo sem `closest` não quebra — devolve ausência", () => {
    expect(alvoNoDom({} as EventTarget)).toBeNull();
    expect(alvoNoDom(document.createTextNode("oi"))).toBeNull();
  });

  it("`mirarAlvoDoMenu` GRAVA e responde na mesma chamada", () => {
    montar('<article data-menu-mensagem="m7"><p id="texto">oi</p></article>');

    expect(mirarAlvoDoMenu(em("#texto"))).toBe(true);
    expect(lerAlvoDoMenu()).toEqual({ tipo: "mensagem", id: "m7" });

    /*
      ⚠ **E LIMPA quando não há alvo.** Sem isso o menu recusaria abrir mas o
      store continuaria apontando para o gesto anterior — e o `⋯` da linha, que
      despacha o mesmo evento, agiria sobre a mensagem errada.
    */
    expect(mirarAlvoDoMenu(document.body)).toBe(false);
    expect(lerAlvoDoMenu()).toBeNull();
  });
});
