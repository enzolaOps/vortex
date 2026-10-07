import { expect, test, type Page } from "@playwright/test";

import { contasDeTeste } from "./globalSetup";
import { CHAVE_DA_SESSAO } from "./helpers/sessao";

/**
 * Jornada 4.1 (parte do M3): entrar, recarregar e continuar dentro, sair e voltar à
 * entrada. Precisa da pilha local do pi-infra (`globalSetup.ts`); sem ela os testes
 * se pulam sozinhos e o job de CI, que só roda `@fumaca`, nem os vê.
 *
 * Os testes leem o texto da tela como a pessoa o lê. Se o catálogo mudar a frase,
 * a spec muda junto: é o contrato que ela protege.
 */
test.describe("4.1 sessão @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  const entradaVisivel = (page: Page) => page.getByRole("heading", { name: "Entrar no Vortex" });

  async function preencher(page: Page, identificador: string, senha: string) {
    await page.getByLabel("E-mail ou usuário").fill(identificador);
    await page.getByLabel("Senha", { exact: true }).fill(senha);
  }

  /** Conta criada pela API não tem nome de usuário: o primeiro acesso pede um. */
  async function entrarComo(page: Page, conta: { email: string; senha: string; username: string }) {
    await page.goto("/");
    await expect(entradaVisivel(page)).toBeVisible();
    await preencher(page, conta.email, conta.senha);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    const shell = page.getByTestId("shell");
    const nome = page.getByRole("heading", { name: "Escolha seu nome de usuário" });
    await expect(shell.or(nome)).toBeVisible();
    if (await nome.isVisible()) {
      await page.getByLabel("Nome de usuário").fill(conta.username);
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    await expect(shell).toBeVisible();
  }

  test("entra, recarrega e continua dentro, sai e volta à entrada", async ({ page }) => {
    const { a } = contasDeTeste();
    const console_: string[] = [];
    page.on("console", (m) => console_.push(m.text()));

    await entrarComo(page, a);
    expect(page.url(), "o token nunca vai para a URL").not.toMatch(/token|session/i);

    // Recarregar: continua dentro e a entrada nunca aparece (nem piscando).
    await page.addInitScript(() => {
      const piscou = () => document.querySelector("h1")?.textContent === "Entrar no Vortex";
      new MutationObserver(() => {
        if (piscou()) sessionStorage.setItem("e2e-piscou-entrada", "1");
      }).observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    await expect(page.getByTestId("shell")).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("e2e-piscou-entrada"))).toBeNull();

    // Nenhum token no console durante toda a jornada.
    const guardado = await page.evaluate((chave) => localStorage.getItem(chave), CHAVE_DA_SESSAO);
    const token = (JSON.parse(guardado ?? "{}") as { token?: string }).token;
    expect(token).toBeTruthy();
    expect(console_.join("\n")).not.toContain(token ?? "");

    // Sair: volta à entrada, apaga a sessão local e não volta sozinha ao recarregar.
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(entradaVisivel(page)).toBeVisible();
    expect(await page.evaluate((chave) => localStorage.getItem(chave), CHAVE_DA_SESSAO)).toBeNull();
    await page.reload();
    await expect(entradaVisivel(page)).toBeVisible();
    await expect(page.getByTestId("shell")).toHaveCount(0);
  });

  test("senha errada diz o motivo e mantém o que foi digitado", async ({ page }) => {
    const { a } = contasDeTeste();
    await page.goto("/");
    await preencher(page, a.email, "senha-errada-de-proposito");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
    await expect(page.getByLabel("E-mail ou usuário")).toHaveValue(a.email);
    await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("senha-errada-de-proposito");
    await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
    await expect(page.getByTestId("shell")).toHaveCount(0);
  });

  test("sem marcar Manter conectado a sessão fica só na aba", async ({ page }) => {
    const { b } = contasDeTeste();
    await page.goto("/");
    await preencher(page, b.email, b.senha);
    await page.getByLabel("Manter conectado").uncheck();
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    const nome = page.getByRole("heading", { name: "Escolha seu nome de usuário" });
    await expect(page.getByTestId("shell").or(nome)).toBeVisible();
    if (await nome.isVisible()) {
      await page.getByLabel("Nome de usuário").fill(b.username);
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    await expect(page.getByTestId("shell")).toBeVisible();

    const onde = await page.evaluate((chave) => ({
      persistente: localStorage.getItem(chave),
      daAba: sessionStorage.getItem(chave),
    }), CHAVE_DA_SESSAO);
    expect(onde.persistente).toBeNull();
    expect(onde.daAba).not.toBeNull();

    await page.reload();
    await expect(page.getByTestId("shell")).toBeVisible();
  });
});
