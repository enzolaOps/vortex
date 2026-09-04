import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import { client } from "./client";
import {
  channelMessageIds,
  definirCanalAberto,
  messages,
  primeiraNaoLida,
} from "./adapter";

/**
 * Leitura como POSIÇÃO, não contagem.
 *
 * "Tem 47 coisas novas" e "você parou AQUI" são informações diferentes, e a
 * segunda é a que faz alguém conseguir voltar a um canal movimentado sem
 * desistir. O Discord e o Discourse chegaram nela por caminhos separados — é o
 * sinal mais forte que a análise de concorrentes produziu.
 *
 * O que estes testes guardam é O MOMENTO em que o cursor avança. Avançar na
 * ENTRADA do canal faria o divisor sumir no mesmo frame em que apareceu: a
 * pessoa abriria o canal e não veria marca nenhuma de onde tinha parado. Nada
 * falharia — a feature simplesmente não existiria, e ninguém saberia dizer por
 * quê.
 */

const OUTRO = "01JQ0000000000000000000010";
/** `links` — nenhum outro teste deste arquivo entra nele. */
const VIRGEM = "01JQ0000000000000000000011";

const pendentes: FrameRequestCallback[] = [];

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  await seed(40);
  // Estado limpo entre testes: o cursor é module-level e sobrevive.
  definirCanalAberto(undefined);
});

function virarFrame() {
  const fila = pendentes.splice(0, pendentes.length);
  for (const cb of fila) cb(0);
}

/**
 * A lista PUBLICADA do canal.
 *
 * Vira o frame antes de ler: a publicação é coalescida por `rAF`, e ler sem
 * drenar devolve a lista de antes das mensagens novas. Foi exatamente o que
 * fez o teste da marca falhar dizendo que nenhuma linha a carregava — a
 * amostra é que não continha as linhas.
 */
function ids(): readonly string[] {
  virarFrame();
  return channelMessageIds.peek(CHANNEL_ID) ?? [];
}

describe("cursor de leitura", () => {
  it("canal nunca visitado não tem primeira não lida", () => {
    // Sem isto, abrir um canal pela primeira vez marcaria as dez mil como
    // novas — e o divisor apareceria no topo do histórico dizendo que TUDO
    // é novo, que é o oposto de útil.
    definirCanalAberto(CHANNEL_ID);
    expect(primeiraNaoLida(CHANNEL_ID)).toBeUndefined();
  });

  it("o cursor NÃO avança ao entrar — só ao sair", () => {
    definirCanalAberto(CHANNEL_ID);
    const antes = ids().length;

    // Chega mensagem enquanto a pessoa está olhando.
    definirCanalAberto(OUTRO); // sai: cursor vai até o fim
    definirCanalAberto(CHANNEL_ID); // volta

    // Voltou e nada é novo, porque nada chegou entre a saída e a volta.
    expect(primeiraNaoLida(CHANNEL_ID)).toBeUndefined();
    expect(ids().length).toBe(antes);
  });

  it("mensagem que chega DEPOIS da saída vira a primeira não lida", () => {
    definirCanalAberto(CHANNEL_ID);
    definirCanalAberto(OUTRO);

    const antes = [...ids()];
    // Uma mensagem nova enquanto o canal está fechado.
    const nova = criarUma();

    expect(primeiraNaoLida(CHANNEL_ID)).toBe(nova);
    expect(antes).not.toContain(nova);
  });

  it("a linha carrega a marca, e só UMA linha carrega", () => {
    definirCanalAberto(CHANNEL_ID);
    definirCanalAberto(OUTRO);
    criarUma();
    criarUma();
    criarUma();

    const marcadas = ids().filter((id) => {
      messages.subscriber(id)(() => {});
      return messages.peek(id)?.primeiraNaoLida === true;
    });

    // Exatamente uma: o divisor é uma posição, não um intervalo.
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toBe(primeiraNaoLida(CHANNEL_ID));
  });
});

let n = 0;

/**
 * Uma mensagem nova pelo caminho de EVENTO, como chegaria pela rede.
 *
 * `getOrCreate` com `true` emite `messageCreate` — o mesmo caminho de uma
 * mensagem vinda do websocket, e é por ele que o cursor precisa funcionar.
 * Semear pelo caminho de carga em massa não exercitaria nada disto.
 */
function criarUma(): string {
  return criarEm(CHANNEL_ID);
}

function criarEm(channelId: string): string {
  n += 1;
  const id = `01JQ00000000000000000L${String(n).padStart(4, "0")}`;
  client.messages.getOrCreate(
    id,
    {
      _id: id,
      channel: channelId,
      author: "01JQ0000000000000001000005",
      content: "nova",
    },
    true,
  );
  return id;
}

/**
 * Os dois casos que os testes acima NÃO distinguiam.
 *
 * Escritos depois de testar os testes: duas mutações — avançar o cursor na
 * ENTRADA em vez da saída, e remover a semeadura do canal nunca visitado —
 * passaram pelos quatro primeiros sem falhar nenhum.
 *
 * A causa foi a mesma nos dois: os cenários montados nunca chegavam ao estado
 * em que as duas regras divergem. Asserção que não pode falhar não guarda
 * nada, e o jeito de descobrir é quebrar o código de propósito.
 */
describe("o que só a mutação revelou", () => {
  it("entrar num canal COM não lidas não apaga o divisor", () => {
    // Este é o caso inteiro da feature: sair, chegar mensagem, voltar — e a
    // marca de "você parou aqui" continuar visível enquanto se lê.
    definirCanalAberto(CHANNEL_ID);
    definirCanalAberto(OUTRO);
    const nova = criarUma();
    virarFrame();

    definirCanalAberto(CHANNEL_ID);

    // Avançar o cursor na ENTRADA faria isto virar `undefined`: o divisor
    // sumiria no mesmo frame em que a pessoa abriu o canal para vê-lo.
    expect(primeiraNaoLida(CHANNEL_ID)).toBe(nova);
  });

  it("num canal NUNCA visitado, a mensagem que chega com ele aberto vira a primeira não lida", () => {
    // É o que a semeadura do cursor no primeiro acesso protege: sem ela, um
    // canal sem cursor não tem "a primeira depois de onde parei", e o divisor
    // nunca apareceria ali enquanto a sessão durasse.
    //
    // Precisa de um canal VIRGEM: o cursor é module-level e sobrevive aos
    // testes anteriores deste arquivo, então reusar o CHANNEL_ID mediria um
    // canal que já tem cursor — foi assim que a primeira versão deste teste
    // passou pela mutação sem reclamar.
    criarEm(VIRGEM);
    virarFrame();

    definirCanalAberto(VIRGEM);
    const nova = criarEm(VIRGEM);
    virarFrame();

    expect(primeiraNaoLida(VIRGEM)).toBe(nova);
  });
});
