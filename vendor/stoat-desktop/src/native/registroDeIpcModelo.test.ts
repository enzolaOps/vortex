import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { after, before, describe, it } from "node:test";

import {
  type Ambiente,
  type FrameConferivel,
  type IpcComoOMain,
  type Papel,
  type Recusa,
  type Remetente,
  booleano,
  criarRegistro,
  motivoDeRecusa,
  semArgumentos,
  umDe,
} from "./registroDeIpcModelo";

const ORIGEM = "https://app.vortex.test";
const PRINCIPAL = 1;
const OVERLAY = 2;
const ESTRANHA = 3;

type Frame = "principal" | "filho" | "nenhum" | "destruido";

/** Um evento de IPC de mentira, com o frame e a URL escolhidos pelo teste. */
function evento(id: number, opcoes: { frame?: Frame; url?: string } = {}): Remetente {
  const url = opcoes.url ?? `${ORIGEM}/`;
  const mainFrame: FrameConferivel = { url, processId: 10 + id, routingId: 1 };
  const filho: FrameConferivel = { url, processId: 10 + id, routingId: 2 };
  const frame = opcoes.frame ?? "principal";
  if (frame === "destruido") {
    return {
      sender: {
        id,
        get mainFrame(): FrameConferivel {
          throw new Error("Render frame was disposed");
        },
      },
      senderFrame: mainFrame,
    };
  }
  return {
    sender: { id, mainFrame },
    senderFrame: frame === "principal" ? mainFrame : frame === "filho" ? filho : null,
  };
}

/* Um `ipcMain` de mentira: guarda o ouvinte por canal para o teste disparar. */
function montar(ambiente?: Partial<Ambiente>) {
  const ouvintes = new Map<string, (e: Remetente, ...a: unknown[]) => unknown>();
  const ipc: IpcComoOMain<Remetente, Remetente> = {
    on: (canal, f) => ouvintes.set(canal, f),
    handle: (canal, f) => ouvintes.set(canal, f),
  };
  const recusas: [string, Recusa][] = [];
  const janela = (id: number) => ({ isDestroyed: () => false, webContents: { id } });
  const registro = criarRegistro(
    ipc,
    () => ({
      janelas: { principal: janela(PRINCIPAL), overlay: janela(OVERLAY) },
      origem: ORIGEM,
      ...ambiente,
    }),
    (canal, motivo) => void recusas.push([canal, motivo]),
  );
  const disparar = (canal: string, e: Remetente, ...a: unknown[]) => ouvintes.get(canal)?.(e, ...a);
  return { registro, disparar, recusas };
}

/* Os canais que a revisão do #225 apontou como alcançáveis pelo overlay. */
const SENSIVEIS: [string, "send" | "invoke"][] = [
  ["close", "send"],
  ["minimise", "send"],
  ["maximise", "send"],
  ["vortexAtenuar", "send"],
  ["config", "send"],
  ["vortexDefinirAtalhos", "invoke"],
  ["vortexGravarPreferencia", "invoke"],
  ["vortexReiniciar", "invoke"],
  ["vortexLimparCache", "invoke"],
  ["vortexJanela", "invoke"],
  ["setAutostart", "invoke"],
];

describe("registro de IPC", () => {
  // O console.warn da recusa padrão não deve sujar a saída.
  const aviso = console.warn;
  before(() => {
    console.warn = () => undefined;
  });
  after(() => {
    console.warn = aviso;
  });

  for (const [canal, via] of SENSIVEIS) {
    it(`"${canal}" (${via}) recusa janela estranha, overlay, iframe, origem estranha e payload inválido`, () => {
      const { registro, disparar, recusas } = montar();
      const executados: unknown[] = [];
      registro.registrar(canal, {
        via,
        quem: ["principal"],
        validar: booleano,
        executar: (dados) => {
          executados.push(dados);
          return "feito";
        },
      });

      assert.equal(disparar(canal, evento(ESTRANHA), true), undefined);
      assert.equal(disparar(canal, evento(OVERLAY), true), undefined);
      assert.equal(disparar(canal, evento(PRINCIPAL, { frame: "filho" }), true), undefined);
      assert.equal(disparar(canal, evento(PRINCIPAL, { frame: "nenhum" }), true), undefined);
      assert.equal(disparar(canal, evento(PRINCIPAL, { frame: "destruido" }), true), undefined);
      assert.equal(disparar(canal, evento(PRINCIPAL, { url: "https://mal.test/" }), true), undefined);
      assert.equal(disparar(canal, evento(PRINCIPAL, { url: "about:blank" }), true), undefined);
      assert.equal(disparar(canal, evento(PRINCIPAL), "true"), undefined);
      assert.deepEqual(executados, []);
      assert.deepEqual(
        recusas.map(([, m]) => m),
        ["janela", "janela", "frame", "frame", "frame", "origem", "origem", "payload"],
      );

      const r = disparar(canal, evento(PRINCIPAL, { url: `${ORIGEM}/servidor/1` }), false);
      assert.deepEqual(executados, [false]);
      assert.equal(r, via === "invoke" ? "feito" : undefined);
    });
  }

  it("canal do overlay só aceita a janela do overlay", () => {
    const { registro, disparar } = montar();
    registro.registrar("vortexOverlayComando", {
      via: "invoke",
      quem: ["overlay"],
      validar: umDe(["mutar", "ensurdecer", "desconectar"]),
      executar: (c) => c,
    });
    assert.equal(disparar("vortexOverlayComando", evento(PRINCIPAL), "mutar"), undefined);
    assert.equal(disparar("vortexOverlayComando", evento(ESTRANHA), "mutar"), undefined);
    assert.equal(disparar("vortexOverlayComando", evento(OVERLAY), "fechar"), undefined);
    assert.equal(disparar("vortexOverlayComando", evento(OVERLAY), "mutar"), "mutar");
  });

  it("canal com dois papéis aceita os dois e mais ninguém", () => {
    const { registro, disparar } = montar();
    registro.registrar("ambos", {
      via: "invoke",
      quem: ["principal", "overlay"],
      validar: semArgumentos,
      executar: () => "feito",
    });
    assert.equal(disparar("ambos", evento(PRINCIPAL)), "feito");
    assert.equal(disparar("ambos", evento(OVERLAY)), "feito");
    assert.equal(disparar("ambos", evento(ESTRANHA)), undefined);
  });

  it("repassa os argumentos já validados e o evento", () => {
    const { registro, disparar } = montar();
    registro.registrar("vortexGravarPreferencia", {
      via: "invoke",
      quem: ["principal"],
      validar: (chave: unknown, valor: unknown) =>
        typeof chave === "string" ? { chave, valor } : undefined,
      executar: (g, e) => [g.chave, g.valor, e.sender.id],
    });
    assert.deepEqual(disparar("vortexGravarPreferencia", evento(PRINCIPAL), "aoFechar", "sair"), [
      "aoFechar",
      "sair",
      PRINCIPAL,
    ]);
  });

  it("validador que lança é recusa, não exceção no main", () => {
    const { registro, disparar, recusas } = montar();
    registro.registrar("x", {
      via: "invoke",
      quem: ["principal"],
      validar: () => {
        throw new Error("payload hostil");
      },
      executar: () => "feito",
    });
    assert.equal(disparar("x", evento(PRINCIPAL)), undefined);
    assert.deepEqual(recusas, [["x", "payload"]]);
  });

  it("janela destruída ou ausente não autoriza ninguém", () => {
    const destruida = { isDestroyed: () => true, webContents: { id: PRINCIPAL } };
    const { registro, disparar } = montar({ janelas: { principal: destruida, overlay: undefined } });
    registro.registrar("close", { via: "invoke", quem: ["principal"], validar: semArgumentos, executar: () => "feito" });
    registro.registrar("o", { via: "invoke", quem: ["overlay"], validar: semArgumentos, executar: () => "feito" });
    assert.equal(disparar("close", evento(PRINCIPAL)), undefined);
    assert.equal(disparar("o", evento(OVERLAY)), undefined);
  });

  it("a janela que navegou para outra origem perde a ponte", () => {
    const ambiente: Ambiente = {
      janelas: {
        principal: { isDestroyed: () => false, webContents: { id: PRINCIPAL } },
        overlay: undefined,
      },
      origem: ORIGEM,
    };
    const quem: [Papel] = ["principal"];
    assert.equal(motivoDeRecusa(quem, evento(PRINCIPAL), ambiente), undefined);
    assert.equal(motivoDeRecusa(quem, evento(PRINCIPAL, { url: "https://app.vortex.test.mal.test/" }), ambiente), "origem");
    assert.equal(motivoDeRecusa(quem, evento(PRINCIPAL, { url: "http://app.vortex.test/" }), ambiente), "origem");
    assert.equal(motivoDeRecusa(quem, evento(PRINCIPAL, { url: "data:text/html,oi" }), ambiente), "origem");
  });

  it("canal repetido lança", () => {
    const { registro } = montar();
    const def = { via: "send", quem: ["principal"], validar: semArgumentos, executar: (): void => undefined } as const;
    registro.registrar("close", def);
    assert.throws(() => registro.registrar("close", def), /duas vezes/);
    assert.deepEqual([...registro.canais().keys()], ["close"]);
  });

  it("nenhum `ipcMain` fora do registro", () => {
    /* `pnpm test` roda a partir de vendor/stoat-desktop/. */
    const src = join(process.cwd(), "src");
    assert.ok(statSync(src).isDirectory(), `src/ não encontrado em ${process.cwd()}`);
    const arquivos = (pasta: string): string[] =>
      readdirSync(pasta, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? arquivos(join(pasta, e.name)) : e.name.endsWith(".ts") ? [join(pasta, e.name)] : [],
      );
    const todos = arquivos(src);
    assert.ok(todos.length > 10, "a varredura não achou os arquivos da casca");
    const infratores = todos
      .filter((f) => !/registroDeIpc(Modelo)?(\.test)?\.ts$/.test(f))
      .filter((f) => /\bipcMain\b/.test(readFileSync(f, "utf8")))
      .map((f) => relative(src, f));
    assert.deepEqual(infratores, []);
  });
});

/*
  Contrato de TIPO — conferido pelo `tsc`, não pelo runner: esta função nunca
  roda. Se um `@ts-expect-error` deixar de ser erro, o `tsc` reprova.
*/
export function _contratoDeTipo(): void {
  const { registro } = montar();
  // @ts-expect-error — canal sem papel não compila.
  registro.registrar("a", { via: "send", validar: semArgumentos, executar: () => undefined });
  // @ts-expect-error — canal sem validador não compila.
  registro.registrar("b", { via: "send", quem: ["principal"], executar: () => undefined });
  // @ts-expect-error — lista de papéis vazia não compila.
  registro.registrar("c", { via: "send", quem: [], validar: semArgumentos, executar: () => undefined });
  // @ts-expect-error — papel inventado não compila.
  registro.registrar("d", { via: "send", quem: ["qualquer"], validar: semArgumentos, executar: () => undefined });
}
