import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * As permissões de verdade, com o `client` dublado.
 *
 * O outro arquivo de permissões (`permissoes.test.ts`) guarda a PROPAGAÇÃO —
 * que uma permissão mudada chega nas linhas montadas. Este guarda a DECISÃO, e
 * ele existe porque a etapa 4 trocou o `return true` por uma consulta real, e
 * a troca tem duas armadilhas que o comentário antigo não previa.
 */
const canal = { havePermission: vi.fn() };
const client = {
  user: undefined as unknown,
  channels: { get: vi.fn(() => canal as unknown) },
};

vi.mock("./client", () => ({ client, conectado: () => true }));

const { pode } = await import("./permissoes");

const CANAL = "01CANAL00000000000000000A";

beforeEach(() => {
  vi.clearAllMocks();
  client.user = { id: "01EU" };
  client.channels.get = vi.fn(() => canal as unknown);
});

describe("com servidor para perguntar", () => {
  it("repassa a permissão do protocolo", () => {
    canal.havePermission.mockReturnValue(true);
    expect(pode(CANAL, "enviar")).toBe(true);
    expect(canal.havePermission).toHaveBeenCalledWith("SendMessage");
  });

  it.each([
    ["fixar", "ManageMessages"],
    ["reagir", "React"],
    ["gerenciarCanais", "ManageChannel"],
    ["banir", "BanMembers"],
    ["expulsar", "KickMembers"],
    ["silenciarMembro", "TimeoutMembers"],
    ["criarConvite", "InviteOthers"],
    ["gerenciarServidor", "ManageServer"],
  ] as const)("a ação %s pergunta por %s", (acao, permissao) => {
    canal.havePermission.mockReturnValue(true);
    pode(CANAL, acao);
    expect(canal.havePermission).toHaveBeenCalledWith(permissao);
  });

  it("negada é negada", () => {
    canal.havePermission.mockReturnValue(false);
    expect(pode(CANAL, "banir")).toBe(false);
  });

  /*
    Com servidor presente, "não sei" é `false`: é melhor esconder uma ação que
    existia do que oferecer uma que o servidor vai recusar — a segunda vira
    erro DEPOIS do clique, que é o pior momento para descobrir.
  */
  it("canal desconhecido nega", () => {
    client.channels.get = vi.fn(() => undefined);
    expect(pode(CANAL, "enviar")).toBe(false);
  });

  it("o SDK estourando nega, em vez de derrubar a linha", () => {
    canal.havePermission.mockImplementation(() => {
      throw new Error("servidor não hidratado");
    });
    expect(pode(CANAL, "fixar")).toBe(false);
  });
});

describe("sem servidor para perguntar", () => {
  /*
    ⚠ **A armadilha que o comentário antigo não previa.**

    O comentário dizia que ligar isto seria "uma linha", com o default de "não
    sei" virando `false`. Verdade — e `false` sem esta exceção esconderia a
    interface inteira de si mesma durante todo o desenvolvimento: sem `Ready`
    não há tabela de cargos, e composer, reação, resposta, menu e a coluna de
    administração sumiriam do arnês onde o projeto é construído e medido.
  */
  it("libera, porque não há tabela de cargos para consultar", () => {
    client.user = undefined;
    expect(pode(CANAL, "enviar")).toBe(true);
    expect(pode(CANAL, "banir")).toBe(true);
    expect(canal.havePermission).not.toHaveBeenCalled();
  });

  /*
    E a exceção é ESTREITA: uma condição só. Com sessão, ela não vale mais —
    senão seria um `|| true` disfarçado que nunca mais reprovaria nada.
  */
  it("com sessão, a exceção não vale mais", () => {
    client.user = { id: "01EU" };
    canal.havePermission.mockReturnValue(false);
    expect(pode(CANAL, "banir")).toBe(false);
  });
});

describe("o que não é permissão de servidor", () => {
  /*
    Ninguém precisa autorizar você a ler o que já está na sua tela. Perguntar
    ao servidor aqui seria inventar uma pergunta que o protocolo não faz.
  */
  it("marcar como lida nunca pergunta", () => {
    client.user = { id: "01EU" };
    canal.havePermission.mockReturnValue(false);
    expect(pode(CANAL, "marcarLida")).toBe(true);
    expect(canal.havePermission).not.toHaveBeenCalled();
  });
});
