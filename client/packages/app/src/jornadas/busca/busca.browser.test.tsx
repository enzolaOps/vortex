import "../../arnes/redeFalsa";

import { CHANNEL_ID, SERVER_ID, seed } from "nucleo/arnes/firehose";
import { channelMessageIds, definirCanalAberto, estadoDoHistorico } from "nucleo/sdk/adapter";
import { client } from "nucleo/sdk/client";
import { limparBusca } from "nucleo/store/busca";
import { definirConexao, limparConexao } from "nucleo/store/conexao";
import { irPara } from "nucleo/store/navegacao";
import { definirProntidao } from "nucleo/store/prontidao";
import { dispensarToast, lerToasts } from "nucleo/ui-logica/toastStore";
import { ulidDoInstante } from "nucleo/lib/ulid";
import { page, userEvent } from "vitest/browser";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { quadros } from "../../testes/esperas";
import { busca } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { ShellDasSalas } from "../salas/ShellDasSalas";

/**
 * A busca no canal contra o app inteiro (shell, lista, painel), com o mundo do
 * arnês e `Channel.search` dublado: o SDK não tem servidor para responder.
 */

/**
 * `conectado()` lê o estado do socket do SDK. Só os testes do salto antigo precisam dele
 * "aberto" (carregar histórico exige socket): nos outros a lista tentaria buscar de verdade.
 * O estado é um acessor de instância, então se troca sem mockar o módulo.
 */
const ESTADO_CONECTADO = 2; // ConnectionState.Connected
const eventos = client.events as unknown as { state: () => number };
const estadoOriginal = eventos.state;
const ligarSocket = () => {
  eventos.state = () => ESTADO_CONECTADO;
  // A lista confirma a leitura ao ficar no fim; o arnês não tem a coleção de não lidas.
  vi.spyOn(client.channels.get(CHANNEL_ID)!, "ack").mockResolvedValue(undefined);
};

type Achado = { id: string; conteudo: string; autor?: string };

beforeAll(async () => {
  await seed(60);
}, 60_000);

beforeEach(async () => {
  await page.viewport(1600, 900);
  document.documentElement.dataset.tema = "vidro";
  limparConexao();
  limparBusca();
  definirProntidao(true);
  irPara(SERVER_ID, CHANNEL_ID);
  definirCanalAberto(CHANNEL_ID);
});
afterEach(() => {
  for (const t of lerToasts()) dispensarToast(t.id);
  desmontar();
  limparBusca();
  vi.restoreAllMocks();
  eventos.state = estadoOriginal;
  definirProntidao(false);
});

const canal = () => client.channels.get(CHANNEL_ID)!;
const ids = () => channelMessageIds.getSnapshot(CHANNEL_ID) ?? [];

function resposta(achados: readonly Achado[]) {
  return achados.map((a) => ({
    id: a.id,
    channelId: CHANNEL_ID,
    authorId: a.autor ?? "01JQ0000000000000001000001",
    content: a.conteudo,
    createdAt: new Date(),
    attachments: [],
  })) as never;
}

function dublarBusca(corpo: (params: Record<string, unknown>) => unknown) {
  return vi.spyOn(canal(), "search").mockImplementation(((params: Record<string, unknown>) =>
    Promise.resolve(corpo(params))) as never);
}

async function abrir() {
  montar(
    <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
      <ShellDasSalas />
    </div>,
  );
  await expect.element(page.getByRole("button", { name: busca.botao })).toBeVisible();
}

const botao = () => page.getByRole("button", { name: busca.botao });
const painel = () => pegar("[data-testid='painel-de-busca']");
const campo = () => page.getByRole("combobox", { name: busca.campo });
const membros = () => pegar("[data-testid='lista-de-membros']");

async function digitarNoCampo(texto: string) {
  await campo().click();
  await userEvent.fill(campo(), texto);
}

describe("abrir e fechar", () => {
  it("o botão abre o painel no lugar dos membros e fecha devolvendo o foco", async () => {
    await abrir();
    await expect.poll(() => membros()).not.toBeNull();
    expect(painel()).toBeNull();

    await botao().click();
    await expect.element(campo()).toBeVisible();
    expect(membros()).toBeNull();
    expect(document.activeElement).toBe(campo().element());

    await botao().click();
    await expect.poll(() => painel()).toBeNull();
    await expect.poll(() => membros()).not.toBeNull();
    expect(document.activeElement).toBe(botao().element());
  });

  it("Ctrl+F abre com o foco no campo; Esc fecha e devolve o foco ao composer", async () => {
    await abrir();
    const composer = pegar<HTMLTextAreaElement>("textarea")!;
    composer.focus();
    await userEvent.keyboard("{Control>}f{/Control}");
    await expect.element(campo()).toBeVisible();
    expect(document.activeElement).toBe(campo().element());

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => painel()).toBeNull();
    expect(document.activeElement).toBe(composer);
  });

  it("Esc devolve o foco ao botão quando a busca foi aberta por ele", async () => {
    await abrir();
    await botao().click();
    await expect.element(campo()).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => painel()).toBeNull();
    expect(document.activeElement).toBe(botao().element());
  });

  it("o botão diz se está ligado", async () => {
    await abrir();
    await expect.element(botao()).toHaveAttribute("aria-pressed", "false");
    await botao().click();
    await expect.element(botao()).toHaveAttribute("aria-pressed", "true");
  });
});

describe("filtros", () => {
  it("viram fichas removíveis, e a busca sai com o autor e o tipo certos", async () => {
    const autor = client.users.get("01JQ0000000000000001000001")!;
    const busca1 = dublarBusca(() => resposta([]));
    await abrir();
    await botao().click();
    await digitarNoCampo(`prazo de:${autor.username} tem:link`);

    const fichas = page.getByRole("list", { name: busca.ficha.rotulo });
    await expect.element(fichas.getByText(busca.ficha.de(autor.username))).toBeVisible();
    await expect.element(fichas.getByText(busca.ficha.tem.link)).toBeVisible();

    await expect.poll(() => busca1.mock.calls.length).toBe(1);
    expect(busca1.mock.calls[0]?.[0]).toMatchObject({
      query: "prazo",
      author: "01JQ0000000000000001000001",
      has: "Link",
    });

    await page.getByRole("button", { name: busca.ficha.remover(busca.ficha.tem.link) }).click();
    await expect.poll(() => busca1.mock.calls.length).toBe(2);
    expect(busca1.mock.calls[1]?.[0]).not.toHaveProperty("has");
    await expect.element(fichas.getByText(busca.ficha.tem.link)).not.toBeInTheDocument();
    expect((campo().element() as HTMLInputElement).value).toBe(`prazo de:${autor.username}`);
  });

  it("os controles escrevem no mesmo texto: data e tipo viram ficha e filtro", async () => {
    const busca1 = dublarBusca(() => resposta([]));
    await abrir();
    await botao().click();
    await digitarNoCampo("planilha");
    await page.getByRole("button", { name: busca.filtros.mostrar }).click();

    const imagem = page.getByTestId("painel-de-busca").getByRole("button", { name: busca.filtros.imagem, exact: true });
    await imagem.click();
    await expect.element(page.getByText(busca.ficha.tem.imagem)).toBeVisible();
    await expect.poll(() => busca1.mock.calls.some((c) => c[0] && (c[0] as { has?: string }).has === "Image")).toBe(true);

    await imagem.click();
    await expect.element(page.getByText(busca.ficha.tem.imagem)).not.toBeInTheDocument();

    await userEvent.fill(page.getByLabelText(busca.filtros.depoisDe), "2026-01-15");
    await expect.element(page.getByText(busca.ficha.depois("15/01/2026"))).toBeVisible();
    await expect
      .poll(() => busca1.mock.calls.some((c) => (c[0] as { after?: string }).after !== undefined))
      .toBe(true);
  });

  it("filtro que não se entende vira aviso, e a rede nem é chamada", async () => {
    const busca1 = dublarBusca(() => resposta([]));
    await abrir();
    await botao().click();
    await digitarNoCampo("tem:planilha");
    // O aviso só existe depois de a busca RODAR e parar no filtro (`executar`, já fora da
    // pausa de digitação): com ele na tela a decisão de não chamar a rede já foi tomada.
    await expect.element(page.getByText(busca.estados.filtroInvalido("tem:planilha"))).toBeVisible();
    expect(busca1).not.toHaveBeenCalled();
  });
});

describe("estados", () => {
  it("convite → esqueleto → resultados com contagem e termo marcado", async () => {
    let resolver!: (v: unknown) => void;
    const espera = new Promise((r) => {
      resolver = r;
    });
    dublarBusca(() => espera);
    await abrir();
    await botao().click();
    await expect.element(page.getByText(busca.estados.convite)).toBeVisible();

    await digitarNoCampo("prazo");
    await expect.element(page.getByRole("status", { name: busca.estados.buscando })).toBeVisible();

    resolver(resposta([{ id: ids()[3]!, conteudo: "o **prazo** final é sexta" }, { id: ids()[4]!, conteudo: "sem prazo definido ainda" }]));
    await expect.element(page.getByText(busca.resultados.contagem(2))).toBeVisible();
    const marcas = [...document.querySelectorAll("mark")].map((m) => m.textContent);
    expect(marcas).toEqual(["prazo", "prazo"]);
    // Sem parse de markdown no resultado: nenhum asterisco, nenhum <strong>.
    expect(painel()!.textContent).not.toContain("**");
    expect(painel()!.querySelector("strong")).toBeNull();
  });

  it("nada encontrado diz o que foi buscado", async () => {
    dublarBusca(() => resposta([]));
    await abrir();
    await botao().click();
    await digitarNoCampo("zzzz");
    await expect.element(page.getByText(busca.estados.vazio("zzzz"))).toBeVisible();
  });

  it("erro tem 'Tentar de novo', que refaz a busca", async () => {
    let falhar = true;
    const busca1 = vi.spyOn(canal(), "search").mockImplementation((() =>
      falhar ? Promise.reject(new Error("fora")) : Promise.resolve(resposta([{ id: ids()[5]!, conteudo: "achei" }]))));
    await abrir();
    await botao().click();
    await digitarNoCampo("achei");
    await expect.element(page.getByText(busca.estados.erro)).toBeVisible();

    falhar = false;
    await page.getByRole("button", { name: busca.estados.tentarDeNovo }).click();
    await expect.element(page.getByText(busca.resultados.contagem(1))).toBeVisible();
    expect(busca1).toHaveBeenCalledTimes(2);
  });

  it("sem conexão diz isso, e a busca falha refaz sozinha quando a conexão volta", async () => {
    let falhar = true;
    dublarBusca(() => (falhar ? Promise.reject(new Error("fora")) : resposta([{ id: ids()[5]!, conteudo: "achei" }])));
    await abrir();
    await botao().click();
    await digitarNoCampo("achei");
    await expect.element(page.getByText(busca.estados.erro)).toBeVisible();

    definirConexao("sem-conexao");
    await expect.element(page.getByText(busca.estados.semConexao)).toBeVisible();

    falhar = false;
    definirConexao("conectado");
    await expect.element(page.getByText(busca.resultados.contagem(1))).toBeVisible();
  });

  it("carregar mais acrescenta a página seguinte", async () => {
    const todos = ids().slice(0, 30);
    const busca1 = dublarBusca((params) =>
      resposta(
        (params.before === undefined ? todos.slice(0, 25) : todos.slice(25)).map((id) => ({ id, conteudo: `mensagem ${id.slice(-4)} prazo` })),
      ),
    );
    await abrir();
    await botao().click();
    await digitarNoCampo("prazo");
    await expect.element(page.getByText(busca.resultados.contagemTemMais(25))).toBeVisible();

    await page.getByRole("button", { name: busca.resultados.carregarMais }).click();
    await expect.element(page.getByText(busca.resultados.contagem(30))).toBeVisible();
    expect(busca1).toHaveBeenCalledTimes(2);
    expect(busca1.mock.calls[1]?.[0]).toMatchObject({ before: todos[24] });
  });
});

describe("digitação", () => {
  it("espera a pausa: digitar seguido faz UMA chamada", async () => {
    const busca1 = dublarBusca(() => resposta([]));
    await abrir();
    await botao().click();
    await campo().click();
    await userEvent.keyboard("prazo");
    expect(busca1).not.toHaveBeenCalled();
    await expect.poll(() => busca1.mock.calls.length).toBe(1);
    // "Nada encontrado" só aparece quando a busca da ÚLTIMA tecla terminou: toda tecla volta o
    // estado a "buscando", e só a resposta da geração vigente o desliga. Com o vazio na tela
    // não há pausa pendente que pudesse fazer uma segunda chamada.
    await expect.element(page.getByText(busca.estados.vazio("prazo"))).toBeVisible();
    expect(busca1).toHaveBeenCalledTimes(1);
    expect(busca1.mock.calls[0]?.[0]).toMatchObject({ query: "prazo" });
  });

  it("a resposta lenta de uma busca antiga não troca a lista da nova", async () => {
    let soltarAntiga!: (v: unknown) => void;
    const antiga = new Promise((r) => {
      soltarAntiga = r;
    });
    const busca1 = dublarBusca((params) => (params.query === "pra" ? antiga : resposta([{ id: ids()[6]!, conteudo: "prazo certo" }])));
    await abrir();
    await botao().click();
    await digitarNoCampo("pra");
    // A busca por "pra" saiu (e fica pendurada na promessa acima).
    await expect.poll(() => busca1.mock.calls.some((c) => (c[0] as { query?: string }).query === "pra")).toBe(true);
    await digitarNoCampo("prazo");
    await expect.element(page.getByText(busca.resultados.contagem(1))).toBeVisible();

    soltarAntiga(resposta([{ id: ids()[7]!, conteudo: "ANTIGA pra" }, { id: ids()[8]!, conteudo: "ANTIGA pra 2" }]));
    // Asserção NEGATIVA: se a resposta antiga fosse escrita, seria na cadeia da promessa e no
    // render seguinte — depois de dois quadros pintados ela já estaria na tela.
    await quadros(2);
    expect(painel()!.textContent).not.toContain("ANTIGA");
    await expect.element(page.getByText(busca.resultados.contagem(1))).toBeVisible();
  });
});

describe("ir até a mensagem", () => {
  it("de uma já carregada: rola até ela e a realça", async () => {
    const alvo = ids()[12]!;
    dublarBusca(() => resposta([{ id: alvo, conteudo: "achado" }]));
    await abrir();
    await botao().click();
    await digitarNoCampo("achado");
    await page.getByRole("option").first().click();

    await expect.poll(() => document.querySelector(`[data-menu-mensagem="${alvo}"]`)).not.toBeNull();
    await expect
      .poll(() => document.querySelector(`[data-menu-mensagem="${alvo}"]`)?.getAttribute("data-realcada"), { timeout: 5000 })
      .toBe("true");
    await expect.poll(() => document.querySelector(`[data-menu-mensagem="${alvo}"]`)?.hasAttribute("data-realcada"), { timeout: 5000 }).toBe(false);
  });

  it("de uma que NÃO está carregada: carrega para trás até ela e salta", async () => {
    ligarSocket();
    const antigas = Array.from({ length: 130 }, (_, i) => ulidDoInstante(Date.now() - 20 * 86_400_000 + i * 1000)!);
    const alvo = antigas[20]!; // fica na segunda página para trás (a página cheia vem primeiro)
    const bruta = (id: string) => ({ _id: id, channel: CHANNEL_ID, author: "01JQ0000000000000001000001", content: `antiga ${id.slice(-6)}` });
    // Determinístico, como no teste de fixados: o cursor é procurado nas próprias `antigas`, e um
    // cursor que não é delas (o da lista semeada) devolve as mais novas. Comparar com `ids()[0]`
    // lia o snapshot PUBLICADO, que anda um quadro atrás da lista, e sob carga podia entregar a
    // mesma página duas vezes.
    const todas = [...antigas].reverse();
    const api = vi.spyOn(client.api, "get").mockImplementation(((rota: string, params?: { before?: string; limit?: number }) => {
      if (!rota.endsWith("/messages")) return Promise.resolve({});
      if (params?.before === undefined) return Promise.resolve({ messages: [], users: [], members: [] });
      const limite = params.limit ?? 100;
      const idx = todas.indexOf(params.before) + 1; // não é delas: -1 + 1 = 0, as mais novas
      return Promise.resolve({ messages: todas.slice(idx, idx + limite).map(bruta), users: [], members: [] });
    }));
    dublarBusca(() => resposta([{ id: alvo, conteudo: "antiga procurada" }]));

    await abrir();
    expect(ids()).not.toContain(alvo);
    // A carga inicial ASSENTA antes do salto: pedir com ela em voo faz a corrida de páginas
    // depender da velocidade da máquina, e não do que o teste quer provar.
    await expect
      .poll(() => {
        const h = estadoDoHistorico(CHANNEL_ID);
        return h.pedido && !h.paginaEmVoo && !h.acabou && ids().length > 0;
      }, { timeout: 20_000 })
      .toBe(true);
    await botao().click();
    await digitarNoCampo("antiga");
    await page.getByRole("option").first().click();

    await expect.poll(() => ids().includes(alvo), { timeout: 20_000 }).toBe(true);
    const chamadas = api.mock.calls as unknown as [string, { before?: string } | undefined][];
    expect(chamadas.filter((c) => c[1]?.before !== undefined).length).toBeGreaterThanOrEqual(2);
    await expect
      .poll(() => document.querySelector(`[data-menu-mensagem="${alvo}"]`)?.getAttribute("data-realcada"), { timeout: 20_000 })
      .toBe("true");
  }, 60_000);

  it("de uma que não existe mais: avisa, e não deixa a lista presa", async () => {
    ligarSocket();
    const fantasma = ulidDoInstante(Date.now() - 30 * 86_400_000)!;
    vi.spyOn(client.api, "get").mockImplementation((() => Promise.resolve({ messages: [], users: [], members: [] })));
    dublarBusca(() => resposta([{ id: fantasma, conteudo: "sumiu" }]));
    await abrir();
    await botao().click();
    await digitarNoCampo("sumiu");
    await page.getByRole("option").first().click();
    await expect.poll(() => lerToasts().some((t) => t.titulo === busca.salto.ausente)).toBe(true);
  });
});

describe("teclado", () => {
  it("setas percorrem os resultados e Enter abre o ativo", async () => {
    const [a, b, c] = [ids()[10]!, ids()[14]!, ids()[18]!];
    dublarBusca(() =>
      resposta([
        { id: a, conteudo: "um achado" },
        { id: b, conteudo: "dois achado" },
        { id: c, conteudo: "tres achado" },
      ]),
    );
    await abrir();
    await botao().click();
    await digitarNoCampo("achado");
    await expect.element(page.getByText(busca.resultados.contagem(3))).toBeVisible();

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const opcoes = page.getByRole("option");
    await expect.element(opcoes.nth(1)).toHaveAttribute("aria-selected", "true");
    expect(campo().element().getAttribute("aria-activedescendant")).toBe(`busca-resultado-${b}`);

    await userEvent.keyboard("{ArrowUp}");
    await expect.element(opcoes.nth(0)).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect
      .poll(() => document.querySelector(`[data-menu-mensagem="${b}"]`)?.getAttribute("data-realcada"), { timeout: 5000 })
      .toBe("true");
    // O foco fica no campo: dá para seguir navegando.
    expect(document.activeElement).toBe(campo().element());
  });
});
