import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { Camera } from "../icones";
import { Avatar, Botao, PainelVidro, PilhaDeAvatares, Pilula } from "./index";
import { desmontar, montar, pegar, umSoAnel } from "./montar";

afterEach(desmontar);

describe("PainelVidro", () => {
  it("aplica a receita do vidro: desfoque, borda e elevação", () => {
    montar(<PainelVidro data-testid="p">conteúdo</PainelVidro>);
    const e = getComputedStyle(pegar('[data-testid="p"]')!);
    expect(e.backdropFilter).toContain("blur(28px)");
    expect(e.backdropFilter).toContain("saturate(1.6)");
    expect(e.borderTopWidth).toBe("1px");
    expect(e.boxShadow).not.toBe("none");
    expect(e.borderTopLeftRadius).toBe("18px");
  });

  it("variantes trocam a superfície e raios trocam o canto", () => {
    montar(
      <>
        <PainelVidro data-testid="a" variante="padrao" raio="xl" />
        <PainelVidro data-testid="b" variante="leitura" raio="pill" />
        <PainelVidro data-testid="c" variante="sobreposto" elevacao={3} />
      </>,
    );
    const fundo = (id: string) => getComputedStyle(pegar(`[data-testid="${id}"]`)!).backgroundColor;
    expect(new Set([fundo("a"), fundo("b"), fundo("c")]).size).toBe(3);
    expect(getComputedStyle(pegar('[data-testid="a"]')!).borderTopLeftRadius).toBe("22px");
    expect(parseFloat(getComputedStyle(pegar('[data-testid="b"]')!).borderTopLeftRadius)).toBeGreaterThan(100);
  });

  it("renderiza o elemento semântico pedido", () => {
    montar(<PainelVidro como="nav" aria-label="x" data-testid="n" />);
    expect(pegar('[data-testid="n"]')!.tagName).toBe("NAV");
  });
});

describe("Botao", () => {
  it("renderiza as quatro variantes e os dois tamanhos", () => {
    montar(
      <>
        <Botao data-testid="p">Entrar</Botao>
        <Botao data-testid="s" variante="secundario" tamanho="sm">Entrar</Botao>
        <Botao data-testid="f" variante="fantasma">Entrar</Botao>
        <Botao data-testid="d" variante="perigo">Entrar</Botao>
      </>,
    );
    const h = (id: string) => pegar(`[data-testid="${id}"]`)!.getBoundingClientRect().height;
    expect(h("p")).toBe(40);
    expect(h("s")).toBe(32);
    const fundo = (id: string) => getComputedStyle(pegar(`[data-testid="${id}"]`)!).backgroundColor;
    expect(new Set([fundo("p"), fundo("s"), fundo("d")]).size).toBe(3);
    expect(fundo("f")).toBe("rgba(0, 0, 0, 0)");
  });

  it("só ícone é quadrado e leva o nome acessível", () => {
    montar(<Botao data-testid="i" aria-label="Ligar câmera" icone={<Camera />} />);
    const r = pegar('[data-testid="i"]')!.getBoundingClientRect();
    expect(r.width).toBe(r.height);
    expect(pegar('[data-testid="i"]')!.getAttribute("aria-label")).toBe("Ligar câmera");
  });

  it("teclado: Tab foca com um único anel e Enter e Espaço acionam", async () => {
    const aoClicar = vi.fn();
    montar(<Botao onClick={aoClicar} data-testid="b">Entrar</Botao>);
    await userEvent.tab();
    const b = pegar('[data-testid="b"]')!;
    expect(document.activeElement).toBe(b);
    expect(umSoAnel(b)).toBe(true);
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(aoClicar).toHaveBeenCalledTimes(2);
  });

  it("desabilitado: fora da ordem de Tab, esmaecido e sem clique", async () => {
    const aoClicar = vi.fn();
    montar(
      <>
        <Botao disabled onClick={aoClicar} data-testid="d">Entrar</Botao>
        <Botao data-testid="o">Outro</Botao>
      </>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(pegar('[data-testid="o"]'));
    expect(getComputedStyle(pegar('[data-testid="d"]')!).opacity).toBe("0.45");
    pegar('[data-testid="d"]')!.click();
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it("carregando: aria-busy, rótulo visível, clique bloqueado e foco mantido", async () => {
    const aoClicar = vi.fn();
    montar(
      <Botao carregando icone={<Camera />} onClick={aoClicar} data-testid="c">
        Entrar
      </Botao>,
    );
    const b = pegar('[data-testid="c"]')!;
    expect(b.getAttribute("aria-busy")).toBe("true");
    expect(b.textContent).toBe("Entrar");
    expect(b.querySelector("svg")).toBeNull();
    await userEvent.tab();
    expect(document.activeElement).toBe(b);
    await userEvent.keyboard("{Enter}");
    expect(aoClicar).not.toHaveBeenCalled();
  });
});

describe("Pilula", () => {
  it("cada tipo tem forma própria e rótulo que não depende de cor", () => {
    montar(
      <>
        <Pilula tipo="aoVivo" />
        <Pilula tipo="mencao" valor={2} />
        <Pilula tipo="contagem" valor={0} />
        <Pilula tipo="naoLida" />
      </>,
    );
    const corpo = document.body.textContent;
    expect(corpo).toContain("AO VIVO");
    expect(corpo).toContain("@2");
    expect(corpo).toContain("0");
    expect(pegar('[aria-label="2 menções"]')).not.toBeNull();
    expect(pegar('[aria-label="Não lida"]')).not.toBeNull();
    const ponto = pegar('[aria-label="Não lida"]')!.getBoundingClientRect();
    expect([ponto.width, ponto.height]).toEqual([7, 7]);
  });

  it("menção singular concorda", () => {
    montar(<Pilula tipo="mencao" valor={1} />);
    expect(pegar('[aria-label="1 menção"]')).not.toBeNull();
  });
});

describe("Avatar", () => {
  it("rótulo diz nome, fala e presença em texto", () => {
    montar(<Avatar nome="Caio Melo" id="u1" falando status="online" />);
    expect(pegar('[role="img"]')!.getAttribute("aria-label")).toBe("Caio Melo, falando, online");
    expect(pegar('[role="img"]')!.textContent).toBe("CM");
  });

  it("as quatro presenças têm formas distintas, não só cores", () => {
    const formas = (["online", "idle", "dnd", "offline"] as const).map((status) => {
      montar(<Avatar nome="Ana" status={status} />);
      const html = pegar("svg")!.innerHTML;
      desmontar();
      return html;
    });
    expect(new Set(formas).size).toBe(4);
  });

  it("tamanho em px e contorno de fala só quando falando", () => {
    montar(
      <>
        <Avatar nome="Ana" tamanho={44} data-testid="a" />
        <Avatar nome="Bia" tamanho={20} falando />
      </>,
    );
    const r = document.querySelector('[role="img"]')!.getBoundingClientRect();
    expect(r.width).toBe(44);
    expect(document.querySelectorAll('[class*="fala"]').length).toBe(1);
  });

  it("selo de transmissão aparece e entra no rótulo", () => {
    montar(<Avatar nome="Ana" transmitindo />);
    expect(pegar('[role="img"]')!.getAttribute("aria-label")).toContain("transmitindo");
    expect(pegar("svg")).not.toBeNull();
  });
});

describe("PilhaDeAvatares", () => {
  it("mostra até max e resume o resto em +k com rótulo", () => {
    montar(
      <PilhaDeAvatares
        max={2}
        itens={[{ nome: "Ana", id: "1" }, { nome: "Bia", id: "2" }, { nome: "Caio", id: "3" }, { nome: "Davi", id: "4" }]}
      />,
    );
    expect(document.querySelectorAll('[aria-label="Ana"], [aria-label="Bia"]').length).toBe(2);
    expect(pegar('[aria-label="2 pessoas a mais"]')!.textContent).toBe("+2");
  });

  it("sem excedente não desenha o +k", () => {
    montar(<PilhaDeAvatares itens={[{ nome: "Ana" }]} />);
    expect(document.body.textContent).not.toContain("+");
  });
});
