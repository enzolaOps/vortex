import "../../arnes/redeFalsa";

import {
  RAIZ,
  canaisDeTexto,
  canaisDeVoz,
  categorias,
  channels,
  members,
  membrosOffline,
  membrosOnline,
  presence,
  secoesOnline,
  serverIds,
  servers,
  vozPorCanal,
} from "nucleo/sdk/adapter";
import type { Cargo } from "nucleo/sdk/cargos";
import { chaveDeMembro, SEM_CARGO } from "nucleo/sdk/domain";
import type { Banido, Convite, ConviteDoServidor } from "nucleo/sdk/servidores";
import { abrirConfig, limparConfig, lerConfig } from "nucleo/store/config";
import { irParaCasa } from "nucleo/store/navegacao";
import { dispensarToast, lerToasts } from "nucleo/ui-logica/toastStore";
import { definirProntidao } from "nucleo/store/prontidao";
import { abrirServidor, limparUltimoLugar } from "nucleo/store/ultimoLugar";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { admin } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { Avisos } from "../../ui/primitivos/Avisos";
import { CascaDeConfig } from "../config/CascaDeConfig";
import { ShellDasSalas } from "../salas/ShellDasSalas";

type Chamada = readonly [string, ...unknown[]];

interface Controle {
  /** Ações permitidas; vazio = ninguém pode nada. `"*"` = tudo. */
  acoes: Set<string>;
  dono: boolean;
  chamadas: Chamada[];
  convites: readonly ConviteDoServidor[] | undefined;
  banidos: readonly Banido[] | undefined;
  cargos: Cargo[];
  padrao: string[];
  topo: number;
  convitePrevia: Convite | { erro: string };
  entrada: { tipo: "entrou"; serverId: string } | { tipo: "pedido" } | { tipo: "banido" };
  falhaNaLista: boolean;
  lento: Promise<void> | undefined;
}

const ctl = vi.hoisted(
  (): Controle => ({
    acoes: new Set(["*"]),
    dono: false,
    chamadas: [],
    convites: [],
    banidos: [],
    cargos: [],
    padrao: [],
    topo: 0,
    convitePrevia: { erro: "Isso não parece um convite." },
    entrada: { tipo: "entrou", serverId: "S2" },
    falhaNaLista: false,
    lento: undefined,
  }),
);

const registrar = (...c: Chamada) => {
  ctl.chamadas.push(c);
};
const feito = <T,>(valor: T) => Promise.resolve(valor);
const permitido = (acao: string) => ctl.acoes.has("*") || ctl.acoes.has(acao);

vi.mock("nucleo/sdk/permissoes", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  pode: (_canal: string, acao: string) => permitido(acao),
  podeNoServidor: (_servidor: string, acao: string) => permitido(acao),
}));

vi.mock("nucleo/sdk/cargos", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  meuAlcance: () => ({
    topo: ctl.topo,
    podeAtribuir: permitido("atribuirCargos"),
    podeEditarCargos: permitido("gerenciarCargos"),
    podeEditarPermissoes: permitido("gerenciarCargos"),
  }),
  cargosDoServidor: () => ctl.cargos,
  listarCargos: () => feito(ctl.cargos),
  lerPermissoesPadrao: () => ctl.padrao,
  pessoasDoServidor: (_s: string, ids: readonly string[]) =>
    ids.map((id) => ({
      id,
      nome: members.getSnapshot(chaveDeMembro("S1", id))?.displayName ?? id,
      username: members.getSnapshot(chaveDeMembro("S1", id))?.username ?? id,
      cargosIds: members.getSnapshot(chaveDeMembro("S1", id))?.cargosIds ?? [],
      editavel: true,
    })),
  criarCargo: (_s: string, nome: string) => {
    registrar("criarCargo", nome);
    return feito("R9");
  },
  salvarCargo: (_s: string, id: string, nome: string, cor: string | undefined, destacado: boolean) => {
    registrar("salvarCargo", id, nome, cor, destacado);
    return feito(true);
  },
  salvarPermissoes: (_s: string, id: string, ids: readonly string[]) => {
    registrar("salvarPermissoes", id, [...ids].sort());
    return feito(true);
  },
  salvarPermissoesPadrao: (_s: string, ids: readonly string[]) => {
    registrar("salvarPermissoesPadrao", [...ids].sort());
    return feito(true);
  },
  apagarCargo: (_s: string, id: string) => {
    registrar("apagarCargo", id);
    return feito(true);
  },
  reordenarCargos: (_s: string, ids: readonly string[]) => {
    registrar("reordenarCargos", [...ids]);
    return feito(true);
  },
  alternarCargo: (_s: string, usuario: string, cargo: string) => {
    registrar("alternarCargo", usuario, cargo);
    return feito(true);
  },
  moderarVoz: () => feito(true),
  moverParaCanalDeVoz: () => feito(true),
}));

vi.mock("nucleo/sdk/moderacao", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  expulsarEmLote: (_s: string, ids: readonly string[]) => {
    registrar("expulsar", [...ids]);
    return feito({ feitos: ids, falhas: [] });
  },
  banirEmLote: (_s: string, ids: readonly string[], opcoes: object) => {
    registrar("banir", [...ids], opcoes);
    return feito({ feitos: ids, falhas: [] });
  },
  castigarEmLote: (_s: string, ids: readonly string[], opcoes: { minutos: number }) => {
    registrar("castigar", [...ids], opcoes.minutos);
    return feito({ feitos: ids, falhas: [] });
  },
}));

vi.mock("nucleo/sdk/servidores", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  carregarMembros: () => feito(undefined),
  souDono: () => ctl.dono,
  listarConvites: () => (ctl.falhaNaLista ? feito(undefined) : (ctl.lento ?? feito(undefined)).then(() => ctl.convites)),
  revogarConvite: (_s: string, codigo: string) => {
    registrar("revogarConvite", codigo);
    ctl.convites = (ctl.convites ?? []).filter((c) => c.codigo !== codigo);
    return feito(true);
  },
  criarConvite: (canal: string) => {
    registrar("criarConvite", canal);
    return feito("NOVO123");
  },
  listarBanidos: () => (ctl.falhaNaLista ? feito(undefined) : feito(ctl.banidos)),
  perdoar: (_s: string, usuario: string) => {
    registrar("perdoar", usuario);
    ctl.banidos = (ctl.banidos ?? []).filter((b) => b.userId !== usuario);
    return feito(true);
  },
  criarCanal: (_s: string, nome: string, voz: boolean, categoria: string) => {
    registrar("criarCanal", nome, voz, categoria);
    return feito("NOVOCANAL");
  },
  renomearCanal: (id: string, nome: string, topico: string | undefined) => {
    registrar("renomearCanal", id, nome, topico);
    return feito(true);
  },
  apagarCanal: (id: string) => {
    registrar("apagarCanal", id);
    return feito(true);
  },
  duplicarCanal: (id: string) => {
    registrar("duplicarCanal", id);
    return feito("COPIA");
  },
  moverCanaisParaCategoria: (_s: string, categoria: string, ordem: readonly string[]) => {
    registrar("moverCanais", categoria, [...ordem]);
    return feito(true);
  },
  criarCategoriaEDevolverId: (_s: string, nome: string) => {
    registrar("criarCategoria", nome);
    return feito("CATNOVA");
  },
  renomearCategoria: () => feito(true),
  apagarCategoria: (_s: string, id: string) => {
    registrar("apagarCategoria", id);
    return feito(true);
  },
  criarServidor: (nome: string, categoria: string, canais: readonly object[]) => {
    registrar("criarServidor", nome, categoria, canais);
    return feito("S2");
  },
  buscarConvite: () => feito(ctl.convitePrevia),
  entrarPorConvite: (codigo: string) => {
    registrar("entrarPorConvite", codigo);
    return feito(ctl.entrada);
  },
  sairDoServidor: (_s: string, silencioso: boolean) => {
    registrar("sair", silencioso);
    return feito(true);
  },
  transferirPropriedade: (_s: string, novoDono: string) => {
    registrar("transferir", novoDono);
    return feito(true);
  },
  salvarServidor: (_s: string, nome: string, descricao: string) => {
    registrar("salvarServidor", nome, descricao);
    return feito(true);
  },
}));

const S = "S1";
const parcial = <T,>(v: object) => v as unknown as T;

const cargo = (id: string, nome: string, rank: number, concedidas: string[] = []): Cargo => ({
  id,
  nome,
  cor: undefined,
  destacado: false,
  mencionavel: false,
  rank,
  concedidas,
  iconeUrl: undefined,
});

function canal(id: string, name: string, tipo: "texto" | "voz") {
  channels.set(id, parcial({ id, serverId: S, name, tipo, topico: undefined, naoLidas: 0, mencoes: 0, silenciado: false }));
}

function pessoa(id: string, nome: string, extra: object = {}) {
  members.set(
    chaveDeMembro(S, id),
    parcial({
      id,
      displayName: nome,
      username: nome.toLowerCase(),
      sigla: nome.slice(0, 2),
      avatarUrl: undefined,
      statusTexto: undefined,
      cargosIds: [],
      silenciadoAte: undefined,
      entrouEm: "3 abr 2026",
      abaixoDeMim: true,
      ...extra,
    }),
  );
  presence.set(id, "online");
}

function semear() {
  serverIds.set(RAIZ, [S]);
  servers.set(
    S,
    parcial({ id: S, name: "Grupo", sigla: "GR", naoLidas: 0, mencoes: 0, avatarUrl: undefined, descricao: "Para jogar" }),
  );
  canaisDeTexto.set(S, ["T1", "T2"]);
  canaisDeVoz.set(S, ["V1"]);
  canal("T1", "geral", "texto");
  canal("T2", "avisos", "texto");
  canal("V1", "Jogatina", "voz");
  vozPorCanal.set("V1", []);
  categorias.set(S, [
    { id: "CAT", titulo: "Salas", canais: ["V1", "T1"] },
    { id: "default", titulo: undefined, canais: ["T2"] },
  ]);
  pessoa("U1", "Ana", { cargosIds: ["R1"] });
  pessoa("U2", "Caio");
  pessoa("U3", "Eva", { silenciadoAte: Date.now() + 3_600_000 });
  pessoa("U4", "Davi", { abaixoDeMim: false });
  membrosOnline.set(S, ["U1", "U2", "U3", "U4"]);
  membrosOffline.set(S, []);
  secoesOnline.set(S, [{ id: SEM_CARGO, rotulo: "online", cor: undefined, ids: ["U1", "U2", "U3", "U4"] }]);
}

beforeEach(() => {
  // O aviso de um teste anterior ficaria por cima do botão que o próximo clica.
  for (const t of lerToasts()) dispensarToast(t.id);
  document.documentElement.dataset.tema = "vidro";
  localStorage.clear();
  limparUltimoLugar();
  limparConfig();
  irParaCasa();
  ctl.acoes = new Set(["*"]);
  ctl.dono = false;
  ctl.chamadas = [];
  ctl.convites = [];
  ctl.banidos = [];
  ctl.cargos = [cargo("R1", "Moderação", 1, ["KickMembers", "BanMembers"]), cargo("R2", "Artistas", 2)];
  ctl.padrao = ["ViewChannel", "SendMessage"];
  ctl.topo = 0;
  ctl.convitePrevia = { erro: "Isso não parece um convite." };
  ctl.entrada = { tipo: "entrou", serverId: "S2" };
  ctl.falhaNaLista = false;
  ctl.lento = undefined;
  definirProntidao(true);
  semear();
});
afterEach(() => {
  desmontar();
  limparConfig();
  definirProntidao(false);
});

async function abrirSecao(secao: Parameters<typeof abrirConfig>[0]) {
  await page.viewport(1600, 900);
  abrirConfig(secao, S);
  montar(
    <>
      <CascaDeConfig />
      <Avisos />
    </>,
  );
  await expect.element(page.getByRole("dialog")).toBeVisible();
}

async function abrirShell() {
  await page.viewport(1600, 900);
  abrirServidor(S);
  montar(
    <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
      <ShellDasSalas />
      <CascaDeConfig />
      <Avisos />
    </div>,
  );
  await expect.element(page.getByRole("heading", { name: "Grupo", level: 2 })).toBeVisible();
}

const nav = () => page.getByRole("navigation", { name: admin.navegacao.rotulo });
const chamou = (nome: string) => ctl.chamadas.filter((c) => c[0] === nome);

describe("navegação das configurações do servidor", () => {
  it("mostra as seis seções, em três grupos, para quem administra tudo", async () => {
    await abrirSecao("servidor");
    for (const nome of Object.values(admin.navegacao).filter((n) => !n.startsWith("Seções") && n !== "Servidor" && n !== "Pessoas" && n !== "Moderação")) {
      await expect.element(nav().getByRole("button", { name: nome, exact: true })).toBeVisible();
    }
    expect(nav().element().querySelectorAll("button").length).toBe(6);
  });

  it("deixa AUSENTE (não cinza) a seção que a pessoa não pode usar", async () => {
    ctl.acoes = new Set(["gerenciarCanais"]);
    await abrirSecao("canais");
    const botoes = [...nav().element().querySelectorAll("button")].map((b) => b.textContent);
    expect(botoes).toEqual([admin.navegacao.salasECanais]);
    expect(nav().element().querySelector("[disabled]")).toBeNull();
  });

  it("abrir uma seção proibida cai na primeira permitida", async () => {
    ctl.acoes = new Set(["banir"]);
    await abrirSecao("cargos");
    await expect.poll(() => lerConfig().secao).toBe("membros");
  });

  it("sem nenhuma permissão cai nas configurações pessoais", async () => {
    ctl.acoes = new Set();
    await abrirSecao("canais");
    await expect.poll(() => lerConfig().secao).toBe("perfil");
  });
});

describe("menu do servidor", () => {
  it("quem administra vê convidar, criar sala, configurações e sair", async () => {
    await abrirShell();
    await page.getByRole("button", { name: admin.menu.abrir }).click();
    for (const nome of [admin.menu.convidar, admin.canaisPagina.criar, admin.menu.configuracoes, admin.menu.sair]) {
      await expect.element(page.getByRole("menuitem", { name: nome })).toBeVisible();
    }
  });

  it("um membro comum só vê sair — as outras ações não existem", async () => {
    ctl.acoes = new Set();
    await abrirShell();
    await page.getByRole("button", { name: admin.menu.abrir }).click();
    await expect.element(page.getByRole("menuitem", { name: admin.menu.sair })).toBeVisible();
    expect(document.querySelectorAll('[role="menuitem"]').length).toBe(1);
  });

  it("o dono lê 'apagar o servidor' no lugar de sair", async () => {
    ctl.dono = true;
    await abrirShell();
    await page.getByRole("button", { name: admin.menu.abrir }).click();
    await expect.element(page.getByRole("menuitem", { name: admin.menu.apagar })).toBeVisible();
    expect(document.body.textContent).not.toContain(admin.menu.sair);
  });

  it("configurações do servidor abre a primeira seção permitida", async () => {
    ctl.acoes = new Set(["gerenciarCargos"]);
    await abrirShell();
    await page.getByRole("button", { name: admin.menu.abrir }).click();
    await page.getByRole("menuitem", { name: admin.menu.configuracoes }).click();
    await expect.poll(() => lerConfig().secao).toBe("cargos");
    expect(lerConfig().serverId).toBe(S);
  });
});

describe("sair do servidor", () => {
  it("para quem é membro, é sair — e diz que dá para voltar", async () => {
    await abrirShell();
    await page.getByRole("button", { name: admin.menu.abrir }).click();
    await page.getByRole("menuitem", { name: admin.menu.sair }).click();
    await expect.element(page.getByRole("dialog", { name: admin.sair.tituloMembro("Grupo") })).toBeVisible();
    expect(document.body.textContent).toContain(admin.sair.textoMembro);
    await page.getByRole("button", { name: admin.sair.confirmarMembro, exact: true }).click();
    await expect.poll(() => chamou("sair").length).toBe(1);
  });

  it("para o dono diz que o servidor será APAGADO e exige o nome digitado", async () => {
    ctl.dono = true;
    await abrirShell();
    await page.getByRole("button", { name: admin.menu.abrir }).click();
    await page.getByRole("menuitem", { name: admin.menu.apagar }).click();
    await expect.element(page.getByRole("dialog", { name: admin.sair.tituloDono("Grupo") })).toBeVisible();
    expect(document.body.textContent).toContain("apagado para todo mundo");
    await expect.element(page.getByRole("button", { name: admin.sair.transferir })).toBeVisible();
    // Sem o nome, o botão não faz nada.
    await page.getByRole("button", { name: admin.sair.confirmarDono }).click();
    expect(chamou("sair")).toHaveLength(0);
    await page.getByLabelText(/Para confirmar/).fill("Grupo");
    await page.getByRole("button", { name: admin.sair.confirmarDono }).click();
    await expect.poll(() => chamou("sair").length).toBe(1);
  });

  it("transferir a propriedade chama a transferência para a pessoa escolhida", async () => {
    ctl.dono = true;
    await abrirShell();
    await page.getByRole("button", { name: admin.menu.abrir }).click();
    await page.getByRole("menuitem", { name: admin.menu.apagar }).click();
    await page.getByRole("button", { name: admin.sair.transferir }).click();
    await expect.element(page.getByRole("dialog", { name: admin.transferir.titulo })).toBeVisible();
    await page.getByLabelText(admin.transferir.para).selectOptions("U2");
    await page
      .getByRole("dialog", { name: admin.transferir.titulo })
      .getByLabelText(/Para confirmar/)
      .fill("Grupo");
    await page.getByRole("button", { name: admin.transferir.confirmar, exact: true }).click();
    await expect.poll(() => chamou("transferir")).toEqual([["transferir", "U2"]]);
  });
});

describe("criar servidor", () => {
  it("o '+' da dock cria um servidor com a sala inicial e abre o novo", async () => {
    await abrirShell();
    await page.getByRole("button", { name: admin.criarServidor.titulo }).click();
    await expect.element(page.getByRole("dialog", { name: admin.criarServidor.titulo })).toBeVisible();
    // Nome vazio: erro dito, nada chamado.
    await page.getByRole("button", { name: admin.criarServidor.criar }).click();
    await expect.element(page.getByText(admin.criarServidor.nomeObrigatorio)).toBeVisible();
    expect(chamou("criarServidor")).toHaveLength(0);

    await page.getByLabelText(admin.criarServidor.nome).fill("Jogatina");
    await page.getByRole("button", { name: admin.criarServidor.criar }).click();
    await expect.poll(() => chamou("criarServidor").length).toBe(1);
    expect(chamou("criarServidor")[0]?.[1]).toBe("Jogatina");
    expect(chamou("criarServidor")[0]?.[3]).toEqual([{ nome: "Geral", voz: true }]);
  });

  it("entrar com convite mostra a prévia do servidor antes de entrar", async () => {
    ctl.convitePrevia = parcial<Convite>({
      codigo: "abc",
      serverId: "S2",
      nomeDoServidor: "Trampo",
      membros: 12,
      jaSouMembro: false,
      iconeUrl: undefined,
    });
    await abrirShell();
    await page.getByRole("button", { name: admin.criarServidor.titulo }).click();
    await page.getByRole("tab", { name: admin.criarServidor.abaEntrar }).click();
    // Sem convite digitado o botão não faz nada.
    await page.getByRole("button", { name: admin.criarServidor.entrar }).click();
    expect(chamou("entrarPorConvite")).toHaveLength(0);

    await page.getByLabelText(admin.criarServidor.convite).fill("abc");
    await expect.element(page.getByTestId("previa-do-convite")).toBeVisible();
    expect(pegar('[data-testid="previa-do-convite"]')?.textContent).toContain("Trampo");
    expect(pegar('[data-testid="previa-do-convite"]')?.textContent).toContain("12 pessoas");
    await page.getByRole("button", { name: admin.criarServidor.entrar }).click();
    await expect.poll(() => chamou("entrarPorConvite")).toEqual([["entrarPorConvite", "abc"]]);
  });

  it("convite inválido diz o motivo e não deixa entrar", async () => {
    await abrirShell();
    await page.getByRole("button", { name: admin.criarServidor.titulo }).click();
    await page.getByRole("tab", { name: admin.criarServidor.abaEntrar }).click();
    await page.getByLabelText(admin.criarServidor.convite).fill("lixo");
    await expect.element(page.getByText("Isso não parece um convite.")).toBeVisible();
    await page.getByRole("button", { name: admin.criarServidor.entrar }).click();
    expect(chamou("entrarPorConvite")).toHaveLength(0);
  });

  it("banido e pedido pendente são desfechos próprios, com frase", async () => {
    ctl.convitePrevia = parcial<Convite>({ codigo: "abc", serverId: "S2", nomeDoServidor: "Trampo", membros: 1, jaSouMembro: false });
    ctl.entrada = { tipo: "banido" };
    await abrirShell();
    await page.getByRole("button", { name: admin.criarServidor.titulo }).click();
    await page.getByRole("tab", { name: admin.criarServidor.abaEntrar }).click();
    await page.getByLabelText(admin.criarServidor.convite).fill("abc");
    await expect.element(page.getByTestId("previa-do-convite")).toBeVisible();
    await page.getByRole("button", { name: admin.criarServidor.entrar }).click();
    await expect.element(page.getByText(admin.criarServidor.banido)).toBeVisible();
  });
});

describe("salas e canais", () => {
  it("lista as categorias com os canais e o tipo de cada um", async () => {
    await abrirSecao("canais");
    const linhas = [...document.querySelectorAll<HTMLElement>('[data-testid="linha-de-canal"]')];
    expect(linhas.map((l) => [l.dataset.canal, l.dataset.tipo])).toEqual([
      ["V1", "voz"],
      ["T1", "texto"],
      ["T2", "texto"],
    ]);
    expect(document.body.textContent).toContain(admin.canaisPagina.semCategoria);
  });

  it("servidor sem nenhum canal mostra o vazio com a próxima ação", async () => {
    categorias.set(S, []);
    await abrirSecao("canais");
    await expect.element(page.getByTestId("estado-vazio")).toBeVisible();
    expect(pegar('[data-testid="estado-vazio"]')?.textContent).toContain(admin.canaisPagina.vazio);
  });

  it("cria uma sala de voz na categoria escolhida; nome vazio é erro dito", async () => {
    await abrirSecao("canais");
    await page.getByRole("button", { name: admin.canaisPagina.criar, exact: true }).click();
    await expect.element(page.getByRole("dialog", { name: admin.canaisPagina.criarTitulo })).toBeVisible();
    await page.getByRole("button", { name: admin.canaisPagina.criarConfirmar }).click();
    await expect.element(page.getByText(admin.canaisPagina.nomeObrigatorio)).toBeVisible();
    expect(chamou("criarCanal")).toHaveLength(0);

    await page.getByLabelText(admin.canaisPagina.nome, { exact: true }).fill("Estudo");
    await page.getByRole("button", { name: admin.canaisPagina.criarConfirmar }).click();
    await expect.poll(() => chamou("criarCanal")).toEqual([["criarCanal", "Estudo", true, "CAT"]]);
  });

  it("cria um canal de texto quando escolhido", async () => {
    await abrirSecao("canais");
    await page.getByRole("button", { name: admin.canaisPagina.criar, exact: true }).click();
    await page.getByRole("radio", { name: admin.canaisPagina.canal }).click();
    await page.getByLabelText(admin.canaisPagina.nome, { exact: true }).fill("links");
    await page.getByRole("button", { name: admin.canaisPagina.criarConfirmar }).click();
    await expect.poll(() => chamou("criarCanal")).toEqual([["criarCanal", "links", false, "CAT"]]);
  });

  it("editar renomeia, duplicar e apagar passam pela confirmação", async () => {
    await abrirSecao("canais");
    await page.getByRole("button", { name: admin.canaisPagina.editar("geral") }).click();
    const campo = page.getByLabelText(admin.canaisPagina.nome, { exact: true });
    await expect.element(campo).toHaveValue("geral");
    await campo.fill("conversa");
    await page.getByRole("button", { name: admin.canaisPagina.salvarConfirmar }).click();
    await expect.poll(() => chamou("renomearCanal")).toEqual([["renomearCanal", "T1", "conversa", ""]]);

    await page.getByRole("button", { name: admin.canaisPagina.duplicar("avisos") }).click();
    await expect.poll(() => chamou("duplicarCanal")).toEqual([["duplicarCanal", "T2"]]);

    await page.getByRole("button", { name: admin.canaisPagina.apagar("avisos") }).click();
    await expect.element(page.getByRole("dialog", { name: admin.canaisPagina.apagarTitulo("avisos") })).toBeVisible();
    expect(chamou("apagarCanal")).toHaveLength(0);
    await page.getByRole("button", { name: admin.canaisPagina.apagarConfirmar }).click();
    await expect.poll(() => chamou("apagarCanal")).toEqual([["apagarCanal", "T2"]]);
  });

  it("mover para outra categoria é uma escolha na edição, e só escreve se mudou", async () => {
    await abrirSecao("canais");
    await page.getByRole("button", { name: admin.canaisPagina.editar("geral") }).click();
    await page.getByRole("button", { name: admin.canaisPagina.salvarConfirmar }).click();
    await expect.poll(() => chamou("renomearCanal").length).toBe(1);
    expect(chamou("moverCanais")).toHaveLength(0);

    await page.getByRole("button", { name: admin.canaisPagina.editar("avisos") }).click();
    await page.getByLabelText(admin.canaisPagina.categoria, { exact: true }).selectOptions("CAT");
    await page.getByRole("button", { name: admin.canaisPagina.salvarConfirmar }).click();
    await expect.poll(() => chamou("moverCanais")).toEqual([["moverCanais", "CAT", ["T2"]]]);
  });

  it("apagar uma sala avisa que quem está nela é desconectado", async () => {
    await abrirSecao("canais");
    await page.getByRole("button", { name: admin.canaisPagina.apagar("Jogatina") }).click();
    expect(document.body.textContent).toContain(admin.canaisPagina.apagarSala);
  });

  it("subir e descer reordenam dentro da categoria; as pontas não têm seta", async () => {
    await abrirSecao("canais");
    expect(page.getByRole("button", { name: admin.canaisPagina.subir("Jogatina") }).element()).toHaveProperty("disabled", true);
    await page.getByRole("button", { name: admin.canaisPagina.descer("Jogatina") }).click();
    await expect.poll(() => chamou("moverCanais")).toEqual([["moverCanais", "CAT", ["T1", "V1"]]]);
  });
});

describe("convites", () => {
  it("mostra 'carregando' enquanto a lista não chega", async () => {
    let soltar: () => void = () => undefined;
    ctl.lento = new Promise<void>((r) => {
      soltar = r;
    });
    await abrirSecao("convites");
    await expect.element(page.getByRole("status")).toHaveTextContent(admin.convitesPagina.carregando);
    soltar();
    await expect.element(page.getByTestId("estado-vazio")).toBeVisible();
  });

  it("sem convites, o vazio diz o que fazer", async () => {
    await abrirSecao("convites");
    await expect.element(page.getByTestId("estado-vazio")).toBeVisible();
    expect(pegar('[data-testid="estado-vazio"]')?.textContent).toContain(admin.convitesPagina.vazio);
  });

  it("falha na consulta NÃO vira lista vazia: mostra o erro e deixa tentar de novo", async () => {
    ctl.falhaNaLista = true;
    await abrirSecao("convites");
    await expect.element(page.getByTestId("estado-de-erro")).toBeVisible();
    expect(document.querySelector('[data-testid="estado-vazio"]')).toBeNull();
    ctl.falhaNaLista = false;
    ctl.convites = [{ codigo: "AB12", canal: "geral", porId: "U1" }];
    await page.getByRole("button", { name: admin.estados.tentarDeNovo }).click();
    await expect.element(page.getByTestId("linha-de-convite")).toBeVisible();
  });

  it("lista código, quem criou e o canal; revogar tira da lista", async () => {
    ctl.convites = [
      { codigo: "AB12", canal: "geral", porId: "U1" },
      { codigo: "CD34", canal: "avisos", porId: "U2" },
    ];
    await abrirSecao("convites");
    const linhas = () => document.querySelectorAll('[data-testid="linha-de-convite"]');
    await expect.poll(() => linhas().length).toBe(2);
    expect(linhas()[0]?.textContent).toContain("Ana");
    await page.getByRole("button", { name: admin.convitesPagina.revogarConvite("AB12") }).click();
    await expect.poll(() => linhas().length).toBe(1);
    expect(chamou("revogarConvite")).toEqual([["revogarConvite", "AB12"]]);
  });

  it("criar convite escolhe o canal de destino e mostra o link para copiar", async () => {
    await abrirSecao("convites");
    await page.getByRole("button", { name: admin.convitesPagina.criar, exact: true }).click();
    await expect.element(page.getByRole("dialog", { name: admin.convitesPagina.criarTitulo })).toBeVisible();
    await page.getByLabelText(admin.convitesPagina.destino).selectOptions("T2");
    await page.getByRole("button", { name: admin.convitesPagina.gerar }).click();
    await expect.element(page.getByTestId("link-do-convite")).toHaveValue(`${location.origin}/convite/NOVO123`);
    expect(chamou("criarConvite")).toEqual([["criarConvite", "T2"]]);
  });
});

describe("cargos", () => {
  it("lista os cargos com contagem de pessoas e o @todos", async () => {
    await abrirSecao("cargos");
    await expect.poll(() => document.querySelectorAll('[data-testid="item-de-cargo"]').length).toBe(2);
    expect(pegar('[data-cargo="R1"]')?.textContent).toContain("Moderação");
    expect(document.body.textContent).toContain(admin.cargosPagina.todos);
  });

  it("editar permissões acende 'alterações não salvas' e salva só o que mudou", async () => {
    await abrirSecao("cargos");
    await page.getByRole("button", { name: /^Artistas/ }).click();
    expect(document.querySelector('[role="region"][aria-label*="alterações"]')).toBeNull();
    await page.getByRole("switch", { name: "Falar" }).click();
    await page.getByRole("switch", { name: "Câmera e tela" }).click();
    await expect.element(page.getByRole("region", { name: /alterações não salvas/i })).toBeVisible();
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect.poll(() => chamou("salvarPermissoes")).toEqual([["salvarPermissoes", "R2", ["Speak", "Video"]]]);
  });

  it("descartar volta ao que o servidor tem", async () => {
    await abrirSecao("cargos");
    await page.getByRole("button", { name: /^Artistas/ }).click();
    await page.getByRole("switch", { name: "Falar" }).click();
    await page.getByRole("button", { name: admin.cargosPagina.descartar }).click();
    expect(page.getByRole("switch", { name: "Falar" }).element().getAttribute("aria-checked")).toBe("false");
    expect(chamou("salvarPermissoes")).toHaveLength(0);
  });

  it("o @todos edita as permissões padrão", async () => {
    await abrirSecao("cargos");
    await page.getByRole("button", { name: admin.cargosPagina.todos }).click();
    await page.getByRole("switch", { name: "Reagir" }).click();
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect.poll(() => chamou("salvarPermissoesPadrao")).toEqual([
      ["salvarPermissoesPadrao", ["React", "SendMessage", "ViewChannel"]],
    ]);
  });

  it("criar cargo e apagar passam pelo servidor; apagar pergunta antes", async () => {
    await abrirSecao("cargos");
    await page.getByRole("button", { name: admin.cargosPagina.criar }).click();
    await expect.poll(() => chamou("criarCargo")).toEqual([["criarCargo", admin.cargosPagina.novoNome]]);
    await page.getByRole("button", { name: /^Artistas/ }).click();
    await page.getByRole("button", { name: admin.cargosPagina.apagar }).click();
    await expect.element(page.getByRole("dialog", { name: admin.cargosPagina.apagarTitulo("Artistas") })).toBeVisible();
    expect(chamou("apagarCargo")).toHaveLength(0);
  });

  it("subir e descer mandam a ordem inteira", async () => {
    ctl.topo = 0;
    await abrirSecao("cargos");
    await page.getByRole("button", { name: admin.cargosPagina.descer("Moderação") }).click();
    await expect.poll(() => chamou("reordenarCargos")).toEqual([["reordenarCargos", ["R2", "R1"]]]);
  });

  it("cargo acima do meu não abre o editor: diz o motivo", async () => {
    ctl.topo = 1; // eu sou o rank 1; o cargo R1 é igual ao meu e não é editável
    await abrirSecao("cargos");
    await page.getByRole("button", { name: /^Moderação/ }).click();
    await expect.element(page.getByText(admin.cargosPagina.acimaDeVoce)).toBeVisible();
    expect(document.querySelector('[data-testid="editor-de-cargo"]')).toBeNull();
  });

  it("sem permissão de criar cargo o botão não existe", async () => {
    ctl.acoes = new Set(["x"]);
    await abrirSecao("cargos");
    // Cai na seção permitida (nenhuma de servidor) e o botão nunca aparece.
    expect(document.body.textContent).not.toContain(admin.cargosPagina.criar);
  });
});

describe("membros e moderação", () => {
  const linhas = () => [...document.querySelectorAll<HTMLElement>('[data-testid="linha-de-membro"]')];

  it("lista as pessoas com cargos e data de entrada, e conta o total", async () => {
    await abrirSecao("membros");
    await expect.poll(() => linhas().length).toBe(4);
    expect(linhas()[0]?.textContent).toContain("Moderação");
    expect(linhas()[0]?.textContent).toContain("3 abr 2026");
    expect(pegar('[data-testid="total-de-membros"]')?.textContent).toBe("4 pessoas");
  });

  it("filtra por nome e por cargo; nada encontrado diz como seguir", async () => {
    await abrirSecao("membros");
    await expect.poll(() => linhas().length).toBe(4);
    await page.getByLabelText(admin.membrosPagina.buscar).fill("ca");
    await expect.poll(() => linhas().length).toBe(1);
    await page.getByLabelText(admin.membrosPagina.buscar).fill("zzz");
    await expect.element(page.getByTestId("estado-vazio")).toBeVisible();
    expect(document.body.textContent).toContain(admin.membrosPagina.vazioDica);
    await page.getByLabelText(admin.membrosPagina.buscar).fill("");
    await page.getByRole("button", { name: "Moderação", exact: true }).click();
    await expect.poll(() => linhas().length).toBe(1);
  });

  it("castigo em andamento aparece na linha", async () => {
    await abrirSecao("membros");
    await expect.poll(() => linhas().length).toBe(4);
    expect(linhas()[2]?.textContent).toContain("Em castigo por");
  });

  it("expulsar pergunta antes e chama a expulsão da pessoa certa", async () => {
    await abrirSecao("membros");
    await page.getByRole("button", { name: admin.membrosPagina.acoes("Caio") }).click();
    await page.getByRole("menuitem", { name: admin.membrosPagina.expulsar }).click();
    await expect.element(page.getByRole("dialog", { name: admin.membrosPagina.expulsarTitulo("Caio") })).toBeVisible();
    expect(chamou("expulsar")).toHaveLength(0);
    await page.getByRole("button", { name: admin.membrosPagina.expulsar, exact: true }).click();
    await expect.poll(() => chamou("expulsar")).toEqual([["expulsar", ["U2"]]]);
  });

  it("banir leva motivo e a opção de apagar as últimas 24 horas", async () => {
    await abrirSecao("membros");
    await page.getByRole("button", { name: admin.membrosPagina.acoes("Caio") }).click();
    await page.getByRole("menuitem", { name: admin.membrosPagina.banir }).click();
    await page.getByLabelText(admin.membrosPagina.motivo).fill("spam");
    await page.getByRole("switch", { name: admin.membrosPagina.apagarMensagens }).click();
    await page.getByRole("button", { name: admin.membrosPagina.banir, exact: true }).click();
    await expect.poll(() => chamou("banir")).toEqual([["banir", ["U2"], { motivo: "spam", excluirMensagensDe: 86_400 }]]);
  });

  it("castigo por 1 hora e tirar o castigo", async () => {
    await abrirSecao("membros");
    await page.getByRole("button", { name: admin.membrosPagina.acoes("Caio") }).click();
    await page.getByRole("menuitem", { name: admin.membrosPagina.umaHora }).click();
    await expect.poll(() => chamou("castigar")).toEqual([["castigar", ["U2"], 60]]);
    await page.getByRole("button", { name: admin.membrosPagina.acoes("Eva") }).click();
    await page.getByRole("menuitem", { name: admin.membrosPagina.tirarCastigo }).click();
    await expect.poll(() => chamou("castigar")[1]).toEqual(["castigar", ["U3"], 0]);
  });

  it("quem está acima de mim na hierarquia NÃO tem menu de ações", async () => {
    await abrirSecao("membros");
    await expect.poll(() => linhas().length).toBe(4);
    expect(document.querySelector(`[aria-label="${admin.membrosPagina.acoes("Davi")}"]`)).toBeNull();
    expect(document.querySelector(`[aria-label="${admin.membrosPagina.acoes("Caio")}"]`)).not.toBeNull();
  });

  it("sem permissão de banir, o menu nem oferece banir", async () => {
    ctl.acoes = new Set(["expulsar"]);
    await abrirSecao("membros");
    await page.getByRole("button", { name: admin.membrosPagina.acoes("Caio") }).click();
    await expect.element(page.getByRole("menuitem", { name: admin.membrosPagina.expulsar })).toBeVisible();
    expect(document.querySelector('[role="menuitem"]:not([data-variante])')).toBeNull();
    expect([...document.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent)).toEqual([admin.membrosPagina.expulsar]);
  });

  it("mudar cargos liga e desliga o cargo da pessoa", async () => {
    await abrirSecao("membros");
    await page.getByRole("button", { name: admin.membrosPagina.acoes("Caio") }).click();
    await page.getByRole("menuitem", { name: admin.membrosPagina.gerenciarCargos }).click();
    await expect.element(page.getByRole("dialog", { name: admin.membrosPagina.cargosDe("Caio") })).toBeVisible();
    await page.getByRole("switch", { name: "Artistas" }).click();
    await expect.poll(() => chamou("alternarCargo")).toEqual([["alternarCargo", "U2", "R2"]]);
  });
});

describe("banimentos", () => {
  it("sem banidos, o vazio explica", async () => {
    await abrirSecao("banimentos");
    await expect.element(page.getByTestId("estado-vazio")).toBeVisible();
    expect(document.body.textContent).toContain(admin.banimentosPagina.vazio);
  });

  it("lista com motivo e perdoa", async () => {
    ctl.banidos = [
      { userId: "B1", nome: "Rui", razao: "spam" },
      { userId: "B2", nome: "Lia", razao: undefined },
    ];
    await abrirSecao("banimentos");
    const linhas = () => document.querySelectorAll('[data-testid="linha-de-banido"]');
    await expect.poll(() => linhas().length).toBe(2);
    expect(linhas()[0]?.textContent).toContain("spam");
    expect(linhas()[1]?.textContent).toContain(admin.banimentosPagina.semRazao);
    await page.getByRole("button", { name: admin.banimentosPagina.perdoarPessoa("Rui") }).click();
    await expect.poll(() => linhas().length).toBe(1);
    expect(chamou("perdoar")).toEqual([["perdoar", "B1"]]);
  });

  it("falha na consulta é erro, não lista vazia", async () => {
    ctl.falhaNaLista = true;
    await abrirSecao("banimentos");
    await expect.element(page.getByTestId("estado-de-erro")).toBeVisible();
    expect(document.querySelector('[data-testid="estado-vazio"]')).toBeNull();
  });
});

describe("visão geral", () => {
  it("salva nome e descrição só quando algo mudou", async () => {
    await abrirSecao("servidor");
    expect(document.querySelector('[role="region"][aria-label*="alterações"]')).toBeNull();
    await page.getByLabelText(admin.visaoGeral.nome).fill("Turma");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect.poll(() => chamou("salvarServidor")).toEqual([["salvarServidor", "Turma", "Para jogar"]]);
  });

  it("nome vazio é erro dito e não deixa salvar", async () => {
    await abrirSecao("servidor");
    await page.getByLabelText(admin.visaoGeral.nome).fill("");
    await expect.element(page.getByText(admin.visaoGeral.nomeObrigatorio)).toBeVisible();
    expect(document.querySelector('[role="region"][aria-label*="alterações"]')).toBeNull();
  });

  it("a casca tem o foco preso e dá para clicar dentro do diálogo (o véu não intercepta)", async () => {
    await abrirSecao("servidor");
    // `click` do Playwright falha se outro elemento interceptar o ponteiro.
    await page.getByRole("button", { name: admin.navegacao.convites, exact: true }).click();
    await expect.poll(() => lerConfig().secao).toBe("convites");
  });
});
