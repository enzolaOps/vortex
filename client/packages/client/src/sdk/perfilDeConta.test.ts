import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Avatar, banner e desativar conta — o que vai ao fio.
 *
 * As três armadilhas aqui são de FORMA, e nenhuma dá erro:
 *
 * 1. remover é `remove: ["Avatar"]`, nunca `avatar: null` — o protocolo só
 *    apaga campo pelo `remove`, e o nulo passaria como "sem alteração";
 * 2. o banner mora DENTRO de `profile`, que o servidor aplica como parcial —
 *    montar o objeto inteiro apagaria a bio de quem trocasse a capa;
 * 3. desativar exige um TICKET de MFA, e não a senha crua.
 */

type Edicao = Record<string, unknown>;

const edicoes: Edicao[] = [];
const disableAccount = vi.fn(() => Promise.resolve());
const createTicket = vi.fn(() => Promise.resolve({ disableAccount }));

const client = {
  user: {
    id: "01EU",
    username: "eu",
    displayName: "Eu",
    edit: (d: Edicao) => {
      edicoes.push(d);
      return Promise.resolve();
    },
  },
  account: { mfa: () => Promise.resolve({ createTicket }) },
  servers: { toList: () => [] },
};

vi.mock("./client", () => ({ client, conectado: () => true }));

const toasts: { tipo: string; titulo: string }[] = [];
vi.mock("../components/ui/toastStore", () => ({
  toast: (t: { tipo: string; titulo: string }) => toasts.push(t),
}));

const { desativarConta, trocarImagemDoPerfil, TAG_DA_IMAGEM_DO_PERFIL } =
  await import("./perfil");

beforeEach(() => {
  edicoes.length = 0;
  toasts.length = 0;
  createTicket.mockClear();
  disableAccount.mockClear();
});

describe("avatar e banner do próprio perfil", () => {
  it("as tags do autumn são as dos dois campos, e não a mesma", () => {
    /* Tag errada não falha no ENVIO — falha no `PATCH`, depois de o arquivo
       já ter subido. E os tetos diferem: 4 MB contra 6 MB. */
    expect(TAG_DA_IMAGEM_DO_PERFIL.avatar).toBe("avatars");
    expect(TAG_DA_IMAGEM_DO_PERFIL.banner).toBe("backgrounds");
  });

  it("avatar vai no campo raiz", async () => {
    expect(await trocarImagemDoPerfil("avatar", "01ANEXO")).toBe(true);
    expect(edicoes).toEqual([{ avatar: "01ANEXO" }]);
  });

  it("banner vai DENTRO de profile, que o servidor mescla", async () => {
    expect(await trocarImagemDoPerfil("banner", "01ANEXO")).toBe(true);
    expect(edicoes).toEqual([{ profile: { background: "01ANEXO" } }]);
    /* O que NÃO pode estar ali: um `profile` completo apagaria a bio. */
    expect(Object.keys(edicoes[0]!.profile as object)).toEqual(["background"]);
  });

  it("remover usa `remove`, e nunca nulo", async () => {
    await trocarImagemDoPerfil("avatar", undefined);
    await trocarImagemDoPerfil("banner", undefined);
    expect(edicoes).toEqual([
      { remove: ["Avatar"] },
      { remove: ["ProfileBackground"] },
    ]);
  });
});

describe("desativar conta", () => {
  it("troca a senha por um bilhete e é o bilhete que desativa", async () => {
    expect(await desativarConta("senha", "segredo")).toBe(true);
    expect(createTicket).toHaveBeenCalledWith({ password: "segredo" });
    expect(disableAccount).toHaveBeenCalledOnce();
  });

  it("código de recuperação é o outro fator, e vai no campo dele", async () => {
    await desativarConta("recuperacao", "aaaa-bbbb");
    expect(createTicket).toHaveBeenCalledWith({ recovery_code: "aaaa-bbbb" });
  });

  it("falha avisa e devolve false — quem chamou não sai da conta", async () => {
    disableAccount.mockImplementationOnce(() =>
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- o stoat-api lanca o TEXTO
      Promise.reject('{"type":"InvalidCredentials"}'),
    );
    expect(await desativarConta("senha", "errada")).toBe(false);
    expect(toasts[0]?.tipo).toBe("erro");
  });
});
