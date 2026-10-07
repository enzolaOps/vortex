import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";

import { contasDeTeste } from "./globalSetup";
import { CHAVE_DA_SESSAO } from "./helpers/sessao";

/**
 * Jornada 4.7 (PRD): administração básica. O "Completa quando" do PRD, passo a passo, pela
 * interface: A cria o servidor, cria uma sala de voz e gera o convite; B entra pelo convite;
 * A cria um cargo que libera transmitir e o dá a B; B transmite; A expulsa B, que some da
 * visão das salas.
 *
 * Precisa da pilha local do pi-infra (`globalSetup.ts`); sem ela, pula. Duas contas, dois
 * contextos de navegador = duas pessoas. A sessão entra por `localStorage`: o login pela API
 * é só preparo, a tela de entrada é a jornada 4.1.
 */
const SERVIDOR = `Admin E2E ${String(Date.now())}`;
const SALA = "Palestra";
const CARGO = "Palestrantes";
const PRAZO_MS = 10_000;

type Sessao = { _id: string; token: string; user_id: string };

async function entrarPelaApi(request: APIRequestContext, email: string, senha: string): Promise<Sessao> {
  const { api } = contasDeTeste();
  const r = await request.post(`${api}/auth/session/login`, { data: { email, password: senha, friendly_name: "e2e" } });
  expect(r.ok(), `login de ${email}`).toBe(true);
  return (await r.json()) as Sessao;
}

async function abrirComo(browser: Browser, sessao: Sessao): Promise<Page> {
  const contexto = await browser.newContext({
    permissions: ["microphone", "camera"],
    viewport: { width: 1600, height: 900 },
  });
  await contexto.addInitScript(
    ([chave, s]) => {
      localStorage.setItem(chave, JSON.stringify(s));
    },
    [CHAVE_DA_SESSAO, sessao] as const,
  );
  const pagina = await contexto.newPage();
  await pagina.goto("/");
  await expect(pagina.getByTestId("shell")).toBeVisible();
  return pagina;
}

/** Abre as configurações do servidor aberto, direto numa seção. */
async function abrirConfiguracoes(pagina: Page, secao: string) {
  await pagina.getByRole("button", { name: "Opções do servidor" }).click();
  await pagina.getByRole("menuitem", { name: "Configurações do servidor" }).click();
  const dialogo = pagina.getByRole("dialog", { name: "Configurações" });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole("navigation", { name: "Seções do servidor" }).getByRole("button", { name: secao, exact: true }).click();
  return dialogo;
}

/** Garante o estado de um interruptor, qualquer que seja o de partida. */
async function interruptor(dialogo: Locator, nome: string, ligado: boolean) {
  const chave = dialogo.getByRole("switch", { name: nome, exact: true });
  if ((await chave.getAttribute("aria-checked")) !== String(ligado)) await chave.click();
  await expect(chave).toHaveAttribute("aria-checked", String(ligado));
}

test.describe("4.7 administração @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  test("cria o servidor e a sala, convida, dá o cargo que libera transmitir, e expulsa", async ({ browser, request }) => {
    test.setTimeout(150_000);
    const { a, b } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const sessaoB = await entrarPelaApi(request, b.email, b.senha);
    const paginaA = await abrirComo(browser, sessaoA);
    const paginaB = await abrirComo(browser, sessaoB);

    // 1. A cria o servidor pelo "+" da dock.
    await paginaA.getByRole("button", { name: "Adicionar um servidor" }).click();
    const criar = paginaA.getByRole("dialog", { name: "Adicionar um servidor" });
    await criar.getByLabel("Nome do servidor").fill(SERVIDOR);
    await criar.getByRole("button", { name: "Criar servidor" }).click();
    await expect(paginaA.getByRole("heading", { name: SERVIDOR, level: 2 })).toBeVisible({ timeout: PRAZO_MS });

    // 2. A cria uma sala de voz em Salas e canais.
    let config = await abrirConfiguracoes(paginaA, "Salas e canais");
    await config.getByRole("button", { name: "Criar sala ou canal", exact: true }).click();
    const formulario = paginaA.getByRole("dialog", { name: "Criar sala ou canal" }).last();
    await formulario.getByLabel("Nome", { exact: true }).fill(SALA);
    await formulario.getByRole("button", { name: "Criar", exact: true }).click();
    const linha = config.locator('[data-testid="linha-de-canal"][data-tipo="voz"]').filter({ hasText: SALA });
    await expect(linha).toBeVisible({ timeout: PRAZO_MS });
    await paginaA.keyboard.press("Escape");
    await expect(paginaA.getByRole("button", { name: new RegExp(SALA) }).first()).toBeVisible();

    // 3. A gera o convite pelo menu do servidor.
    await paginaA.getByRole("button", { name: "Opções do servidor" }).click();
    await paginaA.getByRole("menuitem", { name: "Convidar pessoas" }).click();
    const convite = paginaA.getByRole("dialog", { name: "Convidar pessoas" });
    const link = convite.getByLabel("Link do convite");
    await expect(link).toHaveValue(/\/convite\//, { timeout: PRAZO_MS });
    const endereco = await link.inputValue();
    await paginaA.keyboard.press("Escape");

    // 4. B entra pelo convite, pela interface.
    await paginaB.getByRole("button", { name: "Adicionar um servidor" }).click();
    const entrar = paginaB.getByRole("dialog", { name: "Adicionar um servidor" });
    await entrar.getByRole("tab", { name: "Entrar com um convite" }).click();
    await entrar.getByLabel("Link ou código do convite").fill(endereco);
    await expect(entrar.getByTestId("previa-do-convite")).toContainText(SERVIDOR, { timeout: PRAZO_MS });
    await entrar.getByRole("button", { name: "Entrar no servidor" }).click();
    await expect(paginaB.getByRole("heading", { name: SERVIDOR, level: 2 })).toBeVisible({ timeout: PRAZO_MS });

    // 5. Todo mundo perde "câmera e tela"; o cargo Palestrantes a devolve.
    config = await abrirConfiguracoes(paginaA, "Cargos");
    await config.getByRole("button", { name: "@todos" }).click();
    await interruptor(config, "Câmera e tela", false);
    await config.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(config.getByRole("region", { name: /alterações não salvas/i })).toHaveCount(0, { timeout: PRAZO_MS });

    await config.getByRole("button", { name: "Criar cargo" }).click();
    await config.getByLabel("Nome do cargo").fill(CARGO);
    await interruptor(config, "Câmera e tela", true);
    await interruptor(config, "Falar", true);
    await config.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(config.getByRole("button", { name: new RegExp(`^${CARGO}`) })).toBeVisible({ timeout: PRAZO_MS });

    // 6. B, sem o cargo, entra na sala e NÃO tem transmitir (o botão não existe).
    await paginaB.getByRole("button", { name: new RegExp(SALA) }).first().click();
    await paginaB.getByRole("button", { name: "Entrar na sala" }).click();
    await expect(paginaB.getByRole("button", { name: "Sair da chamada" })).toBeVisible({ timeout: PRAZO_MS });
    await expect(paginaB.getByRole("button", { name: "Compartilhar tela" })).toHaveCount(0);
    await expect(paginaB.getByRole("button", { name: "Câmera" })).toHaveCount(0);
    await paginaB.getByRole("button", { name: "Sair da chamada" }).click();

    // 7. A dá o cargo a B, em Membros.
    await config.getByRole("navigation", { name: "Seções do servidor" }).getByRole("button", { name: "Membros", exact: true }).click();
    await config.getByLabel("Buscar pessoas").fill("VortexE2eB");
    await config.getByRole("button", { name: "Ações para VortexE2eB" }).click();
    await paginaA.getByRole("menuitem", { name: "Mudar cargos" }).click();
    await paginaA.getByRole("dialog", { name: /Cargos de/ }).getByRole("switch", { name: CARGO }).click();
    await expect(config.locator('[data-testid="linha-de-membro"]').filter({ hasText: CARGO })).toBeVisible({ timeout: PRAZO_MS });
    await paginaA.getByRole("dialog", { name: /Cargos de/ }).getByRole("button", { name: "Fechar", exact: true }).first().click();
    await paginaA.keyboard.press("Escape");

    // 7b. A entra na sala para ver a transmissão; B volta e agora transmite.
    await paginaA.getByRole("button", { name: new RegExp(SALA) }).first().click();
    await paginaA.getByRole("button", { name: "Entrar na sala" }).click();
    await expect(paginaA.getByTestId("palco")).toBeVisible({ timeout: PRAZO_MS });

    await paginaB.getByRole("button", { name: new RegExp(SALA) }).first().click();
    await paginaB.getByRole("button", { name: "Entrar na sala" }).click();
    await paginaB.getByRole("button", { name: "Compartilhar tela" }).click();
    await paginaB.getByRole("dialog", { name: "O que você quer mostrar?" }).getByRole("button", { name: "Transmitir" }).click();

    // 8. A vê a transmissão de B com vídeo.
    await expect(paginaA.getByTestId("foco-do-palco").locator("video")).toBeVisible({ timeout: 15_000 });

    // 9. A expulsa B: ele some da visão das salas.
    await paginaA.getByRole("button", { name: /Abrir o chat/ }).click();
    await paginaA.getByRole("button", { name: "Opções do servidor" }).click();
    await paginaA.getByRole("menuitem", { name: "Configurações do servidor" }).click();
    const membros = paginaA.getByRole("dialog", { name: "Configurações" });
    await membros.getByRole("navigation", { name: "Seções do servidor" }).getByRole("button", { name: "Membros", exact: true }).click();
    await membros.getByLabel("Buscar pessoas").fill("VortexE2eB");
    await membros.getByRole("button", { name: "Ações para VortexE2eB" }).click();
    await paginaA.getByRole("menuitem", { name: "Expulsar" }).click();
    await paginaA.getByRole("dialog", { name: /Expulsar/ }).getByRole("button", { name: "Expulsar", exact: true }).click();
    await expect(membros.locator('[data-testid="linha-de-membro"]')).toHaveCount(0, { timeout: PRAZO_MS });
    await paginaA.keyboard.press("Escape");

    await expect(paginaA.locator('[role="img"][aria-label*="pessoa na sala"]').first()).toHaveAttribute(
      "aria-label",
      /^[01] pessoa/,
      { timeout: PRAZO_MS },
    );
    // Para B, o servidor deixa de existir na dock.
    await expect(paginaB.getByRole("button", { name: SERVIDOR })).toHaveCount(0, { timeout: PRAZO_MS });
  });

  test("um membro sem permissão não vê nenhuma ação de administração", async ({ browser, request }) => {
    test.setTimeout(90_000);
    const { a, b } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const sessaoB = await entrarPelaApi(request, b.email, b.senha);
    const { api } = contasDeTeste();
    const nome = `Sem permissão E2E ${String(Date.now())}`;
    const cabecalho = (s: Sessao) => ({ "x-session-token": s.token });
    const criado = await request.post(`${api}/servers/create`, { headers: cabecalho(sessaoA), data: { name: nome } });
    expect(criado.ok(), "criar servidor").toBe(true);
    const { channels } = (await criado.json()) as { channels: { _id: string }[] };
    const convite = await request.post(`${api}/channels/${channels[0]!._id}/invites`, { headers: cabecalho(sessaoA), data: {} });
    const { _id: codigo } = (await convite.json()) as { _id: string };
    expect((await request.post(`${api}/invites/${codigo}`, { headers: cabecalho(sessaoB), data: {} })).ok()).toBe(true);

    const paginaB = await abrirComo(browser, sessaoB);
    await paginaB.getByRole("button", { name: nome }).click();
    await paginaB.getByRole("button", { name: "Opções do servidor" }).click();
    await expect(paginaB.getByRole("menuitem", { name: "Sair do servidor" })).toBeVisible();
    await expect(paginaB.getByRole("menuitem", { name: "Configurações do servidor" })).toHaveCount(0);
    await expect(paginaB.getByRole("menuitem", { name: "Criar sala ou canal" })).toHaveCount(0);
  });

  test("o dono que sai é avisado de que o servidor será apagado", async ({ browser, request }) => {
    test.setTimeout(60_000);
    const { a } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const paginaA = await abrirComo(browser, sessaoA);
    const nome = `Apagar E2E ${String(Date.now())}`;
    await paginaA.getByRole("button", { name: "Adicionar um servidor" }).click();
    const criar = paginaA.getByRole("dialog", { name: "Adicionar um servidor" });
    await criar.getByLabel("Nome do servidor").fill(nome);
    await criar.getByRole("button", { name: "Criar servidor" }).click();
    await expect(paginaA.getByRole("heading", { name: nome, level: 2 })).toBeVisible({ timeout: PRAZO_MS });

    await paginaA.getByRole("button", { name: "Opções do servidor" }).click();
    await paginaA.getByRole("menuitem", { name: "Apagar o servidor" }).click();
    const dialogo = paginaA.getByRole("dialog", { name: `Apagar ${nome}?` });
    await expect(dialogo).toContainText("apagado para todo mundo");
    await dialogo.getByLabel(/Para confirmar/).fill(nome);
    await dialogo.getByRole("button", { name: "Apagar servidor" }).click();
    await expect(paginaA.getByRole("button", { name: nome })).toHaveCount(0, { timeout: PRAZO_MS });
  });
});
