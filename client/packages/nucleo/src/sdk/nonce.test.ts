import { beforeEach, describe, expect, it } from "vitest";

import {
  aguardando,
  aguardar,
  desistir,
  limparPendentes,
  pendentes,
  reconciliar,
} from "./nonce";

/**
 * O mapa entre a mensagem otimista e a que o servidor devolve.
 *
 * O briefing chama isto de "a única peça capaz de arruinar a decisão do port",
 * e a razão é concreta: numa lista virtualizada com `getItemKey` por ID de
 * entidade, trocar o ID da linha a desmonta e remonta. A pessoa vê a própria
 * mensagem piscar no instante seguinte ao Enter.
 *
 * Este arquivo testa o mapa isolado, sem SDK e sem rede — que é o único jeito
 * de exercitar hoje um caminho que só a fase 6 vai rodar de verdade.
 */
describe("reconciliação por nonce", () => {
  beforeEach(limparPendentes);

  it("devolve a otimista que corresponde ao nonce", () => {
    aguardar("n1", "local-1", "c1");
    const p = reconciliar("n1", "do-servidor");
    expect(p?.idLocal).toBe("local-1");
    expect(p?.channelId).toBe("c1");
  });

  it("consome: a segunda vez não devolve nada", () => {
    /*
      O servidor REENVIA eventos em reconexão, e a segunda chegada não é erro —
      é o caso normal. Devolver a otimista de novo faria a reconciliação rodar
      duas vezes e registrar um apelido para uma mensagem que já tem o dela.
    */
    aguardar("n1", "local-1", "c1");
    expect(reconciliar("n1", "do-servidor")).toBeDefined();
    expect(reconciliar("n1", "do-servidor")).toBeUndefined();
  });

  it("mensagem de outra pessoa não tem nonce meu", () => {
    aguardar("n1", "local-1", "c1");
    expect(reconciliar("de-outro", "x")).toBeUndefined();
    expect(reconciliar(undefined, "x")).toBeUndefined();
    // E a minha continua esperando.
    expect(aguardando("local-1")).toBe(true);
  });

  it("desistir limpa os DOIS sentidos", () => {
    /*
      O mapa é duplo — por nonce e por ID local — e limpar só um lado é
      vazamento silencioso: o outro cresce para sempre numa sessão de 8h com
      rede instável. É o erro nº 5 do briefing.
    */
    aguardar("n1", "local-1", "c1");
    desistir("local-1");
    expect(pendentes()).toBe(0);
    expect(aguardando("local-1")).toBe(false);
    expect(reconciliar("n1", "do-servidor")).toBeUndefined();
  });

  it("reconciliar também limpa os dois sentidos", () => {
    aguardar("n1", "local-1", "c1");
    reconciliar("n1", "do-servidor");
    expect(pendentes()).toBe(0);
    expect(aguardando("local-1")).toBe(false);
  });

  it("desistir de algo que não espera não quebra nem apaga vizinho", () => {
    aguardar("n1", "local-1", "c1");
    desistir("nunca-existiu");
    expect(pendentes()).toBe(1);
    expect(aguardando("local-1")).toBe(true);
  });

  it("a própria otimista NÃO reconcilia consigo mesma", () => {
    /*
      A otimista carrega o nonce — precisa, é o que vai no POST — e também
      dispara o evento de criação. Sem esta guarda ela era tratada como a
      própria confirmação, e a linha nunca entrava na lista: a pessoa apertava
      Enter e não aparecia nada.
    */
    aguardar("n1", "local-1", "c1");
    expect(reconciliar("n1", "local-1")).toBeUndefined();
    expect(aguardando("local-1")).toBe(true);
  });

  it("várias em voo ao mesmo tempo", () => {
    // Três Enters seguidos com rede lenta é o caso comum, não o exótico.
    aguardar("n1", "l1", "c");
    aguardar("n2", "l2", "c");
    aguardar("n3", "l3", "c");
    expect(pendentes()).toBe(3);

    // Confirmação fora de ordem: o servidor não promete ordem de resposta.
    expect(reconciliar("n2", "do-servidor")?.idLocal).toBe("l2");
    expect(pendentes()).toBe(2);
    expect(aguardando("l1")).toBe(true);
    expect(aguardando("l3")).toBe(true);
  });
});
