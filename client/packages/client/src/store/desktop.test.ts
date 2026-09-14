import { describe, expect, it } from "vitest";

import { desktopDaLeitura, pendentesDeReinicio } from "./desktop";

describe("leitura das preferências da casca", () => {
  it("o que a casca manda vale, e o que falta cai no padrão", () => {
    const d = desktopDaLeitura({ iniciarComSistema: true, aoFechar: "perguntar" });
    expect(d.naCasca).toBe(true);
    expect(d.iniciarComSistema).toBe(true);
    expect(d.aoFechar).toBe("perguntar");
    expect(d.minimizarParaBandeja).toBe(true);
  });

  /* Casca antiga, ou conteúdo que não devia estar ali: não pode quebrar a tela. */
  it("tipo errado e valor fora da união caem no padrão", () => {
    const d = desktopDaLeitura({ barraNativa: "sim", aoFechar: "explodir" });
    expect(d.barraNativa).toBe(false);
    expect(d.aoFechar).toBe("bandeja");
  });

  /* A casca não pode declarar o próprio `naCasca` nem vazar chave desconhecida. */
  it("ignora chave desconhecida e não deixa a casca escrever `naCasca`", () => {
    const d = desktopDaLeitura({ naCasca: false, customFrame: false }) as Record<string, unknown>;
    expect(d.naCasca).toBe(true);
    expect("customFrame" in d).toBe(false);
  });

  /*
    ⚠ O caso que deixaria a janela sem controle: a pessoa marcou a barra
    nativa, a janela desta sessão ainda é sem moldura. A barra custom tem de
    continuar — ela desenha pelo EM USO.
  */
  it("o em uso vem da casca, e não da preferência", () => {
    const d = desktopDaLeitura({ barraNativa: true, barraNativaEmUso: false });
    expect(d.barraNativa).toBe(true);
    expect(d.barraNativaEmUso).toBe(false);
  });

  it("casca que não manda o em uso: em uso = preferência", () => {
    const d = desktopDaLeitura({ aceleracaoDeHardware: false });
    expect(d.aceleracaoEmUso).toBe(false);
    expect(d.barraNativaEmUso).toBe(false);
  });
});

describe("aviso de reinício", () => {
  it("aparece pela diferença entre o gravado e o em uso", () => {
    const base = desktopDaLeitura({});
    expect(pendentesDeReinicio(base)).toEqual([]);
    expect(pendentesDeReinicio({ ...base, aceleracaoDeHardware: false })).toEqual(["aceleracao"]);
    expect(pendentesDeReinicio({ ...base, barraNativa: true })).toEqual(["barra"]);
  });

  /* Desligar e religar volta ao que está rodando: pedir reinício seria mentir. */
  it("some quando a escolha volta ao que está rodando", () => {
    const d = desktopDaLeitura({ aceleracaoDeHardware: false, aceleracaoEmUso: false });
    expect(pendentesDeReinicio(d)).toEqual([]);
  });
});
