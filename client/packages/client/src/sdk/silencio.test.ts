import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import { channels } from "./adapter";
import { client } from "./client";
import { alternarSilencio, limparSilencio } from "../store/silencio";

/**
 * Silenciar é decisão do CLIENTE, e o SDK diz isso na forma da API.
 *
 * Não há escrita para silenciar: `channel.muted` é uma pergunta que o app
 * responde, via a opção `channelIsMuted`. O que estes testes guardam é a
 * cadeia inteira — store local → opção do SDK → `channel.muted` → snapshot —,
 * porque ela tem três elos e cada um falha calado.
 */

const pendentes: FrameRequestCallback[] = [];

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  limparSilencio();
  await seed(10);
  pendentes.splice(0, pendentes.length).forEach((cb) => cb(0));
});

describe("silenciar canal", () => {
  it("o SDK consulta o store: `channel.muted` acompanha", () => {
    // O elo do meio, isolado. Se este falhar, a opção não chegou ao cliente.
    const canal = client.channels.get(CHANNEL_ID)!;
    expect(canal.muted).toBe(false);

    alternarSilencio(CHANNEL_ID);
    expect(canal.muted).toBe(true);
  });

  it("o snapshot acompanha, para quem está assinando", () => {
    /*
      O último elo. O store muda, mas o snapshot só é reconstruído quando
      alguém o reemite — sem a subscrição no adapter, silenciar não mudaria
      nada na tela até o canal ser tocado por outro motivo.
    */
    const parar = channels.subscriber(CHANNEL_ID)(() => {});
    expect(channels.getSnapshot(CHANNEL_ID)?.silenciado).toBe(false);

    alternarSilencio(CHANNEL_ID);
    expect(channels.getSnapshot(CHANNEL_ID)?.silenciado).toBe(true);

    alternarSilencio(CHANNEL_ID);
    expect(channels.getSnapshot(CHANNEL_ID)?.silenciado).toBe(false);
    parar();
  });
});
