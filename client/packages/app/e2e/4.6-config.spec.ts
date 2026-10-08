import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from "@playwright/test";

import { contasDeTeste } from "./globalSetup";
import { CHAVE_DA_SESSAO } from "./helpers/sessao";

/**
 * Jornada 4.6 (PRD): configurações essenciais. Precisa da pilha local do pi-infra
 * (`globalSetup.ts`); sem ela os testes se pulam sozinhos.
 *
 * Cada teste cria a PRÓPRIA conta descartável pela API. Trocar a senha ou derrubar
 * sessões da conta compartilhada A/B quebraria as outras jornadas, que a reaproveitam
 * entre arquivos. B (a conta compartilhada) só LÊ: é "a outra conta" que vê a mudança.
 *
 * "A outra conta vê" é medido no que B recebe do servidor (`GET /users/:id` com a
 * sessão de B). A lista de membros ainda não desenha foto nem recado — é do chat
 * (M5) — então o que está sob teste aqui é a gravação, e não o desenho dela.
 */
const PRAZO_MS = 10_000;
// PNG de 1x1 pixel: o servidor de mídia só precisa de uma imagem válida.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Sessao = { _id: string; token: string; user_id: string };
type Conta = { email: string; senha: string; username: string; sessao: Sessao };

const cabecalho = (s: Sessao) => ({ "x-session-token": s.token });

async function entrarPelaApi(
  request: APIRequestContext,
  email: string,
  senha: string,
  nomeDoDispositivo = "e2e",
): Promise<Sessao> {
  const { api } = contasDeTeste();
  const r = await request.post(`${api}/auth/session/login`, {
    data: { email, password: senha, friendly_name: nomeDoDispositivo },
  });
  expect(r.ok(), `login de ${email}`).toBe(true);
  return (await r.json()) as Sessao;
}

let contador = 0;

/** Uma conta nova, com nome de usuário escolhido, e a sessão dela já aberta. */
async function criarContaDescartavel(
  request: APIRequestContext,
): Promise<Conta> {
  const { api, a } = contasDeTeste();
  contador += 1;
  const id = `${String(Date.now())}${String(contador)}`;
  const email = `vortex-e2e-cfg-${id}@teste.local`;
  const username = `Cfg${id.slice(-9)}`;
  const criada = await request.post(`${api}/auth/account/create`, {
    data: { email, password: a.senha },
  });
  expect(criada.status(), "criar conta descartável").toBe(204);
  const sessao = await entrarPelaApi(request, email, a.senha);
  const nome = await request.post(`${api}/onboard/complete`, {
    headers: cabecalho(sessao),
    data: { username },
  });
  expect(nome.ok(), "escolher nome de usuário").toBe(true);
  return { email, senha: a.senha, username, sessao };
}

async function abrirComo(
  browser: Browser,
  sessao: Sessao,
  preparar?: (p: Page) => Promise<void>,
): Promise<Page> {
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
  await preparar?.(pagina);
  await pagina.goto("/");
  await expect(pagina.getByTestId("shell")).toBeVisible();
  return pagina;
}

async function abrirConfiguracoes(pagina: Page, secao: string) {
  await pagina.getByRole("button", { name: "Configurações" }).click();
  const dialogo = pagina.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  if (secao !== "Perfil")
    await dialogo
      .getByRole("navigation")
      .getByRole("button", { name: secao, exact: true })
      .click();
  return dialogo;
}

test.describe("4.6 configurações @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  test("troca a foto e o recado, e a outra conta recebe a mudança", async ({
    browser,
    request,
  }) => {
    const { api, b } = contasDeTeste();
    const dona = await criarContaDescartavel(request);
    const sessaoB = await entrarPelaApi(request, b.email, b.senha);
    const pagina = await abrirComo(browser, dona.sessao);

    const dialogo = await abrirConfiguracoes(pagina, "Perfil");
    const recado = `em reunião ${String(Date.now())}`;
    await dialogo.getByLabel("Recado").fill(recado);
    await expect(
      dialogo.getByText("Você tem alterações não salvas"),
    ).toBeVisible();
    await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(pagina.getByText("Alterações salvas.")).toBeVisible();
    await expect(
      dialogo.getByText("Você tem alterações não salvas"),
    ).toHaveCount(0);

    await dialogo
      .getByTestId("seletor-de-foto")
      .setInputFiles({
        name: "foto.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      });
    await expect(
      dialogo.getByTestId("foto-do-perfil").locator("img"),
    ).toBeVisible({ timeout: PRAZO_MS });

    // B recebe do servidor o que A gravou: o recado e uma foto (o anexo existe).
    await expect
      .poll(
        async () => {
          const r = await request.get(`${api}/users/${dona.sessao.user_id}`, {
            headers: cabecalho(sessaoB),
          });
          const u = (await r.json()) as {
            status?: { text?: string };
            avatar?: { _id: string };
          };
          return {
            recado: u.status?.text,
            temFoto: u.avatar?._id !== undefined,
          };
        },
        { timeout: PRAZO_MS },
      )
      .toEqual({ recado, temFoto: true });

    // E a gravação sobrevive a recarregar: o formulário reabre com o que foi salvo.
    await pagina.reload();
    const reaberto = await abrirConfiguracoes(pagina, "Perfil");
    await expect(reaberto.getByLabel("Recado")).toHaveValue(recado);
  });

  test("troca a senha e entra com a nova; a antiga deixa de valer", async ({
    browser,
    request,
  }) => {
    const conta = await criarContaDescartavel(request);
    const pagina = await abrirComo(browser, conta.sessao);
    const novaSenha = `${conta.senha}-nova`;

    const dialogo = await abrirConfiguracoes(pagina, "Conta");
    await dialogo.getByRole("button", { name: "Trocar senha" }).click();
    const formulario = pagina.getByRole("dialog", { name: "Trocar senha" });
    await formulario.getByLabel("Senha atual").fill("senha-errada-123");
    await formulario.getByLabel("Nova senha").fill(novaSenha);
    await formulario.getByLabel("Confirmar nova senha").fill(novaSenha);
    await formulario.getByRole("button", { name: "Trocar senha" }).click();
    // Senha atual errada: o erro fica no diálogo e nada foi trocado.
    await expect(
      formulario.getByText("A senha atual está incorreta."),
    ).toBeVisible();

    await formulario.getByLabel("Senha atual").fill(conta.senha);
    await formulario.getByLabel("Nova senha").fill(novaSenha);
    await formulario.getByLabel("Confirmar nova senha").fill(novaSenha);
    await formulario.getByRole("button", { name: "Trocar senha" }).click();
    await expect(pagina.getByText("Senha alterada.")).toBeVisible();

    // Sai e entra pela interface: a nova vale, a antiga não.
    await dialogo.getByRole("button", { name: "Sair", exact: true }).click();
    await pagina
      .getByRole("dialog", { name: "Sair da conta?" })
      .getByRole("button", { name: "Sair", exact: true })
      .click();
    const entrada = pagina.getByRole("heading", { name: "Entrar no Vortex" });
    await expect(entrada).toBeVisible({ timeout: PRAZO_MS });

    await pagina.getByLabel("E-mail ou usuário").fill(conta.email);
    await pagina.getByLabel("Senha", { exact: true }).fill(conta.senha);
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(pagina.getByText("E-mail ou senha incorretos.")).toBeVisible({
      timeout: PRAZO_MS,
    });

    await pagina.getByLabel("Senha", { exact: true }).fill(novaSenha);
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(pagina.getByTestId("shell")).toBeVisible({
      timeout: PRAZO_MS,
    });
  });

  test("derruba outro dispositivo e a sessão dele cai; a senha é pedida uma vez só", async ({
    browser,
    request,
  }) => {
    const { api } = contasDeTeste();
    const conta = await criarContaDescartavel(request);
    const outro = await entrarPelaApi(
      request,
      conta.email,
      conta.senha,
      "outro-computador",
    );
    const terceiro = await entrarPelaApi(
      request,
      conta.email,
      conta.senha,
      "terceiro-computador",
    );

    // O "outro computador" é uma segunda página de verdade, com a sessão dele.
    const paginaDoOutro = await abrirComo(browser, outro);
    const pagina = await abrirComo(browser, conta.sessao);

    const dialogo = await abrirConfiguracoes(pagina, "Dispositivos");
    await expect(dialogo.getByText("outro-computador")).toBeVisible({
      timeout: PRAZO_MS,
    });
    await expect(dialogo.getByText("terceiro-computador")).toBeVisible();

    // Primeiro dispositivo: pede a senha (e erra uma vez).
    await dialogo
      .getByRole("button", { name: "Desconectar outro-computador" })
      .click();
    const pedido = pagina.getByRole("dialog", {
      name: "Confirme com a sua senha",
    });
    await pedido.getByLabel("Senha atual").fill("senha-errada-123");
    await pedido
      .getByRole("button", { name: "Desconectar", exact: true })
      .click();
    await expect(
      pedido.getByText("A senha atual está incorreta."),
    ).toBeVisible();
    await pedido.getByLabel("Senha atual").fill(conta.senha);
    await pedido
      .getByRole("button", { name: "Desconectar", exact: true })
      .click();
    await expect(dialogo.getByText("outro-computador")).toHaveCount(0, {
      timeout: PRAZO_MS,
    });

    // A sessão dele cai: o servidor a recusa e a página dele volta à entrada.
    const rejeitada = await request.get(`${api}/users/@me`, {
      headers: cabecalho(outro),
    });
    expect(rejeitada.status()).toBe(401);
    await expect(
      paginaDoOutro.getByRole("heading", { name: "Entrar no Vortex" }),
    ).toBeVisible({ timeout: 20_000 });

    // Segundo pedido: NÃO pede a senha de novo.
    await dialogo
      .getByRole("button", { name: "Desconectar todos os outros" })
      .click();
    await expect(
      pagina.getByRole("dialog", { name: "Confirme com a sua senha" }),
    ).toHaveCount(0);
    await expect(dialogo.getByTestId("dispositivos-vazio")).toBeVisible({
      timeout: PRAZO_MS,
    });
    const terceiroCaiu = await request.get(`${api}/users/@me`, {
      headers: cabecalho(terceiro),
    });
    expect(terceiroCaiu.status()).toBe(401);

    // Esta sessão continua de pé.
    const eu = await request.get(`${api}/users/@me`, {
      headers: cabecalho(conta.sessao),
    });
    expect(eu.status()).toBe(200);
  });

  test("push-to-talk: o microfone só transmite enquanto a tecla está segurada", async ({
    browser,
    request,
  }) => {
    const { api } = contasDeTeste();
    const conta = await criarContaDescartavel(request);
    const servidor = await request.post(`${api}/servers/create`, {
      headers: cabecalho(conta.sessao),
      data: { name: `Config E2E ${String(Date.now())}` },
    });
    expect(servidor.ok(), "criar servidor").toBe(true);
    const { server } = (await servidor.json()) as {
      server: { _id: string; name: string };
    };
    const sala = await request.post(`${api}/servers/${server._id}/channels`, {
      headers: cabecalho(conta.sessao),
      data: { type: "Voice", name: "Jogatina" },
    });
    expect(sala.ok(), "criar sala de voz").toBe(true);

    /*
      A pergunta é "o navegador está enviando áudio?", e quem responde são os
      remetentes das conexões WebRTC: faixa de áudio viva E habilitada. O init
      script guarda cada conexão que a página abrir.
    */
    const pagina = await abrirComo(browser, conta.sessao, async (p) => {
      await p.addInitScript(() => {
        const todas: RTCPeerConnection[] = [];
        (window as unknown as { __conexoes: RTCPeerConnection[] }).__conexoes =
          todas;
        const Original = window.RTCPeerConnection;
        window.RTCPeerConnection = class extends Original {
          constructor(
            ...args: ConstructorParameters<typeof RTCPeerConnection>
          ) {
            super(...args);
            todas.push(this);
          }
        };
      });
    });
    const transmitindo = () =>
      pagina.evaluate(() =>
        (
          window as unknown as { __conexoes: RTCPeerConnection[] }
        ).__conexoes.some((c) =>
          c
            .getSenders()
            .some(
              (s) =>
                s.track?.kind === "audio" &&
                s.track.enabled &&
                s.track.readyState === "live",
            ),
        ),
      );

    await pagina.getByRole("button", { name: server.name }).click();
    await pagina
      .getByRole("button", { name: /Jogatina/ })
      .last()
      .click();
    await pagina.getByRole("button", { name: "Entrar na sala" }).click();
    // Detecção de voz (o padrão): o microfone abre ao entrar.
    await expect.poll(transmitindo, { timeout: PRAZO_MS }).toBe(true);

    // Troca para "pressionar para falar" e fecha as configurações.
    const dialogo = await abrirConfiguracoes(pagina, "Voz e vídeo");
    await dialogo.getByRole("radio", { name: /Pressionar para falar/ }).click();
    await expect(dialogo.getByTestId("tecla-de-falar")).toHaveText(
      "Alt + Espaço",
    );
    await pagina.keyboard.press("Escape");
    await expect(pagina.getByRole("dialog")).toHaveCount(0);

    // Sem a tecla o microfone fecha; com ela abre; ao soltar fecha de novo.
    await expect.poll(transmitindo, { timeout: PRAZO_MS }).toBe(false);
    await pagina.keyboard.down("Alt");
    await pagina.keyboard.down("Space");
    await expect.poll(transmitindo, { timeout: PRAZO_MS }).toBe(true);
    await pagina.keyboard.up("Space");
    await pagina.keyboard.up("Alt");
    await expect.poll(transmitindo, { timeout: PRAZO_MS }).toBe(false);
  });
});
