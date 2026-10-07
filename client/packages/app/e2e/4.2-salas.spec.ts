import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

import { contasDeTeste } from "./globalSetup";

/**
 * Jornada 4.2 (PRD): "chegar ao servidor e ver quem está onde". Duas contas, dois
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

test.describe("4.2 salas @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  test("A entra na sala e B a vê em até 2 s; A sai pela interface e some para B em até 2 s", async ({
    browser,
    request,
  }) => {
    const { a, b } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const sessaoB = await entrarPelaApi(request, b.email, b.senha);
    await prepararServidor(request, sessaoA, sessaoB);

    const paginaA = await abrirComoPessoa(browser, sessaoA);
    const paginaB = await abrirComoPessoa(browser, sessaoB);

    // B olha a sala: nada conectou sozinho, e a sala está vazia.
    const salaDeB = paginaB.getByRole("button", { name: new RegExp(NOME_DA_SALA) }).last();
    await salaDeB.click();
    const cartaoDeB = paginaB.getByRole("region", { name: NOME_DA_SALA });
    await expect(cartaoDeB).toContainText("Ninguém está na sala agora.");

    // A abre a sala e entra com um clique (o app nunca entra sozinho).
    await paginaA.getByRole("button", { name: new RegExp(NOME_DA_SALA) }).last().click();
    await paginaA.getByRole("button", { name: "Entrar na sala" }).click();

    // B vê A no widget e na lista de salas, em até 2 s.
    await expect(cartaoDeB).toContainText(a.username, { timeout: PRAZO_MS });
    await expect(paginaB.getByRole("img", { name: "1 pessoa na sala" })).toBeVisible({ timeout: PRAZO_MS });

    // A sai pela interface; B deixa de ver A em até 2 s, sem esperar o socket cair.
    await paginaA.getByRole("button", { name: "Sair da chamada" }).click();
    await expect(cartaoDeB).not.toContainText(a.username, { timeout: PRAZO_MS });
    await expect(paginaB.getByRole("img", { name: "0 pessoa na sala" })).toBeVisible({ timeout: PRAZO_MS });
  });
});
