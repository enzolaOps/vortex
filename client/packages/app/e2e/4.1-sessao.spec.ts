import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { contasDeTeste } from "./globalSetup";
import { CHAVE_DA_SESSAO } from "./helpers/sessao";

/**
 * Jornada 4.1: entrar, recarregar e continuar dentro, sair e voltar à entrada; criar
 * conta, recuperar senha, links de e-mail, convite sem sessão e entrar por código QR.
 * Precisa da pilha local do pi-infra (`globalSetup.ts`); sem ela os testes se pulam
 * sozinhos e o job de CI, que só roda `@fumaca`, nem os vê.
 *
 * Os testes leem o texto da tela como a pessoa o lê. Se o catálogo mudar a frase,
 * a spec muda junto: é o contrato que ela protege.
 */
test.describe("4.1 sessão @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  const entradaVisivel = (page: Page) =>
    page.getByRole("heading", { name: "Entrar no Vortex" });

  async function preencher(page: Page, identificador: string, senha: string) {
    await page.getByLabel("E-mail ou usuário").fill(identificador);
    await page.getByLabel("Senha", { exact: true }).fill(senha);
  }

  /** Conta criada pela API não tem nome de usuário: o primeiro acesso pede um. */
  async function entrarComo(
    page: Page,
    conta: { email: string; senha: string; username: string },
  ) {
    await page.goto("/");
    await expect(entradaVisivel(page)).toBeVisible();
    await preencher(page, conta.email, conta.senha);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    const shell = page.getByTestId("shell");
    const nome = page.getByRole("heading", {
      name: "Como o grupo vai te chamar?",
    });
    await expect(shell.or(nome)).toBeVisible();
    if (await nome.isVisible()) {
      await page.getByLabel("Nome de usuário").fill(conta.username);
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    await expect(shell).toBeVisible();
  }

  test("entra, recarrega e continua dentro, sai e volta à entrada", async ({
    page,
  }) => {
    const { a } = contasDeTeste();
    const console_: string[] = [];
    page.on("console", (m) => console_.push(m.text()));

    await entrarComo(page, a);
    expect(page.url(), "o token nunca vai para a URL").not.toMatch(
      /token|session/i,
    );

    // Recarregar: continua dentro e a entrada nunca aparece (nem piscando).
    await page.addInitScript(() => {
      const piscou = () =>
        document.querySelector("h1")?.textContent === "Entrar no Vortex";
      new MutationObserver(() => {
        if (piscou()) sessionStorage.setItem("e2e-piscou-entrada", "1");
      }).observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    await expect(page.getByTestId("shell")).toBeVisible();
    expect(
      await page.evaluate(() => sessionStorage.getItem("e2e-piscou-entrada")),
    ).toBeNull();

    // Nenhum token no console durante toda a jornada.
    const guardado = await page.evaluate(
      (chave) => localStorage.getItem(chave),
      CHAVE_DA_SESSAO,
    );
    const token = (JSON.parse(guardado ?? "{}") as { token?: string }).token;
    expect(token).toBeTruthy();
    expect(console_.join("\n")).not.toContain(token ?? "");

    // Sair mora nas configurações e pede confirmação.
    await page.getByRole("button", { name: "Configurações" }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Sair", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Sair da conta?" })
      .getByRole("button", { name: "Sair", exact: true })
      .click();
    await expect(entradaVisivel(page)).toBeVisible();
    expect(
      await page.evaluate(
        (chave) => localStorage.getItem(chave),
        CHAVE_DA_SESSAO,
      ),
    ).toBeNull();
    await page.reload();
    await expect(entradaVisivel(page)).toBeVisible();
    await expect(page.getByTestId("shell")).toHaveCount(0);
  });

  test("senha errada diz o motivo e mantém o que foi digitado", async ({
    page,
  }) => {
    const { a } = contasDeTeste();
    await page.goto("/");
    await preencher(page, a.email, "senha-errada-de-proposito");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "E-mail ou senha incorretos.",
    );
    await expect(page.getByLabel("E-mail ou usuário")).toHaveValue(a.email);
    await expect(page.getByLabel("Senha", { exact: true })).toHaveValue(
      "senha-errada-de-proposito",
    );
    await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
    await expect(page.getByTestId("shell")).toHaveCount(0);
  });

  test("sem marcar Manter conectado a sessão fica só na aba", async ({
    page,
  }) => {
    const { b } = contasDeTeste();
    await page.goto("/");
    await preencher(page, b.email, b.senha);
    await page.getByLabel("Manter conectado").uncheck();
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    const nome = page.getByRole("heading", {
      name: "Como o grupo vai te chamar?",
    });
    await expect(page.getByTestId("shell").or(nome)).toBeVisible();
    if (await nome.isVisible()) {
      await page.getByLabel("Nome de usuário").fill(b.username);
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    await expect(page.getByTestId("shell")).toBeVisible();

    const onde = await page.evaluate(
      (chave) => ({
        persistente: localStorage.getItem(chave),
        daAba: sessionStorage.getItem(chave),
      }),
      CHAVE_DA_SESSAO,
    );
    expect(onde.persistente).toBeNull();
    expect(onde.daAba).not.toBeNull();

    await page.reload();
    await expect(page.getByTestId("shell")).toBeVisible();
  });
});

type SessaoDaApi = { _id: string; token: string; user_id: string };

async function entrarPelaApi(
  request: APIRequestContext,
  email: string,
  senha: string,
): Promise<SessaoDaApi> {
  const { api } = contasDeTeste();
  const r = await request.post(`${api}/auth/session/login`, {
    data: { email, password: senha, friendly_name: "e2e" },
  });
  expect(r.ok(), `login de ${email}`).toBe(true);
  return (await r.json()) as SessaoDaApi;
}

test.describe("4.1 entrada completa @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  test("cria conta pela interface, confere o e-mail sem pôr o endereço na URL e entra com ela", async ({
    page,
  }) => {
    const { api } = contasDeTeste();
    const sufixo = Date.now().toString(36);
    const email = `vortex-e2e-${sufixo}@teste.local`;
    const usuario = `e2e${sufixo}`;
    const senha = "vortex-e2e-senha-nova-1";

    await page.goto("/");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(
      page.getByRole("heading", { name: "Criar conta" }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/entrar/criar");

    await page.getByLabel("Nome de usuário").fill(usuario);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(senha);
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(
      page.getByRole("heading", { name: "Confira seu e-mail" }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    // O reenvio espera 60 s: o botão diz quanto falta e não é apertável.
    await expect(
      page.getByRole("button", { name: /Reenviar em \d+ s/ }),
    ).toBeDisabled();
    expect(page.url(), "o e-mail nunca vai para a URL").not.toContain(
      encodeURIComponent(email),
    );
    expect(page.url()).not.toContain(usuario);

    // A conta existe no servidor (a pilha local tem a verificação desligada).
    const r = await page.request.post(`${api}/auth/session/login`, {
      data: { email, password: senha, friendly_name: "e2e" },
    });
    expect(r.ok(), "a conta criada pela interface entra pela API").toBe(true);

    await page.getByRole("button", { name: "Voltar para entrar" }).click();
    await page.getByLabel("E-mail ou usuário").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(senha);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    // O nome de usuário foi escolhido no cadastro: o primeiro acesso não pergunta de novo.
    await expect(page.getByTestId("shell")).toBeVisible();
  });

  test("esqueci a senha pede o link e mostra o resultado; link inválido diz que não vale mais", async ({
    page,
  }) => {
    const { a } = contasDeTeste();
    await page.goto("/");
    await page.getByRole("button", { name: "Esqueci a senha" }).click();
    await expect(
      page.getByRole("heading", { name: "Recuperar senha" }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/entrar/recuperar");

    await page.getByLabel("E-mail").fill("isso-nao-e-email");
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("alert")).toContainText("e-mail válido");

    await page.getByLabel("E-mail").fill(a.email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(
      page.getByRole("heading", { name: "Link enviado" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Reenviar em \d+ s/ }),
    ).toBeDisabled();

    // O link do e-mail: um token que o servidor não conhece é recusado na própria tela.
    await page.goto("/redefinir/token-que-nao-existe");
    await expect(
      page.getByRole("heading", { name: "Nova senha" }),
    ).toBeVisible();
    await page.getByLabel("Nova senha").fill("Outra-senha-1");
    await page.getByLabel("Confirmar senha").fill("Outra-senha-1");
    await page.getByRole("button", { name: "Salvar senha" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pedir um novo link" }),
    ).toBeVisible();

    await page.goto("/verificar/token-que-nao-existe");
    await expect(
      page.getByRole("heading", { name: "Não deu para confirmar o e-mail" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Voltar para entrar" }).click();
    await expect(
      page.getByRole("heading", { name: "Entrar no Vortex" }),
    ).toBeVisible();
  });

  test("abre um convite sem sessão, entra e cai no servidor do convite", async ({
    browser,
    request,
  }) => {
    const { api, a, b } = contasDeTeste();
    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const nome = `Convite E2E ${Date.now()}`;
    const criado = await request.post(`${api}/servers/create`, {
      headers: { "x-session-token": sessaoA.token },
      data: { name: nome },
    });
    expect(criado.ok(), "criar servidor").toBe(true);
    const { channels } = (await criado.json()) as {
      channels: { _id: string }[];
    };
    const convite = await request.post(
      `${api}/channels/${channels[0]!._id}/invites`,
      {
        headers: { "x-session-token": sessaoA.token },
        data: {},
      },
    );
    expect(convite.ok(), "criar convite").toBe(true);
    const { _id: codigo } = (await convite.json()) as { _id: string };

    const contexto = await browser.newContext({
      viewport: { width: 1600, height: 900 },
    });
    const page = await contexto.newPage();
    // Com parâmetro de rastreio, que é a forma mais comum de o link chegar.
    await page.goto(`/convite/${codigo}?ref=rastreio`);
    await expect(
      page.getByRole("heading", { name: "Você foi convidado" }),
    ).toBeVisible();
    await expect(page.getByText(nome)).toBeVisible();

    await page.getByRole("button", { name: "Entrar na conta" }).click();
    await page.getByLabel("E-mail ou usuário").fill(b.email);
    await page.getByLabel("Senha", { exact: true }).fill(b.senha);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    const nomeDeUsuario = page.getByRole("heading", {
      name: "Como o grupo vai te chamar?",
    });
    const shell = page.getByTestId("shell");
    await expect(shell.or(nomeDeUsuario)).toBeVisible();
    if (await nomeDeUsuario.isVisible()) {
      await page.getByLabel("Nome de usuário").fill(b.username);
      await page.getByRole("button", { name: "Continuar" }).click();
    }

    // O convite esperou a sessão: abre dentro do app, no servidor do link.
    const dialogo = page.getByTestId("convite-recebido");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText(nome)).toBeVisible();
    await dialogo.getByRole("button", { name: "Entrar no servidor" }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(page.getByRole("button", { name: nome })).toBeVisible();
    expect(
      new URL(page.url()).pathname,
      "o endereço do convite não fica na barra",
    ).toBe("/");
    await contexto.close();
  });

  test("entra por código QR: o aparelho com sessão confere o número e autoriza", async ({
    browser,
    request,
  }) => {
    const { api, a } = contasDeTeste();
    const sonda = await request.post(`${api}/auth/qr/create`, {
      data: { friendly_name: "sonda" },
    });
    test.skip(
      sonda.status() === 404,
      "a instância não tem as rotas de QR do fork",
    );

    const sessaoA = await entrarPelaApi(request, a.email, a.senha);
    const novo = await browser.newContext({
      viewport: { width: 1600, height: 900 },
    });
    const comSessao = await browser.newContext({
      viewport: { width: 1600, height: 900 },
    });
    await comSessao.addInitScript((s) => {
      localStorage.setItem("vortex.sessao", JSON.stringify(s));
    }, sessaoA);

    const semSessao = await novo.newPage();
    const pedido = semSessao.waitForResponse(
      (r) =>
        r.url().endsWith("/auth/qr/create") && r.request().method() === "POST",
    );
    await semSessao.goto("/");
    await semSessao
      .getByRole("button", { name: "Entrar com código QR" })
      .click();
    await expect(
      semSessao.getByRole("heading", { name: "Aponte um aparelho conectado" }),
    ).toBeVisible();
    const { id } = (await (await pedido).json()) as { id: string };
    const confirmacao = semSessao.locator("span", { hasText: /^\d{3} \d{3}$/ });
    await expect(confirmacao).toBeVisible();
    const numero = (await confirmacao.textContent()) ?? "";

    // O aparelho com sessão abre o link que está dentro do QR.
    const autorizador = await comSessao.newPage();
    await autorizador.goto(`/qr/${id}`);
    const dialogo = autorizador.getByTestId("autorizar-qr");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText(numero)).toBeVisible();
    await dialogo
      .getByRole("button", { name: "Os números batem, autorizar" })
      .click();
    await expect(
      dialogo.getByText("Pronto. O outro aparelho já está entrando."),
    ).toBeVisible();

    // O aparelho novo pergunta a cada 2 s e entra sozinho.
    await expect(semSessao.getByTestId("shell")).toBeVisible({
      timeout: 15_000,
    });
    await novo.close();
    await comSessao.close();
  });
});
