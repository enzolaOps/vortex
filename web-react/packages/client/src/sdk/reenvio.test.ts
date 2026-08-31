import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import {
  configurarSimulacaoDeEnvio,
  definirUsuarioLocal,
  enviarMensagem,
  messages,
  reenviar,
} from "./adapter";

/**
 * Reenviar uma mensagem que falhou.
 *
 * O design system exige que erro diga o que aconteceu **e como resolver**. A
 * linha falhada dizia "não enviada" — só a primeira metade — e a segunda não
 * existia em lugar nenhum do app: a mensagem ficava vermelha para sempre.
 *
 * O que estes testes protegem não é o botão, é a propriedade que o torna
 * correto: reenviar mantém o ID, e portanto o LUGAR da mensagem no histórico.
 * Recriar produziria ID novo e a linha saltaria para o fim, longe de onde a
 * pessoa a escreveu — e nada falharia.
 */

const AUTOR = "01JQ0000000000000001000000";

const pendentes: FrameRequestCallback[] = [];

beforeEach(async () => {
  // O adapter coalesce publicação por rAF, que não existe em Node. Fila
  // manual, drenada por `virarFrame` — o mesmo padrão de `lateral.test.ts`,
  // e pela mesma razão de lá: trocar a fila entre testes dessincroniza o
  // `flushHandle` module-level do adapter.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  vi.useFakeTimers();
  await seed(4);
  definirUsuarioLocal(AUTOR);
});

afterEach(() => {
  configurarSimulacaoDeEnvio({ ativa: true, falhar: false });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function virarFrame() {
  const fila = pendentes.splice(0, pendentes.length);
  for (const cb of fila) cb(0);
}

/** Assinar é o que faz o snapshot existir. */
function assinar(id: string) {
  const notificado = vi.fn();
  messages.subscriber(id)(notificado);
  return notificado;
}

describe("reenvio", () => {
  it("falha, reenvia, e a mensagem chega — com o MESMO id", () => {
    configurarSimulacaoDeEnvio({ ativa: true, falhar: true });

    const id = enviarMensagem(CHANNEL_ID, "vai falhar")!;
    expect(id).toBeDefined();
    assinar(id);

    expect(messages.peek(id)?.sendState).toBe("pending");
    vi.runAllTimers();
    virarFrame();
    expect(messages.peek(id)?.sendState).toBe("failed");

    // Agora a rede "volta".
    configurarSimulacaoDeEnvio({ ativa: true, falhar: false });
    reenviar(id);

    // Volta a pendente NA HORA: sem isto, clicar em "Tentar de novo" não daria
    // sinal nenhum até a resposta chegar, e a pessoa clicaria de novo.
    expect(messages.peek(id)?.sendState).toBe("pending");

    vi.runAllTimers();
    virarFrame();
    expect(messages.peek(id)?.sendState).toBe("sent");

    // O ID não mudou — é o que mantém a linha no lugar onde foi escrita.
    expect(messages.peek(id)?.id).toBe(id);
  });

  it("reenviar o que NÃO falhou é no-op", () => {
    const id = enviarMensagem(CHANNEL_ID, "essa vai")!;
    // Assinar ANTES: o store não guarda snapshot de quem ninguém observa, e
    // sem isto o `peek` devolve `undefined` e o teste mediria o nada.
    const notificado = assinar(id);
    vi.runAllTimers();
    virarFrame();
    expect(messages.peek(id)?.sendState).toBe("sent");

    notificado.mockClear();
    reenviar(id);

    // Nem volta a pendente, nem republica: um clique perdido numa linha que
    // já chegou não pode piscar a mensagem de volta para "enviando".
    expect(messages.peek(id)?.sendState).toBe("sent");
    expect(notificado).not.toHaveBeenCalled();
  });

  it("falhar de novo devolve a linha ao estado de erro, não a deixa pendurada", () => {
    configurarSimulacaoDeEnvio({ ativa: true, falhar: true });

    const id = enviarMensagem(CHANNEL_ID, "sem rede mesmo")!;
    assinar(id);
    vi.runAllTimers();
    virarFrame();

    reenviar(id);
    vi.runAllTimers();
    virarFrame();

    // "pending" para sempre é o pior dos três estados: a pessoa não sabe se
    // deve esperar ou tentar de novo.
    expect(messages.peek(id)?.sendState).toBe("failed");
  });
});
