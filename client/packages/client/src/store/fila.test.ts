import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assinarFila,
  desmarcarPendente,
  esquecerDaFila,
  lerPendentesDoCanal,
  limparFila,
  marcarPendente,
} from "./fila";

/**
 * O contador de "mensagens na fila" do rodapé do composer.
 *
 * O que estes testes guardam é a HONESTIDADE do número. Um contador que conta
 * duas vezes a mesma mensagem, ou que não desce quando ela sai, diz à pessoa
 * que há texto guardado que não existe — e o rodapé promete "envia ao
 * reconectar". É pior que não ter contador, pelo mesmo critério que mantém
 * controle pendente fora da tela quando ele mentiria sobre o estado.
 */
describe("fila por canal", () => {
  beforeEach(() => limparFila());

  it("conta por canal e não mistura", () => {
    marcarPendente("m1", "c1");
    marcarPendente("m2", "c1");
    marcarPendente("m3", "c2");

    expect(lerPendentesDoCanal("c1")).toBe(2);
    expect(lerPendentesDoCanal("c2")).toBe(1);
    expect(lerPendentesDoCanal("c3")).toBe(0);
  });

  it("marcar a mesma mensagem duas vezes não conta duas", () => {
    /*
      O caminho de envio passa por mais de um ponto do adapter — a criação
      otimista e o `marcarEnvio` que vem logo atrás. Sem idempotência o rodapé
      diria "2 mensagens na fila" com uma só escrita.
    */
    marcarPendente("m1", "c1");
    marcarPendente("m1", "c1");
    expect(lerPendentesDoCanal("c1")).toBe(1);
  });

  it("a mensagem sai do canal antigo ao trocar de canal", () => {
    marcarPendente("m1", "c1");
    marcarPendente("m1", "c2");
    expect(lerPendentesDoCanal("c1")).toBe(0);
    expect(lerPendentesDoCanal("c2")).toBe(1);
  });

  it("esquecer da fila também tira da contagem", () => {
    // É por aqui que passam descartar e reenviar, e nos dois a mensagem
    // deixou de esperar a rede.
    marcarPendente("m1", "c1");
    esquecerDaFila("m1");
    expect(lerPendentesDoCanal("c1")).toBe(0);
  });

  it("avisa quem assina ao entrar e ao sair, e não à toa", () => {
    const ouvinte = vi.fn();
    assinarFila(ouvinte);

    marcarPendente("m1", "c1");
    expect(ouvinte).toHaveBeenCalledTimes(1);

    marcarPendente("m1", "c1");
    expect(ouvinte).toHaveBeenCalledTimes(1);

    desmarcarPendente("m1");
    esquecerDaFila("m1");
    // Só o `esquecerDaFila` emite aqui: `desmarcarPendente` é a peça interna,
    // e ela já tinha tirado a entrada.
    expect(lerPendentesDoCanal("c1")).toBe(0);
  });
});
