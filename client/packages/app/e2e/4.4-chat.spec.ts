import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";

import { contasDeTeste } from "./globalSetup";

/**
 * Jornada 4.4 (PRD): "conversar". Duas contas, dois contextos de navegador = duas
 * pessoas. A escreve texto com markdown, manda um anexo e reage; B responde. Cada
 * um vê, na outra tela, o que o outro fez. A própria mensagem nunca aparece como
 * nova. Uma falha simulada de rede mostra "Reenviar", e reenviar funciona.
 *
 * Precisa da pilha local do pi-infra (ver `globalSetup.ts`); sem ela, pula.
 * A sessão entra por `localStorage`: a tela de entrada é a jornada 4.1, de outro marco.
 */
const NOME_DO_SERVIDOR = `Chat E2E ${Date.now()}`;
const PRAZO_MS = 5000;

/** PNG de 1x1: pequeno o bastante para qualquer teto de upload, válido para o servidor de mídia. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

type Sessao = { _id: string; token: string; user_id: string };

async function entrarPelaApi(request: APIRequestContext, email: string, senha: string): Promise<Sessao> {
  const { api } = contasDeTeste();
  const r = await request.post(`${api}/auth/session/login`, { data: { email, password: senha, friendly_name: "e2e" } });
  expect(r.ok(), `login de ${email}`).toBe(true);
  return (await r.json()) as Sessao;
}

const cabecalho = (s: Sessao) => ({ "x-session-token": s.token });

/** A cria o servidor (que já nasce com um canal de texto) e B entra por convite. */
async function prepararServidor(request: APIRequestContext, a: Sessao, b: Sessao): Promise<void> {
  const { api } = contasDeTeste();
  const criado = await request.post(`${api}/servers/create`, {
    headers: cabecalho(a),
    data: { name: NOME_DO_SERVIDOR },
  });
  expect(criado.ok(), "criar servidor").toBe(true);
  const { channels } = (await criado.json()) as { channels: { _id: string }[] };

  const convite = await request.post(`${api}/channels/${channels[0]!._id}/invites`, { headers: cabecalho(a), data: {} });
  expect(convite.ok(), "criar convite").toBe(true);
  const { _id: codigo } = (await convite.json()) as { _id: string };
  const entrada = await request.post(`${api}/invites/${codigo}`, { headers: cabecalho(b), data: {} });
  expect(entrada.ok(), "B entra por convite").toBe(true);
}

async function abrirComoPessoa(browser: Browser, sessao: Sessao): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await contexto.addInitScript((s) => {
    localStorage.setItem("vortex.sessao", JSON.stringify(s));
  }, sessao);
  const pagina = await contexto.newPage();
  await pagina.goto("/");
  await pagina.getByRole("button", { name: NOME_DO_SERVIDOR }).click();
  // O servidor abre no primeiro canal de texto: o campo de escrever é a prova.
  await expect(campo(pagina)).toBeVisible({ timeout: PRAZO_MS });
  return pagina;
}

const campo = (p: Page) => p.getByRole("textbox", { name: /^Conversar em / });
const mensagem = (p: Page, texto: string | RegExp): Locator => p.locator("[data-menu-mensagem]", { hasText: texto });

async function escrever(p: Page, texto: string) {
  await campo(p).fill(texto);
  await campo(p).press("Enter");
}

test.describe("4.4 chat @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  test("markdown, resposta, reação e anexo chegam à outra conta; falha de rede mostra reenvio e reenviar funciona", async ({
    browser,
    request,
  }) => {
    const { a, b } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const sessaoB = await entrarPelaApi(request, b.email, b.senha);
    await prepararServidor(request, sessaoA, sessaoB);

    const paginaA = await abrirComoPessoa(browser, sessaoA);
    const paginaB = await abrirComoPessoa(browser, sessaoB);

    // 1. Texto com markdown: A vê na hora (otimista) e B vê renderizado, sem os asteriscos.
    await escrever(paginaA, "olá **negrito** e `código` do A");
    await expect(mensagem(paginaA, "do A").locator("strong")).toHaveText("negrito");
    const naB = mensagem(paginaB, "do A");
    await expect(naB.locator("strong")).toHaveText("negrito", { timeout: PRAZO_MS });
    await expect(naB.locator("code")).toHaveText("código");
    await expect(naB).not.toContainText("**");

    // 2. Reação: A reage à própria mensagem pelo menu de contexto (um só, no nível da lista).
    await mensagem(paginaA, "do A").locator("article").click({ button: "right" });
    await paginaA.getByRole("menuitem", { name: "Reagir com 👍" }).click();
    const chipNaB = naB.getByRole("button", { name: /👍/ });
    await expect(chipNaB).toBeVisible({ timeout: PRAZO_MS });
    await expect(chipNaB).toContainText("1");
    // Para B a reação é de outra pessoa: o chip não está aceso.
    await expect(chipNaB).toHaveAttribute("aria-pressed", "false");

    // 3. Anexo: A manda só a imagem; B vê a imagem na linha, com a caixa reservada.
    await paginaA.getByTestId("seletor-de-arquivos").setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await expect(paginaA.getByText("pixel.png")).toBeVisible();
    await paginaA.getByRole("button", { name: "Enviar" }).click();
    const imagemNaB = paginaB.locator('img[alt="pixel.png"]');
    await expect(imagemNaB).toBeVisible({ timeout: PRAZO_MS });

    // A própria mensagem nunca aparece como nova: nenhum divisor de novas mensagens em A.
    await expect(paginaA.locator("[data-novas]")).toHaveCount(0);
    await expect(paginaA.getByRole("button", { name: "Ir para a primeira não lida" })).toHaveCount(0);

    // 4. Resposta: B responde à mensagem de A pelo menu; A vê a prévia irmã com o autor e o trecho.
    await naB.locator("article").click({ button: "right" });
    await paginaB.getByRole("menuitem", { name: "Responder" }).click();
    await expect(paginaB.getByText(/^Respondendo a /)).toBeVisible();
    await escrever(paginaB, "resposta do B");
    const respostaNaA = mensagem(paginaA, "resposta do B");
    await expect(respostaNaA).toBeVisible({ timeout: PRAZO_MS });
    const previa = respostaNaA.locator("button[aria-label^='Resposta a']");
    await expect(previa).toContainText("do A");
    // A prévia é irmã da linha: fica fora do <article> que reage ao hover.
    await expect(previa.locator("xpath=ancestor::article")).toHaveCount(0);

    // 5. Falha simulada de rede: o envio de A é abortado.
    await paginaA.route(/\/channels\/[^/]+\/messages$/, (rota) => {
      if (rota.request().method() === "POST") return rota.abort("failed");
      return rota.continue();
    });
    await escrever(paginaA, "vai falhar uma vez");
    const falhada = mensagem(paginaA, "vai falhar uma vez");
    await expect(falhada.getByText("Não foi enviada.")).toBeVisible({ timeout: PRAZO_MS });
    await expect(falhada.getByRole("button", { name: "Reenviar" })).toBeVisible();
    await expect(falhada.getByRole("button", { name: "Descartar" })).toBeVisible();
    // B não viu nada: a mensagem nunca saiu.
    await expect(mensagem(paginaB, "vai falhar uma vez")).toHaveCount(0);

    // 6. A rede volta: Reenviar funciona, uma vez só, e B recebe.
    await paginaA.unroute(/\/channels\/[^/]+\/messages$/);
    await falhada.getByRole("button", { name: "Reenviar" }).click();
    await expect(mensagem(paginaB, "vai falhar uma vez")).toHaveCount(1, { timeout: PRAZO_MS });
    await expect(mensagem(paginaA, "vai falhar uma vez").getByText("Não foi enviada.")).toHaveCount(0);
    await expect(mensagem(paginaA, "vai falhar uma vez")).toHaveCount(1);
  });
});
