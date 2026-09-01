import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import { client } from "./client";
import {
  configurarSimulacaoDeEnvio,
  definirUsuarioLocal,
  enviarMensagem,
  reenviar,
} from "./adapter";

/**
 * Responder mencionando, ou não.
 *
 * ⚠ **Até agora TODA resposta ia com `mention: false`**, e o comentário do
 * adapter dizia por quê: enquanto "Responder sem mencionar" não existisse, o
 * inverso transformaria toda resposta numa menção que ninguém pediu. A escolha
 * existe agora, e o padrão passou a ser notificar — que é o que "Responder"
 * significa para quem clica.
 *
 * O que estes testes guardam não é o corpo do POST em si: é que a escolha
 * SOBREVIVE ao caminho de reenvio. `replyIds` do objeto local é uma lista de
 * IDs — o protocolo não guarda `mention` na mensagem —, então quem
 * reconstruísse a resposta a partir dele perderia a decisão em silêncio, e o
 * sintoma seria uma menção chegando a quem tinha sido poupado dela.
 */

const AUTOR = "01JQ0000000000000001000000";
const ALVO = "01JQ0000000000000009000000";

const pendentes: FrameRequestCallback[] = [];

/** O que o SDK recebeu no último `sendMessage`. */
let enviados: { replies?: { id: string; mention: boolean }[] }[] = [];
/** Faz o próximo `sendMessage` rejeitar, para exercitar o caminho de falha. */
let falharUmaVez = false;

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  await seed(4);
  definirUsuarioLocal(AUTOR);

  /*
    A simulação SUBSTITUI o POST — ver `SimulacaoDeEnvio`. Para observar o
    corpo é preciso desligá-la e espiar o SDK.
  */
  configurarSimulacaoDeEnvio({ ativa: false });

  enviados = [];
  falharUmaVez = false;
  const canal = client.channels.get(CHANNEL_ID);
  if (canal !== undefined) {
    vi.spyOn(canal, "sendMessage").mockImplementation((corpo: unknown) => {
      enviados.push(corpo as (typeof enviados)[number]);
      if (falharUmaVez) {
        falharUmaVez = false;
        return Promise.reject(new Error("rede caiu"));
      }
      return Promise.resolve({} as never);
    });
  }
});

afterEach(() => {
  configurarSimulacaoDeEnvio({ ativa: true, falhar: false });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  pendentes.length = 0;
});

/** O `postar` é assíncrono; uma volta na fila de microtarefas basta. */
const assentar = () => new Promise((r) => setTimeout(r, 0));

describe("mencionar ao responder", () => {
  it("o padrão NOTIFICA — é o que 'Responder' quer dizer", async () => {
    enviarMensagem(CHANNEL_ID, "oi", { id: ALVO, mencionar: true });
    await assentar();

    expect(enviados[0]?.replies).toEqual([{ id: ALVO, mention: true }]);
  });

  it("'sem mencionar' não notifica", async () => {
    enviarMensagem(CHANNEL_ID, "oi", { id: ALVO, mencionar: false });
    await assentar();

    expect(enviados[0]?.replies).toEqual([{ id: ALVO, mention: false }]);
  });

  /*
    ⚠ **O teste que justifica o mapa `respostasPendentes`.** Sem ele, o
    reenvio lê `replyIds` do objeto local — só IDs — e assume o padrão, ou
    seja manda a menção que a pessoa tinha recusado. Nada falha, nada avisa: a
    linha fica verde e alguém é notificado sem ter sido mencionado.
  */
  it("o reenvio PRESERVA a escolha de não mencionar", async () => {
    /* Falha de verdade, pelo caminho real: o POST rejeita e `postar` marca
       `failed`. Marcar o estado à mão exigiria um export só para teste. */
    falharUmaVez = true;
    const id = enviarMensagem(CHANNEL_ID, "oi", {
      id: ALVO,
      mencionar: false,
    });
    expect(id).toBeDefined();
    await assentar();
    expect(enviados).toHaveLength(1);

    enviados = [];
    reenviar(id!);
    await assentar();

    expect(enviados[0]?.replies).toEqual([{ id: ALVO, mention: false }]);
  });

  it("mensagem sem resposta não manda `replies`", async () => {
    enviarMensagem(CHANNEL_ID, "solta");
    await assentar();

    expect(enviados[0]?.replies).toBeUndefined();
  });
});
