import { describe, expect, it, vi } from "vitest";

import { conectarComMicrofone, encerrarSala, soSeVigente } from "./entradaDeSala";

function adiado<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promessa, resolve, reject };
}

function base() {
  const ordem: string[] = [];
  const rede = adiado<string>();
  const mic = adiado<string>();
  return {
    ordem,
    rede,
    mic,
    args: {
      querMicrofone: true,
      capturar: () => {
        ordem.push("capturar");
        return mic.promessa;
      },
      entrar: () => {
        ordem.push("entrar");
        return rede.promessa;
      },
      aindaQuerMicrofone: () => true,
      publicar: vi.fn((_s: string, f: string) => {
        ordem.push(`publicar:${f}`);
        return Promise.resolve();
      }),
      publicarAgora: vi.fn(() => Promise.resolve()),
      soltar: vi.fn(),
      vigente: () => true,
    },
  };
}

describe("conectarComMicrofone", () => {
  it("pede o microfone em paralelo com a conexão e publica depois de conectar", async () => {
    const t = base();
    const p = conectarComMicrofone(t.args);
    // Os dois já começaram, antes de qualquer um terminar.
    expect(t.ordem).toEqual(["capturar", "entrar"]);
    t.mic.resolve("faixa");
    await Promise.resolve();
    expect(t.args.publicar).not.toHaveBeenCalled();
    t.rede.resolve("sala");
    expect(await p).toBe("sala");
    expect(t.args.publicar).toHaveBeenCalledWith("sala", "faixa");
  });

  it("não pede o microfone quando mudo", async () => {
    const t = base();
    t.args.querMicrofone = false;
    t.args.aindaQuerMicrofone = () => false;
    t.rede.resolve("sala");
    await conectarComMicrofone(t.args);
    expect(t.ordem).toEqual(["entrar"]);
    expect(t.args.publicarAgora).not.toHaveBeenCalled();
  });

  it("solta a faixa quando a conexão falha", async () => {
    const t = base();
    const p = conectarComMicrofone(t.args);
    t.mic.resolve("faixa");
    t.rede.reject(new Error("rede"));
    await expect(p).rejects.toThrow("rede");
    await Promise.resolve();
    expect(t.args.soltar).toHaveBeenCalledWith("faixa");
  });

  it("solta a faixa quando a sessão deixou de valer", async () => {
    const t = base();
    t.args.vigente = () => false;
    t.mic.resolve("faixa");
    t.rede.resolve("sala");
    await conectarComMicrofone(t.args);
    expect(t.args.soltar).toHaveBeenCalledWith("faixa");
    expect(t.args.publicar).not.toHaveBeenCalled();
  });
});

describe("encerrarSala", () => {
  it("trocar de sala não espera o leave_call", async () => {
    const aviso = adiado(); // nunca resolve neste teste
    const desconectar = vi.fn(() => Promise.resolve());
    await encerrarSala({
      avisar: () => aviso.promessa,
      desconectar,
      esperarAviso: false,
    });
    expect(desconectar).toHaveBeenCalledOnce();
  });

  it("dispara aviso e disconnect juntos", () => {
    const avisar = vi.fn(() => new Promise<void>(() => {}));
    const desconectar = vi.fn(() => new Promise<void>(() => {}));
    void encerrarSala({ avisar, desconectar, esperarAviso: true });
    expect(avisar).toHaveBeenCalledOnce();
    expect(desconectar).toHaveBeenCalledOnce();
  });

  it("sair de vez espera os dois", async () => {
    const aviso = adiado();
    let fim = false;
    const p = encerrarSala({
      avisar: () => aviso.promessa,
      desconectar: () => Promise.resolve(),
      esperarAviso: true,
    }).then(() => (fim = true));
    await Promise.resolve();
    await Promise.resolve();
    expect(fim).toBe(false);
    aviso.resolve();
    await p;
    expect(fim).toBe(true);
  });
});

describe("soSeVigente", () => {
  it("ignora evento tardio da sala antiga", () => {
    let atual = "antiga";
    const aoDesconectar = vi.fn();
    const handler = soSeVigente(() => atual === "antiga", aoDesconectar);
    handler();
    atual = "nova";
    handler();
    expect(aoDesconectar).toHaveBeenCalledOnce();
  });
});
