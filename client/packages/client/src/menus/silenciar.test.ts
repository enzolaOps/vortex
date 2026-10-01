import { describe, expect, it } from "vitest";

import {
  notaDeSilencio,
  relogioDoSilencio,
  restanteDeSilencio,
} from "./silenciar";

const MIN = 60_000;
const AGORA = 1_000_000_000;

describe("restanteDeSilencio", () => {
  it("minutos até 59, horas arredondadas para cima", () => {
    expect(restanteDeSilencio(AGORA + 12 * MIN, AGORA)).toBe("12 min restantes");
    expect(restanteDeSilencio(AGORA + 60 * MIN, AGORA)).toBe("1 h restantes");
    expect(restanteDeSilencio(AGORA + 61 * MIN, AGORA)).toBe("2 h restantes");
  });

  it("sem silêncio, sem prazo ou vencido: nada", () => {
    expect(restanteDeSilencio(undefined, AGORA)).toBeUndefined();
    expect(restanteDeSilencio(Infinity, AGORA)).toBeUndefined();
    expect(restanteDeSilencio(AGORA - 1, AGORA)).toBeUndefined();
  });
});

describe("notaDeSilencio (D-NOTIF-27)", () => {
  it("temporário: quando volta, com o restante", () => {
    expect(notaDeSilencio("canal", AGORA + 7 * 60 * MIN, AGORA)).toBe(
      "Volta a notificar automaticamente · 7 h restantes.",
    );
  });

  it("até reativar: diz que a contagem continua, com o sujeito certo", () => {
    expect(notaDeSilencio("canal", Infinity, AGORA)).toBe(
      "Silenciado até você reativar. O canal continua contando não lidos, sem notificar.",
    );
    expect(notaDeSilencio("servidor", Infinity, AGORA)).toContain(
      "O servidor continua",
    );
  });

  it("sem silêncio ou com prazo vencido: sem nota", () => {
    expect(notaDeSilencio("canal", undefined, AGORA)).toBeUndefined();
    expect(notaDeSilencio("canal", AGORA - MIN, AGORA)).toBeUndefined();
  });
});

describe("relogioDoSilencio", () => {
  it("relógio velho sobe até o início do silêncio", () => {
    const ate = AGORA + 60 * MIN;
    expect(relogioDoSilencio(AGORA - 5 * MIN, ate, 60 * MIN)).toBe(AGORA);
    expect(relogioDoSilencio(AGORA + MIN, ate, 60 * MIN)).toBe(AGORA + MIN);
  });

  it("duração desconhecida (NaN, vinda do protocolo) ou sem prazo: vale o relógio", () => {
    expect(relogioDoSilencio(AGORA, AGORA + MIN, Number.NaN)).toBe(AGORA);
    expect(relogioDoSilencio(AGORA, Infinity, Infinity)).toBe(AGORA);
    expect(relogioDoSilencio(AGORA, undefined, undefined)).toBe(AGORA);
    /* E o rótulo nunca vira "NaN h" — foi o que o arnês mostrou depois de
       um F5, com a primeira versão desta conta. */
    expect(
      restanteDeSilencio(AGORA + 30 * MIN, relogioDoSilencio(AGORA, AGORA + 30 * MIN, Number.NaN)),
    ).toBe("30 min restantes");
  });
});
