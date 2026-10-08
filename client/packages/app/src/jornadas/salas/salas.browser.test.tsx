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
import { definirChamada, definirFalantes, limparChamada } from "nucleo/store/chamada";
import { limparConexao, pausarConexao } from "nucleo/store/conexao";
import { limparFalhaDeVoz } from "nucleo/store/falhaDeVoz";
import { definirPalco, fecharPalco } from "nucleo/store/palcoDeVoz";
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
  limparFalhaDeVoz();
  fecharPalco();
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
      <ShellDasSalas rodapeDasSalas={<button type="button">Configurações</button>} />
    </div>,
  );
  await expect.element(page.getByRole("heading", { name: "Grupo", level: 2 })).toBeVisible();
}

const botao = (nome: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === nome)!;
const coluna = () => pegar("aside[aria-label='" + shell.salas.rotulo + "']")!;
const correntes = () => coluna().querySelectorAll("[aria-current]");

const sala = (nome: string) =>
  [...coluna().querySelectorAll("button")].find((b) => b.textContent.includes(nome))!;
const painel = () => pegar("section[aria-label='" + voz.painelDaChamada + "']");
const palco = () => pegar("[data-testid='palco']");
const pip = () => pegar("section[aria-label='" + voz.chamada + "']");
/** Visível de verdade: tem caixa E não está escondido (peça fora do grau fica medível, mas invisível). */
const visivel = (el: Element | null) => el !== null && el.getClientRects().length > 0 && getComputedStyle(el).visibility === "visible";

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

  it("abre o servidor no último canal de texto, sem conectar nem mostrar widget de sala", async () => {
    lembrarTexto(S, "T2");
    lembrarSala(S, "V2");
    await abrirNoServidor();
    expect(correntes()[0]!.textContent).toContain("avisos");
    expect(pegar("section[aria-label='Estudo']")).toBeNull();
    expect(pegar("section[aria-label='Jogatina']")).toBeNull();
    expect(ctl.entrou).toEqual([]);
    expect(palco()).toBeNull();
  });

  it("marca 'você está aqui' na sala em que a pessoa está conectada", async () => {
    const { definirChamada } = await import("nucleo/store/chamada");
    definirChamada({ estado: "dentro", channelId: "V2" });
    await abrirNoServidor();
    expect(coluna().querySelectorAll('[role="img"][aria-label="Você está aqui"]').length).toBe(1);
  });
});

describe("clicar numa sala de voz entra nela", () => {
  it("nunca conecta ao abrir; o clique entra e abre o palco na hora", async () => {
    await abrirNoServidor();
    expect(ctl.entrou).toEqual([]);
    expect(document.body.textContent).not.toContain(salas.entrarNaSala);

    sala("Jogatina").click();
    expect(ctl.entrou).toEqual(["V1"]);
    await expect.poll(palco).not.toBeNull();
  });

  it("Enter na sala (teclado) faz o mesmo", async () => {
    await abrirNoServidor();
    sala("Estudo").focus();
    await userEvent.keyboard("{Enter}");
    expect(ctl.entrou).toEqual(["V2"]);
    await expect.poll(palco).not.toBeNull();
  });

  it("já em outra sala: troca direto para a nova", async () => {
    definirChamada({ estado: "dentro", channelId: "V2" });
    await abrirNoServidor();
    sala("Jogatina").click();
    expect(ctl.entrou).toEqual(["V1"]);
    await expect.poll(palco).not.toBeNull();
  });

  it("já na mesma sala: só abre o palco, sem entrar de novo", async () => {
    definirChamada({ estado: "dentro", channelId: "V2" });
    await abrirNoServidor();
    expect(palco()).toBeNull();
    sala("Estudo").click();
    await expect.poll(palco).not.toBeNull();
    expect(ctl.entrou).toEqual([]);
  });

  it("sem permissão para conectar: não entra e diz o motivo, sem controle inerte", async () => {
    ctl.permitir = false;
    await abrirNoServidor();
    const jogatina = sala("Jogatina");
    expect(jogatina.getAttribute("aria-disabled")).toBe("true");
    expect(jogatina.title).toBe(salas.vocePodeEntrar);
    const descricao = document.getElementById(jogatina.getAttribute("aria-describedby")!);
    expect(descricao?.textContent).toBe(salas.vocePodeEntrar);
    jogatina.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(ctl.entrou).toEqual([]);
    expect(palco()).toBeNull();
  });

  it("sem conexão: não entra e diz que é a conexão", async () => {
    await abrirNoServidor();
    pausarConexao();
    await expect.poll(() => sala("Estudo").getAttribute("aria-disabled")).toBe("true");
    expect(sala("Estudo").title).toBe(salas.semConexaoParaEntrar);
    sala("Estudo").click();
    expect(ctl.entrou).toEqual([]);
  });

  it("a faixa estreita do palco também entra na hora, e troca de sala", async () => {
    definirChamada({ estado: "dentro", channelId: "V1" });
    await abrirNoServidor();
    definirPalco({ tipo: "grade" });
    const faixa = () => pegar("[data-testid='faixa-de-salas']")!;
    await expect.poll(() => faixa().querySelector("button[aria-label^='Estudo']")).not.toBeNull();
    faixa().querySelector<HTMLElement>("button[aria-label^='Estudo']")!.click();
    expect(ctl.entrou).toEqual(["V2"]);
  });

  it("a faixa estreita sem permissão: aria-disabled com o motivo, e o clique não entra", async () => {
    ctl.permitir = false;
    await abrirNoServidor();
    definirPalco({ tipo: "grade" });
    const faixa = () => pegar("[data-testid='faixa-de-salas']")!;
    await expect.poll(() => faixa().querySelector("button[aria-label^='Estudo']")).not.toBeNull();
    const botaoDaFaixa = faixa().querySelector<HTMLElement>("button[aria-label^='Estudo']")!;
    expect(botaoDaFaixa.getAttribute("aria-disabled")).toBe("true");
    expect(botaoDaFaixa.getAttribute("aria-label")).toContain(salas.vocePodeEntrar);
    botaoDaFaixa.click();
    expect(ctl.entrou).toEqual([]);
  });
});

describe("painel da chamada na coluna de salas", () => {
  it("fica fixo acima de Configurações/Sair, com sala, tempo, quem fala e os cinco controles", async () => {
    definirChamada({ estado: "dentro", channelId: "V2", desde: Date.now() });
    await abrirNoServidor();
    const p = painel()!;
    expect(p).not.toBeNull();
    expect(coluna().contains(p)).toBe(true);
    expect(p.textContent).toContain("Estudo");
    for (const nome of [voz.microfone, voz.audioRecebido, voz.camera, voz.compartilharTela, voz.sairDaChamada]) {
      expect(p.querySelector(`button[aria-label='${nome}']`)).not.toBeNull();
    }
    // Acima do rodapé da pessoa, e colado a ele (nada entre os dois).
    const rodape = botao("Configurações").parentElement!;
    expect(p.getBoundingClientRect().bottom).toBeLessThanOrEqual(rodape.getBoundingClientRect().top + 1);
    expect(p.nextElementSibling).toBe(rodape);
  });

  it("não existe sem chamada", async () => {
    await abrirNoServidor();
    expect(painel()).toBeNull();
  });

  it("sair age na chamada", async () => {
    definirChamada({ estado: "dentro", channelId: "V2", desde: Date.now() });
    await abrirNoServidor();
    await page.getByRole("button", { name: voz.sairDaChamada }).click();
    expect(ctl.saiu).toBe(1);
  });

  it("segue visível na casa, durante a chamada", async () => {
    definirChamada({ estado: "dentro", channelId: "V2", desde: Date.now() });
    await abrirNoServidor();
    irParaCasa();
    await expect.poll(() => painel()).not.toBeNull();
    expect(visivel(painel())).toBe(true);
    expect(painel()!.querySelector(`button[aria-label='${voz.sairDaChamada}']`)).not.toBeNull();
  });

  it("com o palco do servidor aberto a coluna vira faixa e só a cápsula do palco tem controles", async () => {
    definirChamada({ estado: "dentro", channelId: "V2", desde: Date.now() });
    await abrirNoServidor();
    sala("Estudo").click();
    await expect.poll(palco).not.toBeNull();
    expect(painel()).toBeNull();
    expect(document.querySelectorAll(`button[aria-label='${voz.sairDaChamada}']`).length).toBe(1);
    expect(document.querySelectorAll(`button[aria-label='${voz.microfone}']`).length).toBe(1);
  });

  it("sem transmissão não há PiP; com alguém transmitindo ele aparece, sem repetir os controles", async () => {
    definirChamada({ estado: "dentro", channelId: "V2", desde: Date.now() });
    await abrirNoServidor();
    expect(pip()).toBeNull();
    expect(painel()).not.toBeNull();

    // Na Jogatina (V1) o Caio transmite.
    definirChamada({ channelId: "V1" });
    await expect.poll(pip).not.toBeNull();
    expect(pip()!.querySelector(`button[aria-label='${voz.microfone}']`)).toBeNull();
    expect(document.querySelectorAll(`button[aria-label='${voz.microfone}']`).length).toBe(1);
  });

  it("a janelinha não cobre o campo de escrever: a camada reserva o rodapé da área principal", async () => {
    definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now() });
    await abrirNoServidor();
    await expect.poll(pip).not.toBeNull();
    const principal = pegar("main")!.getBoundingClientRect();
    expect(pip()!.getBoundingClientRect().bottom).toBeLessThan(principal.bottom - 40);
  });
});

describe("quem fala, sem corte", () => {
  const NOME_LONGO = "Fulano de Tal Sobrenome Muito Muito Comprido Mesmo";

  it("o nome cede com reticências; a bolinha e o 'está falando' ficam inteiros", async () => {
    members.set(chaveDeMembro(S, "U1"), parcial({ id: "U1", displayName: NOME_LONGO, sigla: "FU" }));
    vozPorCanal.set("V2", [participante("U1")]);
    definirChamada({ estado: "dentro", channelId: "V2", desde: Date.now() });
    definirFalantes(["U1"]);
    await abrirNoServidor();
    const p = painel()!;
    await expect.poll(() => p.textContent).toContain(voz.estaFalando);
    const nome = [...p.querySelectorAll("span")].find((e) => e.textContent === NOME_LONGO)!;
    const sufixo = [...p.querySelectorAll("span")].find((e) => e.textContent === voz.estaFalando)!;
    const bolinha = p.querySelector(`[role="img"][aria-label="${voz.estado.falando}"]`)!;
    const caixa = p.getBoundingClientRect();
    // O nome está truncado...
    expect(nome.scrollWidth).toBeGreaterThan(nome.clientWidth);
    expect(getComputedStyle(nome).textOverflow).toBe("ellipsis");
    // ...o resto não: a bolinha mantém os 10px e o sufixo cabe inteiro dentro do painel.
    expect(bolinha.getBoundingClientRect().width).toBeGreaterThanOrEqual(10);
    expect(sufixo.scrollWidth).toBeLessThanOrEqual(sufixo.clientWidth);
    expect(sufixo.getBoundingClientRect().right).toBeLessThanOrEqual(caixa.right);
    expect(bolinha.getBoundingClientRect().left).toBeGreaterThanOrEqual(caixa.left);
  });

  it("o PiP segue a mesma regra", async () => {
    members.set(chaveDeMembro(S, "U1"), parcial({ id: "U1", displayName: NOME_LONGO, sigla: "FU" }));
    definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now() });
    definirFalantes(["U1"]);
    await abrirNoServidor();
    await expect.poll(pip).not.toBeNull();
    const w = pip()!;
    await expect.poll(() => w.textContent).toContain(voz.estaFalando);
    const nome = [...w.querySelectorAll("span")].find((e) => e.textContent === NOME_LONGO)!;
    const bolinha = w.querySelector(`[role="img"][aria-label="${voz.estado.falando}"]`)!;
    expect(bolinha.getBoundingClientRect().width).toBeGreaterThanOrEqual(10);
    expect(getComputedStyle(nome).textOverflow).toBe("ellipsis");
  });
});

describe("linha da sala: o nome tem prioridade", () => {
  it("com avatares e AO VIVO sem espaço, o nome fica inteiro e o resto vira +N e ponto", async () => {
    channels.set(
      "V1",
      parcial({ id: "V1", serverId: S, name: "Jogatina Noturna", tipo: "voz", naoLidas: 0, mencoes: 0, silenciado: false }),
    );
    await abrirNoServidor();
    const linha = sala("Jogatina Noturna");
    const nome = [...linha.querySelectorAll("span")].find((e) => e.textContent === "Jogatina Noturna")!;
    expect(nome.scrollWidth).toBeLessThanOrEqual(nome.clientWidth);
    // O selo cheio cedeu; o ponto vermelho (ou nada) fica, nunca o rótulo cortado.
    const selo = [...linha.querySelectorAll("span")].find((e) => e.textContent.trim() === "AO VIVO");
    expect(visivel(selo ?? null)).toBe(false);
    expect(visivel(linha.querySelector('[role="img"][aria-label="AO VIVO"]'))).toBe(true);
  });

  it("com espaço de sobra, o selo aparece inteiro", async () => {
    await page.viewport(1600, 900);
    definirProntidao(true);
    abrirServidor(S);
    montar(
      <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
        <ShellDasSalas />
      </div>,
    );
    await expect.element(page.getByRole("heading", { name: "Grupo", level: 2 })).toBeVisible();
    // A coluna é do usuário (ele arrasta): larga, a sobra cabe tudo.
    pegar("[data-testid='shell-grade']")!.style.setProperty("--larg-salas", "26rem");
    const linha = sala("Jogatina");
    const selo = [...linha.querySelectorAll("span")].find((e) => e.textContent.trim() === "AO VIVO");
    await expect.poll(() => visivel(selo ?? null)).toBe(true);
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
    // A sala não oferece entrar enquanto a conexão não volta.
    expect(sala("Jogatina").getAttribute("aria-disabled")).toBe("true");
    expect(document.body.textContent).not.toContain(salas.entrarNaSala);
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
