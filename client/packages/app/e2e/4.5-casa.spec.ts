import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";

import { contasDeTeste } from "./globalSetup";

/**
 * Jornada 4.5 (PRD): "DMs e amigos". Duas contas, dois contextos de navegador = duas
 * pessoas. A pede amizade a B pelo nome, B aceita, A abre a DM e as duas trocam
 * mensagens. O cabeçalho mostra a pessoa, nenhuma busca cita um canal que não existe
 * e a coluna de membros de servidor não aparece.
 *
 * Precisa da pilha local do pi-infra (ver `globalSetup.ts`); sem ela, pula.
 * A sessão entra por `localStorage`: a tela de entrada é a jornada 4.1, de outro marco.
 */
const PRAZO_MS = 8000;
const RODADA = Date.now().toString(36);

type Sessao = { _id: string; token: string; user_id: string };
type Eu = { username: string; discriminator?: string };

async function entrarPelaApi(request: APIRequestContext, email: string, senha: string): Promise<Sessao> {
  const { api } = contasDeTeste();
  const r = await request.post(`${api}/auth/session/login`, { data: { email, password: senha, friendly_name: "e2e" } });
  expect(r.ok(), `login de ${email}`).toBe(true);
  return (await r.json()) as Sessao;
}

const cabecalho = (s: Sessao) => ({ "x-session-token": s.token });

/** Conta criada pela API não tem usuário até o primeiro acesso: completa com o nome da conta de teste. */
async function garantirUsuario(request: APIRequestContext, s: Sessao, username: string): Promise<Eu> {
  const { api } = contasDeTeste();
  const oi = await request.get(`${api}/onboard/hello`, { headers: cabecalho(s) });
  if (oi.ok() && ((await oi.json()) as { onboarding: boolean }).onboarding) {
    const feito = await request.post(`${api}/onboard/complete`, { headers: cabecalho(s), data: { username } });
    expect(feito.ok(), `escolher o nome ${username}`).toBe(true);
  }
  const eu = await request.get(`${api}/users/@me`, { headers: cabecalho(s) });
  expect(eu.ok(), "ler o próprio usuário").toBe(true);
  return (await eu.json()) as Eu;
}

/** Estado limpo entre as duas contas: sem amizade, pedido nem bloqueio de uma corrida anterior. */
async function limparRelacao(request: APIRequestContext, de: Sessao, para: Sessao): Promise<void> {
  const { api } = contasDeTeste();
  for (const [quem, alvo] of [
    [de, para],
    [para, de],
  ] as const) {
    await request.delete(`${api}/users/${alvo.user_id}/friend`, { headers: cabecalho(quem) });
    await request.delete(`${api}/users/${alvo.user_id}/block`, { headers: cabecalho(quem) });
  }
}

async function abrirComoPessoa(browser: Browser, sessao: Sessao): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await contexto.addInitScript((s) => {
    localStorage.setItem("vortex.sessao", JSON.stringify(s));
  }, sessao);
  const pagina = await contexto.newPage();
  await pagina.goto("/");
  await expect(pagina.getByRole("heading", { name: "Amigos", level: 2 })).toBeVisible({ timeout: PRAZO_MS });
  return pagina;
}

const campo = (p: Page) => p.getByRole("textbox", { name: /^Conversar com / });
const mensagem = (p: Page, texto: string | RegExp): Locator => p.locator("[data-menu-mensagem]", { hasText: texto });

async function escrever(p: Page, texto: string) {
  await campo(p).fill(texto);
  await campo(p).press("Enter");
}

test.describe("4.5 casa @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  test("A pede amizade a B pelo nome, B aceita, A abre a DM e as duas contas trocam mensagens", async ({
    browser,
    request,
  }) => {
    const { a, b } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const sessaoB = await entrarPelaApi(request, b.email, b.senha);
    const euA = await garantirUsuario(request, sessaoA, a.username);
    const euB = await garantirUsuario(request, sessaoB, b.username);
    await limparRelacao(request, sessaoA, sessaoB);

    const paginaA = await abrirComoPessoa(browser, sessaoA);
    const paginaB = await abrirComoPessoa(browser, sessaoB);

    // 1. Pedido de A para B pelo nome de usuário. Nome que não existe é erro dito na tela.
    const nomeDeB = euB.discriminator ? `${euB.username}#${euB.discriminator}` : euB.username;
    await paginaA.getByLabel("Adicionar por nome de usuário").fill(`naoexiste${RODADA}`);
    await paginaA.getByRole("button", { name: "Pedir amizade" }).click();
    await expect(paginaA.getByRole("alert").filter({ hasText: "Não deu para enviar o pedido" })).toBeVisible({
      timeout: PRAZO_MS,
    });
    await paginaA.getByLabel("Adicionar por nome de usuário").fill(nomeDeB);
    await paginaA.getByRole("button", { name: "Pedir amizade" }).click();
    await expect(paginaA.getByRole("status").filter({ hasText: "Pedido enviado" })).toBeVisible({ timeout: PRAZO_MS });

    // 2. B vê o pedido pendente na entrada de amigos, abre Pedidos e aceita.
    await expect(paginaB.getByRole("button", { name: /Amigos, 1 pedido pendente/ })).toBeVisible({ timeout: PRAZO_MS });
    await paginaB.getByRole("tab", { name: /^Pedidos/ }).click();
    await paginaB.getByRole("button", { name: `Aceitar pedido de ${euA.username}` }).click();
    await expect(paginaB.getByRole("button", { name: `Aceitar pedido de ${euA.username}` })).toHaveCount(0);

    // 3. A vê B entre os amigos e abre a DM por "Mensagem".
    await paginaA.getByRole("tab", { name: "Todos" }).click();
    await paginaA.getByRole("button", { name: `Mensagem para ${euB.username}` }).click({ timeout: PRAZO_MS });

    // O cabeçalho mostra a pessoa; não há coluna de membros de servidor nem busca citando canal.
    await expect(paginaA.getByRole("heading", { name: euB.username, level: 2 })).toBeVisible({ timeout: PRAZO_MS });
    await expect(campo(paginaA)).toBeVisible();
    await expect(paginaA.getByRole("complementary", { name: "Membros online" })).toHaveCount(0);
    await expect(paginaA.getByText(/Buscar em #|Pesquisar em #/)).toHaveCount(0);

    // 4. Troca de mensagens.
    const deA = `oi do A ${RODADA}`;
    await escrever(paginaA, deA);
    await expect(mensagem(paginaA, deA)).toBeVisible();

    // B vê a conversa na coluna, abre e lê.
    await paginaB.locator("[data-conversa]", { hasText: euA.username }).first().click({ timeout: PRAZO_MS });
    await expect(mensagem(paginaB, deA)).toBeVisible({ timeout: PRAZO_MS });
    await expect(paginaB.getByRole("heading", { name: euA.username, level: 2 })).toBeVisible();
    await expect(paginaB.getByRole("complementary", { name: "Membros online" })).toHaveCount(0);

    const deB = `oi do B ${RODADA}`;
    await escrever(paginaB, deB);
    await expect(mensagem(paginaA, deB)).toBeVisible({ timeout: PRAZO_MS });
    // A própria mensagem nunca aparece como nova.
    await expect(paginaA.locator("[data-novas]")).toHaveCount(0);
  });
});
