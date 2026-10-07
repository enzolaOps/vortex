import { describe, expect, it } from "vitest";

import { quando } from "./quando";

describe("quando", () => {
  const agora = new Date(2026, 8, 14, 15, 0).getTime();
  const em = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();

  it("hoje: relativo no detalhado, hora no curto", () => {
    expect(quando(em(14, 12), agora, "detalhado")).toBe("há 3 h");
    expect(quando(em(14, 14, 50), agora, "detalhado")).toBe("há 10 min");
    expect(quando(agora, agora, "detalhado")).toBe("agora");
    expect(quando(em(14, 9, 14), agora, "curto")).toBe("09:14");
  });

  it("ontem é pelo DIA do calendário, não por 24 horas", () => {
    // 23:30 de ontem são 15h30 atrás e continuam sendo "ontem".
    expect(quando(em(13, 23, 30), agora, "curto")).toBe("ontem");
    expect(quando(em(13, 18, 40), agora, "detalhado")).toBe("ontem 18:40");
  });

  it("até uma semana em dias, depois a data", () => {
    expect(quando(em(12, 10), agora, "curto")).toBe("2 dias");
    expect(quando(em(1, 10), agora, "detalhado")).toBe("01/09");
  });
});
