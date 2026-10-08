import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

import { contasDeTeste } from "./globalSetup";
import { comSessaoFalsa } from "./helpers/sessao";

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
async function prepararServidor(
  request: APIRequestContext,
  a: Sessao,
  b: Sessao,
  nomeDoServidor = NOME_DO_SERVIDOR,
): Promise<string> {
  const { api } = contasDeTeste();
  const criado = await request.post(`${api}/servers/create`, {
    headers: cabecalho(a),
    data: { name: nomeDoServidor },
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

async function abrirComoPessoa(browser: Browser, sessao: Sessao, nomeDoServidor = NOME_DO_SERVIDOR): Promise<Page> {
  const contexto = await browser.newContext({
    permissions: ["microphone", "camera"],
    viewport: { width: 1600, height: 900 },
  });
  await contexto.addInitScript((s) => {
    localStorage.setItem("vortex.sessao", JSON.stringify(s));
  }, sessao);
  const pagina = await contexto.newPage();
  await pagina.goto("/");
  await pagina.getByRole("button", { name: nomeDoServidor }).click();
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

    // A entra com um clique na sala: o palco abre na hora e a cápsula aparece.
    await paginaA.getByRole("button", { name: new RegExp(NOME_DA_SALA) }).last().click();
    await expect(paginaA.getByTestId("palco")).toBeVisible();
    await expect(paginaA.getByRole("button", { name: "Sair da chamada" })).toBeVisible();

    // A transmite pelo diálogo (a captura é a falsa do Chromium).
    await paginaA.getByRole("button", { name: "Compartilhar tela" }).click();
    await paginaA.getByRole("dialog", { name: "O que você quer mostrar?" }).getByRole("button", { name: "Transmitir" }).click();
    await expect(paginaA.getByTestId("foco-do-palco")).toBeVisible({ timeout: 10_000 });

    // B entra e vê a transmissão de A no foco, com vídeo.
    await paginaB.getByRole("button", { name: new RegExp(NOME_DA_SALA) }).last().click();
    const foco = paginaB.getByTestId("foco-do-palco");
    await expect(foco.locator("video")).toBeVisible({ timeout: 10_000 });

    // B vai ler um canal: a chamada segue no widget; volta ao palco no mesmo foco.
    await paginaB.getByRole("button", { name: /geral/ }).first().click();
    await expect(paginaB.getByRole("region", { name: "Chamada em andamento" })).toBeVisible();
    await expect(paginaB.getByRole("region", { name: "Controles da chamada" })).toBeVisible();
    await paginaB.getByRole("button", { name: "Voltar ao palco" }).click({ force: true });
    await expect(paginaB.getByTestId("foco-do-palco")).toBeVisible();

    // A sai e a transmissão some para B em até 2 s.
    await paginaA.getByRole("button", { name: "Sair da chamada" }).click();
    await expect(paginaB.getByTestId("foco-do-palco")).toHaveCount(0, { timeout: PRAZO_MS });
  });

  test("B lê um canal com a chamada: o widget mostra a transmissão em PiP, arrasta ao canto e o canto sobrevive ao recarregar", async ({
    browser,
    request,
  }) => {
    const nome = `${NOME_DO_SERVIDOR} pip`;
    const { a, b } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const sessaoB = await entrarPelaApi(request, b.email, b.senha);
    await prepararServidor(request, sessaoA, sessaoB, nome);
    const paginaA = await abrirComoPessoa(browser, sessaoA, nome);
    const paginaB = await abrirComoPessoa(browser, sessaoB, nome);

    await paginaA.getByRole("button", { name: new RegExp(NOME_DA_SALA) }).last().click();
    await paginaA.getByRole("button", { name: "Compartilhar tela" }).click();
    await paginaA.getByRole("dialog", { name: "O que você quer mostrar?" }).getByRole("button", { name: "Transmitir" }).click();
    await expect(paginaA.getByTestId("foco-do-palco")).toBeVisible({ timeout: 10_000 });

    await paginaB.getByRole("button", { name: new RegExp(NOME_DA_SALA) }).last().click();
    await paginaB.getByRole("button", { name: /geral/ }).first().click();

    // O PiP mostra a transmissão de A (vídeo, na camada média).
    const widget = paginaB.getByRole("region", { name: "Chamada em andamento" });
    await expect(widget).toBeVisible();
    await expect(widget.getByTestId("video-do-pip").locator("video")).toBeVisible({ timeout: 10_000 });

    // Arrasta o widget (pelo palco) até o canto superior esquerdo da área.
    const antes = (await widget.boundingBox())!;
    const palco = (await widget.getByTestId("video-do-pip").boundingBox())!;
    await paginaB.mouse.move(palco.x + palco.width / 2, palco.y + palco.height / 2);
    await paginaB.mouse.down();
    await paginaB.mouse.move(400, 200, { steps: 10 });
    await paginaB.mouse.up();
    await expect.poll(async () => (await widget.boundingBox())!.y).toBeLessThan(antes.y / 2);
    const depois = (await widget.boundingBox())!;
    expect(depois.x).toBeLessThan(antes.x / 2);

    // O canto é do dispositivo: sobrevive ao recarregar.
    await paginaB.reload();
    await paginaB.getByRole("button", { name: nome }).click();
    const recarregado = paginaB.getByRole("region", { name: "Chamada em andamento" });
    if (await recarregado.isVisible()) {
      expect((await recarregado.boundingBox())!.x).toBeLessThan(antes.x / 2);
    }
  });

  test("B destaca a chamada: o overlay mostra quem está na sala na janela PiP, e some quando B sai", async ({
    browser,
    request,
  }) => {
    const nome = `${NOME_DO_SERVIDOR} destacar`;
    const { a, b } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const sessaoB = await entrarPelaApi(request, b.email, b.senha);
    await prepararServidor(request, sessaoA, sessaoB, nome);
    const paginaA = await abrirComoPessoa(browser, sessaoA, nome);
    const paginaB = await abrirComoPessoa(browser, sessaoB, nome);

    // Clicar na sala entra nela (o palco abre na hora).
    for (const p of [paginaA, paginaB]) {
      await p.getByRole("button", { name: new RegExp(NOME_DA_SALA) }).last().click();
    }
    await paginaB.getByRole("button", { name: /geral/ }).first().click();
    // Ninguém transmite: sem janelinha, e os controles moram no painel da coluna de salas.
    await expect(paginaB.getByRole("region", { name: "Chamada em andamento" })).toHaveCount(0);
    await expect(paginaB.getByRole("region", { name: "Controles da chamada" })).toBeVisible();

    // O Document PiP exige gesto; o clique do Playwright o dá.
    await paginaB.getByRole("button", { name: "Destacar chamada" }).click();
    await expect.poll(() => paginaB.evaluate(() => !!(window as PipWindow).documentPictureInPicture?.window)).toBe(true);
    await expect
      .poll(() =>
        paginaB.evaluate(
          () => (window as PipWindow).documentPictureInPicture?.window?.document.querySelectorAll("li[data-pessoa]").length ?? 0,
        ),
      )
      .toBeGreaterThanOrEqual(2);

    // Sai da chamada: a janela destacada fecha junto.
    await paginaB.getByRole("button", { name: "Sair da chamada" }).click();
    await expect.poll(() => paginaB.evaluate(() => !!(window as PipWindow).documentPictureInPicture?.window)).toBe(false);
  });
});

type PipWindow = Window & { documentPictureInPicture?: { window: Window | null } };

/**
 * PiP e destacar sem back-end: o que dá para provar sem uma sala de verdade. O
 * resto (vídeo no widget, arrastar, janela destacada) está nos casos @backend acima
 * e nos testes de navegador de `jornadas/voz/pip.browser.test.tsx`.
 */
test.describe("destacar, sem back-end", () => {
  test("o Chromium do e2e tem Document PiP — a premissa dos casos @backend de destacar", async ({ page }) => {
    await comSessaoFalsa(page);
    await page.goto("/");
    expect(await page.evaluate(() => typeof (window as unknown as { documentPictureInPicture?: { requestWindow: unknown } }).documentPictureInPicture?.requestWindow)).toBe("function");
  });

  test("onde não há Document PiP (Firefox, Safari) o app sobe sem erro e sem oferecer destacar", async ({ page }) => {
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, "documentPictureInPicture", { value: undefined, configurable: true });
    });
    await comSessaoFalsa(page);
    await page.goto("/");
    await expect(page.getByTestId("shell")).toBeVisible();
    await expect(page.getByRole("button", { name: "Destacar chamada" })).toHaveCount(0);
    expect(erros).toEqual([]);
  });
});
