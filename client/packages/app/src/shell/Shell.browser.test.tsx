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
