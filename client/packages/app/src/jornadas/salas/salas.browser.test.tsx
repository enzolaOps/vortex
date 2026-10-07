import "../../arnes/redeFalsa";

import {
  RAIZ,
  canaisDeTexto,
  canaisDeVoz,
  channels,
  members,
  membrosOffline,
  presence,
  secoesOnline,
  serverIds,
  servers,
  vozPorCanal,
} from "nucleo/sdk/adapter";
import { chaveDeMembro, SEM_CARGO, type ParticipanteDeVoz } from "nucleo/sdk/domain";
import { definirFalantes, limparChamada } from "nucleo/store/chamada";
import { limparConexao, pausarConexao } from "nucleo/store/conexao";
import { irParaCasa } from "nucleo/store/navegacao";
import { limparPreferenciasDaSala } from "nucleo/store/preferenciasDaSala";
import { definirProntidao } from "nucleo/store/prontidao";
import { abrirServidor, lembrarSala, lembrarTexto, limparUltimoLugar } from "nucleo/store/ultimoLugar";
import { page, userEvent } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { salas, shell, voz } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { ShellDasSalas } from "./ShellDasSalas";

const ctl = vi.hoisted(() => ({
  permitir: true,
  entrou: [] as string[],
  saiu: 0,
  criados: [] as string[],
}));

vi.mock("nucleo/sdk/permissoes", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  pode: () => ctl.permitir,
  podeNoServidor: () => ctl.permitir,
}));
vi.mock("nucleo/sdk/chamada", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  entrarNaChamada: (id: string) => {
    ctl.entrou.push(id);
    return Promise.resolve(true);
  },
  sairDaChamada: () => {
    ctl.saiu += 1;
    return Promise.resolve();
  },
}));
vi.mock("nucleo/sdk/servidores", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  criarCategoriaEDevolverId: () => Promise.resolve("CAT"),
  criarCanal: (_s: string, nome: string) => {
    ctl.criados.push(nome);
    return Promise.resolve("VNOVA");
  },
  criarConvite: () => Promise.resolve("abc123"),
}));

const S = "S1";
const parcial = <T,>(v: object) => v as unknown as T;

const participante = (userId: string, extra: Partial<ParticipanteDeVoz> = {}): ParticipanteDeVoz => ({
  userId,
  estado: "voz",
  desde: 1,
  mudo: false,
  surdo: false,
  mudoPeloServidor: false,
  surdoPeloServidor: false,
  ...extra,
});

function canal(id: string, name: string, tipo: "texto" | "voz", extra: object = {}) {
  channels.set(
    id,
    parcial({ id, serverId: S, name, tipo, naoLidas: 0, mencoes: 0, silenciado: false, ...extra }),
  );
}

function semear() {
  serverIds.set(RAIZ, [S]);
  servers.set(S, parcial({ id: S, name: "Grupo", sigla: "GR", naoLidas: 0, mencoes: 0, avatarUrl: undefined }));
  canaisDeTexto.set(S, ["T1", "T2"]);
  canaisDeVoz.set(S, ["V1", "V2"]);
  canal("T1", "geral", "texto");
  canal("T2", "avisos", "texto", { mencoes: 2 });
  canal("V1", "Jogatina", "voz");
  canal("V2", "Estudo", "voz");
  vozPorCanal.set("V1", [
    participante("U1"),
    participante("U2", { estado: "tela" }),
    participante("U3", { mudo: true }),
  ]);
  vozPorCanal.set("V2", []);
  for (const [id, nome] of [
    ["U1", "Ana"],
    ["U2", "Caio"],
    ["U3", "Eva"],
    ["U4", "Davi"],
  ] as const) {
    members.set(chaveDeMembro(S, id), parcial({ id, displayName: nome, sigla: nome.slice(0, 2) }));
    presence.set(id, id === "U4" ? "offline" : "online");
  }
  secoesOnline.set(S, [
    { id: "MOD", rotulo: "Moderação", cor: undefined, ids: ["U1"] },
    { id: SEM_CARGO, rotulo: "online", cor: undefined, ids: ["U2", "U3"] },
  ]);
  membrosOffline.set(S, ["U4"]);
}

beforeEach(() => {
  document.documentElement.dataset.tema = "vidro";
  localStorage.clear();
  limparUltimoLugar();
  limparPreferenciasDaSala();
  limparConexao();
  limparChamada();
  irParaCasa();
  ctl.permitir = true;
  ctl.entrou = [];
  ctl.saiu = 0;
  ctl.criados = [];
  definirProntidao(false);
  semear();
});
afterEach(() => {
  desmontar();
  definirProntidao(false);
});

async function abrirNoServidor() {
  await page.viewport(1600, 900);
  definirProntidao(true);
  abrirServidor(S);
  montar(
    <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
      <ShellDasSalas />
    </div>,
  );
  await expect.element(page.getByRole("heading", { name: "Grupo", level: 2 })).toBeVisible();
}

const botao = (nome: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === nome)!;
const coluna = () => pegar("aside[aria-label='" + shell.salas.rotulo + "']")!;
const correntes = () => coluna().querySelectorAll("[aria-current]");

describe("carregando", () => {
  it("mostra esqueleto na coluna, na dock e na gaveta até o Ready, sem afirmar nada", async () => {
    await page.viewport(1600, 900);
    montar(
      <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
        <ShellDasSalas />
      </div>,
    );
    await expect.poll(() => document.querySelectorAll('[role="status"]').length).toBeGreaterThanOrEqual(3);
    expect(document.body.textContent).toContain(salas.carregandoServidor);
    expect(document.body.textContent).not.toContain(salas.entrarNaSala);
    expect(document.querySelector('[role="img"][aria-label*="pessoa"]')).toBeNull();
  });
});

describe("coluna de salas", () => {
  it("mostra a contagem de cada sala sempre (inclusive 0), o marcador ao vivo e uma só seleção", async () => {
    await abrirNoServidor();
    expect(coluna().querySelector('[role="img"][aria-label="3 pessoas na sala"]')).not.toBeNull();
    expect(coluna().querySelector('[role="img"][aria-label="0 pessoa na sala"]')).not.toBeNull();
    // Uma pessoa transmite a tela: a Jogatina carrega o selo ao vivo e a Estudo não.
    const jogatina = [...coluna().querySelectorAll("button")].find((b) => b.textContent.includes("Jogatina"))!;
    const estudo = [...coluna().querySelectorAll("button")].find((b) => b.textContent.includes("Estudo"))!;
    expect(jogatina.textContent).toContain("AO VIVO");
    expect(estudo.textContent).not.toContain("AO VIVO");
    // Os canais de texto: menção visível, e UMA seleção na coluna inteira.
    expect(correntes().length).toBe(1);
    expect(correntes()[0]!.textContent).toContain("geral");
    await page.getByRole("button", { name: /avisos/ }).click();
    expect(correntes().length).toBe(1);
    expect(correntes()[0]!.textContent).toContain("avisos");
  });

  it("abre o servidor no último canal de texto, com a última sala no widget", async () => {
    lembrarTexto(S, "T2");
    lembrarSala(S, "V2");
    await abrirNoServidor();
    expect(correntes()[0]!.textContent).toContain("avisos");
    expect(pegar("section[aria-label='Estudo']")).not.toBeNull();
    expect(pegar("section[aria-label='Jogatina']")).toBeNull();
    // Trocar a sala mostrada não conecta a nada.
    await page.getByRole("button", { name: /Jogatina/ }).first().click();
    await expect.poll(() => pegar("section[aria-label='Jogatina']")).not.toBeNull();
    expect(ctl.entrou).toEqual([]);
  });

  it("marca 'você está aqui' na sala em que a pessoa está conectada", async () => {
    const { definirChamada } = await import("nucleo/store/chamada");
    definirChamada({ estado: "dentro", channelId: "V2" });
    await abrirNoServidor();
    expect(coluna().querySelectorAll('[role="img"][aria-label="Você está aqui"]').length).toBe(1);
  });
});

describe("widget da sala", () => {
  it("nunca conecta ao abrir; Entrar chama a chamada; quem fala aparece; o canto persiste", async () => {
    await abrirNoServidor();
    expect(ctl.entrou).toEqual([]);

    await page.getByRole("button", { name: /Jogatina/ }).last().click();
    const cartao = pegar("section[aria-label='Jogatina']")!;
    for (const nome of ["Ana", "Caio", "Eva"]) expect(cartao.textContent).toContain(nome);
    expect(cartao.textContent).toContain(voz.estado.transmitindo);
    expect(cartao.textContent).toContain(voz.estado.mudo);

    definirFalantes(["U1"]);
    await expect.poll(() => cartao.textContent).toContain(voz.estado.falando);

    await userEvent.click(botao(salas.entrarNaSala));
    expect(ctl.entrou).toEqual(["V1"]);

    // Depois: fixar no canto move o widget e o ponteiro fica para trás, então vem por último.
    await page.getByRole("button", { name: voz.fixarNoCanto.tl }).click();
    expect(JSON.parse(localStorage.getItem("vortex:preferencias-da-sala")!)).toMatchObject({ canto: "tl" });
  });

  it("dentro da sala, oferece Sair e não Entrar", async () => {
    const { definirChamada } = await import("nucleo/store/chamada");
    definirChamada({ estado: "dentro", channelId: "V1" });
    await abrirNoServidor();
    await page.getByRole("button", { name: /Jogatina/ }).last().click();
    await expect.element(page.getByRole("button", { name: salas.sairDaSala })).toBeVisible();
    expect(pegar("section[aria-label='Jogatina']")!.textContent).not.toContain(salas.entrarNaSala);
    await userEvent.click(botao(salas.sairDaSala));
    expect(ctl.saiu).toBe(1);
  });

  it("sem permissão para conectar, a sala aparece sem a ação de entrar", async () => {
    ctl.permitir = false;
    await abrirNoServidor();
    await page.getByRole("button", { name: /Jogatina/ }).last().click();
    expect(pegar("section[aria-label='Jogatina']")!.textContent).not.toContain(salas.entrarNaSala);
  });

  it("não cobre o campo de escrever: a camada reserva o rodapé da área principal", async () => {
    await abrirNoServidor();
    await page.getByRole("button", { name: voz.fixarNoCanto.br }).click().catch(() => undefined);
    const principal = pegar("main")!.getBoundingClientRect();
    const widget = pegar("section[aria-label='Jogatina']")!.parentElement!.getBoundingClientRect();
    expect(widget.bottom).toBeLessThan(principal.bottom - 40);
  });
});

describe("gaveta de membros", () => {
  it("agrupa por cargo, depois offline, e alterna entre lista e ícones (persistido)", async () => {
    await abrirNoServidor();
    const lista = pegar("[data-testid='lista-de-membros']")!;
    for (const t of ["Moderação", shell.gaveta.titulo, shell.gaveta.offline, "Ana", "Davi"]) {
      expect(lista.textContent).toContain(t);
    }
    await page.getByRole("button", { name: shell.gaveta.mostrarIcones }).click();
    expect(JSON.parse(localStorage.getItem("vortex:preferencias-da-sala")!)).toMatchObject({ gaveta: "icones" });
    // Ícones: sem nome escrito, mas ainda dividido por cargo.
    const icones = pegar("[data-testid='lista-de-membros']")!;
    expect(icones.textContent).not.toContain("Ana");
    expect(icones.querySelectorAll('[role="separator"]').length).toBe(3);
    await page.getByRole("button", { name: shell.gaveta.mostrarLista }).click();
  });

  it("virtualiza: uma lista de milhares de membros monta só a janela visível", async () => {
    membrosOffline.set(
      S,
      Array.from({ length: 5000 }, (_, i) => `X${i}`),
    );
    await abrirNoServidor();
    await expect.poll(() => document.querySelectorAll("[data-testid='lista-de-membros'] [data-index]").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-testid='lista-de-membros'] [data-index]").length).toBeLessThan(60);
  });
});

describe("sem conexão", () => {
  it("avisa que a presença pode estar desatualizada e não afirma quem está onde", async () => {
    await abrirNoServidor();
    pausarConexao();
    await expect.element(page.getByText(salas.semConexao)).toBeVisible();
    // A contagem segue visível, mas dita como desatualizada.
    expect(coluna().querySelector('[role="img"][aria-label*="desatualizada"]')).not.toBeNull();
    // O widget troca a lista de gente pelo aviso e não oferece Entrar.
    await page.getByRole("button", { name: /Jogatina/ }).last().click();
    const cartao = pegar("section[aria-label='Jogatina']")!;
    expect(cartao.textContent).toContain(salas.presencaDesatualizada);
    expect(cartao.textContent).not.toContain("Ana");
    expect(cartao.textContent).not.toContain(salas.entrarNaSala);
    // Na gaveta, nenhum indicador de presença é afirmado.
    const lista = pegar("[data-testid='lista-de-membros']")!;
    expect(lista.textContent).toContain(shell.gaveta.desatualizada);
    expect(lista.querySelector('[role="img"][aria-label*="online"]')).toBeNull();
  });
});

describe("servidor sem salas", () => {
  beforeEach(() => {
    canaisDeVoz.set(S, []);
  });

  it("convida a criar uma sala e a chamar gente, para quem pode", async () => {
    await abrirNoServidor();
    await expect.element(page.getByText(salas.servidorVazio.titulo)).toBeVisible();
    await expect.element(page.getByRole("button", { name: salas.criarSala })).toBeVisible();
    await expect.element(page.getByRole("button", { name: salas.servidorVazio.convidar })).toBeVisible();

    await page.getByRole("button", { name: salas.criarSala }).click();
    await page.getByRole("textbox", { name: salas.criar.rotuloDoNome }).fill("Reunião");
    botao(salas.criar.confirmar).click();
    await expect.poll(() => ctl.criados).toEqual(["Reunião"]);
  });

  it("gera o link do convite para copiar", async () => {
    await abrirNoServidor();
    await page.getByRole("button", { name: salas.servidorVazio.convidar }).click();
    const campo = page.getByRole("textbox", { name: salas.convite.rotuloDoLink });
    await expect.element(campo).toHaveValue(`${location.origin}/convite/abc123`);
  });

  it("sem permissão, só o aviso: nenhuma ação é oferecida", async () => {
    ctl.permitir = false;
    await abrirNoServidor();
    await expect.element(page.getByText(salas.servidorVazio.semPermissao)).toBeVisible();
    expect(page.getByRole("button", { name: salas.criarSala }).elements().length).toBe(0);
    expect(page.getByRole("button", { name: salas.servidorVazio.convidar }).elements().length).toBe(0);
  });

  it("todas as salas vazias não é o servidor vazio: aparecem normalmente, sem tom de erro", async () => {
    canaisDeVoz.set(S, ["V2"]);
    await abrirNoServidor();
    expect(document.body.textContent).not.toContain(salas.servidorVazio.titulo);
    expect(coluna().querySelector('[role="img"][aria-label="0 pessoa na sala"]')).not.toBeNull();
  });
});
