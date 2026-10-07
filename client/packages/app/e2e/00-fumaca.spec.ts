import { expect, test } from "@playwright/test";

import { acionarTodosOsControles } from "./helpers/acionarTodosOsControles";

/**
 * Fumaça: o shell sobe, a barra de título só tem o que o design aprova e nenhum controle
 * é inerte. Roda SEM back-end (é o que o job de CI executa).
 */
test.describe("shell @fumaca", () => {
  test("renderiza as regiões e a barra de título não tem controle extra", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell")).toBeVisible();

    for (const regiao of ["Servidores", "Salas e canais", "Conversa", "Membros online"]) {
      await expect(page.getByLabel(regiao).first()).toBeAttached();
    }

    // Só o nome do app e (no desktop) os botões da janela. Na web, nenhum controle.
    const barra = page.getByTestId("barra-de-titulo");
    await expect(barra).toHaveText("Vortex");
    await expect(barra.locator("button, a, input, select, textarea, [tabindex]")).toHaveCount(0);
  });

  test("a grade não estoura nas três larguras de referência", async ({ page }) => {
    for (const largura of [1280, 1920, 2560]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/");
      const grade = page.getByTestId("shell-grade");
      await expect(grade).toBeVisible();
      const medidas = await grade.evaluate((g) => ({ scroll: g.scrollWidth, client: g.clientWidth }));
      expect(medidas.scroll, `${largura}px`).toBeLessThanOrEqual(medidas.client);
      const docMedidas = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(docMedidas.scroll, `${largura}px (documento)`).toBeLessThanOrEqual(docMedidas.client);
    }
  });

  test("todo controle focável produz efeito observável", async ({ page }) => {
    await page.goto("/");
    const { acionados } = await acionarTodosOsControles(page, { isencoes: [] });
    // A gaveta tem o botão de alternar modo: se o shell perder todos os controles, algo quebrou.
    expect(acionados).toBeGreaterThan(0);
  });
});

test.describe("acionarTodosOsControles @fumaca", () => {
  test("reprova controle inerte, aceita efeito observável e isenção declarada", async ({ page }) => {
    await page.setContent('<button id="inerte">Faz nada</button>');
    await expect(acionarTodosOsControles(page)).rejects.toThrow(/Faz nada/);

    await expect(
      acionarTodosOsControles(page, { isencoes: [{ nome: "Faz nada", motivo: "só move o foco" }] }),
    ).resolves.toMatchObject({ isentos: 1 });

    await page.setContent(
      '<button onclick="document.body.dataset.clicou = 1">Liga</button>',
    );
    await expect(acionarTodosOsControles(page)).resolves.toMatchObject({ acionados: 1 });
  });
});
