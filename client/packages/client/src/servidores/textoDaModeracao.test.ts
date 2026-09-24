import { describe, expect, it } from "vitest";

import {
  avisoDeCastigo,
  DURACOES_DE_CASTIGO,
  entrouHa,
  idCurto,
  terminoDoCastigo,
} from "./textoDaModeracao";

/* Hora LOCAL de propósito: hoje/amanhã são de calendário de quem lê. */
const agora = new Date(2026, 8, 21, 15, 40).getTime(); // 21/09, 15:40

describe("terminoDoCastigo", () => {
  it("as seis durações do design, na grafia do design", () => {
    const textos = DURACOES_DE_CASTIGO.map((d) => terminoDoCastigo(agora, d.minutos));
    expect(textos).toEqual([
      "em 1 minuto",
      "em 5 minutos",
      "hoje às 16:40",
      "amanhã às 15:40",
      "em 28 de setembro",
      "em 19 de outubro",
    ]);
  });

  it("hoje/amanhã são de CALENDÁRIO, não de 24 h", () => {
    const tarde = new Date(2026, 8, 21, 23, 30).getTime();
    expect(terminoDoCastigo(tarde, 60)).toBe("amanhã às 00:30");
  });

  it("põe o ano quando ele muda", () => {
    const dezembro = new Date(2026, 11, 20, 10, 0).getTime();
    expect(terminoDoCastigo(dezembro, 40_320)).toBe("em 17 de janeiro de 2027");
  });
});

describe("entrouHa", () => {
  const dia = 86_400_000;
  it("ausência continua ausência", () => {
    expect(entrouHa(undefined, agora)).toBeUndefined();
  });
  it("dias, meses e anos", () => {
    expect(entrouHa(agora - 60_000, agora)).toBe("entrou hoje");
    expect(entrouHa(agora - dia, agora)).toBe("entrou ontem");
    expect(entrouHa(agora - 3 * dia, agora)).toBe("entrou há 3 dias");
    expect(entrouHa(agora - 45 * dia, agora)).toBe("entrou há 1 mês");
    expect(entrouHa(agora - 200 * dia, agora)).toBe("entrou há 6 meses");
    expect(entrouHa(agora - 800 * dia, agora)).toBe("entrou há 2 anos");
  });
});

describe("idCurto", () => {
  it("três na frente, quatro atrás, como o design", () => {
    expect(idCurto("01J9124ABCDEFGHJKMNP4471")).toBe("01J…4471");
  });
  it("ID curto não vira reticência", () => {
    expect(idCurto("abc")).toBe("abc");
  });
});

describe("avisoDeCastigo", () => {
  it("diz onde, até quando e por quê", () => {
    expect(
      avisoDeCastigo({ servidor: "Vortex", termino: "hoje às 16:40", motivo: " spam " }),
    ).toBe("Você está de castigo em **Vortex**. O castigo termina hoje às 16:40.\nMotivo: spam");
  });
  it("sem motivo, sem a linha de motivo", () => {
    expect(
      avisoDeCastigo({ servidor: "Vortex", termino: "em 5 minutos", motivo: "  " }),
    ).toBe("Você está de castigo em **Vortex**. O castigo termina em 5 minutos.");
  });
});
