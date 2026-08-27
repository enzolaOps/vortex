import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assinarSessao,
  dentro,
  entrando,
  erro,
  esquecerToken,
  fora,
  guardarToken,
  lerSessao,
  lerTokenGuardado,
  limparSessao,
} from "./sessao";

/**
 * A sessão, e o que sobrevive a um armazenamento hostil.
 *
 * O que estes testes guardam é o comportamento em volta da parte que NÃO pode
 * ser testada — `client.login()` não tem servidor a quem perguntar. Tudo em
 * torno dela é exercitável, e é o que decide se a falha do dia vai ser legível
 * ou vai virar uma tela branca.
 */

const guardado = new Map<string, string>();

beforeEach(() => {
  guardado.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  });
  limparSessao();
});

describe("estado da sessão", () => {
  it("começa DESCONHECIDA, não 'fora'", () => {
    /*
      A diferença que evita o flash. A pergunta ao armazenamento acontece no
      efeito, depois do primeiro render — começar em "fora" mostraria a tela de
      login por um frame em toda abertura de quem já está logado, que é a
      maioria das aberturas.
    */
    expect(lerSessao().estado).toBe("desconhecida");
  });

  it("o getter devolve a MESMA referência — armadilha nº 1", () => {
    dentro("eu");
    expect(lerSessao()).toBe(lerSessao());
  });

  it("avisa quem assina, e para de avisar depois de cancelar", () => {
    const ouvinte = vi.fn();
    const parar = assinarSessao(ouvinte);
    entrando();
    expect(ouvinte).toHaveBeenCalledTimes(1);
    parar();
    fora();
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it("erro carrega o motivo; sair o descarta", () => {
    erro("E-mail ou senha incorretos.");
    expect(lerSessao().motivo).toBe("E-mail ou senha incorretos.");
    // Sem isto, a tela de login mostraria o erro da tentativa anterior ao
    // reabrir — acusando de senha errada quem nem digitou ainda.
    fora();
    expect(lerSessao().motivo).toBeUndefined();
  });
});

describe("token guardado", () => {
  const bom = { _id: "s1", token: "t", user_id: "u" };

  it("guarda e devolve", () => {
    guardarToken(bom);
    expect(lerTokenGuardado()).toEqual(bom);
    esquecerToken();
    expect(lerTokenGuardado()).toBeUndefined();
  });

  it("JSON corrompido vira ausência, não exceção", () => {
    // Meia escrita, versão antiga, alguém mexendo no console. Sessão ilegível
    // é sessão inexistente: a resposta certa é pedir login, não quebrar a
    // abertura do app.
    guardado.set("vortex.sessao", "{ isto não é json");
    expect(lerTokenGuardado()).toBeUndefined();
  });

  it("JSON válido com forma errada também vira ausência", () => {
    // O caso mais traiçoeiro: parseia, e aí um `token` `undefined` viajaria
    // para o SDK como se fosse credencial.
    guardado.set("vortex.sessao", JSON.stringify({ _id: "s1" }));
    expect(lerTokenGuardado()).toBeUndefined();
  });

  it("armazenamento bloqueado não derruba nada", () => {
    // Aba anônima, política de privacidade do navegador. Ler devolve nada e
    // guardar falha em silêncio: a sessão desta aba continua viva, e o que se
    // perde é só a comodidade de não digitar de novo amanhã.
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(lerTokenGuardado()).toBeUndefined();
    expect(() => guardarToken(bom)).not.toThrow();
    expect(() => esquecerToken()).not.toThrow();
  });
});
