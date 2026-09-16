import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "stoat.js";

/**
 * Cargos: o que vai ao fio, com o `client` dublado.
 *
 * Três escritas desta tela têm armadilha de FORMA — o `@everyone` não é
 * `{ allow, deny }`, a lista de cargos de um membro é substituída inteira, e a
 * matriz curada apagaria bits que não mostra. Nenhuma das três dá erro: todas
 * devolvem 200 e deixam o servidor diferente do que a tela disse.
 */

type MembroFalso = {
  id: { server: string; user: string };
  roles: string[];
  edit: ReturnType<typeof vi.fn>;
};

const membros = new Map<string, MembroFalso>();
const servidor = {
  id: "S",
  ownerId: "DONO",
  defaultPermissions: 0n as bigint,
  roles: new Map<string, { permissions?: { a: number } }>(),
  member: undefined as unknown,
  setPermissions: vi.fn(() => Promise.resolve({})),
  editRole: vi.fn(() => Promise.resolve({})),
  havePermission: vi.fn(() => false),
};
const client = {
  user: { id: "EU" } as { id: string } | undefined,
  servers: { get: vi.fn(() => servidor as unknown) },
  serverMembers: {
    getByKey: vi.fn((k: { server: string; user: string }) => membros.get(k.user)),
    values: () => membros.values(),
  },
};

vi.mock("./client", () => ({ client, conectado: () => true }));
vi.mock("../components/ui/toastStore", () => ({ toast: vi.fn() }));

const {
  aplicarCargoEmLote,
  definirIconeDoCargo,
  lerPermissoesPadrao,
  meuAlcance,
  mesclarPermissoes,
  salvarPermissoes,
  salvarPermissoesPadrao,
} = await import("./cargos");

function membro(user: string, roles: string[]): MembroFalso {
  const m: MembroFalso = {
    id: { server: "S", user },
    roles,
    edit: vi.fn((d: { roles: string[] }) => {
      m.roles = d.roles;
      return Promise.resolve();
    }),
  };
  membros.set(user, m);
  return m;
}

beforeEach(() => {
  vi.clearAllMocks();
  membros.clear();
  client.user = { id: "EU" };
  servidor.defaultPermissions = 0n;
  servidor.roles.clear();
  servidor.ownerId = "DONO";
});

describe("mesclarPermissoes", () => {
  it("preserva os bits que a matriz curada não mostra", () => {
    const fora = Permission.ChangeNickname | Permission.ChangeAvatar;
    const atual = fora | Permission.SendMessage;
    const novo = mesclarPermissoes(atual, ["React"]);
    expect(novo & fora).toBe(fora);
    expect(novo & Permission.SendMessage).toBe(0n);
    expect(novo & Permission.React).toBe(Permission.React);
  });

  it("alcança os bits altos sem truncar em 32", () => {
    const novo = mesclarPermissoes(0n, ["Speak", "MentionRoles"]);
    expect(novo).toBe(Permission.Speak | Permission.MentionRoles);
  });
});

describe("permissões padrão", () => {
  it("lê default_permissions do servidor", () => {
    servidor.defaultPermissions = Permission.SendMessage | Permission.Connect;
    expect(lerPermissoesPadrao("S")).toEqual(["SendMessage", "Connect"]);
  });

  it("grava NÚMERO em /permissions/default, sem apagar o que não aparece", async () => {
    servidor.defaultPermissions = Permission.ChangeNickname | Permission.SendMessage;
    const ok = await salvarPermissoesPadrao("S", ["SendMessage", "React"]);
    expect(ok).toBe(true);
    expect(servidor.setPermissions).toHaveBeenCalledWith(
      "default",
      Number(Permission.ChangeNickname | Permission.SendMessage | Permission.React),
    );
  });

  it("o cargo também não perde bit fora da matriz", async () => {
    servidor.roles.set("R", { permissions: { a: Number(Permission.ChangeAvatar) } });
    await salvarPermissoes("S", "R", ["React"]);
    expect(servidor.setPermissions).toHaveBeenCalledWith("R", {
      allow: (Permission.ChangeAvatar | Permission.React).toString(),
      deny: "0",
    });
  });
});

describe("ícone do cargo", () => {
  it("põe pelo ID do arquivo e tira com remove Icon", async () => {
    await definirIconeDoCargo("S", "R", "ARQ");
    expect(servidor.editRole).toHaveBeenLastCalledWith("R", { icon: "ARQ" });
    await definirIconeDoCargo("S", "R", undefined);
    expect(servidor.editRole).toHaveBeenLastCalledWith("R", { remove: ["Icon"] });
  });

  it("falha chega traduzida, para a caixa mostrar", async () => {
    servidor.editRole.mockRejectedValueOnce('{"type":"NotElevated"}');
    await expect(definirIconeDoCargo("S", "R", "ARQ")).rejects.toThrow(
      "Seu cargo não está acima do dessa pessoa.",
    );
  });
});

describe("aplicarCargoEmLote", () => {
  it("dá o cargo sem perder os que a pessoa já tinha", async () => {
    const a = membro("a", ["X"]);
    const r = await aplicarCargoEmLote("S", "R", ["a"], true);
    expect(a.edit).toHaveBeenCalledWith({ roles: ["X", "R"] });
    expect(r.feitos).toEqual(["a"]);
  });

  it("tira só o cargo pedido", async () => {
    const a = membro("a", ["X", "R", "Y"]);
    await aplicarCargoEmLote("S", "R", ["a"], false);
    expect(a.edit).toHaveBeenCalledWith({ roles: ["X", "Y"] });
  });

  it("quem já está no estado pedido não gasta chamada", async () => {
    const a = membro("a", ["R"]);
    const r = await aplicarCargoEmLote("S", "R", ["a"], true);
    expect(a.edit).not.toHaveBeenCalled();
    expect(r.feitos).toEqual(["a"]);
  });

  it("relê a lista na hora da escrita, e não na abertura da aba", async () => {
    const a = membro("a", ["X"]);
    a.roles = ["X", "NOVO"];
    await aplicarCargoEmLote("S", "R", ["a"], true);
    expect(a.edit).toHaveBeenCalledWith({ roles: ["X", "NOVO", "R"] });
  });

  it("uma recusa vira falha daquela pessoa, e as outras seguem", async () => {
    membro("a", []);
    const b = membro("b", []);
    b.edit.mockRejectedValueOnce('{"type":"NotElevated"}');
    membro("c", []);
    const r = await aplicarCargoEmLote("S", "R", ["a", "b", "c", "sumiu"], true);
    expect(r.feitos).toEqual(["a", "c"]);
    expect(r.falhas).toEqual([
      { item: "b", motivo: "Seu cargo não está acima do dessa pessoa." },
      { item: "sumiu", motivo: "Essa pessoa não está mais no servidor." },
    ]);
  });
});

describe("meuAlcance", () => {
  it("dono alcança tudo, mesmo sem cargo", () => {
    servidor.ownerId = "EU";
    servidor.member = { orderedRoles: [] };
    expect(meuAlcance("S")).toMatchObject({ topo: -Infinity, podeAtribuir: true });
  });

  it("com sessão, o topo é o menor rank dos meus cargos, e a permissão vem do servidor", () => {
    servidor.member = { orderedRoles: [{ rank: 5 }, { rank: 3 }] };
    servidor.havePermission.mockImplementation(((p: string) => p === "AssignRoles") as never);
    expect(meuAlcance("S")).toEqual({
      topo: 3,
      podeAtribuir: true,
      podeEditarCargos: false,
      podeEditarPermissoes: false,
    });
  });

  it("sem sessão responde como `pode()`: nada a perguntar, nada escondido", () => {
    client.user = undefined;
    expect(meuAlcance("S").podeEditarPermissoes).toBe(true);
  });
});
