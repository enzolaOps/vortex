import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Os quatro desfechos de "Entrar no servidor", com o `client` dublado.
 *
 * ⚠ **Dois deles não são falha nem sucesso, e é isso que o teste guarda.** O
 * fork responde `JoinRequestPending` a quem entra num servidor de aprovação
 * manual e `Banned` a quem foi banido — os dois como ERRO do protocolo, porque
 * `InviteJoinResponse` não tem variante para eles e um cliente antigo trataria
 * um pedido como entrada. Enquanto os dois viravam `undefined` mais um toast, o
 * modal continuava com o botão "Entrar" aceso: quem foi banido clicava de novo
 * e quem já tinha pedido pedia duas vezes.
 *
 * ⚠ **E o `Banned` NÃO descarta o convite.** Quem sumiu da lista é a pessoa, e
 * um administrador pode perdoar enquanto a tela está aberta.
 */

const respostaDeConvite = {
  type: "Server",
  code: "a9Kq2",
  server_id: "01SERVIDOR",
  server_name: "Vortex Core",
  member_count: 1204,
  channel_id: "01CANAL",
  channel_name: "boas-vindas",
  user_name: "Júlia",
};

let erroDoJoin: string | undefined;
/* Mutável: o caso +18 precisa de um assunto que o servidor sem fork mandaria. */
let assuntoDoCanal = "";

const join = vi.fn(() => {
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- o stoat-api lanca o TEXTO
  if (erroDoJoin !== undefined) return Promise.reject(erroDoJoin);
  return Promise.resolve({ id: "01SERVIDOR" });
});

vi.mock("stoat.js", async (importOriginal: () => Promise<object>) => {
  const real = await importOriginal();
  class ServerPublicInvite {
    code = respostaDeConvite.code;
    serverId = respostaDeConvite.server_id;
    serverName = respostaDeConvite.server_name;
    memberCount = respostaDeConvite.member_count;
    channelName = respostaDeConvite.channel_name;
    channelDescription = assuntoDoCanal;
    userName = respostaDeConvite.user_name;
    serverIcon = undefined;
    serverBanner = undefined;
    userAvatar = undefined;
    join = join;
  }
  /*
    Parcial, e não um módulo inteiro escrito à mão: o `sdk/` importa `Permission`
    e outras tabelas do `stoat.js` em arquivos que este teste puxa por
    transitividade. Substituir o módulo todo faz o import quebrar longe daqui —
    e a mensagem aponta para `cargos.ts`, que nada tem com convite.
  */
  return {
    ...real,
    ServerPublicInvite,
    PublicChannelInvite: { from: () => new ServerPublicInvite() },
  };
});

const client = {
  api: { get: vi.fn(() => Promise.resolve(respostaDeConvite)) },
  servers: { get: () => undefined, toList: () => [] },
};

vi.mock("./client", () => ({ client, conectado: () => true }));

const toasts: { tipo: string; titulo: string }[] = [];
vi.mock("../components/ui/toastStore", () => ({
  toast: (t: { tipo: string; titulo: string }) => toasts.push(t),
}));

const { buscarConvite, entrarPorConvite } = await import("./servidores");

beforeEach(() => {
  erroDoJoin = undefined;
  assuntoDoCanal = "";
  client.api.get.mockImplementation(() => Promise.resolve(respostaDeConvite));
  toasts.length = 0;
  join.mockClear();
});

/** Busca primeiro: `entrarPorConvite` só entra no que já foi buscado. */
async function buscado(): Promise<void> {
  const r = await buscarConvite("https://vortex.exemplo/convite/a9Kq2");
  expect("erro" in r).toBe(false);
}

describe("entrar por convite", () => {
  it("entrou devolve o servidor", async () => {
    await buscado();
    expect(await entrarPorConvite("a9Kq2")).toEqual({
      tipo: "entrou",
      serverId: "01SERVIDOR",
    });
  });

  it("aprovação manual vira ESTADO, e não erro", async () => {
    await buscado();
    erroDoJoin = '{"type":"JoinRequestPending"}';
    expect(await entrarPorConvite("a9Kq2")).toEqual({ tipo: "pedido" });
    /* Sem toast: a tela desenha o estado, e um toast some em cinco segundos
       deixando o botão "Entrar" aceso. */
    expect(toasts).toHaveLength(0);
  });

  it("banido vira estado próprio e o convite continua buscado", async () => {
    await buscado();
    erroDoJoin = '{"type":"Banned"}';
    expect(await entrarPorConvite("a9Kq2")).toEqual({ tipo: "banido" });

    /* Segunda tentativa sem buscar de novo: um administrador pode perdoar
       enquanto a tela está aberta, e descartar o convite obrigaria a
       recomeçar. */
    erroDoJoin = undefined;
    expect(await entrarPorConvite("a9Kq2")).toEqual({
      tipo: "entrou",
      serverId: "01SERVIDOR",
    });
  });

  it("qualquer outra falha volta traduzida, para quem chamou decidir", async () => {
    await buscado();
    erroDoJoin = '{"type":"NotFound"}';
    const r = await entrarPorConvite("a9Kq2");
    expect(r.tipo).toBe("falhou");
    expect(r.tipo === "falhou" && r.motivo).toBe("Isso não existe mais.");
  });

  /**
   * ⚠ **O caso que motivou o mapa por código.** Com uma variável única, a
   * linha de mensagem que monta ao rolar sobrescrevia o convite aberto no
   * modal — e o botão "Entrar" levava para OUTRO servidor, sem erro nenhum.
   */
  it("entrar em código que não foi buscado não entra em lugar nenhum", async () => {
    await buscado();
    const r = await entrarPorConvite("OUTRO1");
    expect(r.tipo).toBe("falhou");
    expect(join).not.toHaveBeenCalled();
  });
});

describe("prévia de canal +18 (D-CCANAL-06)", () => {
  it("canal comum mostra o assunto e não é restrito", async () => {
    assuntoDoCanal = "Comece por aqui.";
    const r = await buscarConvite("a9Kq2");
    expect("erro" in r).toBe(false);
    if ("erro" in r) return;
    expect(r.restritoPorIdade).toBe(false);
    expect(r.assuntoDoCanal).toBe("Comece por aqui.");
  });

  it("canal +18 marca a prévia e NÃO mostra o assunto, mesmo que ele chegue", async () => {
    /* O servidor do fork já retém o assunto; o cliente descarta de novo para
       não depender de a outra ponta lembrar. */
    assuntoDoCanal = "o que não pode vazar";
    client.api.get.mockImplementation(() =>
      Promise.resolve({ ...respostaDeConvite, channel_mature: true }),
    );
    const r = await buscarConvite("a9Kq2");
    expect("erro" in r).toBe(false);
    if ("erro" in r) return;
    expect(r.restritoPorIdade).toBe(true);
    expect(r.assuntoDoCanal).toBeUndefined();
  });
});
