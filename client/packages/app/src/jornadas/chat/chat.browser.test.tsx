import "../../arnes/redeFalsa";

import * as adapter from "nucleo/sdk/adapter";
import {
  channelMessageIds,
  channels,
  digitacao,
  estadoDoHistoricoDoCanal,
  members,
  messages,
  typing,
} from "nucleo/sdk/adapter";
import { readCounters, resetCounters } from "nucleo/arnes/stats";
import { analisar } from "nucleo/markdown/analisar";
import { chaveDeMembro, type ChannelSnapshot, type MessageSnapshot } from "nucleo/sdk/domain";
import { limparConexao, pausarConexao } from "nucleo/store/conexao";
import { limparEdicaoDeMensagem } from "nucleo/store/edicaoDeMensagem";
import { limparEmojisRecentes } from "nucleo/store/emojisRecentes";
import { fecharSeletorDeReacao } from "nucleo/store/seletorDeReacao";
import { fecharVisualizador } from "nucleo/store/visualizadorDeImagem";
import { limparFila, marcarPendente } from "nucleo/store/fila";
import { escreverRascunho, limparRascunho } from "nucleo/store/rascunhos";
import { cancelarResposta, responderA } from "nucleo/store/resposta";
import { progressoDeUpload } from "nucleo/store/uploads";
import { userEvent, page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chat } from "../../textos";
import { AreaPrincipal } from "../../shell";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { AreaDeChat } from "./AreaDeChat";

const C = "C1";
const C2 = "C2";
const S = "S1";
const EU = "U1";

const ctl = vi.hoisted(() => ({
  negadas: new Set<string>(),
  eu: "U1",
  enviados: [] as unknown[][],
  reacoes: [] as string[][],
  apagadas: [] as string[],
  editadas: [] as string[][],
  fixadas: [] as string[],
  naoLidas: [] as string[],
  reenviadas: [] as string[],
  descartadas: [] as string[],
  lidos: [] as string[],
  paginas: [] as string[],
  historicos: [] as string[],
  naoLida: undefined as string | undefined,
  mencoes: [] as string[],
  apagarOk: true,
  teto: 1_000,
  midia: true,
}));

vi.mock("nucleo/sdk/permissoes", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  pode: (_canal: string, acao: string) => !ctl.negadas.has(acao),
  podeNoServidor: () => true,
}));
vi.mock("nucleo/sdk/anexos", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  temServidorDeMidia: () => ctl.midia,
  tetoDeUploadBytes: () => ctl.teto,
  tetoDeUploadTexto: () => "1 KB",
  urlDeEmoji: () => undefined,
}));
/*
  O adapter NÃO leva factory: a factory espera o módulo original, e os módulos que ele
  importa (stores, hooks) importam o adapter de volta — a espera circular trava a aba.
  `spy: true` mantém a implementação real e deixa cada teste trocar só o que precisa.
*/
vi.mock("nucleo/sdk/adapter", { spy: true });

function instalarDubles() {
  vi.mocked(adapter.usuarioLocalId).mockImplementation(() => ctl.eu);
  vi.mocked(adapter.enviarMensagem).mockImplementation((...args: unknown[]) => {
    ctl.enviados.push(args);
    return "ENVIADA";
  });
  vi.mocked(adapter.alternarReacao).mockImplementation((id, emoji) => {
    ctl.reacoes.push([id, emoji]);
  });
  vi.mocked(adapter.apagarMensagem).mockImplementation((id) => {
    ctl.apagadas.push(id);
    return Promise.resolve(ctl.apagarOk);
  });
  vi.mocked(adapter.editarMensagem).mockImplementation((id, texto) => {
    ctl.editadas.push([id, texto]);
    return Promise.resolve(true);
  });
  vi.mocked(adapter.alternarFixada).mockImplementation((id) => {
    ctl.fixadas.push(id);
  });
  vi.mocked(adapter.marcarNaoLidaA).mockImplementation((id) => {
    ctl.naoLidas.push(id);
  });
  vi.mocked(adapter.reenviar).mockImplementation((id) => {
    ctl.reenviadas.push(id);
  });
  vi.mocked(adapter.descartarPendente).mockImplementation((id) => {
    ctl.descartadas.push(id);
  });
  vi.mocked(adapter.marcarCanalLido).mockImplementation((id) => {
    ctl.lidos.push(id);
  });
  vi.mocked(adapter.carregarPaginaAnterior).mockImplementation((id) => {
    ctl.paginas.push(id);
    return Promise.resolve();
  });
  vi.mocked(adapter.carregarHistorico).mockImplementation((id) => {
    ctl.historicos.push(id);
    return Promise.resolve();
  });
  vi.mocked(adapter.primeiraNaoLida).mockImplementation(() => ctl.naoLida);
  vi.mocked(adapter.temMencao).mockImplementation(() => ctl.mencoes.length > 0);
  vi.mocked(adapter.proximaMencao).mockImplementation((_c, depoisDe) => {
    const i = depoisDe === undefined ? -1 : ctl.mencoes.indexOf(depoisDe);
    return ctl.mencoes[(i + 1) % ctl.mencoes.length];
  });
}

const parcial = <T,>(v: object) => v as unknown as T;

function canal(id: string, patch: Partial<ChannelSnapshot> = {}) {
  channels.set(
    id,
    parcial<ChannelSnapshot>({
      id,
      serverId: S,
      name: "geral",
      tipo: "texto",
      topico: undefined,
      naoLidas: 0,
      mencoes: 0,
      silenciado: false,
      ...patch,
    }),
  );
}

function snap(id: string, patch: Partial<MessageSnapshot> = {}): MessageSnapshot {
  const content = patch.content ?? `texto da ${id}`;
  return {
    id,
    channelId: C,
    authorId: "U2",
    content,
    blocos: analisar(content),
    conviteCodigo: undefined,
    mencionaVoce: false,
    anexos: [],
    createdAt: 1,
    createdAtText: "14:32",
    createdAtCurto: "14:32",
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
    ...patch,
  };
}

/** Semeia o canal pelos MESMOS stores que o adapter publica. */
function semear(snaps: readonly MessageSnapshot[], canalId = C) {
  for (const s of snaps) messages.set(s.id, s);
  channelMessageIds.set(
    canalId,
    snaps.map((s) => s.id),
  );
  estadoDoHistoricoDoCanal.set(canalId, { inicial: "pronto", pagina: false });
}

function muitas(n: number, de = 0): MessageSnapshot[] {
  return Array.from({ length: n }, (_, i) => {
    const k = String(de + i).padStart(4, "0");
    return snap(`m${k}`, { content: `mensagem número ${k}`, iniciaGrupo: i % 3 === 0 });
  });
}

beforeEach(() => {
  instalarDubles();
  document.documentElement.dataset.tema = "vidro";
  localStorage.clear();
  limparConexao();
  limparFila();
  limparEdicaoDeMensagem();
  cancelarResposta(C);
  limparRascunho(C);
  limparRascunho(C2);
  ctl.negadas.clear();
  ctl.eu = EU;
  ctl.enviados = [];
  ctl.reacoes = [];
  ctl.apagadas = [];
  ctl.editadas = [];
  ctl.fixadas = [];
  ctl.naoLidas = [];
  ctl.reenviadas = [];
  ctl.descartadas = [];
  ctl.lidos = [];
  ctl.paginas = [];
  ctl.historicos = [];
  ctl.naoLida = undefined;
  ctl.mencoes = [];
  ctl.apagarOk = true;
  ctl.teto = 1_000;
  ctl.midia = true;
  canal(C);
  canal(C2, { name: "links" });
  for (const [id, nome] of [
    ["U1", "Vini"],
    ["U2", "Ana"],
    ["U3", "Caio"],
  ] as const) {
    members.set(chaveDeMembro(S, id), parcial({ id, displayName: nome, sigla: nome.slice(0, 2) }));
  }
  channelMessageIds.set(C, []);
  estadoDoHistoricoDoCanal.set(C, { inicial: "carregando", pagina: false });
});
afterEach(() => {
  desmontar();
});

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = () => pegar<HTMLElement>('[role="log"]')!;
const distanciaDoFim = () => log().scrollHeight - log().clientHeight - log().scrollTop;
const linhas = () => Array.from(document.querySelectorAll<HTMLElement>("[data-index]"));
const linhaDe = (id: string) => document.querySelector<HTMLElement>(`[data-menu-mensagem="${id}"]`);
const menu = () => document.querySelector<HTMLElement>('[role="menu"]');

function abrir(canalId = C, altura = 640) {
  return montar(
    <div style={{ inlineSize: "960px", blockSize: `${altura}px`, display: "grid" }}>
      <AreaPrincipal>
        <AreaDeChat key={canalId} canalId={canalId} servidorId={S} />
      </AreaPrincipal>
    </div>,
  );
}

function clicarDireito(alvo: Element) {
  const r = alvo.getBoundingClientRect();
  alvo.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: Math.round(r.left + 20),
      clientY: Math.round(r.top + 10),
    }),
  );
}

/* ================================================================ corpo */

describe("corpo da mensagem", () => {
  it("o markdown vira DOM pela árvore do núcleo: ênfase, código, lista, link seguro e menção com nome", async () => {
    semear([
      snap("a1", {
        content: "**forte** e *itálico* `cod` fala com <@U3>",
      }),
      snap("a2", { content: "- um\n- dois\n\n[site](https://exemplo.com)" }),
      snap("a3", { content: "```ts\nlet x = 1\n```" }),
    ]);
    abrir();
    await expect.poll(() => linhas().length).toBe(3);
    const a1 = linhaDe("a1")!;
    expect(a1.querySelector("strong")?.textContent).toBe("forte");
    expect(a1.querySelector("em")?.textContent).toBe("itálico");
    expect(a1.querySelector("code")?.textContent).toBe("cod");
    expect(a1.textContent).toContain("@Caio");
    const a2 = linhaDe("a2")!;
    expect(a2.querySelectorAll("ul li")).toHaveLength(2);
    const link = a2.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://exemplo.com/");
    expect(link.rel).toContain("noopener");
    expect(link.target).toBe("_blank");
    expect(linhaDe("a3")!.querySelector("pre code")?.textContent).toBe("let x = 1");
  });

  it("link com esquema perigoso nunca vira link, e título não vira h1", async () => {
    semear([snap("b1", { content: "[x](javascript:alert(1))\n\n# grande" })]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    const b1 = linhaDe("b1")!;
    expect(b1.querySelector('a[href^="javascript"]')).toBeNull();
    expect(b1.querySelector("h1")).toBeNull();
    expect(b1.querySelector('[role="heading"]')?.textContent).toBe("grande");
  });
});

/* =============================================================== anexos */

describe("anexos", () => {
  const imagem = (largura: number | undefined, altura: number | undefined) => ({
    id: "img",
    nome: "foto.png",
    url: "/nao-existe-foto.png",
    tipo: "imagem" as const,
    largura,
    altura,
    tamanhoTexto: "20 KB",
  });

  it("a imagem reserva a caixa pelo metadata ANTES de carregar, e a caixa não muda depois", async () => {
    semear([snap("i1", { content: "olha", anexos: [imagem(1600, 900)] })]);
    abrir();
    await expect.poll(() => linhaDe("i1")?.querySelector("img")).not.toBeNull();
    const caixa = () => linhaDe("i1")!.querySelector("img")!.parentElement!.parentElement!.getBoundingClientRect();
    const antes = caixa();
    expect(antes.width).toBe(360);
    expect(Math.abs(antes.height - 202.5)).toBeLessThan(2);
    // A imagem falha (404): a caixa continua do mesmo tamanho.
    await esperar(500);
    const depois = caixa();
    expect(depois.width).toBe(antes.width);
    expect(depois.height).toBe(antes.height);
  });

  it("imagem alta é limitada na altura, sem estourar a coluna", async () => {
    semear([snap("i2", { content: "alta", anexos: [imagem(600, 1600)] })]);
    abrir();
    await expect.poll(() => linhaDe("i2")?.querySelector("img")).not.toBeNull();
    const r = linhaDe("i2")!.querySelector("img")!.parentElement!.parentElement!.getBoundingClientRect();
    expect(r.height).toBeLessThanOrEqual(321);
    expect(r.width).toBeLessThanOrEqual(360);
  });

  it("arquivo vira cartão com nome, peso e download; áudio vira player", async () => {
    semear([
      snap("f1", {
        content: "docs",
        anexos: [
          { id: "f", nome: "relatorio.pdf", url: "/r.pdf", tipo: "arquivo", largura: undefined, altura: undefined, tamanhoTexto: "1,2 MB" },
          { id: "a", nome: "voz.ogg", url: "/v.ogg", tipo: "audio", largura: undefined, altura: undefined, tamanhoTexto: undefined },
        ],
      }),
    ]);
    abrir();
    await expect.poll(() => linhaDe("f1")).not.toBeNull();
    const cartao = linhaDe("f1")!.querySelector<HTMLAnchorElement>("a[download]")!;
    expect(cartao.textContent).toContain("relatorio.pdf");
    expect(cartao.textContent).toContain("1,2 MB");
    expect(cartao.getBoundingClientRect().height).toBe(56);
    expect(linhaDe("f1")!.querySelector("audio[controls]")).not.toBeNull();
  });
});

/* ========================================================= estados da lista */

describe("estados da lista", () => {
  it("carregando: o esqueleto avisa a espera, e nada de começo-do-canal ainda", async () => {
    abrir();
    await expect.poll(() => pegar('[aria-busy="true"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain("Este é o começo");
    expect(ctl.historicos).toContain(C);
  });

  it("falha na primeira carga: diz o que houve e o botão tenta de novo", async () => {
    estadoDoHistoricoDoCanal.set(C, { inicial: "falhou", pagina: false });
    abrir();
    await expect.element(page.getByText(chat.falhaAoCarregar)).toBeVisible();
    ctl.historicos = [];
    await page.getByRole("button", { name: chat.tentarDeNovo }).click();
    expect(ctl.historicos).toEqual([C]);
  });

  it("vazio traz o começo com o nome do contexto certo: canal, sala e conversa", async () => {
    estadoDoHistoricoDoCanal.set(C, { inicial: "pronto", pagina: false });
    canal(C, { name: "links", topico: "Links que valem a pena" });
    abrir();
    await expect.element(page.getByText("Este é o começo de #links")).toBeVisible();
    expect(document.body.textContent).toContain("Links que valem a pena");
    desmontar();

    canal(C, { name: "Jogatina", tipo: "voz", topico: undefined });
    abrir();
    await expect.element(page.getByText("Este é o começo do chat de Jogatina")).toBeVisible();
    desmontar();

    canal(C, { name: "Ana", tipo: "dm" });
    abrir();
    await expect.element(page.getByText("Este é o começo da sua conversa com Ana")).toBeVisible();
  });

  it("sem permissão para escrever, o começo do canal não manda escrever", async () => {
    estadoDoHistoricoDoCanal.set(C, { inicial: "pronto", pagina: false });
    ctl.negadas.add("enviar");
    abrir();
    await expect.element(page.getByText(chat.dicaDoComecoSemPermissao)).toBeVisible();
  });

  it("a página anterior em voo aparece sobreposta, sem mexer na altura da lista", async () => {
    semear(muitas(200));
    abrir();
    await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);
    const antes = log().scrollHeight;
    estadoDoHistoricoDoCanal.set(C, { inicial: "pronto", pagina: true });
    await expect.element(page.getByText(chat.carregandoAnteriores)).toBeVisible();
    expect(log().scrollHeight).toBe(antes);
  });
});

/* ============================================== leitura: âncora e posição */

describe("lista: âncora, histórico e leitura como posição", () => {
  it("nasce ancorada no fim, virtualizada, e nenhuma linha mede 0px", async () => {
    semear(muitas(600));
    abrir();
    await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);
    expect(linhas().length).toBeLessThan(60);
    for (const l of linhas()) expect(l.offsetHeight).toBeGreaterThan(0);
  });

  it("prepend de histórico não salta: a linha sob o olhar fica onde estava", async () => {
    const atuais = muitas(300, 100);
    semear(atuais);
    abrir();
    await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);

    // Sobe até perto do topo: pede a página anterior.
    log().scrollTop = 600;
    await expect.poll(() => ctl.paginas.length, { timeout: 3000 }).toBeGreaterThan(0);
    await esperar(200);

    const referencia = linhas().find((l) => l.getBoundingClientRect().top > log().getBoundingClientRect().top + 40)!;
    const id = referencia.querySelector<HTMLElement>("[data-menu-mensagem]")!.dataset.menuMensagem!;
    const antes = referencia.getBoundingClientRect().top;

    // A página chega pelo topo (é o que o adapter publica).
    const anteriores = muitas(60, 0);
    for (const s of anteriores) messages.set(s.id, s);
    channelMessageIds.set(C, [...anteriores.map((s) => s.id), ...atuais.map((s) => s.id)]);
    await esperar(400);

    const depois = linhaDe(id)!.parentElement!.getBoundingClientRect().top;
    expect(Math.abs(depois - antes)).toBeLessThanOrEqual(3);
  });

  it("primeira não lida: divisor na linha e atalho que leva até ela", async () => {
    const todas = muitas(300);
    todas[60] = { ...todas[60]!, primeiraNaoLida: true };
    ctl.naoLida = todas[60].id;
    semear(todas);
    abrir();
    await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);
    const botao = page.getByRole("button", { name: chat.irParaNaoLida });
    await expect.element(botao).toBeVisible();
    await botao.click();
    await expect.poll(() => linhaDe(todas[60]!.id), { timeout: 3000 }).not.toBeNull();
    expect(linhaDe(todas[60].id)!.querySelector("[data-novas]")?.textContent).toBe(chat.novas);
    // Com a marca à vista o atalho some.
    await expect.poll(() => pegar("button")?.textContent !== undefined).toBe(true);
    expect(
      Array.from(document.querySelectorAll("button")).some((b) => b.textContent === chat.irParaNaoLida),
    ).toBe(false);
  });

  it("próxima menção percorre as menções e dá a volta", async () => {
    const todas = muitas(400);
    ctl.mencoes = [todas[20]!.id, todas[210]!.id];
    semear(todas);
    abrir();
    await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);
    const botao = page.getByRole("button", { name: chat.proximaMencao });
    await botao.click();
    await expect.poll(() => linhaDe(ctl.mencoes[0]!), { timeout: 3000 }).not.toBeNull();
    await botao.click();
    await expect.poll(() => linhaDe(ctl.mencoes[1]!), { timeout: 3000 }).not.toBeNull();
    await botao.click();
    await expect.poll(() => linhaDe(ctl.mencoes[0]!), { timeout: 3000 }).not.toBeNull();
  });

  it("ack ao ler: no fim da lista o canal é marcado lido, sem esperar sair", async () => {
    semear(muitas(30));
    abrir();
    await expect.poll(() => ctl.lidos.length, { timeout: 4000 }).toBeGreaterThan(0);
    expect(ctl.lidos[0]).toBe(C);
  });

  it("longe do fim aparece o atalho para as mensagens recentes, e ele volta ao fim", async () => {
    semear(muitas(400));
    abrir();
    await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);
    // A medição das linhas assenta primeiro; uma pessoa só rola depois de ver a tela.
    await esperar(800);
    // Gesto de verdade: só ele descola a lista do fim (posição sozinha mente).
    log().dispatchEvent(new WheelEvent("wheel", { deltaY: -3000 }));
    log().scrollTop = Math.max(0, log().scrollTop - 3000);
    const botao = page.getByRole("button", { name: chat.irParaOFim });
    await expect.element(botao).toBeVisible();
    await botao.click();
    await expect.poll(distanciaDoFim, { timeout: 4000 }).toBeLessThanOrEqual(80);
  });
});

/* ====================================================== linha: estados */

describe("linha da mensagem", () => {
  it("pendente diz 'Enviando…'; sem conexão diz 'Na fila · sem conexão'", async () => {
    semear([snap("p1", { authorId: EU, sendState: "pending" })]);
    abrir();
    await expect.element(page.getByText(chat.enviando)).toBeVisible();
    pausarConexao();
    await expect.element(page.getByText(chat.naFilaSemConexao)).toBeVisible();
  });

  it("falhou: explica e oferece Reenviar e Descartar", async () => {
    semear([snap("x1", { authorId: EU, sendState: "failed" })]);
    abrir();
    await expect.element(page.getByText(chat.naoEnviada)).toBeVisible();
    await page.getByRole("button", { name: chat.reenviar }).click();
    await page.getByRole("button", { name: chat.descartar }).click();
    expect(ctl.reenviadas).toEqual(["x1"]);
    expect(ctl.descartadas).toEqual(["x1"]);
  });

  it("subindo arquivo mostra o progresso, que vem do store efêmero", async () => {
    semear([snap("u1", { authorId: EU, sendState: "subindo" })]);
    progressoDeUpload.set("u1", { nome: "foto.png", fracao: 0.62, taxaTexto: "178 KB/s" });
    abrir();
    await expect.element(page.getByText(chat.enviandoArquivo(62))).toBeVisible();
    expect(document.body.textContent).toContain("178 KB/s");
    await expect.element(page.getByRole("button", { name: chat.cancelarEnvio })).toBeVisible();
  });

  it("a prévia da resposta é IRMÃ da linha, não filha, e mostra autor e trecho", async () => {
    semear([
      snap("o1", { content: "o original, que é bem comprido\ne tem duas linhas" }),
      snap("r1", { authorId: "U3", content: "respondendo", respostas: ["o1"] }),
    ]);
    abrir();
    await expect.poll(() => linhaDe("r1")).not.toBeNull();
    const citacao = linhaDe("r1")!.querySelector<HTMLElement>("button[aria-label^='Resposta a']")!;
    expect(citacao.textContent).toContain("Ana");
    expect(citacao.textContent).toContain("o original, que é bem comprido e tem duas linhas");
    expect(citacao.closest("article")).toBeNull();
    expect(citacao.nextElementSibling?.tagName).toBe("ARTICLE");
  });

  it("reações: chips com contagem, aceso o que é meu, clique alterna", async () => {
    semear([
      snap("e1", {
        reactions: [
          { emoji: "👍", total: 3, minha: true, quem: [] },
          { emoji: "🎉", total: 1, minha: false, quem: [] },
        ],
      }),
    ]);
    abrir();
    await expect.poll(() => linhaDe("e1")).not.toBeNull();
    const chips = Array.from(linhaDe("e1")!.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"));
    expect(chips.map((c) => [c.textContent, c.getAttribute("aria-pressed")])).toEqual([
      ["👍3", "true"],
      ["🎉1", "false"],
    ]);
    chips[1]!.click();
    expect(ctl.reacoes).toEqual([["e1", "🎉"]]);
  });

  it("sem permissão de reagir os chips não respondem ao clique", async () => {
    ctl.negadas.add("reagir");
    semear([snap("e2", { reactions: [{ emoji: "👍", total: 1, minha: false, quem: [] }] })]);
    abrir();
    await expect.poll(() => linhaDe("e2")).not.toBeNull();
    expect(linhaDe("e2")!.querySelector<HTMLButtonElement>("button[aria-pressed]")!.disabled).toBe(true);
  });

  it("marca editada e fixada; menção realça a linha", async () => {
    semear([snap("m1", { editedAt: 5, fixada: true, mencionaVoce: true })]);
    abrir();
    await expect.poll(() => linhaDe("m1")).not.toBeNull();
    const l = linhaDe("m1")!;
    expect(l.textContent).toContain(`(${chat.editada})`);
    expect(l.textContent).toContain(chat.fixada);
    expect(l.querySelector("[data-destacada]")).not.toBeNull();
  });
});

/* =========================================================== menu único */

describe("menu de contexto: um só, no nível da lista", () => {
  it("clique direito abre UM menu, com os itens da própria mensagem; a alheia não oferece editar nem apagar", async () => {
    semear([snap("n1", { authorId: EU, content: "minha" }), snap("n2", { authorId: "U2", content: "dela" })]);
    abrir();
    await expect.poll(() => linhas().length).toBe(2);
    clicarDireito(linhaDe("n1")!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
    const nomes = (m: HTMLElement) => Array.from(m.querySelectorAll('[role="menuitem"]')).map((i) => i.textContent?.trim());
    expect(nomes(menu()!)).toEqual(
      expect.arrayContaining([chat.responder, chat.copiarTexto, chat.editar, chat.fixar, chat.marcarNaoLida, chat.apagar]),
    );
    await userEvent.keyboard("{Escape}");
    await expect.poll(menu).toBeNull();

    clicarDireito(linhaDe("n2")!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
    const dela = nomes(menu()!);
    expect(dela).toEqual(expect.arrayContaining([chat.responder, chat.copiarTexto]));
    expect(dela).not.toContain(chat.editar);
    expect(dela).not.toContain(chat.apagar);
  });

  it("nenhuma linha monta menu: o número de menus no DOM não cresce com a lista", async () => {
    semear(muitas(300));
    abrir();
    await expect.poll(() => linhas().length).toBeGreaterThan(5);
    expect(document.querySelectorAll('[role="menu"], [data-radix-context-menu-content]')).toHaveLength(0);
  });

  it("fora de qualquer mensagem o menu não abre", async () => {
    semear([snap("v1")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    clicarDireito(log());
    await esperar(150);
    expect(menu()).toBeNull();
  });

  it("o botão 'mais ações' da barra abre o MESMO menu, no alvo da linha", async () => {
    semear([snap("b1", { authorId: EU }), snap("b2", { authorId: "U2" })]);
    abrir();
    await expect.poll(() => linhas().length).toBe(2);
    linhaDe("b2")!.querySelector<HTMLButtonElement>("button[aria-label='Mais ações']")!.click();
    await expect.poll(menu).not.toBeNull();
    // O alvo é a b2 (alheia): sem "Apagar".
    expect(Array.from(menu()!.querySelectorAll('[role="menuitem"]')).map((i) => i.textContent?.trim())).not.toContain(
      chat.apagar,
    );
  });

  it("reagir pela fileira rápida do menu", async () => {
    semear([snap("q1")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    clicarDireito(linhaDe("q1")!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
    menu()!.querySelector<HTMLElement>(`[aria-label="${chat.reagirComEmoji("😂")}"]`)!.click();
    expect(ctl.reacoes).toEqual([["q1", "😂"]]);
  });

  it("sem permissão de reagir, fixar e responder o menu não oferece essas ações", async () => {
    ctl.negadas.add("reagir").add("fixar").add("responder");
    semear([snap("w1")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    clicarDireito(linhaDe("w1")!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
    const itens = Array.from(menu()!.querySelectorAll('[role="menuitem"]')).map((i) => i.textContent?.trim());
    expect(itens).not.toContain(chat.fixar);
    expect(itens).not.toContain(chat.responder);
    expect(menu()!.querySelector(`[aria-label="${chat.reagirComEmoji("😂")}"]`)).toBeNull();
  });

  it("fixar e marcar como não lida chamam o núcleo com o alvo", async () => {
    semear([snap("z1")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    clicarDireito(linhaDe("z1")!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
    Array.from(menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((i) => i.textContent?.includes(chat.fixar))!.click();
    expect(ctl.fixadas).toEqual(["z1"]);
    await expect.poll(menu).toBeNull();
    clicarDireito(linhaDe("z1")!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
    Array.from(menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((i) => i.textContent?.includes(chat.marcarNaoLida))!.click();
    expect(ctl.naoLidas).toEqual(["z1"]);
  });
});

/* ============================================= editar e apagar a própria */

describe("editar e apagar", () => {
  async function abrirMenuDe(id: string) {
    clicarDireito(linhaDe(id)!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
  }
  const item = (texto: string) =>
    Array.from(menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((i) => i.textContent?.includes(texto))!;

  it("editar é in-line: o campo ocupa o lugar do corpo, Enter salva, Esc cancela", async () => {
    semear([snap("d1", { authorId: EU, content: "texto antigo" })]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    await abrirMenuDe("d1");
    item(chat.editar).click();
    const campo = await vi.waitUntil(() =>
      linhaDe("d1")!.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${chat.editandoMensagem}"]`),
    );
    expect(campo.value).toBe("texto antigo");
    expect(linhaDe("d1")!.textContent).not.toContain("texto antigo\n");

    campo.focus();
    await userEvent.keyboard(" novo{Enter}");
    expect(ctl.editadas).toEqual([["d1", "texto antigo novo"]]);
    await expect.poll(() => linhaDe("d1")!.querySelector("textarea")).toBeNull();

    // Esc descarta sem chamar o núcleo.
    await abrirMenuDe("d1");
    item(chat.editar).click();
    const outro = await vi.waitUntil(() => linhaDe("d1")!.querySelector<HTMLTextAreaElement>("textarea"));
    outro.focus();
    await userEvent.keyboard("lixo{Escape}");
    await expect.poll(() => linhaDe("d1")!.querySelector("textarea")).toBeNull();
    expect(ctl.editadas).toHaveLength(1);
  });

  it("apagar NÃO é otimista: pede confirmação e só chama o núcleo ao confirmar", async () => {
    semear([snap("g1", { authorId: EU })]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    await abrirMenuDe("g1");
    item(chat.apagar).click();
    const dialogo = await vi.waitUntil(() => document.querySelector('[role="dialog"]'));
    expect(dialogo.textContent).toContain(chat.confirmarApagarTitulo);
    expect(ctl.apagadas).toEqual([]);
    // A linha continua ali enquanto não há confirmação do servidor.
    expect(linhaDe("g1")).not.toBeNull();

    await page.getByRole("button", { name: chat.apagar }).click();
    await expect.poll(() => ctl.apagadas).toEqual(["g1"]);
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    // Continua na lista: quem tira é o evento do servidor, não o clique.
    expect(linhaDe("g1")).not.toBeNull();
  });

  it("cancelar o diálogo não apaga nada", async () => {
    semear([snap("g2", { authorId: EU })]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    await abrirMenuDe("g2");
    item(chat.apagar).click();
    await vi.waitUntil(() => document.querySelector('[role="dialog"]'));
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    expect(ctl.apagadas).toEqual([]);
  });
});

/* =============================================================== composer */

describe("composer", () => {
  const campo = () => pegar<HTMLTextAreaElement>(`textarea[aria-label="${chat.placeholderDoCampo("geral")}"]`)!;

  it("sem permissão de enviar o campo SAI e entra a frase", async () => {
    ctl.negadas.add("enviar");
    semear([snap("s1")]);
    abrir();
    await expect.element(page.getByText(chat.semPermissaoParaEscrever)).toBeVisible();
    expect(pegar("textarea")).toBeNull();
  });

  it("na sala (canal de voz) a frase fala do chat da sala", async () => {
    ctl.negadas.add("enviar");
    canal(C, { name: "Jogatina", tipo: "voz" });
    semear([snap("s2")]);
    abrir();
    await expect.element(page.getByText(chat.semPermissaoNaSala)).toBeVisible();
  });

  it("Enter envia o markdown digitado e limpa o rascunho; Shift+Enter quebra a linha", async () => {
    semear([snap("c0")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    campo().focus();
    await userEvent.keyboard("olá **mundo**{Shift>}{Enter}{/Shift}segunda");
    expect(ctl.enviados).toHaveLength(0);
    await userEvent.keyboard("{Enter}");
    expect(ctl.enviados).toHaveLength(1);
    expect(ctl.enviados[0]).toEqual([C, "olá **mundo**\nsegunda", undefined, undefined]);
    await expect.poll(() => campo().value).toBe("");
  });

  it("o botão de enviar fica desabilitado sem texto", () => {
    semear([snap("c1")]);
    abrir();
    const enviar = pegar<HTMLButtonElement>(`button[aria-label="${chat.enviar}"]`)!;
    expect(enviar.getAttribute("aria-disabled") === "true" || enviar.disabled).toBe(true);
  });

  it("responder: a prévia aparece, o envio leva o alvo e Esc cancela", async () => {
    semear([snap("alvo", { content: "pergunta?" })]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    responderA(C, "alvo");
    await expect.element(page.getByText(chat.respondendoA("Ana"))).toBeVisible();
    expect(document.activeElement).toBe(campo());
    await userEvent.keyboard("sim{Enter}");
    expect(ctl.enviados[0]).toEqual([C, "sim", { id: "alvo", mencionar: true }, undefined]);
    await expect.poll(() => pegar(`button[aria-label="${chat.cancelarResposta}"]`)).toBeNull();

    responderA(C, "alvo");
    await expect.element(page.getByText(chat.respondendoA("Ana"))).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => pegar(`button[aria-label="${chat.cancelarResposta}"]`)).toBeNull();
  });

  it("anexar: arquivo vira ficha removível, envia sem texto e leva os arquivos", async () => {
    semear([snap("c2")]);
    abrir();
    const seletor = pegar<HTMLInputElement>('[data-testid="seletor-de-arquivos"]')!;
    const arquivo = new File(["conteudo"], "foto.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(arquivo);
    seletor.files = dt.files;
    seletor.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.element(page.getByText("foto.png")).toBeVisible();

    // Só anexo: enviar vale.
    await page.getByRole("button", { name: chat.enviar }).click();
    expect(ctl.enviados).toHaveLength(1);
    expect(ctl.enviados[0]![0]).toBe(C);
    expect(ctl.enviados[0]![1]).toBe("");
    expect((ctl.enviados[0]![3] as File[])[0]).toBe(arquivo);
    await expect.poll(() => pegar('ul[aria-label="Arquivos para enviar"]')).toBeNull();
  });

  it("remover a ficha tira o arquivo", async () => {
    semear([snap("c3")]);
    abrir();
    const seletor = pegar<HTMLInputElement>('[data-testid="seletor-de-arquivos"]')!;
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "a.txt"));
    seletor.files = dt.files;
    seletor.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.element(page.getByText("a.txt")).toBeVisible();
    await page.getByRole("button", { name: chat.removerAnexo("a.txt") }).click();
    await expect.poll(() => pegar('ul[aria-label="Arquivos para enviar"]')).toBeNull();
  });

  it("arquivo acima do teto de upload é recusado antes de enviar, dizendo o limite", async () => {
    ctl.teto = 10;
    semear([snap("c4")]);
    abrir();
    const seletor = pegar<HTMLInputElement>('[data-testid="seletor-de-arquivos"]')!;
    const dt = new DataTransfer();
    dt.items.add(new File(["muito maior que dez bytes"], "grande.zip"));
    seletor.files = dt.files;
    seletor.dispatchEvent(new Event("change", { bubbles: true }));
    const alerta = await vi.waitUntil(() => pegar('p[role="alert"]'));
    expect(alerta.textContent).toContain("grande.zip");
    expect(alerta.textContent).toContain(chat.limiteDeEnvio("1 KB"));
    expect(pegar('ul[aria-label="Arquivos para enviar"]')).toBeNull();
  });

  it("sem servidor de arquivos o botão de anexar nem existe", () => {
    ctl.midia = false;
    semear([snap("c5")]);
    abrir();
    expect(pegar(`button[aria-label="${chat.anexar}"]`)).toBeNull();
  });

  it("digitando: cada alteração avisa o núcleo, e apagar tudo para na hora", async () => {
    const digitou = vi.spyOn(digitacao, "aoDigitar").mockImplementation(() => undefined);
    const parou = vi.spyOn(digitacao, "aoParar").mockImplementation(() => undefined);
    semear([snap("c6")]);
    abrir();
    campo().focus();
    await userEvent.keyboard("oi");
    expect(digitou).toHaveBeenCalledWith(C);
    await userEvent.keyboard("{Backspace}{Backspace}");
    expect(parou).toHaveBeenCalledWith(C);
  });

  it("quem digita aparece na região viva, sem contar a si mesmo", async () => {
    semear([snap("c7")]);
    abrir();
    typing.set(C, ["U2", EU]);
    await expect.element(page.getByText(chat.digitando("Ana"))).toBeVisible();
    expect(pegar('[role="status"]')?.textContent).not.toContain("Vini");
  });

  it("sem conexão o aviso diz que as mensagens saem quando voltar, e conta a fila", async () => {
    semear([snap("c8")]);
    abrir();
    pausarConexao();
    await expect.element(page.getByText(chat.semConexao)).toBeVisible();
    marcarPendente("p1", C);
    marcarPendente("p2", C);
    await expect.element(page.getByText(chat.naFila(2), { exact: false })).toBeVisible();
  });

  it("o rascunho é por canal: sair e voltar devolve o texto", async () => {
    semear([snap("c9")]);
    abrir();
    campo().focus();
    await userEvent.keyboard("não perca isto");
    desmontar();
    canal(C2, { name: "links" });
    semear([snap("k1", { channelId: C2 })], C2);
    abrir(C2);
    await expect.poll(() => pegar<HTMLTextAreaElement>("textarea")?.value).toBe("");
    desmontar();
    abrir(C);
    await expect.poll(() => campo().value).toBe("não perca isto");
  });

  it("Ctrl+B envolve a seleção em negrito de markdown", async () => {
    semear([snap("c10")]);
    abrir();
    escreverRascunho(C, "dizer olá agora");
    await expect.poll(() => campo().value).toBe("dizer olá agora");
    campo().focus();
    campo().setSelectionRange(6, 9);
    await userEvent.keyboard("{Control>}b{/Control}");
    await expect.poll(() => campo().value).toBe("dizer **olá** agora");
  });

  it("a foto do autor cobre o avatar e trocá-la não re-renderiza a linha", async () => {
    semear([snap("f1", { authorId: "U2" })]);
    abrir();
    const foto = () => linhaDe("f1")?.querySelector("img");
    await expect.poll(() => linhaDe("f1")).not.toBeNull();
    expect(foto()).toBeNull();
    const base = { id: "U2", displayName: "Ana", sigla: "An" };

    members.set(chaveDeMembro(S, "U2"), parcial({ ...base, avatarUrl: "http://localhost/a1.png" }));
    await expect.poll(() => foto()?.getAttribute("src")).toBe("http://localhost/a1.png");

    resetCounters();
    members.set(chaveDeMembro(S, "U2"), parcial({ ...base, avatarUrl: "http://localhost/a2.png" }));
    await expect.poll(() => foto()?.getAttribute("src")).toBe("http://localhost/a2.png");
    await esperar(100);
    expect(readCounters().rowRenders).toBe(0);

    // O nome é da linha: trocar o nome a acorda.
    resetCounters();
    members.set(chaveDeMembro(S, "U2"), parcial({ ...base, displayName: "Ana Maria", avatarUrl: "http://localhost/a2.png" }));
    await expect.poll(() => linhaDe("f1")?.textContent).toContain("Ana Maria");
    expect(readCounters().rowRenders).toBeGreaterThan(0);
  });
});

/* ================================= visualizador, seletor de emoji, resposta */

describe("visualizador de imagem", () => {
  const posicaoDe = (i: number, total: number) => `${i} ${chat.visualizador.de} ${total}`;
  const img = (id: string, nome: string) => ({
    id,
    nome,
    url: "/nao-existe.png",
    tipo: "imagem" as const,
    largura: 800,
    altura: 600,
    tamanhoTexto: "20 KB",
  });
  const dialogo = () => document.querySelector<HTMLElement>('[role="dialog"]');

  beforeEach(() => {
    fecharVisualizador();
  });
  afterEach(() => {
    fecharVisualizador();
  });

  it("o anexo é um botão; clicar abre a mensagem com autor, canal e hora, e Esc fecha devolvendo o foco", async () => {
    semear([snap("v1", { anexos: [img("a", "um.png"), img("b", "dois.png")] })]);
    abrir();
    await expect.poll(() => linhaDe("v1")?.querySelector("img")).not.toBeNull();
    const gatilho = linhaDe("v1")!.querySelector<HTMLButtonElement>(`button[aria-label="${chat.abrirAnexo("um.png")}"]`)!;
    expect(gatilho.tagName).toBe("BUTTON");
    gatilho.focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(dialogo).not.toBeNull();
    const texto = dialogo()!.textContent ?? "";
    expect(texto).toContain("Ana");
    expect(texto).toContain(chat.visualizador.emCanal("geral"));
    expect(texto).toContain("14:32");
    expect(texto).toContain(posicaoDe(1, 2));
    expect(dialogo()!.querySelector<HTMLAnchorElement>("a[download]")?.getAttribute("download")).toBe("um.png");

    await userEvent.keyboard("{Escape}");
    await expect.poll(dialogo).toBeNull();
    await expect.poll(() => document.activeElement).toBe(gatilho);
  });

  it("as setas andam entre as imagens da mesma mensagem, no teclado e nos botões", async () => {
    semear([snap("v2", { anexos: [img("a", "um.png"), img("b", "dois.png"), img("c", "tres.png")] })]);
    abrir();
    await expect.poll(() => linhaDe("v2")?.querySelector("img")).not.toBeNull();
    linhaDe("v2")!.querySelector<HTMLButtonElement>(`button[aria-label="${chat.abrirAnexo("dois.png")}"]`)!.click();
    await expect.poll(() => dialogo()?.textContent).toContain(posicaoDe(2, 3));
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => dialogo()?.textContent).toContain(posicaoDe(3, 3));
    await page.getByRole("button", { name: chat.visualizador.proxima }).click();
    await expect.poll(() => dialogo()?.textContent).toContain(posicaoDe(1, 3));
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(() => dialogo()?.textContent).toContain(posicaoDe(3, 3));
  });

  it("com uma imagem só não há setas nem posição", async () => {
    semear([snap("v3", { anexos: [img("a", "so.png")] })]);
    abrir();
    await expect.poll(() => linhaDe("v3")?.querySelector("img")).not.toBeNull();
    linhaDe("v3")!.querySelector<HTMLButtonElement>(`button[aria-label="${chat.abrirAnexo("so.png")}"]`)!.click();
    await expect.poll(dialogo).not.toBeNull();
    expect(dialogo()!.querySelector(`[aria-label="${chat.visualizador.proxima}"]`)).toBeNull();
    expect(dialogo()!.querySelector('[role="status"]')).toBeNull();
  });
});

describe("seletor de emoji para reagir", () => {
  const seletor = () => document.querySelector<HTMLElement>(`[aria-label="${chat.emoji.seletor}"]`);
  const reagir = (id: string) =>
    linhaDe(id)!.querySelector<HTMLButtonElement>("button[aria-label=Reagir]")!.click();

  beforeEach(() => {
    fecharSeletorDeReacao();
    limparEmojisRecentes();
  });

  it("abre pela barra de ações, acha por nome sem acento, reage e fecha", async () => {
    semear([snap("e1")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    reagir("e1");
    await expect.poll(seletor).not.toBeNull();
    // O módulo da lista carrega sob demanda, e a busca recebe o foco.
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe(chat.emoji.buscar);
    await userEvent.keyboard("coracao");
    await expect.poll(() => seletor()!.querySelectorAll("[data-emoji]").length).toBeGreaterThan(0);
    const primeiro = seletor()!.querySelector<HTMLButtonElement>("[data-emoji]")!;
    const glifo = primeiro.textContent;
    primeiro.click();
    expect(ctl.reacoes).toEqual([["e1", glifo]]);
    await expect.poll(seletor).toBeNull();
  });

  it("busca sem resultado diz que não achou; categorias e recentes aparecem sem busca", async () => {
    semear([snap("e2")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    reagir("e2");
    await expect.poll(() => seletor()?.querySelector("[data-emoji]")).not.toBeNull();
    expect(
      seletor()!.querySelectorAll(`[role="group"][aria-label="${chat.emoji.categorias}"] button`).length,
    ).toBeGreaterThan(3);
    expect(seletor()!.textContent).not.toContain(chat.emoji.recentes);
    await userEvent.keyboard("zzzzxx");
    await expect.element(page.getByText(chat.emoji.semResultado("zzzzxx"))).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(seletor).toBeNull();

    // Depois de escolher um, ele vira o primeiro dos recentes.
    reagir("e2");
    await expect.poll(() => seletor()?.querySelector("[data-emoji]")).not.toBeNull();
    const escolhido = seletor()!.querySelectorAll<HTMLButtonElement>("[data-emoji]")[5]!;
    const glifo = escolhido.textContent;
    escolhido.click();
    await expect.poll(seletor).toBeNull();
    reagir("e2");
    await expect.poll(() => seletor()?.textContent).toContain(chat.emoji.recentes);
    expect(seletor()!.querySelector("[data-secao=recentes] [data-emoji]")!.textContent).toBe(glifo);
  });

  it("setas andam pela grade e Enter escolhe", async () => {
    semear([snap("e3")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    reagir("e3");
    await expect.poll(() => seletor()?.querySelector("[data-emoji]")).not.toBeNull();
    const todos = () => Array.from(seletor()!.querySelectorAll<HTMLButtonElement>("[data-emoji]"));
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe(chat.emoji.buscar);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(todos()[0]);
    await userEvent.keyboard("{ArrowRight}{ArrowDown}");
    expect(document.activeElement).toBe(todos()[9]);
    await userEvent.keyboard("{ArrowUp}{ArrowLeft}");
    expect(document.activeElement).toBe(todos()[0]);
    const primeiro = todos()[0]!.textContent;
    await userEvent.keyboard("{Enter}");
    expect(ctl.reacoes).toEqual([["e3", primeiro]]);
  });

  it("o menu de contexto tem Mais reações, que abre o mesmo seletor", async () => {
    semear([snap("e4")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    clicarDireito(linhaDe("e4")!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
    Array.from(menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((i) => i.textContent?.includes(chat.emoji.maisReacoes))!
      .click();
    await expect.poll(seletor).not.toBeNull();
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe(chat.emoji.buscar);
  });

  it("sem permissão de reagir não há botão de reação na barra nem item no menu", async () => {
    ctl.negadas.add("reagir");
    semear([snap("e5")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    expect(linhaDe("e5")!.querySelector("button[aria-label=Reagir]")).toBeNull();
    clicarDireito(linhaDe("e5")!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
    expect(menu()!.textContent).not.toContain(chat.emoji.maisReacoes);
  });
});

describe("seletor de emoji no composer", () => {
  const seletor = () => document.querySelector<HTMLElement>(`[aria-label="${chat.emoji.seletor}"]`);
  const botao = () => pegar<HTMLButtonElement>("button[data-gatilho-de-emoji]")!;
  const area = () => pegar<HTMLTextAreaElement>("textarea")!;

  beforeEach(() => {
    limparEmojisRecentes();
  });

  it("insere na posição do cursor, devolve o foco ao campo e o botão também fecha", async () => {
    semear([snap("c1")]);
    abrir();
    await expect.poll(() => pegar("textarea")).not.toBeNull();
    escreverRascunho(C, "oi mundo");
    await expect.poll(() => area().value).toBe("oi mundo");
    area().focus();
    area().setSelectionRange(2, 2);
    botao().click();
    await expect.poll(() => seletor()?.querySelector("[data-emoji]")).not.toBeNull();
    const glifo = seletor()!.querySelector<HTMLButtonElement>("[data-emoji]")!.textContent;
    seletor()!.querySelector<HTMLButtonElement>("[data-emoji]")!.click();
    await expect.poll(() => area().value).toBe(`oi${glifo} mundo`);
    await expect.poll(seletor).toBeNull();
    await expect.poll(() => document.activeElement).toBe(area());
    await expect.poll(() => area().selectionStart).toBe(2 + glifo.length);

    botao().click();
    await expect.poll(seletor).not.toBeNull();
    await userEvent.click(botao());
    await expect.poll(seletor).toBeNull();
  });
});

describe("responder sem mencionar", () => {
  const alternador = () => pegar<HTMLButtonElement>(`button[aria-label="${chat.mencionarResposta}"]`)!;

  it("o padrão menciona; o alternador é visível, muda o envio e o rótulo é fixo", async () => {
    semear([snap("r1", { content: "pergunta?" })]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    responderA(C, "r1");
    await expect.poll(alternador).not.toBeNull();
    expect(alternador().getAttribute("aria-pressed")).toBe("true");
    alternador().click();
    await expect.poll(() => alternador().getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(pegar("textarea")!);
    await userEvent.keyboard("ok{Enter}");
    expect(ctl.enviados[0]).toEqual([C, "ok", { id: "r1", mencionar: false }, undefined]);
  });

  it("o menu da mensagem arma a resposta já sem mencionar", async () => {
    semear([snap("r2")]);
    abrir();
    await expect.poll(() => linhas().length).toBe(1);
    clicarDireito(linhaDe("r2")!.querySelector("article")!);
    await expect.poll(menu).not.toBeNull();
    Array.from(menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((i) => i.textContent?.includes(chat.responderSemMencionar))!
      .click();
    await expect.poll(alternador).not.toBeNull();
    expect(alternador().getAttribute("aria-pressed")).toBe("false");
    await expect.poll(() => document.activeElement?.tagName).toBe("TEXTAREA");
    await userEvent.keyboard("ok{Enter}");
    expect(ctl.enviados[0]).toEqual([C, "ok", { id: "r2", mencionar: false }, undefined]);
  });
});
