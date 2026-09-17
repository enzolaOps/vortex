import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Atualizacao,
  criarAtualizacao,
  validarPedidoDeInstalacao,
} from "./atualizacaoModelo";

function montar(opcoes: { disponivel?: boolean; checarLanca?: boolean } = {}) {
  const emitidos: Atualizacao[] = [];
  const conta = { checagens: 0, instalacoes: 0 };
  const a = criarAtualizacao({
    disponivel: opcoes.disponivel ?? true,
    checar: () => {
      conta.checagens++;
      if (opcoes.checarLanca) throw new Error("sem rede");
    },
    instalar: () => void conta.instalacoes++,
    emitir: (x) => void emitidos.push(x),
  });
  const estados = () => emitidos.map((e) => e.estado);
  return { a, emitidos, conta, estados };
}

describe("ciclo de atualização", () => {
  it("traduz o ciclo normal e carrega a versão até o fim", () => {
    const { a, estados } = montar();
    a.aoEvento({ tipo: "verificando" });
    a.aoEvento({ tipo: "disponivel" });
    a.aoEvento({ tipo: "baixada", versao: "4.2.1" });
    assert.deepEqual(estados(), ["verificando", "baixando", "pronta"]);
    assert.deepEqual(a.estado(), { estado: "pronta", versao: "4.2.1", progresso: 100 });
  });

  it("progresso é 0 fora de pronta — nunca um número inventado", () => {
    const { a } = montar();
    a.aoEvento({ tipo: "disponivel" });
    assert.equal(a.estado().progresso, 0);
  });

  it("pedido comum fora de pronta não faz nada", () => {
    const { a, conta, estados } = montar();
    a.pedirInstalacao({ obrigatoria: false });
    assert.equal(conta.instalacoes, 0);
    assert.equal(conta.checagens, 0);
    assert.deepEqual(estados(), []);
  });

  it("qualquer pedido em pronta instala na hora", () => {
    const { a, conta } = montar();
    a.aoEvento({ tipo: "baixada", versao: "4.2.1" });
    a.pedirInstalacao({ obrigatoria: false });
    assert.equal(conta.instalacoes, 1);
  });

  it("obrigatória sem nada baixado verifica e instala quando baixar", () => {
    const { a, conta, estados } = montar();
    a.pedirInstalacao({ obrigatoria: true });
    assert.equal(conta.checagens, 1);
    assert.equal(conta.instalacoes, 0);
    a.aoEvento({ tipo: "verificando" });
    a.aoEvento({ tipo: "disponivel" });
    a.aoEvento({ tipo: "baixada", versao: "4.3.0" });
    assert.equal(conta.instalacoes, 1);
    assert.equal(estados()[0], "verificando");
  });

  it("obrigatória durante o download não recomeça a verificação", () => {
    const { a, conta } = montar();
    a.aoEvento({ tipo: "disponivel" });
    a.pedirInstalacao({ obrigatoria: true });
    assert.equal(conta.checagens, 0);
    a.aoEvento({ tipo: "baixada", versao: "4.3.0" });
    assert.equal(conta.instalacoes, 1);
  });

  it("erro desarma a instalação pendente", () => {
    const { a, conta } = montar();
    a.pedirInstalacao({ obrigatoria: true });
    a.aoEvento({ tipo: "erro" });
    assert.equal(a.estado().estado, "falhou");
    a.aoEvento({ tipo: "baixada", versao: "4.3.0" });
    assert.equal(conta.instalacoes, 0);
  });

  it("obrigatória sem versão nova no feed é falha, não 'em dia'", () => {
    const { a } = montar();
    a.pedirInstalacao({ obrigatoria: true });
    a.aoEvento({ tipo: "nada" });
    assert.equal(a.estado().estado, "falhou");
  });

  it("sem pedido pendente, nada novo é 'em dia'", () => {
    const { a } = montar();
    a.aoEvento({ tipo: "nada" });
    assert.equal(a.estado().estado, "em-dia");
  });

  it("checagem que lança vira falhou", () => {
    const { a } = montar({ checarLanca: true });
    a.pedirInstalacao({ obrigatoria: true });
    assert.equal(a.estado().estado, "falhou");
  });

  it("obrigatória sem atualizador de pé falha em vez de ficar verificando", () => {
    const { a, conta } = montar({ disponivel: false });
    a.pedirInstalacao({ obrigatoria: true });
    assert.equal(a.estado().estado, "falhou");
    assert.equal(conta.checagens, 0);
  });

  it("tentar de novo depois de falhar volta a verificar", () => {
    const { a, conta } = montar();
    a.aoEvento({ tipo: "erro" });
    a.pedirInstalacao({ obrigatoria: true });
    assert.equal(a.estado().estado, "verificando");
    assert.equal(conta.checagens, 1);
  });
});

describe("validarPedidoDeInstalacao", () => {
  it("sem argumento é o pedido comum", () => {
    assert.deepEqual(validarPedidoDeInstalacao(), { obrigatoria: false });
  });

  it("aceita { obrigatoria: boolean }", () => {
    assert.deepEqual(validarPedidoDeInstalacao({ obrigatoria: true }), { obrigatoria: true });
    assert.deepEqual(validarPedidoDeInstalacao({}), { obrigatoria: false });
  });

  it("recusa qualquer outra forma", () => {
    assert.equal(validarPedidoDeInstalacao("sim"), undefined);
    assert.equal(validarPedidoDeInstalacao(null), undefined);
    assert.equal(validarPedidoDeInstalacao([true]), undefined);
    assert.equal(validarPedidoDeInstalacao({ obrigatoria: "sim" }), undefined);
    assert.equal(validarPedidoDeInstalacao({ obrigatoria: true }, 1), undefined);
  });
});
