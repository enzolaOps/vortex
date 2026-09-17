import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type ConteudoConferivel,
  type SessaoConferivel,
  PARTICAO_DO_OVERLAY,
  abrirNoNavegadorDoSistema,
  navegacaoDaPrincipalPermitida,
  protegerConteudoDoOverlay,
  protegerSessaoDoOverlay,
  requisicaoDoOverlayPermitida,
} from "./privilegioModelo";

const APP = "https://vortex.test";

describe("privilégio do overlay", () => {
  it("a partição não é persistida", () => {
    assert.ok(!PARTICAO_DO_OVERLAY.startsWith("persist:"));
  });

  it("rede: só assets da origem do app", () => {
    const permitidas = [
      `${APP}/overlay`,
      `${APP}/assets/index-abc.js`,
      `${APP}/fonts/instrument.woff2`,
      `${APP}/autumn/avatars/01ABC`,
      `${APP}/apiario.png`,
      "data:image/png;base64,AAAA",
      `blob:${APP}/1234`,
    ];
    const negadas = [
      `${APP}/api`,
      `${APP}/api/users/@me`,
      `${APP}/API/users/@me`,
      `${APP}/ws`,
      `${APP}/ws/?token=x`,
      `${APP}/january/proxy?url=https://mal.test`,
      "https://mal.test/overlay",
      "http://vortex.test/overlay",
      "https://vortex.test:8443/overlay",
      "wss://vortex.test/ws",
      "file:///C:/Windows/win.ini",
      "chrome-extension://abc/x.js",
      "não é url",
    ];
    for (const u of permitidas) assert.equal(requisicaoDoOverlayPermitida(u, APP), true, u);
    for (const u of negadas) assert.equal(requisicaoDoOverlayPermitida(u, APP), false, u);
  });

  it("a sessão cancela o que não é asset e nega toda permissão", () => {
    let aoRequisitar: Parameters<SessaoConferivel["webRequest"]["onBeforeRequest"]>[1] | undefined;
    let aoPedir: Parameters<SessaoConferivel["setPermissionRequestHandler"]>[0] | undefined;
    let aoConferir: Parameters<SessaoConferivel["setPermissionCheckHandler"]>[0] | undefined;
    let filtro: { urls: string[] } | undefined;
    const sessao: SessaoConferivel = {
      webRequest: {
        onBeforeRequest: (f, o) => {
          filtro = f;
          aoRequisitar = o;
        },
      },
      setPermissionRequestHandler: (h) => void (aoPedir = h),
      setPermissionCheckHandler: (h) => void (aoConferir = h),
    };
    protegerSessaoDoOverlay(sessao, () => APP);

    assert.deepEqual(filtro, { urls: ["<all_urls>"] });
    const respostas: boolean[] = [];
    aoRequisitar?.({ url: `${APP}/overlay` }, (r) => respostas.push(r.cancel));
    aoRequisitar?.({ url: `${APP}/api/users/@me` }, (r) => respostas.push(r.cancel));
    aoRequisitar?.({ url: "https://mal.test/" }, (r) => respostas.push(r.cancel));
    assert.deepEqual(respostas, [false, true, true]);

    for (const p of ["media", "notifications", "clipboard-read", "geolocation", "fullscreen", "openExternal"]) {
      let concedida: boolean | undefined;
      aoPedir?.(undefined, p, (sim) => (concedida = sim));
      assert.equal(concedida, false, p);
      assert.equal(aoConferir?.(undefined, p), false, p);
    }
  });

  it("o conteúdo não navega, nem para a própria origem, e não abre janela", () => {
    const ouvintes = new Map<string, (e: { preventDefault(): void; url: string }) => void>();
    let abrir: ((d: { url: string }) => { action: "deny" }) | undefined;
    const conteudo: ConteudoConferivel = {
      on: (evento, o) => ouvintes.set(evento, o),
      setWindowOpenHandler: (h) => void (abrir = h),
    };
    protegerConteudoDoOverlay(conteudo);

    for (const evento of ["will-navigate", "will-frame-navigate"]) {
      for (const url of [`${APP}/`, `${APP}/overlay`, "https://mal.test/"]) {
        let barrada = false;
        ouvintes.get(evento)?.({ url, preventDefault: () => (barrada = true) });
        assert.equal(barrada, true, `${evento} ${url}`);
      }
    }
    assert.deepEqual(abrir?.({ url: "https://exemplo.test/" }), { action: "deny" });
    assert.deepEqual(abrir?.({ url: `${APP}/` }), { action: "deny" });
  });
});

describe("privilégio da principal", () => {
  it("navega só dentro da origem do app, e URL ilegível é recusada", () => {
    assert.equal(navegacaoDaPrincipalPermitida(`${APP}/servidor/1`, APP), true);
    assert.equal(navegacaoDaPrincipalPermitida("https://mal.test/", APP), false);
    assert.equal(navegacaoDaPrincipalPermitida("https://vortex.test.mal.test/", APP), false);
    assert.equal(navegacaoDaPrincipalPermitida("javascript:alert(1)", APP), false);
    assert.equal(navegacaoDaPrincipalPermitida("::::", APP), false);
  });

  it("só http, https e mailto vão para o navegador do sistema", () => {
    assert.equal(abrirNoNavegadorDoSistema("https://exemplo.test/"), true);
    assert.equal(abrirNoNavegadorDoSistema("http://exemplo.test/"), true);
    assert.equal(abrirNoNavegadorDoSistema("mailto:a@b.test"), true);
    assert.equal(abrirNoNavegadorDoSistema("file:///C:/Windows/System32/calc.exe"), false);
    assert.equal(abrirNoNavegadorDoSistema("javascript:alert(1)"), false);
    assert.equal(abrirNoNavegadorDoSistema("ms-settings:privacy"), false);
    assert.equal(abrirNoNavegadorDoSistema("smb://servidor/c$"), false);
  });
});
