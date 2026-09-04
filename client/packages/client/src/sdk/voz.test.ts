import { beforeEach, describe, expect, it, vi } from "vitest";

import { seed } from "../dev/firehose";
import { semearVoz, vozPorCanal } from "./adapter";
import { client } from "./client";

/**
 * A sala de voz.
 *
 * O que estas asserções protegem não é "aparece na tela" — é a diferença entre
 * SALA e CHAMADA. Uma chamada só existe depois que alguém liga; uma sala tem
 * gente dentro e isso é visível antes de entrar. O protocolo sempre entregou
 * isso (`Ready.voice_states` no login); o cliente é que ignorava.
 *
 * E há uma armadilha própria: o SDK **não emite evento** de voz. Os handlers
 * de `VoiceChannelJoin`, `VoiceChannelLeave` e `UserVoiceStateUpdate` mutam o
 * `ReactiveMap` e trazem `// todo: event` no lugar do `client.emit`. A única
 * superfície de observação é a reatividade Solid — se o `createEffect` do
 * adapter parar de ler os acessores certos, a sala congela no estado de quando
 * a página carregou, sem erro nenhum.
 */

const VOZ_GERAL = "01JQ0000000000000000000012";
const VOZ_JOGOS = "01JQ0000000000000000000013";
const VOZ_VAZIA = "01JQ0000000000000000000014";

const pendentes: FrameRequestCallback[] = [];

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
});

/** Assinar é o que faz o store existir — ele não guarda o que ninguém observa. */
function assinar(channelId: string) {
  const notificado = vi.fn();
  vozPorCanal.subscriber(channelId)(notificado);
  return notificado;
}

describe("sala de voz", () => {
  beforeEach(async () => {
    await seed(4);
  });

  it("a sala vem ocupada da semeadura, sem ninguém ter entrado", () => {
    assinar(VOZ_GERAL);
    const dentro = vozPorCanal.peek(VOZ_GERAL) ?? [];

    // É a asserção que separa sala de chamada: ninguém chamou nada, e há
    // gente lá dentro.
    expect(dentro.length).toBe(2);
    expect(dentro.every((p) => p.userId.startsWith("01JQ"))).toBe(true);
  });

  it("sala vazia publica lista vazia, não ausência", () => {
    assinar(VOZ_VAZIA);
    expect(vozPorCanal.peek(VOZ_VAZIA)).toEqual([]);
  });

  it("ordena por chegada, não por nome", () => {
    assinar(VOZ_JOGOS);
    const dentro = vozPorCanal.peek(VOZ_JOGOS) ?? [];
    expect(dentro.length).toBeGreaterThan(1);

    const desde = dentro.map((p) => p.desde);
    expect(desde).toEqual([...desde].sort((a, b) => a - b));
  });

  it("tela e câmera chegam ao domínio", () => {
    assinar(VOZ_GERAL);
    assinar(VOZ_JOGOS);

    const geral = vozPorCanal.peek(VOZ_GERAL) ?? [];
    const jogos = vozPorCanal.peek(VOZ_JOGOS) ?? [];

    expect(geral.some((p) => p.estado === "tela")).toBe(true);
    expect(jogos.some((p) => p.estado === "video")).toBe(true);
    // E o caso comum continua sendo "só ouvindo".
    expect(jogos.some((p) => p.estado === "voz")).toBe(true);
  });

  /**
   * A armadilha do `// todo: event`.
   *
   * Se o efeito do adapter lesse `isCamera()` fora do escopo reativo, a sala
   * publicaria uma vez e nunca mais — e nada falharia. Este teste liga a câmera
   * de quem já está dentro e exige a republicação.
   */
  it("ligar a câmera republica a sala — o efeito lê os acessores", () => {
    const notificado = assinar(VOZ_JOGOS);
    const antes = vozPorCanal.peek(VOZ_JOGOS) ?? [];
    const alvo = antes.find((p) => p.estado === "voz")!;
    expect(alvo).toBeDefined();

    const canal = client.channels.get(VOZ_JOGOS)!;
    canal.voiceParticipants.get(alvo.userId)!.update({ camera: true });

    expect(notificado).toHaveBeenCalled();
    const depois = vozPorCanal.peek(VOZ_JOGOS) ?? [];
    expect(depois.find((p) => p.userId === alvo.userId)?.estado).toBe("video");
  });

  /**
   * Escopo, que é a única coisa que este projeto mede de verdade.
   *
   * Entrar na sala A não pode acordar a linha da sala B. Sem isto, um servidor
   * com vinte canais de voz repintaria a coluna inteira a cada entrada.
   */
  it("entrar numa sala não acorda a outra", () => {
    const naJogos = assinar(VOZ_JOGOS);
    assinar(VOZ_GERAL);
    naJogos.mockClear();

    semearVoz(VOZ_GERAL, [
      { userId: "01JQ0000000000000001000039", desde: 1700000999000 },
    ]);

    expect((vozPorCanal.peek(VOZ_GERAL) ?? []).length).toBe(3);
    expect(naJogos).not.toHaveBeenCalled();
  });
});
