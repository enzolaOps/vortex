import "../../arnes/redeFalsa";

import * as adapter from "nucleo/sdk/adapter";
import * as chamada from "nucleo/sdk/chamada";
import * as social from "nucleo/sdk/social";
import {
  RAIZ,
  channelMessageIds,
  channels,
  conversas,
  estadoDoHistoricoDoCanal,
  members,
  messages,
  pessoas,
  relacoes,
} from "nucleo/sdk/adapter";
import { analisar } from "nucleo/markdown/analisar";
import { chaveDeMembro, type ChannelSnapshot, type MessageSnapshot, type Relacao } from "nucleo/sdk/domain";
import { definirChamada, limparChamada } from "nucleo/store/chamada";
import { aplicarToque, limparChamadaRecebida } from "nucleo/store/chamadaRecebida";
import { limparConexao, pausarConexao } from "nucleo/store/conexao";
import { limparFalhaDeVoz } from "nucleo/store/falhaDeVoz";
import { abrirConversa, irParaAmigos, irParaCasa, lerLocal, limparNavegacao } from "nucleo/store/navegacao";
import { fecharPalco, lerPalco } from "nucleo/store/palcoDeVoz";
import { limparPreferenciasDaSala } from "nucleo/store/preferenciasDaSala";
import { definirProntidao } from "nucleo/store/prontidao";
import { limparUltimoLugar } from "nucleo/store/ultimoLugar";
import { page, userEvent } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { casa, chat, shell, voz } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { ShellDasSalas } from "../salas/ShellDasSalas";
import { ChamadaRecebida } from "./ChamadaRecebida";

const ctl = vi.hoisted(() => ({
  chamadas: [] as string[],
  atendidas: [] as unknown[],
  recusadas: 0,
  aceitos: [] as string[],
  desfeitos: [] as string[],
  bloqueados: [] as string[],
  desbloqueados: [] as string[],
  pedidos: [] as string[],
  pedidoOk: true,
  grupos: [] as unknown[][],
  conversasAbertas: [] as string[],
  denuncias: [] as string[],
  podeConectar: true,
  podeEnviar: true,
}));

vi.mock("nucleo/sdk/permissoes", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  pode: (_c: string, acao: string) => (acao === "conectar" ? ctl.podeConectar : acao === "enviar" ? ctl.podeEnviar : true),
  podeNoServidor: () => true,
}));
/*
  Chamada e social importam o adapter, e o adapter importa stores que importam o adapter de volta:
  uma factory que espera o módulo original trava a aba. `spy: true` mantém o real e deixa cada
  teste trocar só o que precisa (as trocas estão em `instalarDubles`).
*/
vi.mock("nucleo/sdk/chamada", { spy: true });
vi.mock("nucleo/sdk/social", { spy: true });
vi.mock("nucleo/sdk/adapter", { spy: true });

const parcial = <T,>(v: object) => v as unknown as T;
const EU = "U1";

function pessoa(id: string, nome: string, relacao: Relacao, status: "online" | "idle" | "dnd" | "offline" = "online") {
  pessoas.set(
    id,
    parcial({ id, displayName: nome, username: nome.toLowerCase(), relacao, status, sigla: nome.slice(0, 2) }),
  );
  members.set(chaveDeMembro("", id), parcial({ id, displayName: nome, sigla: nome.slice(0, 2) }));
}

function canal(id: string, patch: Partial<ChannelSnapshot>) {
  channels.set(
    id,
    parcial<ChannelSnapshot>({
      id,
      serverId: undefined,
      name: "Conversa",
      tipo: "dm",
      destinatarioId: undefined,
      naoLidas: 0,
      mencoes: 0,
      silenciado: false,
      participantes: 2,
      ultimaEm: 0,
      ultimaMensagemId: undefined,
      topico: undefined,
      ...patch,
    }),
  );
}

function mensagem(id: string, canalId: string, autor: string, texto: string): MessageSnapshot {
  return {
    id,
    channelId: canalId,
    authorId: autor,
    content: texto,
    blocos: analisar(texto),
    conviteCodigo: undefined,
    mencionaVoce: false,
    anexos: [],
    createdAt: 1,
    createdAtText: "20:48",
    createdAtCurto: "20:48",
    editedAt: undefined,
    sistema: undefined,
    respostas: [],
    fixada: false,
    reactions: [],
    embeds: [],
    sendState: "sent",
    enquete: undefined,
    figurinha: undefined,
    iniciaGrupo: true,
    dia: undefined,
    primeiraNaoLida: false,
  };
}

/** Bia (DM, 2 não lidas), um grupo com uma não lida, Caio (DM) e as notas. */
function semearConversas() {
  pessoa("U2", "Bia", "amigo", "online");
  pessoa("U3", "Caio", "amigo", "idle");
  pessoa("U4", "Davi", "amigo", "offline");
  pessoa("U5", "Laura", "recebido", "offline");
  pessoa("U6", "Kauê", "enviado", "offline");
  pessoa("U7", "Nuno", "bloqueado", "offline");
  members.set(chaveDeMembro("", EU), parcial({ id: EU, displayName: "Vini", sigla: "Vi" }));
  canal("D1", { name: "Bia", destinatarioId: "U2", naoLidas: 2, ultimaEm: 3000, ultimaMensagemId: "M1" });
  canal("G1", { name: "Final de semana", tipo: "grupo", participantes: 4, naoLidas: 1, ultimaEm: 2000, ultimaMensagemId: "M2" });
  canal("D2", { name: "Caio", destinatarioId: "U3", ultimaEm: 1000, ultimaMensagemId: "M3" });
  canal("N1", { name: "Notas", tipo: "notas", participantes: 1, ultimaEm: 0 });
  messages.set("M1", mensagem("M1", "D1", "U2", "kkkk já vou entrar"));
  messages.set("M2", mensagem("M2", "G1", "U3", "quem leva o som?"));
  messages.set("M3", mensagem("M3", "D2", "U3", "mandei o link"));
  channelMessageIds.set("D1", ["M1"]);
  estadoDoHistoricoDoCanal.set("D1", { inicial: "pronto", pagina: false });
  conversas.set(RAIZ, ["D1", "G1", "D2", "N1"]);
  relacoes.set("amigo", ["U2", "U3", "U4"]);
  relacoes.set("recebido", ["U5"]);
  relacoes.set("enviado", ["U6"]);
  relacoes.set("bloqueado", ["U7"]);
}

function semearVazio() {
  conversas.set(RAIZ, []);
  for (const r of ["amigo", "recebido", "enviado", "bloqueado"] as const) relacoes.set(r, []);
}

function instalarDubles() {
  vi.mocked(chamada.ligar).mockImplementation((id) => {
    ctl.chamadas.push(id);
    return Promise.resolve(true);
  });
  vi.mocked(chamada.atenderChamada).mockImplementation((o) => {
    ctl.atendidas.push(o);
    return Promise.resolve(true);
  });
  vi.mocked(chamada.recusarChamada).mockImplementation(() => {
    ctl.recusadas += 1;
  });
  vi.mocked(social.aceitarAmizade).mockImplementation((id) => {
    ctl.aceitos.push(id);
    return Promise.resolve(true);
  });
  vi.mocked(social.desfazerAmizade).mockImplementation((id) => {
    ctl.desfeitos.push(id);
    return Promise.resolve(true);
  });
  vi.mocked(social.bloquear).mockImplementation((id) => {
    ctl.bloqueados.push(id);
    return Promise.resolve(true);
  });
  vi.mocked(social.desbloquear).mockImplementation((id) => {
    ctl.desbloqueados.push(id);
    return Promise.resolve(true);
  });
  vi.mocked(social.pedirAmizade).mockImplementation((nome) => {
    ctl.pedidos.push(nome);
    return Promise.resolve(ctl.pedidoOk);
  });
  vi.mocked(social.criarGrupo).mockImplementation((...args) => {
    ctl.grupos.push(args);
    return Promise.resolve("G9");
  });
  vi.mocked(social.abrirConversaCom).mockImplementation((id) => {
    ctl.conversasAbertas.push(id);
    return Promise.resolve("D1");
  });
  vi.mocked(social.buscarEmComum).mockImplementation(() => Promise.resolve({ servidores: [], amigos: [] }));
  vi.mocked(social.denunciarPessoa).mockImplementation((id) => {
    ctl.denuncias.push(id);
    return Promise.resolve(true);
  });
}

beforeEach(() => {
  instalarDubles();
  vi.mocked(adapter.usuarioLocalId).mockImplementation(() => EU);
  vi.mocked(adapter.publicarRelacoes).mockImplementation(() => undefined);
  vi.mocked(adapter.publicarConversas).mockImplementation(() => undefined);
  vi.mocked(adapter.marcarCanalLido).mockImplementation(() => undefined);
  vi.mocked(adapter.carregarHistorico).mockImplementation(() => Promise.resolve());
  vi.mocked(adapter.carregarPaginaAnterior).mockImplementation(() => Promise.resolve());
  vi.mocked(adapter.primeiraNaoLida).mockImplementation(() => undefined);
  vi.mocked(adapter.temMencao).mockImplementation(() => false);
  document.documentElement.dataset.tema = "vidro";
  localStorage.clear();
  limparNavegacao();
  limparUltimoLugar();
  limparPreferenciasDaSala();
  limparConexao();
  limparChamada();
  limparChamadaRecebida();
  limparFalhaDeVoz();
  fecharPalco();
  ctl.chamadas = [];
  ctl.atendidas = [];
  ctl.recusadas = 0;
  ctl.aceitos = [];
  ctl.desfeitos = [];
  ctl.bloqueados = [];
  ctl.desbloqueados = [];
  ctl.pedidos = [];
  ctl.pedidoOk = true;
  ctl.grupos = [];
  ctl.conversasAbertas = [];
  ctl.denuncias = [];
  ctl.podeConectar = true;
  ctl.podeEnviar = true;
  definirProntidao(false);
});
afterEach(() => {
  desmontar();
  definirProntidao(false);
  vi.unstubAllGlobals();
});

async function abrir() {
  await page.viewport(1600, 900);
  montar(
    <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
      <ShellDasSalas />
      <ChamadaRecebida />
    </div>,
  );
}

const coluna = () => pegar("aside[aria-label='" + shell.salas.rotulo + "']")!;
const principal = () => pegar("main")!;

describe("casa: vazio", () => {
  it("sem conversas e sem amigos, diz como adicionar alguém pelo nome e oferece o campo", async () => {
    semearVazio();
    definirProntidao(true);
    irParaCasa();
    await abrir();
    await expect.element(page.getByText(casa.coluna.semConversas.titulo)).toBeVisible();
    // Online é a aba aberta: o vazio dela vem primeiro, e o de "Todos" explica o campo de cima.
    await expect.element(page.getByText(casa.amigos.vazio.online)).toBeVisible();
    await page.getByRole("tab", { name: casa.amigos.abas.todos }).click();
    await expect.element(page.getByText(casa.amigos.vazio.todos)).toBeVisible();
    await expect.element(page.getByLabelText(casa.amigos.adicionar.rotulo)).toBeVisible();
    await page.getByRole("tab", { name: casa.amigos.abas.pedidos }).click();
    await expect.element(page.getByText(casa.amigos.vazio.pedidos)).toBeVisible();
    await page.getByRole("tab", { name: casa.amigos.abas.bloqueados }).click();
    await expect.element(page.getByText(casa.amigos.vazio.bloqueados)).toBeVisible();
  });
});

describe("casa: conversas e amigos", () => {
  beforeEach(() => {
    semearConversas();
    definirProntidao(true);
    irParaCasa();
  });

  it("lista as conversas na ordem do store, com não lidas, grupo e notas, e abre a DM ao clicar", async () => {
    await abrir();
    const linhas = [...coluna().querySelectorAll("[data-conversa]")].map((b) => b.getAttribute("data-conversa"));
    expect(linhas).toEqual(["D1", "G1", "D2", "N1"]);
    await expect.element(page.getByRole("button", { name: "Bia, 2 não lidas" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Final de semana, 4 pessoas, 1 não lida" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: casa.coluna.notas })).toBeVisible();
    expect(coluna().textContent).toContain("kkkk já vou entrar");
    // Uma só seleção: a entrada de amigos, porque a casa está nos amigos.
    expect(coluna().querySelectorAll("[aria-current]").length).toBe(1);

    await page.getByRole("button", { name: "Bia, 2 não lidas" }).click();
    expect(lerLocal()).toEqual({ tipo: "dm", channelId: "D1" });
    await expect.poll(() => coluna().querySelector("[aria-current]")?.getAttribute("data-conversa")).toBe("D1");
  });

  it("a entrada de amigos mostra os pedidos pendentes", async () => {
    await abrir();
    await expect.element(page.getByRole("button", { name: casa.coluna.amigosComPedidos(1) })).toBeVisible();
  });

  it("Online mostra só quem não está offline; Todos mostra todo mundo", async () => {
    await abrir();
    await expect.element(page.getByRole("group", { name: "Bia, Online" })).toBeVisible();
    await expect.element(page.getByRole("group", { name: "Caio, Ausente" })).toBeVisible();
    expect(document.querySelector("[data-pessoa='U4']")).toBeNull();
    await page.getByRole("tab", { name: casa.amigos.abas.todos }).click();
    await expect.element(page.getByRole("group", { name: "Davi, Offline" })).toBeVisible();
  });

  it("Mensagem abre a DM com a pessoa e navega até ela", async () => {
    await abrir();
    await page.getByRole("button", { name: casa.amigos.acoes.mensagemPara("Bia") }).click();
    await expect.poll(() => ctl.conversasAbertas).toEqual(["U2"]);
    await expect.poll(() => lerLocal()).toEqual({ tipo: "dm", channelId: "D1" });
  });

  it("pedidos: aceitar, recusar e cancelar o enviado chamam a ação certa", async () => {
    irParaAmigos("recebido");
    await abrir();
    await expect.element(page.getByText(casa.amigos.secao.recebidos(1))).toBeVisible();
    await expect.element(page.getByText(casa.amigos.secao.enviados(1))).toBeVisible();
    await page.getByRole("button", { name: casa.amigos.acoes.aceitarDe("Laura") }).click();
    await page.getByRole("button", { name: casa.amigos.acoes.recusarDe("Laura") }).click();
    await page.getByRole("button", { name: casa.amigos.acoes.cancelarPara("Kauê") }).click();
    await expect.poll(() => ctl.aceitos).toEqual(["U5"]);
    await expect.poll(() => ctl.desfeitos).toEqual(["U5", "U6"]);
  });

  it("bloquear e remover amizade saem do menu da pessoa; desbloquear está na aba de bloqueados", async () => {
    await abrir();
    await page.getByRole("button", { name: casa.amigos.acoes.maisAcoes("Bia") }).click();
    await page.getByRole("menuitem", { name: casa.amigos.acoes.bloquear }).click();
    await expect.poll(() => ctl.bloqueados).toEqual(["U2"]);
    await page.getByRole("button", { name: casa.amigos.acoes.maisAcoes("Caio") }).click();
    await page.getByRole("menuitem", { name: casa.amigos.acoes.removerAmizade }).click();
    await expect.poll(() => ctl.desfeitos).toEqual(["U3"]);

    await page.getByRole("tab", { name: casa.amigos.abas.bloqueados }).click();
    await page.getByRole("button", { name: casa.amigos.acoes.desbloquearA("Nuno") }).click();
    await expect.poll(() => ctl.desbloqueados).toEqual(["U7"]);
  });

  it("pedir amizade por nome: tira o @, confirma o envio e limpa o campo", async () => {
    await abrir();
    const campo = page.getByLabelText(casa.amigos.adicionar.rotulo);
    await campo.fill("@ana");
    await page.getByRole("button", { name: casa.amigos.adicionar.botao }).click();
    await expect.element(page.getByRole("status").filter({ hasText: casa.amigos.adicionar.enviado("ana") })).toBeVisible();
    expect(ctl.pedidos).toEqual(["ana"]);
    expect((campo.element() as HTMLInputElement).value).toBe("");
  });

  it("pedido recusado pelo servidor vira erro na tela e mantém o que foi digitado", async () => {
    ctl.pedidoOk = false;
    await abrir();
    const campo = page.getByLabelText(casa.amigos.adicionar.rotulo);
    await campo.fill("ninguem");
    await page.getByRole("button", { name: casa.amigos.adicionar.botao }).click();
    await expect.element(page.getByRole("alert").filter({ hasText: casa.amigos.adicionar.recusado })).toBeVisible();
    expect((campo.element() as HTMLInputElement).value).toBe("ninguem");
    expect(campo.element().getAttribute("aria-invalid")).toBe("true");
  });

  it("sem conexão: não tenta pedir amizade (o aviso mora na barra de título)", async () => {
    await abrir();
    pausarConexao();
    await page.getByLabelText(casa.amigos.adicionar.rotulo).fill("ana");
    await page.getByRole("button", { name: casa.amigos.adicionar.botao }).click();
    await expect.element(page.getByRole("alert").filter({ hasText: casa.amigos.adicionar.semConexao })).toBeVisible();
    expect(ctl.pedidos).toEqual([]);
  });

  it("novo grupo: pede nome e pessoas, cria e abre o grupo", async () => {
    await abrir();
    await page.getByRole("button", { name: casa.coluna.novoGrupo }).click();
    await page.getByRole("button", { name: casa.grupo.criar }).click();
    await expect.element(page.getByRole("alert").filter({ hasText: casa.grupo.nomeObrigatorio })).toBeVisible();
    await page.getByLabelText(casa.grupo.rotuloDoNome).fill("Fim de semana");
    await page.getByRole("button", { name: casa.grupo.criar }).click();
    await expect.element(page.getByRole("alert").filter({ hasText: casa.grupo.escolhaAlguem })).toBeVisible();
    await page.getByRole("checkbox", { name: /Bia/ }).click();
    await page.getByRole("checkbox", { name: /Caio/ }).click();
    await page.getByRole("button", { name: casa.grupo.criar }).click();
    await expect.poll(() => ctl.grupos).toEqual([["Fim de semana", ["U2", "U3"]]]);
    await expect.poll(() => lerLocal()).toEqual({ tipo: "dm", channelId: "G9" });
  });
});

describe("avisos do sistema: o convite", () => {
  function fingirNotification(permission: NotificationPermission) {
    const pedir = vi.fn(() => {
      (Notification as unknown as { permission: string }).permission = "granted";
      return Promise.resolve("granted" as NotificationPermission);
    });
    vi.stubGlobal("Notification", Object.assign(function () {}, { permission, requestPermission: pedir }));
    return pedir;
  }

  beforeEach(() => {
    semearVazio();
    definirProntidao(true);
    irParaCasa();
  });

  it("não pergunta sozinho: só aparece o convite, e a permissão é pedida no clique", async () => {
    const pedir = fingirNotification("default");
    await abrir();
    await expect.element(page.getByText(casa.avisos.texto)).toBeVisible();
    expect(pedir).not.toHaveBeenCalled();
    await page.getByRole("button", { name: casa.avisos.ativar }).click();
    await expect.poll(() => pedir.mock.calls.length).toBe(1);
    await expect.poll(() => document.body.textContent.includes(casa.avisos.texto)).toBe(false);
  });

  it("agora não esconde o convite e não pede nada", async () => {
    const pedir = fingirNotification("default");
    await abrir();
    await page.getByRole("button", { name: casa.avisos.agoraNao }).click();
    await expect.poll(() => document.body.textContent.includes(casa.avisos.texto)).toBe(false);
    expect(pedir).not.toHaveBeenCalled();
  });

  it("permissão já decidida (concedida ou negada) não mostra convite", async () => {
    fingirNotification("granted");
    await abrir();
    await expect.element(page.getByText(casa.coluna.semConversas.titulo)).toBeVisible();
    expect(document.body.textContent).not.toContain(casa.avisos.texto);
  });
});

describe("conversa direta", () => {
  beforeEach(() => {
    semearConversas();
    definirProntidao(true);
  });

  it("mostra a pessoa no cabeçalho, o chat com composer e o perfil — e nenhuma coluna de membros de servidor", async () => {
    abrirConversa("D1");
    await abrir();
    await expect.element(page.getByRole("heading", { name: "Bia", level: 2 })).toBeVisible();
    await expect.element(page.getByRole("textbox", { name: chat.placeholderDaConversa("Bia") })).toBeVisible();
    await expect.element(page.getByRole("complementary", { name: casa.conversa.perfil("Bia") })).toBeVisible();
    // A gaveta colapsada sai da árvore de acessibilidade: nenhuma região de membros para quem lê a tela.
    expect(page.getByRole("complementary", { name: shell.gaveta.rotulo }).query()).toBeNull();
    // A mensagem vinda do outro lado aparece com o nome de quem escreveu, não "autor desconhecido".
    await expect.element(page.getByText("kkkk já vou entrar").first()).toBeVisible();
    expect(principal().textContent).toContain("Bia");
  });

  it("Ligar entra na chamada da conversa e abre o palco na hora", async () => {
    abrirConversa("D1");
    await abrir();
    await page.getByRole("button", { name: casa.conversa.ligarPara("Bia") }).click();
    await expect.poll(() => ctl.chamadas).toEqual(["D1"]);
    expect(lerPalco().tipo).toBe("grade");
  });

  it("sem permissão para conectar, a pessoa nem vê os botões de ligar", async () => {
    ctl.podeConectar = false;
    abrirConversa("D1");
    await abrir();
    await expect.element(page.getByRole("heading", { name: "Bia", level: 2 })).toBeVisible();
    expect(document.querySelector(`[aria-label='${casa.conversa.ligarPara("Bia")}']`)).toBeNull();
  });

  it("pessoa bloqueada: sem composer, com o motivo dito e o caminho de volta", async () => {
    pessoa("U2", "Bia", "bloqueado", "offline");
    abrirConversa("D1");
    await abrir();
    await expect.element(page.getByText(casa.conversa.bloqueada("Bia"))).toBeVisible();
    expect(document.querySelector("textarea")).toBeNull();
    expect(document.querySelector(`[aria-label='${casa.conversa.ligarPara("Bia")}']`)).toBeNull();
    await page.getByRole("button", { name: casa.conversa.desbloquear, exact: true }).first().click();
    await expect.poll(() => ctl.desbloqueados).toContain("U2");
  });

  it("quem me bloqueou: também sem composer, sem prometer desbloqueio", async () => {
    pessoa("U2", "Bia", "bloqueadoPor", "offline");
    abrirConversa("D1");
    await abrir();
    await expect.element(page.getByText(casa.conversa.bloqueadoPor("Bia"))).toBeVisible();
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("conversa que não existe mais diz isso e leva de volta aos amigos", async () => {
    abrirConversa("XX");
    await abrir();
    await expect.element(page.getByText(casa.conversa.indisponivel)).toBeVisible();
    await page.getByRole("button", { name: casa.conversa.voltarAosAmigos }).click();
    expect(lerLocal().tipo).toBe("amigos");
  });

  it("grupo: mostra as pessoas do grupo (com rótulo próprio) e o botão de gerenciar", async () => {
    abrirConversa("G1");
    await abrir();
    await expect.element(page.getByRole("heading", { name: "Final de semana", level: 2 })).toBeVisible();
    await expect.element(page.getByRole("button", { name: casa.grupo.gerenciar })).toBeVisible();
    await expect.element(page.getByRole("button", { name: casa.conversa.ligarNoGrupo("Final de semana") })).toBeVisible();
  });

  it("com a chamada desta conversa de pé e o palco aberto, o palco ocupa a área; fechado, vira widget", async () => {
    abrirConversa("D1");
    definirChamada({ estado: "dentro", channelId: "D1", desde: Date.now() });
    const { definirPalco } = await import("nucleo/store/palcoDeVoz");
    definirPalco({ tipo: "grade" });
    await abrir();
    await expect.element(page.getByTestId("palco")).toBeVisible();
    // O cabeçalho do palco leva de volta à conversa, sem escolher canal de servidor.
    await page.getByRole("button", { name: new RegExp(`^${voz.palco.abrirChat}`) }).click();
    await expect.poll(() => lerPalco().tipo).toBe("fechado");
    await expect.element(page.getByRole("heading", { name: "Bia", level: 2 })).toBeVisible();
    expect(pegar("[data-testid='palco']")).toBeNull();
    expect(document.querySelector("section[role='region']")).not.toBeNull();
  });
});

describe("chamada recebida", () => {
  beforeEach(() => {
    semearConversas();
    definirProntidao(true);
    irParaCasa();
  });

  const tocar = (visivel = true, channelId = "D1", quemLigou = "U2") => {
    aplicarToque(
      { tipo: "comecou", channelId, quemLigou, agora: Date.now(), visivel },
      { eu: EU, canalDaChamada: "" },
    );
  };

  it("mostra quem está ligando e as duas saídas, com os atalhos escritos", async () => {
    await abrir();
    tocar();
    const aviso = page.getByRole("alertdialog", { name: casa.chamada.rotulo("Bia") });
    await expect.element(aviso).toBeVisible();
    await expect.element(page.getByRole("button", { name: casa.chamada.atenderDe("Bia") })).toBeVisible();
    await expect.element(page.getByRole("button", { name: casa.chamada.recusarDe("Bia") })).toBeVisible();
    await expect.element(page.getByText(casa.chamada.sinalTeclaAtender)).toBeVisible();
    await expect.element(page.getByText(casa.chamada.sinalTeclaRecusar)).toBeVisible();
    // O foco já está em Atender: Enter atende sem procurar o botão.
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe(casa.chamada.atenderDe("Bia"));
  });

  it("Atender entra com vídeo; só com áudio entra sem câmera; Recusar para de tocar", async () => {
    await abrir();
    tocar();
    await page.getByRole("button", { name: casa.chamada.atenderDe("Bia") }).click();
    await expect.poll(() => ctl.atendidas).toEqual([{ comCamera: true }]);

    tocar();
    await page.getByRole("button", { name: casa.chamada.soAudio }).click();
    await expect.poll(() => ctl.atendidas.length).toBe(2);
    expect(ctl.atendidas[1]).toEqual({ comCamera: false });

    tocar();
    await page.getByRole("button", { name: casa.chamada.recusarDe("Bia") }).click();
    expect(ctl.recusadas).toBe(1);
  });

  it("atalhos: Ctrl+Enter atende e Esc recusa", async () => {
    await abrir();
    tocar();
    await expect.element(page.getByRole("alertdialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => ctl.recusadas).toBe(1);

    tocar();
    await expect.element(page.getByRole("alertdialog")).toBeVisible();
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await expect.poll(() => ctl.atendidas).toEqual([{ comCamera: true }]);
  });

  it("Esc dentro de um campo de texto não recusa a chamada", async () => {
    await abrir();
    tocar();
    await expect.element(page.getByRole("alertdialog")).toBeVisible();
    const campo = page.getByLabelText(casa.amigos.adicionar.rotulo);
    (campo.element() as HTMLElement).focus();
    await userEvent.keyboard("{Escape}");
    expect(ctl.recusadas).toBe(0);
  });

  it("com o aviso desligado na matriz, a chamada existe mas a tela não desenha nada", async () => {
    await abrir();
    tocar(false);
    await expect.element(page.getByText(casa.coluna.semConversas.titulo).or(page.getByText("Bia")).first()).toBeVisible();
    expect(document.querySelector("[role='alertdialog']")).toBeNull();
  });

  it("de grupo, diz em qual grupo", async () => {
    await abrir();
    tocar(true, "G1", "U3");
    await expect.element(page.getByRole("alertdialog", { name: casa.chamada.rotulo("Caio") })).toBeVisible();
    await expect.element(page.getByText(new RegExp(casa.chamada.noGrupo("Final de semana")))).toBeVisible();
  });
});

describe("silenciar a conversa", () => {
  it("o botão do cabeçalho alterna os avisos da conversa e diz o estado por aria-pressed", async () => {
    semearConversas();
    definirProntidao(true);
    abrirConversa("D1");
    await abrir();
    const botao = page.getByRole("button", { name: casa.conversa.silenciar });
    await expect.element(botao).toHaveAttribute("aria-pressed", "false");
    const { estaSilenciado, limparSilencio } = await import("nucleo/store/silencio");
    await botao.click();
    expect(estaSilenciado("D1")).toBe(true);
    await botao.click();
    expect(estaSilenciado("D1")).toBe(false);
    limparSilencio();
  });
});
