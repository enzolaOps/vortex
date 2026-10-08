import { expect, test } from "@playwright/test";

import { acionarTodosOsControles } from "./helpers/acionarTodosOsControles";
import { comSessaoFalsa } from "./helpers/sessao";

/**
 * Fumaça: o shell sobe, a barra de título só tem o que o design aprova e nenhum controle
 * é inerte. Roda SEM back-end (é o que o job de CI executa). O shell fica atrás do portão
 * de sessão, então estas specs entram com uma sessão guardada falsa.
 */
test.describe("shell @fumaca", () => {
  test.beforeEach(async ({ page }) => {
    await comSessaoFalsa(page);
  });

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
    const { acionados } = await acionarTodosOsControles(page, {
      isencoes: [
        {
          nome: "Sair",
          motivo: "encerra a sessão e recarrega a página; o efeito é coberto por 4.1-sessao.spec.ts",
        },
      ],
    });
    // A gaveta tem o botão de alternar modo: se o shell perder todos os controles, algo quebrou.
    expect(acionados).toBeGreaterThan(0);
  });
});

test.describe("portão de sessão @fumaca", () => {
  test("sem sessão guardada mostra a entrada, sem shell e sem controle inerte", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Entrar no Vortex" })).toBeVisible();
    await expect(page.getByTestId("shell")).toHaveCount(0);
    // Desde o M8, criar conta, recuperar senha e QR são telas de verdade.
    await expect(page.getByRole("button", { name: /criar conta|esqueci|qr/i })).toHaveCount(3);
    const { acionados } = await acionarTodosOsControles(page, {
      isencoes: [
        { nome: "E-mail ou usuário", motivo: "campo de texto: o valor é propriedade, não aparece no HTML" },
        { nome: "Senha", motivo: "campo de texto: o valor é propriedade, não aparece no HTML" },
        { nome: "Manter conectado", motivo: "caixa de marcar: o estado é propriedade, não aparece no HTML" },
      ],
    });
    expect(acionados).toBeGreaterThan(0);
  });

  test("a entrada não estoura nas três larguras de referência", async ({ page }) => {
    for (const largura of [1280, 1920, 2560]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Entrar no Vortex" })).toBeVisible();
      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(doc.scroll, `${largura}px`).toBeLessThanOrEqual(doc.client);
    }
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
