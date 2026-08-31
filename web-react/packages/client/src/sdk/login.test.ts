import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O caminho de login, sob teste pela primeira vez.
 *
 * O `CLAUDE.md` dizia que `client.login()` era "a única linha do projeto que
 * nunca rodou" e que faltava "só o caminho de sucesso contra servidor real".
 * As duas frases estavam erradas na mesma direção: o caminho de sucesso do SDK
 * **não funciona** — ele não instala cabeçalho, não conecta, e lança uma string
 * crua quando a conta tem MFA.
 *
 * Dublando o `client`, tudo o que importa vira testável sem servidor: qual
 * corpo vai na requisição, o que cada um dos três resultados faz, e — o que
 * mais importa — **que `connect()` é chamado**.
 */
const api = { post: vi.fn() };
/*
  ⚠ `configuration` faz parte do dublê porque a conexão DEPENDE dela: sem
  `configuration.ws` o app se recusa a abrir o socket, e a razão é séria — o
  SDK cai em `wss://stoat.chat/events` e manda o token para a instância
  pública. Ver `conectar()` em `autenticacao.ts`.

  Ela é mutável de propósito: o teste da guarda a zera.
*/
const client: {
  api: typeof api;
  configuration: { ws: string } | undefined;
  useExistingSession: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
} = {
  api,
  configuration: { ws: "ws://localhost/ws" },
  useExistingSession: vi.fn(),
  connect: vi.fn(),
  logout: vi.fn(),
  on: vi.fn(),
};

vi.mock("./client", () => ({
  client,
  conectado: () => true,
}));

vi.mock("./adapter", () => ({
  definirUsuarioLocal: vi.fn(),
}));

const { entrar, responderMfa, restaurarSessao, cancelarMfa } = await import(
  "./autenticacao"
);
const { lerSessao, limparSessao, guardarToken } = await import("../store/sessao");

const SESSAO_OK = {
  result: "Success",
  _id: "01SESSAO",
  token: "tok",
  user_id: "01EU",
  name: "Vortex (web)",
};

beforeEach(() => {
  vi.clearAllMocks();
  limparSessao();
  client.configuration = { ws: "ws://localhost/ws" };
});

describe("entrar — o caminho de sucesso", () => {
  it("manda e-mail, senha e um nome amigável genérico", async () => {
    api.post.mockResolvedValueOnce(SESSAO_OK);
    await entrar("eu@exemplo.com", "senha");

    expect(api.post).toHaveBeenCalledWith("/auth/session/login", {
      email: "eu@exemplo.com",
      password: "senha",
      // Genérico de propósito: o user agent carrega versão de sistema e de
      // navegador para uma lista que outras pessoas podem ver.
      friendly_name: "Vortex (web)",
    });
  });

  /*
    ⚠ **A regressão que este arquivo existe para impedir.**

    `client.login()` do SDK tem `// TODO: return await this.connect();` — a
    linha está lá, comentada. Sem socket não há `Ready`, e sem `Ready` não há
    usuário, canal nem mensagem: o app entra e fica mudo, sem erro nenhum.
  */
  it("ABRE O SOCKET, e não só instala o token", async () => {
    api.post.mockResolvedValueOnce(SESSAO_OK);
    await entrar("eu@exemplo.com", "senha");

    expect(client.useExistingSession).toHaveBeenCalledWith({
      _id: "01SESSAO",
      token: "tok",
      user_id: "01EU",
    });
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  /*
    ⚠ **Sem configuração NÃO conecta, e este teste guarda uma credencial.**

    A linha do SDK é `events.connect(this.configuration?.ws ??
    "wss://stoat.chat/events", token)` — o fallback é a instância PÚBLICA do
    Stoat, e o segundo argumento é o token da sessão. Basta o `GET {baseURL}/`
    ter falhado no arranque para a sessão de quem está entrando ser aberta
    contra um servidor de terceiro.

    Verificado por mutação: removendo a guarda de `conectar()`, este teste
    falha e os dois de sucesso passam — que é exatamente o estado silencioso
    que ele existe para impedir.
  */
  it("NÃO abre o socket sem configuração — o fallback do SDK é stoat.chat", async () => {
    client.configuration = undefined;
    api.post.mockResolvedValueOnce({
      result: "Success",
      _id: "01SE",
      token: "tok",
      user_id: "01EU",
    });

    await entrar("a@b.c", "senha");

    expect(client.useExistingSession).toHaveBeenCalledTimes(1);
    expect(client.connect).not.toHaveBeenCalled();
  });

  /*
    O ID vem da RESPOSTA, não de `client.user`.

    O código antigo lia `client.user?.id` e caía num ramo de erro quando ele era
    `undefined` — o que era sempre. Mesmo com socket aberto seria uma corrida:
    `Ready` chega depois da resposta.
  */
  it("entra com o ID que veio na resposta", async () => {
    api.post.mockResolvedValueOnce(SESSAO_OK);
    await entrar("eu@exemplo.com", "senha");

    expect(lerSessao().estado).toBe("dentro");
    expect(lerSessao().userId).toBe("01EU");
  });
});

describe("entrar — segundo fator", () => {
  it("vai para a tela de MFA com os métodos TRADUZIDOS", async () => {
    api.post.mockResolvedValueOnce({
      result: "MFA",
      ticket: "t1",
      allowed_methods: ["Password", "Recovery"],
    });
    await entrar("eu@exemplo.com", "senha");

    const s = lerSessao();
    expect(s.estado).toBe("mfa");
    // `Password | Recovery` é a grafia do Stoat e não sai do adapter.
    expect(s.metodos).toEqual(["senha", "recuperacao"]);
    expect(client.connect).not.toHaveBeenCalled();
  });

  it("responde com o bilhete e o formato que o protocolo espera", async () => {
    api.post.mockResolvedValueOnce({
      result: "MFA",
      ticket: "t1",
      allowed_methods: ["Recovery"],
    });
    await entrar("eu@exemplo.com", "senha");

    api.post.mockResolvedValueOnce(SESSAO_OK);
    await responderMfa("recuperacao", "123456");

    expect(api.post).toHaveBeenLastCalledWith("/auth/session/login", {
      mfa_ticket: "t1",
      mfa_response: { recovery_code: "123456" },
      friendly_name: "Vortex (web)",
    });
    expect(lerSessao().estado).toBe("dentro");
  });

  it.each([
    ["senha", { password: "x" }],
    ["recuperacao", { recovery_code: "x" }],
  ] as const)("o método %s vira o campo certo", async (metodo, esperado) => {
    api.post.mockResolvedValueOnce({
      result: "MFA",
      ticket: "t1",
      allowed_methods: ["Password", "Recovery"],
    });
    await entrar("eu@exemplo.com", "senha");

    api.post.mockResolvedValueOnce(SESSAO_OK);
    await responderMfa(metodo, "x");

    expect(api.post).toHaveBeenLastCalledWith(
      "/auth/session/login",
      expect.objectContaining({ mfa_response: esperado }),
    );
  });

  /*
    Código errado NÃO devolve à tela de senha.

    A primeira versão chamava `entrando()` e depois `erro()`, e as duas trocam o
    estado que o portão usa para escolher a tela: a pessoa apertaria "Verificar"
    e veria o formulário de e-mail de volta. Nada falharia — só a tela errada.
  */
  it("código errado continua no segundo fator, com o motivo", async () => {
    api.post.mockResolvedValueOnce({
      result: "MFA",
      ticket: "t1",
      allowed_methods: ["Recovery"],
    });
    await entrar("eu@exemplo.com", "senha");

    api.post.mockRejectedValueOnce({ response: { status: 401 } });
    await responderMfa("recuperacao", "000000");

    const s = lerSessao();
    expect(s.estado).toBe("mfa");
    expect(s.motivo).toBe("Código incorreto.");
    expect(s.metodos).toEqual(["recuperacao"]);
    expect(s.ocupada).toBe(false);
  });

  it("cancelar volta para a tela de entrada", async () => {
    api.post.mockResolvedValueOnce({
      result: "MFA",
      ticket: "t1",
      allowed_methods: ["Recovery"],
    });
    await entrar("eu@exemplo.com", "senha");
    cancelarMfa();
    expect(lerSessao().estado).toBe("fora");
  });

  /*
    Desafio sem método conhecido seria uma tela sem saída — um formulário que só
    pode falhar. Dizer que não dá é mais honesto.
  */
  it("desafio só de TOTP vira erro, não formulário inerte", async () => {
    /*
      Aplicativo autenticador ficou FORA do Vortex por decisão de produto. Uma
      conta que o tenha ativado por outro cliente precisa ouvir isso, e não
      encarar um campo que não leva a lugar nenhum.
    */
    api.post.mockResolvedValueOnce({
      result: "MFA",
      ticket: "t1",
      allowed_methods: ["Totp"],
    });
    await entrar("eu@exemplo.com", "senha");

    expect(lerSessao().estado).toBe("erro");
  });
});

describe("entrar — conta desativada", () => {
  /*
    O upstream responde a isto com `alert("Account is disabled, run special
    logic here.")` e um `// TODO`. Estado próprio porque a AÇÃO é outra: senha
    errada se resolve tentando de novo, conta desativada não.
  */
  it("é estado próprio, não erro de senha", async () => {
    api.post.mockResolvedValueOnce({ result: "Disabled", user_id: "01EU" });
    await entrar("eu@exemplo.com", "senha");

    expect(lerSessao().estado).toBe("desativada");
    expect(client.connect).not.toHaveBeenCalled();
  });
});

describe("restaurar sessão", () => {
  /*
    ⚠ A segunda metade do mesmo furo, e ninguém tinha notado.

    `useExistingSession` instala o cabeçalho e **também não conecta**. Restaurar
    sessão guardada abria o app com socket fechado — o mesmo app mudo do login,
    por outra porta.
  */
  it("também ABRE O SOCKET", () => {
    guardarToken({ _id: "01S", token: "t", user_id: "01EU" });
    restaurarSessao();

    expect(client.useExistingSession).toHaveBeenCalledTimes(1);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(lerSessao().estado).toBe("dentro");
  });

  it("sem token guardado, fica fora e não conecta", () => {
    restaurarSessao();
    expect(lerSessao().estado).toBe("fora");
    expect(client.connect).not.toHaveBeenCalled();
  });
});
