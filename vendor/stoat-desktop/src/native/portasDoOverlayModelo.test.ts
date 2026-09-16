import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  type DaPrincipal,
  type DoOverlay,
  type Papel,
  type PortaConferivel,
  criarComutador,
  lerDaPrincipal,
  lerDoOverlay,
  lerParaOOverlay,
} from "./portasDoOverlayModelo";

class PortaFalsa implements PortaConferivel {
  enviadas: unknown[] = [];
  fechada = false;
  iniciada = false;
  private aoMensagem: ((e: { data: unknown }) => void)[] = [];
  private aoFechar: (() => void)[] = [];

  constructor(readonly nome: string) {}

  postMessage(m: unknown): void {
    if (this.fechada) throw new Error("porta fechada");
    this.enviadas.push(m);
  }
  start(): void {
    this.iniciada = true;
  }
  close(): void {
    this.fechada = true;
  }
  on(evento: "message" | "close", ouvinte: ((e: { data: unknown }) => void) | (() => void)): void {
    if (evento === "message") this.aoMensagem.push(ouvinte as (e: { data: unknown }) => void);
    else this.aoFechar.push(ouvinte as () => void);
  }
  /** A página do outro lado mandou algo. */
  chegou(data: unknown): void {
    for (const f of this.aoMensagem) f({ data });
  }
  /** O outro lado sumiu (renderer caiu, página saiu). */
  caiu(): void {
    for (const f of this.aoFechar) f();
  }
}

function montar(opcoes: { entregar?: (papel: Papel) => boolean } = {}) {
  const pares: { nossa: PortaFalsa; deles: PortaFalsa }[] = [];
  const entregues: [Papel, PortaConferivel][] = [];
  const daPrincipal: DaPrincipal[] = [];
  const doOverlay: DoOverlay[] = [];
  const eventos: string[] = [];
  const recusas: Papel[] = [];
  const comutador = criarComutador({
    criarPar: () => {
      const n = pares.length;
      const par = { nossa: new PortaFalsa(`nossa${n}`), deles: new PortaFalsa(`deles${n}`) };
      pares.push(par);
      return { port1: par.nossa, port2: par.deles };
    },
    entregar: (papel, porta) => {
      if (opcoes.entregar && !opcoes.entregar(papel)) return false;
      entregues.push([papel, porta]);
      return true;
    },
    daPrincipal: (m) => void daPrincipal.push(m),
    doOverlay: (m) => void doOverlay.push(m),
    aoConectar: (papel) => void eventos.push(`conectou:${papel}`),
    aoDesconectar: (papel) => void eventos.push(`caiu:${papel}`),
    avisar: (papel) => void recusas.push(papel),
  });
  return { comutador, pares, entregues, daPrincipal, doOverlay, eventos, recusas };
}

const ESTADO = { ativo: true, posicao: 2, atalho: ["Ctrl", "O"], voz: { canal: "geral" } };

describe("portas do overlay — ciclo de vida", () => {
  it("conectar entrega a outra ponta à janela do papel e começa a ouvir", () => {
    const t = montar();
    t.comutador.conectar("overlay");
    assert.equal(t.entregues.length, 1);
    assert.equal(t.entregues[0][0], "overlay");
    assert.equal(t.entregues[0][1], t.pares[0].deles);
    assert.equal(t.pares[0].nossa.iniciada, true);
    assert.equal(t.comutador.conectado("overlay"), true);
    assert.equal(t.comutador.conectado("principal"), false);
    assert.deepEqual(t.eventos, ["conectou:overlay"]);
  });

  it("recarregar recria a porta: a velha é fechada e deixa de falar", () => {
    const t = montar();
    t.comutador.conectar("overlay");
    t.comutador.conectar("overlay");
    const [velha, nova] = t.pares;
    assert.equal(velha.nossa.fechada, true);
    assert.equal(nova.nossa.fechada, false);
    assert.deepEqual(t.eventos, ["conectou:overlay", "caiu:overlay", "conectou:overlay"]);

    velha.nossa.chegou({ tipo: "comando", comando: "mutar" });
    assert.deepEqual(t.doOverlay, []);
    nova.nossa.chegou({ tipo: "comando", comando: "mutar" });
    assert.deepEqual(t.doOverlay, [{ tipo: "comando", comando: "mutar" }]);

    assert.equal(t.comutador.enviarAoOverlay({ tipo: "silencio", silenciadas: true }), true);
    assert.deepEqual(velha.nossa.enviadas, []);
    assert.deepEqual(nova.nossa.enviadas, [{ tipo: "silencio", silenciadas: true }]);
  });

  it("fechar a janela desconecta; depois disso nada é enviado", () => {
    const t = montar();
    t.comutador.conectar("overlay");
    t.comutador.desconectar("overlay");
    assert.equal(t.pares[0].nossa.fechada, true);
    assert.equal(t.comutador.enviarAoOverlay({ tipo: "interacao", interagindo: true }), false);
    /* Desconectar de novo não repete o efeito. */
    t.comutador.desconectar("overlay");
    assert.deepEqual(t.eventos, ["conectou:overlay", "caiu:overlay"]);
  });

  it("o outro lado cair desconecta — mas a queda de uma porta velha não derruba a nova", () => {
    const t = montar();
    t.comutador.conectar("principal");
    t.comutador.conectar("principal");
    t.pares[0].nossa.caiu();
    assert.equal(t.comutador.conectado("principal"), true);
    t.pares[1].nossa.caiu();
    assert.equal(t.comutador.conectado("principal"), false);
    assert.deepEqual(t.eventos, ["conectou:principal", "caiu:principal", "conectou:principal", "caiu:principal"]);
  });

  it("janela ausente ou fora da origem do app não recebe porta", () => {
    const t = montar({ entregar: () => false });
    t.comutador.conectar("overlay");
    assert.equal(t.comutador.conectado("overlay"), false);
    assert.equal(t.pares[0].nossa.fechada, true);
    assert.equal(t.pares[0].deles.fechada, true);
    assert.deepEqual(t.eventos, []);
  });

  it("entregar que lança é o mesmo que não entregar", () => {
    const t = montar({
      entregar: () => {
        throw new Error("webContents destruído");
      },
    });
    t.comutador.conectar("principal");
    assert.equal(t.comutador.conectado("principal"), false);
    assert.equal(t.pares[0].nossa.fechada, true);
  });

  it("as duas janelas têm portas independentes", () => {
    const t = montar();
    t.comutador.conectar("principal");
    t.comutador.conectar("overlay");
    t.comutador.conectar("overlay");
    assert.equal(t.pares[0].nossa.fechada, false);
    assert.equal(t.comutador.conectado("principal"), true);
  });
});

describe("portas do overlay — o que cada lado pode dizer", () => {
  it("a principal publica estado e mensagem; comando dela é recusado", () => {
    const t = montar();
    t.comutador.conectar("principal");
    const p = t.pares[0].nossa;
    p.chegou({ tipo: "estado", estado: ESTADO });
    p.chegou({ tipo: "mensagem", mensagem: { id: "1", canal: "geral", autor: "ana", texto: "oi" } });
    p.chegou({ tipo: "comando", comando: "mutar" });
    p.chegou({ tipo: "estado", estado: { voz: {} } });
    p.chegou("mutar");
    assert.deepEqual(t.daPrincipal, [
      { tipo: "estado", estado: ESTADO },
      { tipo: "mensagem", mensagem: { id: "1", canal: "geral", autor: "ana", texto: "oi" } },
    ]);
    assert.deepEqual(t.doOverlay, []);
    assert.deepEqual(t.recusas, ["principal", "principal", "principal"]);
  });

  it("o overlay só pede intenções da lista fechada", () => {
    const t = montar();
    t.comutador.conectar("overlay");
    const o = t.pares[0].nossa;
    for (const comando of ["mutar", "ensurdecer", "desconectar"]) o.chegou({ tipo: "comando", comando });
    o.chegou({ tipo: "comando", comando: "fechar" });
    o.chegou({ tipo: "comando", comando: "pushToTalkInicio" });
    o.chegou({ tipo: "estado", estado: ESTADO });
    o.chegou({ tipo: "mensagem", mensagem: { id: "1", canal: "c", autor: "a", texto: "t" } });
    assert.deepEqual(
      t.doOverlay.map((m) => m.comando),
      ["mutar", "ensurdecer", "desconectar"],
    );
    assert.deepEqual(t.daPrincipal, []);
    assert.equal(t.recusas.length, 4);
  });

  it("leitores conferem a forma", () => {
    assert.equal(lerDaPrincipal({ tipo: "mensagem", mensagem: { id: 1, canal: "c", autor: "a", texto: "t" } }), undefined);
    assert.deepEqual(
      lerDaPrincipal({ tipo: "mensagem", mensagem: { id: "1", canal: "c", autor: "a", texto: "t", extra: "descartado" } }),
      { tipo: "mensagem", mensagem: { id: "1", canal: "c", autor: "a", texto: "t" } },
    );
    assert.equal(lerDoOverlay({ tipo: "comando", comando: ["mutar"] }), undefined);
    assert.deepEqual(lerParaOOverlay({ tipo: "interacao", interagindo: true }), { tipo: "interacao", interagindo: true });
    assert.equal(lerParaOOverlay({ tipo: "interacao", interagindo: "sim" }), undefined);
    assert.deepEqual(lerParaOOverlay({ tipo: "silencio", silenciadas: false }), { tipo: "silencio", silenciadas: false });
    assert.equal(lerParaOOverlay({ tipo: "qualquer" }), undefined);
    assert.equal(lerParaOOverlay(null), undefined);
  });
});

describe("preload do overlay", () => {
  it("não manda nada por IPC: só recebe a porta", () => {
    /* `pnpm test` roda a partir de vendor/stoat-desktop/. */
    const fonte = readFileSync(join(process.cwd(), "src", "preloadDoOverlay.ts"), "utf8");
    assert.match(fonte, /ipcRenderer\.on\(CANAL_DA_PORTA/);
    assert.doesNotMatch(fonte, /ipcRenderer\.(send|sendSync|invoke|postMessage|sendToHost)\b/);
  });
});
