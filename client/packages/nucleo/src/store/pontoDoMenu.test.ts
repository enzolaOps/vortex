import { beforeEach, describe, expect, it } from "vitest";

import {
  assinarPontoDoMenu,
  definirPontoDoMenu,
  lerPontoDoMenu,
  limparPontoDoMenu,
  pontoNoDom,
  selecaoDentroDe,
} from "./pontoDoMenu";

/**
 * O que estava sob o ponteiro — a quebra nº 7 da auditoria de clique direito.
 *
 * ⚠ **O que estes testes protegem é a DISTINÇÃO entre os três alvos**, e ela é
 * invisível em typecheck: um anexo é `<a href download>` e um link de texto é
 * `<a href>`. Tratar os dois igual ofereceria "Abrir link" para um `.pdf`, que
 * no navegador é baixar por outro nome — e "Copiar endereço do link" para uma
 * URL que ninguém escreveu.
 */
describe("ponto do menu", () => {
  beforeEach(() => {
    limparPontoDoMenu();
    document.body.innerHTML = "";
  });

  function montar(html: string): HTMLElement {
    document.body.innerHTML = `<article data-menu-mensagem="m1">${html}</article>`;
    return document.querySelector<HTMLElement>("[data-menu-mensagem]")!;
  }

  function em(seletor: string): Element {
    const no = document.querySelector(seletor);
    if (!no) throw new Error(`sem ${seletor}`);
    return no;
  }

  it("o LINK de texto vira link, e não arquivo", () => {
    const linha = montar('<a href="https://exemplo.test/a" id="l">site</a>');
    const p = pontoNoDom(em("#l"), linha);
    expect(p.link).toBe("https://exemplo.test/a");
    expect(p.arquivo).toBeUndefined();
    expect(p.imagem).toBeUndefined();
  });

  /*
    ⚠ O caso que justifica olhar o `download` em vez da extensão: um anexo é um
    `<a href download>`, e "Abrir link" nele é baixar por outro nome.
  */
  it("o ANEXO vira arquivo, e não link", () => {
    const linha = montar(
      '<a href="https://exemplo.test/f" download="nota.pdf" id="a">nota.pdf</a>',
    );
    const p = pontoNoDom(em("#a"), linha);
    expect(p.arquivo).toBe("https://exemplo.test/f");
    expect(p.link).toBeUndefined();
  });

  it("a IMAGEM leva o nome junto, para salvar com ele", () => {
    const linha = montar('<img id="i" src="https://exemplo.test/i.png" alt="mapa.png">');
    const p = pontoNoDom(em("#i"), linha);
    expect(p.imagem).toBe("https://exemplo.test/i.png");
    expect(p.nomeDaImagem).toBe("mapa.png");
  });

  it("`alt` vazio não vira nome — o fallback fica com quem salva", () => {
    const linha = montar('<img id="i" src="https://exemplo.test/i.png" alt="">');
    expect(pontoNoDom(em("#i"), linha).nomeDaImagem).toBeUndefined();
  });

  it("texto liso não tem nada sob o ponteiro, e devolve a MESMA referência", () => {
    const linha = montar("<p id='t'>só texto</p>");
    const a = pontoNoDom(em("#t"), linha);
    const b = pontoNoDom(em("#t"), linha);
    /* Armadilha nº 1 do briefing: referência nova a cada leitura faria o
       `useSyncExternalStore` do menu concluir que mudou a cada render. */
    expect(Object.is(a, b)).toBe(true);
    expect(a.link).toBeUndefined();
  });

  /* Pato e não `instanceof`: no popout o alvo vem de outro `window`. */
  it("alvo sem `closest` não quebra", () => {
    expect(pontoNoDom({} as EventTarget, null).selecao).toBe("");
    expect(pontoNoDom(null, null).link).toBeUndefined();
  });

  describe("seleção", () => {
    function selecionar(no: Node): void {
      const faixa = document.createRange();
      faixa.selectNodeContents(no);
      const sel = document.defaultView?.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(faixa);
    }

    it("conta quando está DENTRO da linha alvo", () => {
      const linha = montar("<p id='t'>uma frase inteira</p>");
      selecionar(em("#t"));
      expect(selecaoDentroDe(linha)).toBe("uma frase inteira");
    });

    /*
      ⚠ **O caso que o `contains` existe para pegar.** Selecionar num lugar e
      clicar com o direito noutro é o gesto mais comum de quem lê rolando — sem
      o teste, "Copiar seleção" apareceria no menu de uma mensagem oferecendo o
      texto de OUTRA, e o erro só apareceria na colagem.
    */
    it("NÃO conta quando a seleção está em outra linha", () => {
      document.body.innerHTML = `
        <article data-menu-mensagem="a"><p id="a">texto da A</p></article>
        <article data-menu-mensagem="b"><p id="b">texto da B</p></article>
      `;
      selecionar(em("#a"));
      const b = document.querySelector<HTMLElement>('[data-menu-mensagem="b"]')!;
      expect(selecaoDentroDe(b)).toBe("");
    });

    /*
      ⚠ Um clique simples deixa uma seleção de comprimento zero ancorada onde
      se clicou, e ela PASSA no `contains`. Sem `isCollapsed` o item apareceria
      em todo clique direito, com texto vazio.
    */
    it("seleção colapsada não conta", () => {
      const linha = montar("<p id='t'>uma frase</p>");
      const faixa = document.createRange();
      faixa.setStart(em("#t").firstChild!, 2);
      faixa.collapse(true);
      const sel = document.defaultView?.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(faixa);
      expect(selecaoDentroDe(linha)).toBe("");
    });
  });

  /*
    ⚠ **Comparação por CAMPO, como no alvo do menu.** Quem chama monta o objeto
    no handler, então dois gestos sobre o mesmo ponto produzem dois objetos
    diferentes — por referência, o menu re-renderizaria à toa a cada clique.
  */
  it("o store só avisa quando algo MUDA de verdade", () => {
    let avisos = 0;
    const parar = assinarPontoDoMenu(() => {
      avisos += 1;
    });
    const p = {
      selecao: "oi",
      link: undefined,
      imagem: undefined,
      nomeDaImagem: undefined,
      arquivo: undefined,
    };

    definirPontoDoMenu(p);
    expect(avisos).toBe(1);

    const antes = lerPontoDoMenu();
    definirPontoDoMenu({ ...p });
    expect(Object.is(lerPontoDoMenu(), antes)).toBe(true);
    expect(avisos).toBe(1);

    definirPontoDoMenu({ ...p, selecao: "outra" });
    expect(avisos).toBe(2);

    parar();
    definirPontoDoMenu({ ...p, selecao: "terceira" });
    expect(avisos).toBe(2);
  });
});
