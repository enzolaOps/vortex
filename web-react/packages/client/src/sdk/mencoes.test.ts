import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import { channelMessageIds, proximaMencao } from "./adapter";
import { client } from "./client";

/**
 * Menção como POSIÇÃO, não como contagem.
 *
 * O badge responde "quantas" e nunca vai conseguir responder "onde" — por mais
 * que o número cresça, ele não diz para onde rolar. O protocolo entrega
 * `messageMentionIds`, um CONJUNTO DE IDS, e contar era jogar fora o dado mais
 * útil que chegava pelo fio.
 *
 * Estes testes existem porque a feature nasceu sem dado: `ehMencao` está no
 * adapter desde a fase 3 e NUNCA devolveu `true` no arnês — nenhum corpo
 * gerado continha `<@id>`. Contador implementado, jamais visto. O firehose
 * passou a produzir uma menção a cada 31 mensagens, e é isso que estes testes
 * consomem.
 */

const pendentes: FrameRequestCallback[] = [];

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  await seed(200);
  pendentes.splice(0, pendentes.length).forEach((cb) => cb(0));
});

/**
 * Os IDs que realmente mencionam, lidos do OBJETO DO SDK.
 *
 * Não do store de snapshots: ele é preguiçoso e só materializa quem alguém
 * assinou, então num teste sem componente `getSnapshot` devolve `undefined`
 * para tudo. Foi o que fez a primeira versão deste arquivo achar zero menções
 * num canal que tinha sete.
 */
function mencoesReais(): string[] {
  const ids = channelMessageIds.peek(CHANNEL_ID) ?? [];
  return ids.filter((id) =>
    String(
      (client.messages.get(id) as { content?: string } | undefined)?.content ??
        "",
    ).includes("<@"),
  );
}

describe("próxima menção", () => {
  it("o arnês produz menções — sem isto o resto não testa nada", () => {
    // Guarda a própria premissa. A versão anterior deste arquivo passava
    // afirmando `undefined`, e passava porque não havia menção nenhuma.
    expect(mencoesReais().length).toBeGreaterThan(1);
  });

  it("sem posição de partida, vai para a primeira", () => {
    expect(proximaMencao(CHANNEL_ID, undefined)).toBe(mencoesReais()[0]);
  });

  it("avança na ordem da conversa", () => {
    const reais = mencoesReais();
    expect(proximaMencao(CHANNEL_ID, reais[0])).toBe(reais[1]);
    expect(proximaMencao(CHANNEL_ID, reais[1])).toBe(reais[2]);
  });

  it("dá a volta na última", () => {
    /*
      A parte que mais pede teste. Um botão de "próxima" que para de funcionar
      na última obriga a pessoa a rolar de volta ao topo à mão — e quem aperta
      três vezes seguidas quer varrer as três, não descobrir onde acaba a fila.
    */
    const reais = mencoesReais();
    expect(proximaMencao(CHANNEL_ID, reais.at(-1))).toBe(reais[0]);
  });

  it("posição desconhecida recomeça do início", () => {
    // Mensagem apagada, ou ID de outro canal. Devolver `undefined` faria o
    // botão parar de funcionar sem explicação.
    expect(proximaMencao(CHANNEL_ID, "nao-existe")).toBe(mencoesReais()[0]);
  });

  it("canal sem menção não tem destino", () => {
    expect(proximaMencao("canal-vazio", undefined)).toBeUndefined();
  });
});
