import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type MixerCarregado, type Sessao, criarAtenuacao } from "./atenuacaoModelo";

const PROPRIO = "C:\\Program Files\\Vortex\\Vortex.exe";

function mixerDublado(sessoes: Sessao[]): MixerCarregado {
  return { m: { getDefaultDevice: () => ({ sessions: sessoes }) }, saida: 0 };
}

/** Um `carregar` que só resolve quando o teste mandar. */
function carregamentoManual(x: MixerCarregado) {
  let soltar!: () => void;
  const p = new Promise<MixerCarregado>((r) => {
    soltar = () => r(x);
  });
  return { carregar: () => p, soltar };
}

function appDublado() {
  const app = { prevenidos: 0, saidas: 0 };
  const evento = {
    preventDefault: () => {
      app.prevenidos++;
    },
  };
  const sair = () => {
    app.saidas++;
  };
  return { app, evento, sair };
}

const tique = () => new Promise((r) => setTimeout(r, 0));

/**
 * O ALCANCE da atenuação — o que ela pega e o que ela deixa.
 *
 * ⚠ **A única isenção é o próprio Vortex.** Este bloco existe para MEDIR a
 * consequência disso quando a pessoa compartilha som: a sessão do app que está
 * sendo transmitido é atenuada como qualquer outra, e quem assiste ouve pelo
 * mix já baixado. Quem decide não pedir a atenuação nessa hora é o CLIENTE,
 * em `client/packages/client/src/sdk/atenuacao.ts` — a casca não sabe que há
 * transmissão, e ensiná-la significaria resolver PID → executável, que é
 * Win32 novo por uma exceção que o cliente exprime em um booleano.
 */
describe("alcance da atenuação", () => {
  it("baixa TODO app que não é o Vortex, inclusive o transmitido", async () => {
    /* O navegador cuja janela está sendo compartilhada com som. */
    const transmitido = { appName: "chrome.exe", volume: 1 };
    const spotify = { appName: "spotify.exe", volume: 0.8 };
    const x = mixerDublado([
      transmitido,
      spotify,
      { appName: PROPRIO, volume: 1 },
    ]);
    const { atenuar } = criarAtenuacao({
      carregar: () => Promise.resolve(x),
      proprio: PROPRIO,
    });

    await atenuar(true);
    assert.equal(
      transmitido.volume,
      0.5,
      "a fonte transmitida cai a 50% como qualquer outra",
    );
    assert.equal(spotify.volume, 0.4);

    await atenuar(false);
    assert.equal(transmitido.volume, 1, "e volta ao sair da fala");
  });

  it("o próprio Vortex é a única isenção", async () => {
    const proprio = { appName: PROPRIO, volume: 1 };
    const x = mixerDublado([proprio]);
    const { atenuar } = criarAtenuacao({
      carregar: () => Promise.resolve(x),
      proprio: PROPRIO,
    });
    await atenuar(true);
    assert.equal(proprio.volume, 1);
  });
});

describe("atenuação ao fechar o app", () => {
  it("fecha sem segurar quando nunca houve atenuação", () => {
    let carregou = 0;
    const { aoSair } = criarAtenuacao({
      carregar: () => {
        carregou++;
        return Promise.resolve(mixerDublado([]));
      },
      proprio: PROPRIO,
    });
    const { app, evento, sair } = appDublado();
    aoSair(evento, sair);
    assert.equal(app.prevenidos, 0);
    assert.equal(app.saidas, 0);
    assert.equal(carregou, 0, "não carrega o mixer só para fechar");
  });

  it("com o mixer carregado, restaura síncrono e não segura o fechamento", async () => {
    const spotify = { appName: "spotify.exe", volume: 0.8 };
    const x = mixerDublado([spotify, { appName: PROPRIO, volume: 1 }]);
    const { atenuar, aoSair } = criarAtenuacao({ carregar: () => Promise.resolve(x), proprio: PROPRIO });
    await atenuar(true);
    assert.equal(spotify.volume, 0.4);

    const { app, evento, sair } = appDublado();
    aoSair(evento, sair);
    assert.equal(spotify.volume, 0.8, "restaurado antes de o handler devolver");
    assert.equal(app.prevenidos, 0);
    assert.equal(app.saidas, 0);
  });

  it("com o mixer ainda carregando, segura, restaura e sai uma vez só", async () => {
    const spotify = { appName: "spotify.exe", volume: 0.8 };
    const { carregar, soltar } = carregamentoManual(mixerDublado([spotify]));
    const { atenuar, aoSair } = criarAtenuacao({ carregar, proprio: PROPRIO, tetoMs: 10_000 });

    /* A fala começou; o mixer ainda não chegou e o app é fechado. */
    void atenuar(true);
    const { app, evento, sair } = appDublado();
    aoSair(evento, sair);
    assert.equal(app.prevenidos, 1);
    assert.equal(app.saidas, 0);

    /* Um segundo pedido de fechar enquanto espera não dispara outra saída. */
    aoSair(evento, sair);
    assert.equal(app.prevenidos, 2);

    soltar();
    await tique();
    assert.equal(spotify.volume, 0.8, "a fala pendente não atenua depois do fechamento");
    assert.equal(app.saidas, 1);

    /* O `app.quit()` de novo chama o `before-quit`: agora passa direto. */
    aoSair(evento, sair);
    assert.equal(app.prevenidos, 2);
    assert.equal(app.saidas, 1);
  });

  it("estourado o teto de tempo, sai mesmo sem o mixer", async () => {
    const { atenuar, aoSair } = criarAtenuacao({
      carregar: () => new Promise(() => undefined),
      proprio: PROPRIO,
      tetoMs: 20,
    });
    void atenuar(true);
    const { app, evento, sair } = appDublado();
    aoSair(evento, sair);
    assert.equal(app.prevenidos, 1);
    await tique();
    assert.equal(app.saidas, 0, "não sai antes do teto");
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(app.saidas, 1);

    /* O mixer nunca chegou: o `app.quit()` seguinte não pode ser segurado de novo. */
    aoSair(evento, sair);
    assert.equal(app.prevenidos, 1);
  });
});
