import "../../arnes/redeFalsa";

import { CHANNEL_ID, SERVER_ID, seed } from "nucleo/arnes/firehose";
import { channelMessageIds, definirCanalAberto, estadoDoHistorico } from "nucleo/sdk/adapter";
import { client } from "nucleo/sdk/client";
import { limparBusca } from "nucleo/store/busca";
import { definirConexao, lerConexao, limparConexao } from "nucleo/store/conexao";
import { limparFixados } from "nucleo/store/fixados";
import { irPara } from "nucleo/store/navegacao";
import { definirProntidao } from "nucleo/store/prontidao";
import { dispensarToast, lerToasts } from "nucleo/ui-logica/toastStore";
import { ulidDoInstante } from "nucleo/lib/ulid";
import { page, userEvent } from "vitest/browser";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { quadros } from "../../testes/esperas";
import { busca, fixados } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { ShellDasSalas } from "../salas/ShellDasSalas";

/**
 * O painel de fixados contra o app inteiro (shell, lista, painel), com o mundo do
 * arnês e `Channel.search` dublado: o SDK não tem servidor para responder.
 */

const ctl = vi.hoisted(() => ({ negadas: new Set<string>() }));

vi.mock("nucleo/sdk/permissoes", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  pode: (_canal: string, acao: string) => !ctl.negadas.has(acao),
  podeNoServidor: () => true,
}));

/** Só o salto até uma mensagem antiga precisa do socket "aberto" (carregar histórico exige). */
const ESTADO_CONECTADO = 2; // ConnectionState.Connected
const eventos = client.events as unknown as { state: () => number };
const estadoOriginal = eventos.state;
const ligarSocket = () => {
  eventos.state = () => ESTADO_CONECTADO;
  vi.spyOn(client.channels.get(CHANNEL_ID)!, "ack").mockResolvedValue(undefined);
};

beforeAll(async () => {
  await seed(60);
}, 60_000);

beforeEach(async () => {
  await page.viewport(1600, 900);
  document.documentElement.dataset.tema = "vidro";
  ctl.negadas.clear();
  limparConexao();
  limparBusca();
  limparFixados();
  definirProntidao(true);
  irPara(SERVER_ID, CHANNEL_ID);
  definirCanalAberto(CHANNEL_ID);
});
afterEach(() => {
  for (const t of lerToasts()) dispensarToast(t.id);
  desmontar();
  limparBusca();
  limparFixados();
  vi.restoreAllMocks();
  eventos.state = estadoOriginal;
  definirProntidao(false);
});

const canal = () => client.channels.get(CHANNEL_ID)!;
const ids = () => channelMessageIds.getSnapshot(CHANNEL_ID) ?? [];
const mensagem = (id: string) => client.messages.get(id)!;

/** `Channel.search` devolvendo mensagens REAIS do cache do SDK (o painel as lê pelo store). */
function dublarFixadas(corpo: (params: Record<string, unknown>) => readonly string[] | Promise<readonly string[]>) {
  return vi.spyOn(canal(), "search").mockImplementation(((params: Record<string, unknown>) =>
    Promise.resolve(corpo(params)).then((lista) => lista.map(mensagem))));
}

async function abrir() {
  montar(
    <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
      <ShellDasSalas />
    </div>,
  );
  await expect.element(page.getByRole("button", { name: fixados.botao, exact: true })).toBeVisible();
}

const botao = () => page.getByRole("button", { name: fixados.botao, exact: true });
const botaoDeBusca = () => page.getByRole("button", { name: busca.botao });
const painel = () => pegar("[data-testid='painel-de-fixados']");
const painelDeBusca = () => pegar("[data-testid='painel-de-busca']");
const membros = () => pegar("[data-testid='lista-de-membros']");
const itens = () => [...document.querySelectorAll<HTMLElement>("[data-fixado-ir]")];

describe("abrir e fechar", () => {
  it("o botão abre o painel no lugar dos membros e fecha devolvendo o foco", async () => {
    dublarFixadas(() => [ids()[10]!]);
    await abrir();
    await expect.poll(() => membros()).not.toBeNull();
    expect(painel()).toBeNull();
    expect(botao().element().getAttribute("aria-pressed")).toBe("false");

    await botao().click();
    await expect.poll(() => painel()).not.toBeNull();
    expect(membros()).toBeNull();
    expect(botao().element().getAttribute("aria-pressed")).toBe("true");
    expect(painel()!.contains(document.activeElement)).toBe(true);

    await botao().click();
    await expect.poll(() => painel()).toBeNull();
    await expect.poll(() => membros()).not.toBeNull();
    expect(document.activeElement).toBe(botao().element());
  });

  it("Esc fecha e devolve o foco ao botão que abriu", async () => {
    dublarFixadas(() => [ids()[10]!]);
    await abrir();
    const composer = pegar<HTMLTextAreaElement>("textarea")!;
    composer.focus();
    await botao().click();
    await expect.poll(() => painel()).not.toBeNull();

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => painel()).toBeNull();
    // O clique no botão moveu o foco; a origem guardada é a do botão, que o abriu.
    expect(document.activeElement).toBe(botao().element());
  });
});

describe("exclusão mútua com a busca", () => {
  it("abrir a busca com as fixadas abertas fecha as fixadas, e vice-versa", async () => {
    dublarFixadas(() => [ids()[10]!]);
    await abrir();
    await botao().click();
    await expect.poll(() => painel()).not.toBeNull();

    await botaoDeBusca().click();
    await expect.poll(() => painelDeBusca()).not.toBeNull();
    expect(painel()).toBeNull();
    expect(botao().element().getAttribute("aria-pressed")).toBe("false");

    await botao().click();
    await expect.poll(() => painel()).not.toBeNull();
    expect(painelDeBusca()).toBeNull();
    expect(botaoDeBusca().element().getAttribute("aria-pressed")).toBe("false");
  });

  it("Ctrl+F com as fixadas abertas troca para a busca", async () => {
    dublarFixadas(() => [ids()[10]!]);
    await abrir();
    await botao().click();
    await expect.poll(() => painel()).not.toBeNull();
    await userEvent.keyboard("{Control>}f{/Control}");
    await expect.poll(() => painelDeBusca()).not.toBeNull();
    expect(painel()).toBeNull();
  });
});

describe("os estados", () => {
  it("carregando: mostra o esqueleto até a resposta chegar", async () => {
    let chegou!: (v: readonly string[]) => void;
    dublarFixadas(() => new Promise((r) => (chegou = r)));
    await abrir();
    await botao().click();
    await expect.element(page.getByRole("status", { name: fixados.estados.carregando })).toBeVisible();

    chegou([ids()[10]!]);
    await expect.poll(() => itens().length).toBe(1);
    expect(pegar("[aria-busy='true'][role='status']")).toBeNull();
  });

  it("vazio: diz que não há mensagem fixada", async () => {
    dublarFixadas(() => []);
    await abrir();
    await botao().click();
    await expect.element(page.getByText(fixados.estados.vazio)).toBeVisible();
  });

  it("erro: diz a falha e 'Tentar de novo' refaz a busca", async () => {
    let falhar = true;
    const busca_ = vi.spyOn(canal(), "search").mockImplementation((() =>
      falhar ? Promise.reject(new Error("rede")) : Promise.resolve([mensagem(ids()[10]!)])));
    await abrir();
    await botao().click();
    await expect.element(page.getByText(fixados.estados.erro)).toBeVisible();

    falhar = false;
    await page.getByRole("button", { name: fixados.estados.tentarDeNovo }).click();
    await expect.poll(() => itens().length).toBe(1);
    expect(busca_).toHaveBeenCalledTimes(2);
  });

  it("sem conexão: avisa, não busca, e busca quando a conexão volta", async () => {
    const api = dublarFixadas(() => [ids()[10]!]);
    definirConexao("sem-conexao");
    // A conexão só diz que caiu depois de 1,5s (antes disso o silêncio é mais honesto): espera
    // o ESTADO publicado virar, e não um relógio maior que o dela.
    await expect.poll(lerConexao, { timeout: 5000 }).toBe("sem-conexao");
    await abrir();
    await botao().click();
    await expect.element(page.getByText(fixados.estados.semConexao)).toBeVisible();
    expect(api).not.toHaveBeenCalled();

    definirConexao("conectado");
    await expect.poll(() => itens().length).toBe(1);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("cada item mostra autor, hora, trecho e o anexo resumido; o botão mostra a contagem", async () => {
    const comAnexo = ids().find((id) => (mensagem(id).attachments?.length ?? 0) > 0);
    const alvos = [ids()[10]!, ...(comAnexo ? [comAnexo] : [])];
    dublarFixadas(() => alvos);
    await abrir();
    await botao().click();
    await expect.poll(() => itens().length).toBe(alvos.length);

    const primeiro = itens()[0]!;
    expect(primeiro.querySelector("[class*='autor']")?.textContent?.length).toBeGreaterThan(0);
    expect(primeiro.querySelector("[class*='hora']")?.textContent).toMatch(/\d/u);
    expect(primeiro.querySelector("[class*='trecho']")?.textContent?.length).toBeGreaterThan(0);
    await expect.poll(() => botao().element().textContent).toBe(String(alvos.length));
    if (comAnexo) expect(painel()!.textContent).toContain("Anexo:");
  });
});

describe("ao vivo", () => {
  it("fixar entra na lista e desafixar sai, sem refazer a busca", async () => {
    const [a, b] = [ids()[10]!, ids()[14]!];
    const api = dublarFixadas(() => [a]);
    await abrir();
    await botao().click();
    await expect.poll(() => itens().length).toBe(1);

    // Outra pessoa fixa `b`: chega como MessageUpdate com `pinned`.
    const antes = { pinned: false, channelId: CHANNEL_ID };
    client.messages.updateUnderlyingObject(b, { pinned: true } as never);
    client.emit("messageUpdate", mensagem(b), antes as never);
    await expect.poll(() => itens().length).toBe(2);

    // E desafixa `a`.
    client.messages.updateUnderlyingObject(a, { pinned: false } as never);
    client.emit("messageUpdate", mensagem(a), { pinned: true, channelId: CHANNEL_ID } as never);
    await expect.poll(() => itens().length).toBe(1);
    await expect.poll(() => botao().element().textContent).toBe("1");
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("uma edição comum (sem mudar o fixar) não mexe na lista", async () => {
    const a = ids()[10]!;
    dublarFixadas(() => [a]);
    await abrir();
    await botao().click();
    await expect.poll(() => itens().length).toBe(1);

    client.emit("messageUpdate", mensagem(a), { pinned: false, channelId: CHANNEL_ID } as never);
    client.emit("messageUpdate", mensagem(ids()[12]!), { pinned: false, channelId: CHANNEL_ID } as never);
    // Asserção NEGATIVA: uma mudança na lista viria no render seguinte ao evento.
    await quadros(2);
    expect(itens().length).toBe(1);
  });
});

describe("desafixar", () => {
  it("quem pode fixar vê 'Desafixar' e o item sai da lista na hora", async () => {
    const [a, b] = [ids()[10]!, ids()[14]!];
    client.messages.updateUnderlyingObject(a, { pinned: true } as never);
    client.messages.updateUnderlyingObject(b, { pinned: true } as never);
    dublarFixadas(() => [a, b]);
    await abrir();
    await botao().click();
    await expect.poll(() => itens().length).toBe(2);

    const desafixar = page.getByRole("button", { name: /^Desafixar a mensagem de/u });
    expect(desafixar.elements().length).toBe(2);
    await desafixar.first().click();
    await expect.poll(() => itens().length).toBe(1);
    // Desafixou a primeira DE VERDADE (o protocolo), e a outra segue fixada.
    expect(mensagem(a).pinned !== mensagem(b).pinned).toBe(true);
  });

  it("quem não pode fixar não vê o controle", async () => {
    ctl.negadas.add("fixar");
    dublarFixadas(() => [ids()[10]!, ids()[14]!]);
    await abrir();
    await botao().click();
    await expect.poll(() => itens().length).toBe(2);
    expect(page.getByRole("button", { name: /^Desafixar a mensagem de/u }).elements().length).toBe(0);
  });
});

describe("ir até a mensagem", () => {
  it("de uma já carregada: rola até ela e a realça", async () => {
    const alvo = ids()[12]!;
    dublarFixadas(() => [alvo]);
    await abrir();
    await botao().click();
    await expect.poll(() => itens().length).toBe(1);
    itens()[0]!.click();

    await expect
      .poll(() => document.querySelector(`[data-menu-mensagem="${alvo}"]`)?.getAttribute("data-realcada"), { timeout: 5000 })
      .toBe("true");
  });

  it("de uma que NÃO está carregada: carrega para trás até ela e salta", async () => {
    ligarSocket();
    const antigas = Array.from({ length: 130 }, (_, i) => ulidDoInstante(Date.now() - 20 * 86_400_000 + i * 1000)!);
    const alvo = antigas[20]!;
    const bruta = (id: string) => ({ _id: id, channel: CHANNEL_ID, author: "01JQ0000000000000001000001", content: `antiga ${id.slice(-6)}` });
    // A mensagem fixada antiga já está no cache do SDK (a busca a materializa), mas fora da lista.
    client.messages.getOrCreate(alvo, bruta(alvo));
    /*
      Determinístico, sem ler o estado ao vivo: o cursor é procurado nas próprias `antigas`, e um
      cursor que não é delas (o da primeira página, vindo da lista semeada) devolve as mais novas.
      Antes ele comparava com `ids()[0]` — o snapshot PUBLICADO, que anda um frame atrás da
      lista —, e numa máquina lenta essa defasagem podia entregar a mesma página duas vezes.
    */
    const todas = [...antigas].reverse();
    vi.spyOn(client.api, "get").mockImplementation(((rota: string, params?: { before?: string; limit?: number }) => {
      if (!rota.endsWith("/messages")) return Promise.resolve({});
      if (params?.before === undefined) return Promise.resolve({ messages: [], users: [], members: [] });
      const limite = params.limit ?? 100;
      const idx = todas.indexOf(params.before) + 1; // não é delas: -1 + 1 = 0, as mais novas
      return Promise.resolve({ messages: todas.slice(idx, idx + limite).map(bruta), users: [], members: [] });
    }));
    dublarFixadas(() => [alvo]);

    await abrir();
    expect(ids()).not.toContain(alvo);
    // Espera a carga inicial ASSENTAR antes de pedir o salto: pedir com ela em voo faz a corrida
    // de páginas depender da velocidade da máquina, e não do que o teste quer provar.
    await expect
      .poll(() => {
        const h = estadoDoHistorico(CHANNEL_ID);
        return h.pedido && !h.paginaEmVoo && !h.acabou && ids().length > 0;
      }, { timeout: 20_000 })
      .toBe(true);
    await botao().click();
    await expect.poll(() => itens().length).toBe(1);
    await userEvent.click(itens()[0]!);

    await expect.poll(() => ids().includes(alvo), { timeout: 20_000 }).toBe(true);
    await expect
      .poll(() => document.querySelector(`[data-menu-mensagem="${alvo}"]`)?.getAttribute("data-realcada"), { timeout: 20_000 })
      .toBe("true");
  }, 60_000);

  it("de uma que não existe mais: avisa, e não deixa o painel preso", async () => {
    ligarSocket();
    const fantasma = ulidDoInstante(Date.now() - 30 * 86_400_000)!;
    client.messages.getOrCreate(fantasma, { _id: fantasma, channel: CHANNEL_ID, author: "01JQ0000000000000001000001", content: "sumiu" });
    vi.spyOn(client.api, "get").mockImplementation((() => Promise.resolve({ messages: [], users: [], members: [] })));
    dublarFixadas(() => [fantasma]);
    await abrir();
    await botao().click();
    await expect.poll(() => itens().length).toBe(1);
    itens()[0]!.click();
    await expect.poll(() => lerToasts().some((t) => t.titulo === fixados.salto.ausente)).toBe(true);
    await expect.poll(() => itens()[0]!.getAttribute("aria-busy")).toBeNull();
  });
});

describe("teclado", () => {
  it("setas percorrem os itens e Enter salta até o focado", async () => {
    const [a, b, c] = [ids()[10]!, ids()[14]!, ids()[18]!];
    dublarFixadas(() => [a, b, c]);
    await abrir();
    await botao().click();
    await expect.poll(() => itens().length).toBe(3);

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(itens()[0]);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement).toBe(itens()[2]);
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(itens()[1]);

    await userEvent.keyboard("{Enter}");
    const alvo = itens()[1]!.closest("li")!;
    expect(alvo).not.toBeNull();
    await expect.poll(() => document.querySelector("[data-realcada='true']")).not.toBeNull();
  });

  it("Esc dentro de um item fecha e devolve o foco", async () => {
    dublarFixadas(() => [ids()[10]!, ids()[14]!]);
    await abrir();
    await botao().click();
    await expect.poll(() => itens().length).toBe(2);
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => painel()).toBeNull();
    expect(document.activeElement).toBe(botao().element());
  });
});
