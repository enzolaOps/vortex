import { describe, expect, it } from "vitest";

import { presencaDe, toPresence } from "./map";

/**
 * A presença sai de DOIS campos do protocolo, e usar só um punha a member
 * list inteira em offline.
 *
 * ⚠ **O defeito foi relatado por quem usa e reproduzido contra a instância
 * local**: o servidor respondia `{"username":"auditor9018","online":true}` e a
 * coluna listava a pessoa em OFFLINE — na própria sessão dela. `online` é a
 * CONEXÃO; `status.presence` é o que se ESCOLHEU mostrar, e quem nunca
 * escolheu não tem o campo. Só escapava quem tivesse marcado um status à mão.
 */

describe("presença a partir de conexão e escolha", () => {
  /* O caso do defeito: conectado e sem escolha nenhuma. */
  it("conectado sem status escolhido é ONLINE, não offline", () => {
    expect(presencaDe(true, undefined)).toBe("online");
    expect(presencaDe(true, null)).toBe("online");
  });

  it("a escolha vence quando há conexão", () => {
    expect(presencaDe(true, "Idle")).toBe("idle");
    expect(presencaDe(true, "Busy")).toBe("dnd");
    expect(presencaDe(true, "Focus")).toBe("idle");
    expect(presencaDe(true, "Online")).toBe("online");
  });

  /*
    ⚠ Desconectado VENCE a escolha. Quem marcou "Online" e fechou o app está
    offline, e mostrá-lo aceso mandaria alguém falar com uma parede.
  */
  it("desconectado é offline, mesmo tendo escolhido Online", () => {
    expect(presencaDe(false, "Online")).toBe("offline");
    expect(presencaDe(undefined, "Idle")).toBe("offline");
  });

  /* Invisível não precisa de tratamento: o servidor já reporta `online:false`
     para os outros, que é o ponto de ser invisível. Aqui só não pode acender. */
  it("invisível não acende", () => {
    expect(presencaDe(true, "Invisible")).toBe("offline");
  });

  /*
    `toPresence` continua existindo e continua caindo em offline sem entrada —
    ela traduz um campo SÓ, e há chamadores que só têm esse campo. A diferença
    entre as duas é o que este par de asserções fixa.
  */
  it("`toPresence` sozinha segue defaultando para offline", () => {
    expect(toPresence(undefined)).toBe("offline");
    expect(toPresence("Online")).toBe("online");
  });
});
