import { beforeEach, describe, expect, it } from "vitest";

import { motivoDoErro } from "./erros";
import {
  dispensarToast,
  lerToasts,
  toast,
} from "../components/ui/toastStore";

/**
 * O 429 do Revolt, e por que ele chegava como "verifique sua conexão".
 *
 * ⚠ **Relatado com captura de tela:** mudar os pronomes e salvar devolvia cinco
 * toasts dizendo *"Não deu para salvar o perfil. Sem resposta do servidor."* —
 * e o servidor tinha respondido. Medido contra a instância local: o SEGUNDO
 * `PATCH /users/@me` seguido já devolve **429**, com `retry_after` entre 3,4 e
 * 9,4 segundos.
 *
 * A causa é a fronteira do SDK. O `stoat-api` faz `throw data` com o TEXTO cru
 * da resposta, sem status e sem envelope; o corpo de um 429 é
 * `{"retry_after": 3434}` e mais nada. Sem `type`, `POR_TIPO` não acha; sem
 * `status`, `porStatus` não acha — e a frase de 429 que já existia era
 * INALCANÇÁVEL por este caminho.
 *
 * Vale para todo o app, não só para o perfil: qualquer ação limitada dizia à
 * pessoa para conferir a internet.
 */

describe("429 chega como limite, não como queda de rede", () => {
  /* O corpo exato que a instância local devolveu, como STRING — que é a forma
     em que o `stoat-api` o lança. */
  it("o corpo cru de um 429 vira aviso de espera, com os segundos", () => {
    expect(motivoDoErro('{"retry_after":3434}')).toBe(
      "Tentativas demais. Espere 4 segundos.",
    );
  });

  it("já parseado dá o mesmo — as duas formas foram vistas no fio", () => {
    expect(motivoDoErro({ retry_after: 9426 })).toBe(
      "Tentativas demais. Espere 10 segundos.",
    );
  });

  /* Arredonda para CIMA: dizer "espere 3" quando faltam 3,4 leva a pessoa a
     clicar cedo e renovar o limite, que é o defeito que a frase evita. */
  it("arredonda para cima, e o singular existe", () => {
    expect(motivoDoErro({ retry_after: 250 })).toBe(
      "Tentativas demais. Espere 1 segundo.",
    );
  });

  /*
    ⚠ O fallback de rede continua existindo e continua certo para o que ele
    descreve. Trocar um diagnóstico errado por outro seria o mesmo defeito com
    outra roupa.
  */
  it("erro sem nada dentro continua sendo falha de rede", () => {
    expect(motivoDoErro(new Error("boom"))).toBe(
      "Sem resposta do servidor. Verifique sua conexão.",
    );
    expect(motivoDoErro("<html>502</html>")).toBe(
      "Sem resposta do servidor. Verifique sua conexão.",
    );
  });

  it("`retry_after` zero ou negativo não é espera", () => {
    expect(motivoDoErro({ retry_after: 0 })).toBe(
      "Sem resposta do servidor. Verifique sua conexão.",
    );
  });

  /* O `type` continua ganhando: ele é mais específico que qualquer heurística. */
  it("um corpo com `type` continua sendo traduzido por ele", () => {
    expect(motivoDoErro({ type: "InvalidCredentials" })).toBe(
      "E-mail ou senha incorretos.",
    );
  });
});

describe("aviso repetido conta em vez de empilhar", () => {
  /*
    O store é module-level e não tem `limpar` — de propósito: quem o zera em
    produção é dispensar, e um atalho só para teste seria superfície pública
    que o app não usa. Dispensar um a um é o mesmo caminho de quem fecha.
  */
  beforeEach(() => {
    for (const t of [...lerToasts()]) dispensarToast(t.id);
  });

  /*
    ⚠ **O outro metade do relato: CINCO toasts idênticos no canto.** Erro não
    expira (decisão registrada) e é isento do corte de pilha, então cada
    tentativa deixava mais uma cópia da mesma frase.
  */
  it("o mesmo aviso duas vezes é um toast com 2×", () => {
    toast({ tipo: "erro", titulo: "Não deu para salvar o perfil." });
    toast({ tipo: "erro", titulo: "Não deu para salvar o perfil." });

    const t = lerToasts();
    expect(t).toHaveLength(1);
    expect(t[0]?.repeticoes).toBe(2);
  });

  it("cinco tentativas dão UM toast contando cinco", () => {
    for (let i = 0; i < 5; i++) {
      toast({
        tipo: "erro",
        titulo: "Não deu para salvar o perfil.",
        descricao: "Tentativas demais. Espere 4 segundos.",
      });
    }
    const t = lerToasts();
    expect(t).toHaveLength(1);
    expect(t[0]?.repeticoes).toBe(5);
  });

  /* Avisos DIFERENTES continuam sendo dois — colapsar por tipo esconderia
     notícia. */
  it("avisos diferentes não se fundem", () => {
    toast({ tipo: "erro", titulo: "Um" });
    toast({ tipo: "erro", titulo: "Outro" });
    expect(lerToasts()).toHaveLength(2);
  });

  /* A descrição faz parte da identidade: mesma ação, motivo diferente, é
     notícia nova. */
  it("mesmo título com descrição diferente não se funde", () => {
    toast({ tipo: "erro", titulo: "Falhou", descricao: "429" });
    toast({ tipo: "erro", titulo: "Falhou", descricao: "500" });
    expect(lerToasts()).toHaveLength(2);
  });

  /* A primeira aparição não carrega contador — "1×" em todo toast do app
     seria ruído. */
  it("uma vez só não tem contador", () => {
    toast({ tipo: "info", titulo: "Pronto" });
    expect(lerToasts()[0]?.repeticoes).toBeUndefined();
  });
});
