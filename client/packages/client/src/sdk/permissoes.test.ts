import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import { channelMessageIds, messages } from "./adapter";
import { client } from "./client";

/**
 * Permissão que muda tem que chegar nas linhas que estão na tela.
 *
 * Este teste existe porque a resposta que eu havia escrito para o problema
 * estava errada. A nota em `permissoes.ts` dizia "o adapter republica o canal",
 * e republicar o canal troca o array de IDs — o que acorda a LISTA e mais
 * ninguém: `MessageRow` é `memo` com a mesma prop `id`.
 *
 * O sintoma seria o botão de fixar continuar aparecendo depois de a pessoa
 * perder o cargo, sem nada falhar. O que o teste guarda é a identidade do
 * snapshot: é ela que o `useSyncExternalStore` compara.
 */

const pendentes: FrameRequestCallback[] = [];

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  await seed(30);
  pendentes.splice(0, pendentes.length).forEach((cb) => cb(0));
});

describe("mudança de permissão", () => {
  it("troca o snapshot de quem está na tela", () => {
    const ids = channelMessageIds.peek(CHANNEL_ID) ?? [];
    const visivel = ids[0]!;
    const parar = messages.subscriber(visivel)(() => {});

    const antes = messages.getSnapshot(visivel);
    expect(antes).toBeDefined();

    const servidor = client.servers.toList()[0]!;
    client.emit("serverRoleUpdate", servidor, "cargo", {} as never);

    // Conteúdo igual, OBJETO diferente: é o que o `Object.is` do
    // `useSyncExternalStore` compara, e é o que faz a linha reperguntar.
    const depois = messages.getSnapshot(visivel);
    expect(depois).not.toBe(antes);
    expect(depois?.content).toBe(antes?.content);
    parar();
  });

  it("NÃO mexe em quem ninguém está assinando", () => {
    /*
      A economia que torna isto viável. Num histórico de dez mil, quem está na
      tela são algumas dezenas — varrer o canal inteiro seria pagar por
      milhares de linhas que ninguém vê, a cada edição de cargo.
    */
    const ids = channelMessageIds.peek(CHANNEL_ID) ?? [];
    const naoAssinado = ids.at(-1)!;
    expect(messages.getSnapshot(naoAssinado)).toBeUndefined();

    const servidor = client.servers.toList()[0]!;
    client.emit("serverRoleUpdate", servidor, "cargo", {} as never);

    expect(messages.getSnapshot(naoAssinado)).toBeUndefined();
  });
});
