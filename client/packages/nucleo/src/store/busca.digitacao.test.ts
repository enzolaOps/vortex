import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buscarNoCanal, POR_PAGINA, type ResultadoDeBusca } from "../sdk/busca";
import {
  abrirBusca,
  aplicarConsulta,
  carregarMais,
  digitar,
  ESPERA_DA_DIGITACAO_MS,
  fecharBusca,
  lerBusca,
  limparBusca,
} from "./busca";

vi.mock("../sdk/busca", async (original) => ({
  ...(await original<typeof import("../sdk/busca")>()),
  buscarNoCanal: vi.fn(),
  resolverAutor: vi.fn((nome: string) => (nome === "ana" ? "01ANA00000000000000000000A" : undefined)),
}));

/**
 * O que a digitação promete: espera a pausa antes de chamar, ignora a resposta
 * de uma busca que já não é a da tela, separa "nada encontrado" de "falhou", e
 * diz o filtro que não entendeu em vez de buscar errado.
 */

const mock = vi.mocked(buscarNoCanal);

function resultado(id: string): ResultadoDeBusca {
  return {
    id,
    channelId: "c1",
    nomeDoCanal: "geral",
    autorId: "u1",
    conteudo: `msg ${id}`,
    quando: "1 de out., 10:00",
    anexo: undefined,
  };
}

function pagina(n: number, de = 0): ResultadoDeBusca[] {
  return Array.from({ length: n }, (_, i) => resultado(`R${String(1000 - de - i)}`));
}

/** Uma promessa que o teste resolve quando quiser. */
function adiada<T>() {
  let resolver!: (v: T) => void;
  const p = new Promise<T>((r) => {
    resolver = r;
  });
  return { p, resolver };
}

beforeEach(() => {
  vi.useFakeTimers();
  limparBusca();
  mock.mockReset();
  abrirBusca("c1", "s1");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("abrir e fechar", () => {
  it("abre apontada para o canal e fecha mantendo o texto", () => {
    expect(lerBusca().aberta).toBe(true);
    expect(lerBusca().channelId).toBe("c1");
    digitar("prazo");
    fecharBusca();
    expect(lerBusca().aberta).toBe(false);
    expect(lerBusca().consulta).toBe("prazo");
  });

  it("abrir em outro canal descarta a busca do anterior", () => {
    digitar("prazo");
    abrirBusca("c2", "s1");
    expect(lerBusca().consulta).toBe("");
    expect(lerBusca().channelId).toBe("c2");
    expect(lerBusca().aberta).toBe(true);
  });
});

describe("digitação", () => {
  it("mostra o esqueleto já e só chama depois da pausa", async () => {
    mock.mockResolvedValue(pagina(2));
    digitar("pra");
    expect(lerBusca().buscando).toBe(true);
    expect(mock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(ESPERA_DA_DIGITACAO_MS - 1);
    expect(mock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(lerBusca().resultados).toHaveLength(2);
    expect(lerBusca().buscando).toBe(false);
  });

  it("digitar de novo antes da pausa faz UMA chamada, com o texto final", async () => {
    mock.mockResolvedValue(pagina(1));
    digitar("pr");
    await vi.advanceTimersByTimeAsync(100);
    digitar("pra");
    await vi.advanceTimersByTimeAsync(100);
    digitar("prazo");
    await vi.advanceTimersByTimeAsync(ESPERA_DA_DIGITACAO_MS + 5);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0]?.[0]).toMatchObject({ consulta: "prazo" });
  });

  it("a resposta lenta de uma busca antiga não escreve por cima da nova", async () => {
    const lenta = adiada<ResultadoDeBusca[]>();
    mock.mockReturnValueOnce(lenta.p).mockResolvedValueOnce([resultado("NOVA")]);

    digitar("pra");
    await vi.advanceTimersByTimeAsync(ESPERA_DA_DIGITACAO_MS + 5); // a antiga sai e fica pendurada
    digitar("prazo");
    await vi.advanceTimersByTimeAsync(ESPERA_DA_DIGITACAO_MS + 5); // a nova responde
    expect(lerBusca().resultados.map((r) => r.id)).toEqual(["NOVA"]);

    lenta.resolver([resultado("ANTIGA")]); // a antiga chega por último
    await vi.advanceTimersByTimeAsync(0);
    expect(lerBusca().resultados.map((r) => r.id)).toEqual(["NOVA"]);
  });

  it("apagar o campo limpa tudo e cancela a busca em voo", async () => {
    const lenta = adiada<ResultadoDeBusca[]>();
    mock.mockReturnValueOnce(lenta.p);
    digitar("prazo");
    await vi.advanceTimersByTimeAsync(ESPERA_DA_DIGITACAO_MS + 5);
    digitar("");
    lenta.resolver([resultado("X")]);
    await vi.advanceTimersByTimeAsync(0);
    expect(lerBusca().resultados).toEqual([]);
    expect(lerBusca().total).toBeUndefined();
    expect(lerBusca().buscando).toBe(false);
  });
});

describe("estados", () => {
  it("nada encontrado é total zero, e não falha", async () => {
    mock.mockResolvedValue([]);
    aplicarConsulta("zzz");
    await vi.advanceTimersByTimeAsync(0);
    expect(lerBusca().total).toBe(0);
    expect(lerBusca().falhou).toBe(false);
  });

  it("a rede falhando é falha, não 'nada encontrado', e refazer limpa", async () => {
    mock.mockResolvedValueOnce(undefined).mockResolvedValueOnce(pagina(1));
    aplicarConsulta("prazo");
    await vi.advanceTimersByTimeAsync(0);
    expect(lerBusca().falhou).toBe(true);
    expect(lerBusca().total).toBeUndefined();
    aplicarConsulta("prazo");
    await vi.advanceTimersByTimeAsync(0);
    expect(lerBusca().falhou).toBe(false);
    expect(lerBusca().total).toBe(1);
  });

  it("filtro que não se entende vira problema e NÃO chama a rede", async () => {
    aplicarConsulta("tem:planilha");
    await vi.advanceTimersByTimeAsync(0);
    expect(mock).not.toHaveBeenCalled();
    expect(lerBusca().problema).toEqual({ tipo: "filtroInvalido", bruto: "tem:planilha" });
  });

  it("autor que a sessão não conhece vira problema", async () => {
    aplicarConsulta("de:zeca");
    await vi.advanceTimersByTimeAsync(0);
    expect(mock).not.toHaveBeenCalled();
    expect(lerBusca().problema).toEqual({ tipo: "autorDesconhecido", nome: "zeca" });
  });

  it("filtro de autor e de conteúdo chegam à chamada", async () => {
    mock.mockResolvedValue([]);
    aplicarConsulta("prazo de:ana tem:link");
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.mock.calls[0]?.[0]).toMatchObject({
      consulta: "prazo",
      autorId: "01ANA00000000000000000000A",
      tem: "link",
    });
  });
});

describe("carregar mais", () => {
  it("acrescenta a página seguinte pelo cursor da anterior, sem repetir", async () => {
    const primeira = pagina(POR_PAGINA);
    mock.mockResolvedValueOnce(primeira).mockResolvedValueOnce(pagina(3, POR_PAGINA));
    aplicarConsulta("prazo");
    await vi.advanceTimersByTimeAsync(0);
    expect(lerBusca().temMais).toBe(true);

    carregarMais();
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.mock.calls[1]?.[0]).toMatchObject({ antesDe: primeira[POR_PAGINA - 1]?.id });
    expect(lerBusca().resultados).toHaveLength(POR_PAGINA + 3);
    expect(lerBusca().temMais).toBe(false);
  });

  it("página curta não oferece mais", async () => {
    mock.mockResolvedValue(pagina(4));
    aplicarConsulta("prazo");
    await vi.advanceTimersByTimeAsync(0);
    expect(lerBusca().temMais).toBe(false);
    carregarMais();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
