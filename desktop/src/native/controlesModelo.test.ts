import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type ComandoDeVoz,
  type EventoDeTecla,
  type HookCarregado,
  criarControles,
} from "./controlesModelo";

function montar() {
  const ouvintes: Record<string, (e: EventoDeTecla) => void> = {};
  const hook = { inicios: 0, paradas: 0 };
  const carregado: HookCarregado = {
    hook: {
      on: (evento, ouvinte) => void (ouvintes[evento] = ouvinte),
      start: () => void hook.inicios++,
      stop: () => void hook.paradas++,
    },
    teclas: { F13: 91, M: 50 },
  };
  const enviados: ComandoDeVoz[] = [];
  const controles = criarControles({
    carregarHook: () => Promise.resolve(carregado),
    enviar: (c) => void enviados.push(c),
    alternarOverlay: () => undefined,
    alternarSilencioDoOverlay: () => undefined,
    plataforma: "win32",
  });
  return { ...controles, hook, ouvintes, enviados };
}

const F13 = { codigo: "F13", mod: false, alt: false, shift: false };

describe("atalhos globais", () => {
  it("códigos que o hook não conhece não sobem o hook", async () => {
    const c = montar();
    const ok = await c.definirAtalhos({ mutar: { ...F13, codigo: "Nenhuma" } });
    assert.equal(ok, true);
    assert.equal(c.hook.inicios, 0);
  });

  it("trocar para códigos desconhecidos para o hook e fecha o push-to-talk", async () => {
    const c = montar();
    await c.definirAtalhos({ pushToTalk: F13 });
    assert.equal(c.hook.inicios, 1);

    c.ouvintes.keydown({ keycode: 91 });
    assert.deepEqual(c.enviados, ["pushToTalkInicio"]);

    await c.definirAtalhos({ pushToTalk: { ...F13, codigo: "Nenhuma" } });
    assert.equal(c.hook.paradas, 1);
    assert.deepEqual(c.enviados, ["pushToTalkInicio", "pushToTalkFim"]);

    /* A tecla que ficou "segurada" foi esquecida: um novo cadastro a vê descer. */
    await c.definirAtalhos({ pushToTalk: F13 });
    assert.equal(c.hook.inicios, 2);
    c.ouvintes.keydown({ keycode: 91 });
    assert.deepEqual(c.enviados, ["pushToTalkInicio", "pushToTalkFim", "pushToTalkInicio"]);
  });

  it("cadastro vazio e cadastro válido seguem o caminho de sempre", async () => {
    const c = montar();
    await c.definirAtalhos({ mutar: { ...F13, codigo: "KeyM" } });
    assert.equal(c.hook.inicios, 1);
    c.ouvintes.keydown({ keycode: 50 });
    assert.deepEqual(c.enviados, ["mutar"]);

    await c.definirAtalhos({});
    assert.equal(c.hook.paradas, 1);
  });
});
