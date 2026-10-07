import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

import { contasDeTeste } from "./globalSetup";

/**
 * Jornada 4.3 (PRD): "entrar na sala, assistir e transmitir, e sair para ler sem perder a tela". Duas contas, dois
 * contextos de navegador = duas pessoas. A entra numa sala pela interface e B, no
 * widget e na lista de salas, vê A em até 2 s; A sai pela interface e some para B
 * em até 2 s, sem esperar o socket cair (rota de saída da sala, ADR-002).
 *
 * Precisa da pilha local do pi-infra (ver `globalSetup.ts`); sem ela, pula.
 * A sessão entra por `localStorage` (a tela de entrada é a jornada 4.1, de outro
 * marco): o teste faz o login pela API e planta o token no formato que o app lê.
 */
const NOME_DO_SERVIDOR = `Grupo E2E ${Date.now()}`;
const NOME_DA_SALA = "Jogatina";
const PRAZO_MS = 2000;

type Sessao = { _id: string; token: string; user_id: string };

async function entrarPelaApi(request: APIRequestContext, email: string, senha: string): Promise<Sessao> {
  const { api } = contasDeTeste();
  const r = await request.post(`${api}/auth/session/login`, { data: { email, password: senha, friendly_name: "e2e" } });
  expect(r.ok(), `login de ${email}`).toBe(true);
  return (await r.json()) as Sessao;
}

const cabecalho = (s: Sessao) => ({ "x-session-token": s.token });

/** A cria o servidor e a sala de voz, e B entra por convite. Devolve o ID da sala. */
async function prepararServidor(request: APIRequestContext, a: Sessao, b: Sessao): Promise<string> {
  const { api } = contasDeTeste();
  const criado = await request.post(`${api}/servers/create`, {
    headers: cabecalho(a),
    data: { name: NOME_DO_SERVIDOR },
  });
  expect(criado.ok(), "criar servidor").toBe(true);
  const { server, channels } = (await criado.json()) as { server: { _id: string }; channels: { _id: string }[] };

  const sala = await request.post(`${api}/servers/${server._id}/channels`, {
    headers: cabecalho(a),
    data: { type: "Voice", name: NOME_DA_SALA },
  });
  expect(sala.ok(), "criar sala de voz").toBe(true);
  const { _id: salaId } = (await sala.json()) as { _id: string };

  const convite = await request.post(`${api}/channels/${channels[0]!._id}/invites`, { headers: cabecalho(a), data: {} });
  expect(convite.ok(), "criar convite").toBe(true);
  const { _id: codigo } = (await convite.json()) as { _id: string };
  const entrada = await request.post(`${api}/invites/${codigo}`, { headers: cabecalho(b), data: {} });
  expect(entrada.ok(), "B entra por convite").toBe(true);
  return salaId;
}

async function abrirComoPessoa(browser: Browser, sessao: Sessao): Promise<Page> {
  const contexto = await browser.newContext({
    permissions: ["microphone", "camera"],
    viewport: { width: 1600, height: 900 },
  });
  await contexto.addInitScript((s) => {
    localStorage.setItem("vortex.sessao", JSON.stringify(s));
  }, sessao);
  const pagina = await contexto.newPage();
  await pagina.goto("/");
  await pagina.getByRole("button", { name: NOME_DO_SERVIDOR }).click();
  return pagina;
}

test.describe("4.3 palco @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  test("A entra e transmite; B vê o vídeo de A no foco, lê um canal com a chamada no widget, volta ao palco; A sai", async ({
    browser,
    request,
  }) => {
    const { a, b } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const sessaoB = await entrarPelaApi(request, b.email, b.senha);
    await prepararServidor(request, sessaoA, sessaoB);
    const paginaA = await abrirComoPessoa(browser, sessaoA);
    const paginaB = await abrirComoPessoa(browser, sessaoB);

    // A entra: o palco abre na hora e a cápsula aparece.
    await paginaA.getByRole("button", { name: new RegExp(NOME_DA_SALA) }).last().click();
    await paginaA.getByRole("button", { name: "Entrar na sala" }).click();
    await expect(paginaA.getByTestId("palco")).toBeVisible();
    await expect(paginaA.getByRole("button", { name: "Sair da chamada" })).toBeVisible();

    // A transmite pelo diálogo (a captura é a falsa do Chromium).
    await paginaA.getByRole("button", { name: "Compartilhar tela" }).click();
    await paginaA.getByRole("dialog", { name: "O que você quer mostrar?" }).getByRole("button", { name: "Transmitir" }).click();
    await expect(paginaA.getByTestId("foco-do-palco")).toBeVisible({ timeout: 10_000 });

    // B entra e vê a transmissão de A no foco, com vídeo.
    await paginaB.getByRole("button", { name: new RegExp(NOME_DA_SALA) }).last().click();
    await paginaB.getByRole("button", { name: "Entrar na sala" }).click();
    const foco = paginaB.getByTestId("foco-do-palco");
    await expect(foco.locator("video")).toBeVisible({ timeout: 10_000 });

    // B vai ler um canal: a chamada segue no widget; volta ao palco no mesmo foco.
    await paginaB.getByRole("button", { name: /geral/ }).first().click();
    await expect(paginaB.getByRole("region", { name: "Chamada em andamento" })).toBeVisible();
    await paginaB.getByRole("button", { name: "Voltar ao palco" }).click({ force: true });
    await expect(paginaB.getByTestId("foco-do-palco")).toBeVisible();

    // A sai e a transmissão some para B em até 2 s.
    await paginaA.getByRole("button", { name: "Sair da chamada" }).click();
    await expect(paginaB.getByTestId("foco-do-palco")).toHaveCount(0, { timeout: PRAZO_MS });
  });
});
