import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assinarDispositivos,
  lerDispositivos,
  limparDispositivos,
} from "./dispositivos";

function dispositivo(kind: MediaDeviceKind, deviceId: string, label = deviceId) {
  return { kind, deviceId, label, groupId: "", toJSON: () => ({}) } as MediaDeviceInfo;
}

/** Um `mediaDevices` falso que conta quem escuta. */
function falso(lista: MediaDeviceInfo[]) {
  const ouvintes = new Set<() => void>();
  const md = {
    enumerateDevices: vi.fn(() => Promise.resolve(lista)),
    addEventListener: vi.fn((_: string, f: () => void) => ouvintes.add(f)),
    removeEventListener: vi.fn((_: string, f: () => void) => ouvintes.delete(f)),
  };
  vi.stubGlobal("navigator", { mediaDevices: md });
  return { md, ouvintes };
}

const aguardar = () => new Promise((r) => setTimeout(r, 0));

describe("store de dispositivos", () => {
  beforeEach(() => limparDispositivos());
  afterEach(() => vi.unstubAllGlobals());

  it("separa por tipo e mantém a referência entre leituras (getSnapshot)", async () => {
    falso([dispositivo("audioinput", "m1"), dispositivo("videoinput", "c1")]);
    const parar = assinarDispositivos(() => undefined);
    await aguardar();

    expect(lerDispositivos("audioinput").map((d) => d.deviceId)).toEqual(["m1"]);
    expect(lerDispositivos("videoinput").map((d) => d.deviceId)).toEqual(["c1"]);
    expect(lerDispositivos("audioinput")).toBe(lerDispositivos("audioinput"));
    expect(lerDispositivos("audiooutput")).toBe(lerDispositivos("audiooutput"));
    parar();
  });

  it("UM listener de devicechange para qualquer número de assinantes, e nenhum depois do último", () => {
    const { md, ouvintes } = falso([]);
    const a = assinarDispositivos(() => undefined);
    const b = assinarDispositivos(() => undefined);
    expect(md.addEventListener).toHaveBeenCalledTimes(1);
    expect(ouvintes.size).toBe(1);

    a();
    expect(ouvintes.size).toBe(1);
    b();
    expect(ouvintes.size).toBe(0);
  });

  it("plugar um fone relê a lista e avisa quem assina", async () => {
    const lista = [dispositivo("audiooutput", "fone-a")];
    const { ouvintes } = falso(lista);
    let avisos = 0;
    const parar = assinarDispositivos(() => (avisos += 1));
    await aguardar();

    lista.push(dispositivo("audiooutput", "fone-b"));
    for (const f of ouvintes) f();
    await aguardar();

    expect(lerDispositivos("audiooutput")).toHaveLength(2);
    expect(avisos).toBe(2);
    parar();
  });
});
