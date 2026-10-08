import "../arnes/redeFalsa";
import { useState } from "react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";

import { shell } from "../textos";
import { desmontar, montar, pegar } from "../ui/ds/montar";
import { ShellDoApp } from "./ShellDoApp";

afterEach(desmontar);

const URL_LONGA = `https://exemplo.com/${"a".repeat(400)}`;

/** Larguras em px das trilhas declaradas do grid. */
function trilhas(): number[] {
  const grade = pegar('[data-testid="shell-grade"]')!;
  return getComputedStyle(grade)
    .gridTemplateColumns.split(" ")
    .map((t) => Number.parseFloat(t));
}

function montarNaLargura(largura: number) {
  document.documentElement.dataset.tema = "vidro";
  const alvo = montar(
    <div style={{ inlineSize: `${largura}px`, blockSize: "700px" }}>
      <ShellDoApp principal={<p data-testid="url">{URL_LONGA}</p>} />
    </div>,
  );
  return alvo;
}

describe("Shell fixo", () => {
  for (const largura of [1280, 1920, 2560]) {
    it(`em ${largura}px: as trilhas somam a largura, o chat recebe o resto e nada estoura`, async () => {
      await page.viewport(largura, 800);
      const alvo = montarNaLargura(largura);
      const grade = pegar<HTMLElement>('[data-testid="shell-grade"]')!;

      const t = trilhas();
      const pad = Number.parseFloat(getComputedStyle(grade).paddingInlineStart) * 2;
      expect(t.reduce((a, b) => a + b, 0) + pad).toBeCloseTo(largura, 0);

      // dock | gap | salas | gap | principal | gap | gaveta
      expect(t).toHaveLength(7);
      expect(t[0]).toBe(64);
      expect(t[4]).toBeGreaterThan(600);
      expect(t[2]).toBeLessThanOrEqual(276.1);
      expect(t[6]).toBeLessThanOrEqual(304.1);

      // A grade não passa do container e a URL de 400 caracteres não a empurra.
      expect(grade.scrollWidth).toBeLessThanOrEqual(grade.clientWidth);
      expect(alvo.scrollWidth).toBeLessThanOrEqual(alvo.clientWidth);
      const principal = pegar('main')!.getBoundingClientRect();
      const url = pegar('[data-testid="url"]')!.getBoundingClientRect();
      expect(url.right).toBeLessThanOrEqual(principal.right + 0.5);
    });
  }

  it("em janela estreita a gaveta colapsa a zero sem deixar vão", async () => {
    await page.viewport(1000, 700);
    montarNaLargura(1000);
    const t = trilhas();
    expect(t[6]).toBe(0);
    expect(t[5]).toBe(0);
    expect(t[4]).toBeGreaterThan(300);
  });

  it("a gaveta alterna entre lista e só ícones", async () => {
    await page.viewport(1920, 800);
    montarNaLargura(1920);
    expect(trilhas()[6]).toBeGreaterThan(200);
    await page.getByRole("button", { name: shell.gaveta.mostrarIcones }).click();
    expect(trilhas()[6]).toBe(64);
    await page.getByRole("button", { name: shell.gaveta.mostrarLista }).click();
    expect(trilhas()[6]).toBeGreaterThan(200);
  });

  it("a barra de título só tem nome e, na web, nenhum botão", async () => {
    await page.viewport(1280, 800);
    montarNaLargura(1280);
    const barra = pegar('[data-testid="barra-de-titulo"]')!;
    expect(barra.textContent).toBe("Vortex");
    expect(barra.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0);
  });
});

describe("Entrada e saída do palco", () => {
  let alternar: () => void = () => undefined;
  function Palco() {
    const [palco, setPalco] = useState(false);
    alternar = () => {
      setPalco((p) => !p);
    };
    return (
      <div style={{ inlineSize: 1600, blockSize: 700 }}>
        <ShellDoApp
          salasEmFaixa={palco}
          faixaDeSalas={<span>faixa</span>}
          salas={<div data-testid="coluna">salas</div>}
          principal={<p data-testid="conteudo">área</p>}
        />
      </div>
    );
  }

  const principal = () => pegar<HTMLElement>('[data-testid="shell-grade"] > :nth-child(4)')!;
  const colunaDeSalas = () => pegar<HTMLElement>('[data-testid="shell-grade"] > :nth-child(3)')!;
  const nomes = (el: Element) =>
    el.getAnimations().map((a) => ({
      nome: (a as CSSAnimation).animationName,
      duracao: Number(a.effect!.getComputedTiming().duration),
      props: new Set((a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p)))),
    }));
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function preparar() {
    await page.viewport(1600, 800);
    document.documentElement.dataset.tema = "vidro";
    montar(<Palco />);
    await esperar(50);
  }

  it("abrir o app não anima; a trilha troca de largura num quadro só, sem transição", async () => {
    await preparar();
    expect(principal().getAnimations()).toHaveLength(0);
    expect(trilhas()[2]).toBeGreaterThan(200);
    alternar();
    await esperar(0);
    // Imediatamente no valor final: a trilha não é animada (nada de reflow por frame).
    await expect.poll(() => trilhas()[2]).toBe(56);
    const grade = pegar('[data-testid="shell-grade"]')!;
    expect(getComputedStyle(grade).transitionProperty).not.toMatch(/grid|--larg/);
  });

  it("entrar: o palco chega por transform e opacity, em até 240ms; a coluna cheia se fecha como no hover", async () => {
    await preparar();
    alternar();
    await expect.poll(() => nomes(principal()).length).toBeGreaterThan(0);
    const [chega] = nomes(principal());
    expect(chega!.nome).toMatch(/palcoChega/);
    expect(chega!.duracao).toBeLessThanOrEqual(240);
    expect([...chega!.props].sort()).toEqual(["opacity", "transform"]);
    const lista = pegar('[data-testid="lista-de-salas"]')!;
    const soltando = nomes(lista).find((a) => /listaSolta/.test(a.nome));
    expect(soltando).toBeDefined();
    expect([...soltando!.props].sort()).toEqual(["opacity", "transform"]);
    const faixa = pegar('[data-testid="faixa-de-salas"]')!;
    expect(nomes(faixa).some((a) => /faixaAparece/.test(a.nome))).toBe(true);
    // Terminou: nada fica preso, e a lista fechada volta a ser inerte.
    await expect.poll(() => principal().getAnimations().length).toBe(0);
    expect(getComputedStyle(lista).opacity).toBe("0");
    expect(lista.hasAttribute("inert")).toBe(true);
  });

  it("sair: o chat e a coluna voltam por transform e opacity", async () => {
    await preparar();
    alternar();
    await expect.poll(() => trilhas()[2]).toBe(56);
    await expect.poll(() => principal().getAnimations().length).toBe(0);
    alternar();
    await expect.poll(() => trilhas()[2]).toBeGreaterThan(200);
    const volta = nomes(principal()).find((a) => /chatVolta/.test(a.nome));
    expect(volta).toBeDefined();
    expect(volta!.duracao).toBeLessThanOrEqual(240);
    expect([...volta!.props].sort()).toEqual(["opacity", "transform"]);
    const coluna = nomes(colunaDeSalas()).find((a) => /colunaVolta/.test(a.nome));
    expect(coluna).toBeDefined();
    expect([...coluna!.props].sort()).toEqual(["opacity", "transform"]);
  });

  it("o conteúdo não remede a cada frame: a caixa dele muda uma vez, não 11", async () => {
    await preparar();
    const alvo = pegar('[data-testid="conteudo"]')!;
    let remedidas = 0;
    const ro = new ResizeObserver(() => {
      remedidas += 1;
    });
    ro.observe(alvo);
    await esperar(50);
    remedidas = 0;
    alternar();
    await esperar(400); // a animação inteira (180ms) e folga
    ro.disconnect();
    expect(remedidas).toBeLessThanOrEqual(1);
  });

  it("com movimento reduzido a animação é pulada (duração ~0) e o layout final vale igual", async () => {
    await preparar();
    document.documentElement.dataset.movimento = "reduzido";
    try {
      alternar();
      await esperar(0);
      for (const a of nomes(principal())) expect(a.duracao).toBeLessThanOrEqual(1);
      expect(Number.parseFloat(getComputedStyle(principal()).animationDuration)).toBeLessThanOrEqual(0.001);
      await expect.poll(() => trilhas()[2]).toBe(56);
    } finally {
      delete document.documentElement.dataset.movimento;
    }
  });
});
