import { describe, expect, it } from "vitest";

import { calcularLayout } from "./agrupamento";
import { toSistema } from "./map";
import type { Message } from "stoat.js";

/**
 * Linha de sistema.
 *
 * Duas regras, e nenhuma das duas é visível olhando a tela por cima.
 *
 * A tradução é coberta pelo tipo: `SistemaSnapshot` é união fechada, então um
 * caso novo do protocolo não compila sem tratamento. O que o tipo NÃO cobre é o
 * agrupamento — e ali mora a armadilha.
 */

const AGORA = new Date("2026-08-26T15:00:00").getTime();
const ANA = "01JQ0000000000000001000001";
const BRUNO = "01JQ0000000000000001000002";

describe("agrupamento com linha de sistema", () => {
  /**
   * O caso que motiva a regra inteira.
   *
   * `user_joined` carrega o `authorId` da própria pessoa que entrou. Alguém
   * entra e fala em seguida — o caso mais comum que existe — e `mudouDeAutor`
   * é FALSO. Sem a regra, a fala se agruparia sob o evento: a mensagem
   * apareceria sem nome, logo abaixo de "Ana entrou no canal", parecendo que o
   * sistema falou.
   */
  it("a fala DEPOIS de um evento da mesma pessoa abre grupo", () => {
    const evento = { authorId: ANA, createdAt: AGORA, ehSistema: true };
    const fala = { authorId: ANA, createdAt: AGORA + 1000 };

    // A prova de que o teste não é vácuo: sem a marca de sistema, este mesmo
    // par agruparia — mesmo autor, mesmo dia, dentro da janela.
    expect(
      calcularLayout(fala, { authorId: ANA, createdAt: AGORA }, AGORA).iniciaGrupo,
    ).toBe(false);

    expect(calcularLayout(fala, evento, AGORA).iniciaGrupo).toBe(true);
  });

  it("o evento nunca continua a fala de quem o disparou", () => {
    const fala = { authorId: ANA, createdAt: AGORA };
    const evento = { authorId: ANA, createdAt: AGORA + 1000, ehSistema: true };

    expect(calcularLayout(evento, fala, AGORA).iniciaGrupo).toBe(true);
  });

  it("dois eventos seguidos não se agrupam entre si", () => {
    const a = { authorId: ANA, createdAt: AGORA, ehSistema: true };
    const b = { authorId: ANA, createdAt: AGORA + 1000, ehSistema: true };

    expect(calcularLayout(b, a, AGORA).iniciaGrupo).toBe(true);
  });

  /**
   * A regra nova não pode ter comido as antigas: é `||`, não substituição.
   */
  it("fala normal continua agrupando como antes", () => {
    const anterior = { authorId: ANA, createdAt: AGORA };

    expect(
      calcularLayout({ authorId: ANA, createdAt: AGORA + 1000 }, anterior, AGORA)
        .iniciaGrupo,
    ).toBe(false);

    expect(
      calcularLayout({ authorId: BRUNO, createdAt: AGORA + 1000 }, anterior, AGORA)
        .iniciaGrupo,
    ).toBe(true);
  });

  /**
   * O divisor de data continua sendo do DIA, não do tipo de linha.
   *
   * Um evento na virada da meia-noite precisa abrir o divisor igual a uma
   * mensagem — senão o histórico ganha um dia sem cabeçalho sempre que o
   * primeiro registro depois da meia-noite for alguém entrando.
   */
  it("evento na virada do dia abre o divisor", () => {
    const ontem = new Date("2026-08-25T23:59:00").getTime();
    const hoje = new Date("2026-08-26T00:01:00").getTime();

    const layout = calcularLayout(
      { authorId: ANA, createdAt: hoje, ehSistema: true },
      { authorId: ANA, createdAt: ontem },
      AGORA,
    );

    expect(layout.dia).toBe("Hoje");
    expect(layout.iniciaGrupo).toBe(true);
  });
});


/**
 * A tradução de `call_started`.
 *
 * ⚠ **Ela caía no `default` do `toSistema` e virava `{tipo:"texto"}` com a
 * frase pronta — descartando `byId`, `startedAt` e `finishedAt`.** Num canal
 * de voz é a única linha que existe, e quem usa mandou a captura: nove
 * "iniciou uma chamada" idênticos, sem sujeito, sem duração, sem saber se a
 * chamada ainda estava de pé.
 *
 * Estas asserções guardam as DUAS faces, e é a distinção entre elas que a
 * linha desenha: `finishedAt` nulo é a chamada acontecendo AGORA — a que ganha
 * "Entrar na chamada" —; com valor, é a encerrada, que mostra quanto durou.
 */
function chamadaFalsa(inicio: number, fim: number | null): Message {
  return {
    systemMessage: {
      type: "call_started",
      byId: "01JQ0000000000000001000009",
      startedAt: new Date(inicio),
      finishedAt: fim === null ? null : new Date(fim),
    },
  } as unknown as Message;
}

describe("tradução de call_started", () => {
  it("chamada DE PÉ não tem duração — e é isso que a marca como viva", () => {
    const s = toSistema(chamadaFalsa(AGORA, null));
    expect(s).toEqual({
      tipo: "chamada",
      porId: "01JQ0000000000000001000009",
      duracaoTexto: undefined,
    });
  });

  it("chamada encerrada traz quem iniciou E quanto durou", () => {
    const s = toSistema(chamadaFalsa(AGORA, AGORA + 12 * 60_000));
    expect(s).toEqual({
      tipo: "chamada",
      porId: "01JQ0000000000000001000009",
      duracaoTexto: "12 min",
    });
  });

  /*
    ⚠ **A regressão que estas linhas existem para impedir.** O sujeito era o
    que faltava, e uma volta ao `default` produziria `{tipo:"texto"}` sem
    `porId` — exatamente a tela que foi relatada.
  */
  it("nunca volta a ser texto solto", () => {
    const s = toSistema(chamadaFalsa(AGORA, null));
    expect(s?.tipo).toBe("chamada");
    expect(s).not.toHaveProperty("texto");
  });

  /*
    O relógio do servidor pode voltar atrás. A linha tem de dizer algo, e
    "0 s" é o que `duracaoCurta` garante — nunca uma duração negativa.
  */
  it("fim antes do início não produz duração negativa", () => {
    const s = toSistema(chamadaFalsa(AGORA, AGORA - 5_000));
    expect(s).toMatchObject({ tipo: "chamada", duracaoTexto: "0 s" });
  });
});
