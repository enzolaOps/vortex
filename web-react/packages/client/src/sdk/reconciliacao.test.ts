import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import {
  channelMessageIds,
  configurarSimulacaoDeEnvio,
  definirUsuarioLocal,
  enviarMensagem,
  messages,
} from "./adapter";
import { ulid } from "ulid";

import { client } from "./client";
import { limparPendentes } from "./nonce";

/**
 * A confirmação do servidor NÃO pode mexer na lista.
 *
 * É o teste que o briefing pede há três fases sem poder existir: a mensagem
 * otimista tem ID local, a que volta tem ID do servidor, e numa lista
 * virtualizada com `getItemKey` por ID de entidade isso é a chave da linha
 * mudando debaixo do virtualizador — a mensagem pisca no instante seguinte ao
 * Enter, e num histórico longo a âncora vai junto.
 *
 * Sem backend, o caminho de volta é simulado emitindo o evento que o servidor
 * emitiria. É simulação do PROTOCOLO, não do nosso próprio código: o evento
 * carrega ID novo e o mesmo nonce, que é exatamente o que chega pelo fio.
 */

const pendentesDeFrame: FrameRequestCallback[] = [];

function virarFrame() {
  pendentesDeFrame.splice(0, pendentesDeFrame.length).forEach((cb) => cb(0));
}

function ids(): readonly string[] {
  virarFrame();
  return channelMessageIds.peek(CHANNEL_ID) ?? [];
}

/** O que o servidor devolve: ID dele, mesmo nonce, mesmo conteúdo. */
function confirmar(nonce: string, conteudo: string): string {
  /*
    ULID de verdade, e isso não é firula de teste.

    O SDK deriva `createdAt` decodificando o tempo do ID — `new Date(decodeTime(id))`.
    Um ID inventado explode ali, e o erro sai de dentro do `stoat.js` parecendo
    bug do modelo. É o protocolo tendo mais contrato do que "é uma string".
  */
  const idDoServidor = ulid();
  client.messages.getOrCreate(
    idDoServidor,
    {
      _id: idDoServidor,
      channel: CHANNEL_ID,
      author: "01JQ0000000000000001000000",
      content: conteudo,
      nonce,
    },
    true,
  );
  return idDoServidor;
}

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentesDeFrame.push(cb);
    return pendentesDeFrame.length;
  });
  /*
    Só o `setTimeout`, nunca o `requestAnimationFrame`.

    `useFakeTimers()` sem lista substitui o rAF TAMBÉM — e depois do stub
    acima, então o coletor de frames deste arquivo nunca recebia nada e
    `virarFrame()` drenava vazio. O sintoma era a mensagem enviada não
    aparecer na lista, o que parecia bug do código sob teste.
  */
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  limparPendentes();
  await seed(20);
  virarFrame();
  definirUsuarioLocal("01JQ0000000000000001000000");
  configurarSimulacaoDeEnvio({});
});

describe("mensagem otimista confirmada pelo servidor", () => {
  it("a lista NÃO cresce, e a chave da linha não muda", () => {
    const antes = ids();
    const local = enviarMensagem(CHANNEL_ID, "oi")!;

    const comOtimista = ids();
    expect(comOtimista.length).toBe(antes.length + 1);
    expect(comOtimista.at(-1)).toBe(local);

    confirmar(local, "oi");

    const depois = ids();
    // O número exato importa: uma linha a mais seria a mensagem duplicada.
    expect(depois.length).toBe(comOtimista.length);
    // E a chave: se ela virasse o ID do servidor, o virtualizador desmontaria
    // e remontaria a linha.
    expect(depois.at(-1)).toBe(local);
  });

  it("a linha deixa de ser pendente", () => {
    const local = enviarMensagem(CHANNEL_ID, "oi")!;
    // Assinar materializa o snapshot: o store é preguiçoso de propósito.
    const parar = messages.subscriber(local)(() => {});
    expect(messages.getSnapshot(local)?.sendState).toBe("pending");

    confirmar(local, "oi");
    expect(messages.getSnapshot(local)?.sendState).toBe("sent");
    parar();
  });

  it("edição do servidor chega na linha, pelo ID DELE", () => {
    /*
      A metade que quase ficou de fora. Depois da confirmação, quem o servidor
      atualiza é o objeto DELE — e o store lê pela chave LOCAL. Sem resolver o
      apelido na leitura, a linha congelaria no conteúdo do instante do envio
      e nada falharia.
    */
    const local = enviarMensagem(CHANNEL_ID, "oi")!;
    // Assinar materializa o snapshot: o store é preguiçoso de propósito.
    const parar = messages.subscriber(local)(() => {});
    const idDoServidor = confirmar(local, "oi");

    client.messages.updateUnderlyingObject(idDoServidor, {
      content: "oi, editada",
    });

    expect(messages.getSnapshot(local)?.content).toBe("oi, editada");
    parar();
  });

  it("mensagem de outra pessoa entra na lista normalmente", () => {
    // O contrário do primeiro teste: sem nonce meu, é mensagem nova.
    const antes = ids().length;
    confirmar("nonce-de-ninguem", "oi de outro");
    expect(ids().length).toBe(antes + 1);
  });

  it("falha no envio libera o nonce", () => {
    configurarSimulacaoDeEnvio({ falhar: true, latenciaMs: 1 });
    const local = enviarMensagem(CHANNEL_ID, "vai falhar")!;
    vi.advanceTimersByTime(5);

    // Assinar materializa o snapshot: o store é preguiçoso de propósito.
    const parar = messages.subscriber(local)(() => {});
    expect(messages.getSnapshot(local)?.sendState).toBe("failed");
    parar();
  });
});
