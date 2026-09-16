import { type JSONSchema } from "json-schema-typed";

import { ipc } from "./remetente";
import Store from "electron-store";

import { aoFecharInicial, type AoFechar } from "./preferenciasDoCliente";
import { mainWindow } from "./window";

const schema = {
  firstLaunch: {
    type: "boolean",
  } as JSONSchema.Boolean,
  customFrame: {
    type: "boolean",
  } as JSONSchema.Boolean,
  minimiseToTray: {
    type: "boolean",
  } as JSONSchema.Boolean,
  startMinimisedToTray: {
    type: "boolean",
  } as JSONSchema.Boolean,
  spellchecker: {
    type: "boolean",
  } as JSONSchema.Boolean,
  hardwareAcceleration: {
    type: "boolean",
  } as JSONSchema.Boolean,
  windowState: {
    type: "object",
    properties: {
      x: {
        type: "number",
      } as JSONSchema.Number,
      y: {
        type: "number",
      } as JSONSchema.Number,
      width: {
        type: "number",
      } as JSONSchema.Number,
      height: {
        type: "number",
      } as JSONSchema.Number,
      isMaximised: {
        type: "boolean",
      } as JSONSchema.Boolean,
    },
  } as JSONSchema.Object,

  /* ---- as da tela Desktop do cliente — ver `preferenciasDoCliente.ts` ---- */
  iniciarComSistema: { type: "boolean" } as JSONSchema.Boolean,
  aoFechar: {
    type: "string",
    enum: ["bandeja", "encerrar", "perguntar"],
  } as JSONSchema.String,
  lembrarJanela: { type: "boolean" } as JSONSchema.Boolean,
  sempreNoTopoEmChamada: { type: "boolean" } as JSONSchema.Boolean,
  reduzirEmSegundoPlano: { type: "boolean" } as JSONSchema.Boolean,
  /** Estado da janela por ARRANJO de monitores — ver `assinaturaDasTelas`. */
  janelasPorArranjo: { type: "object" } as JSONSchema.Object,
  /** Jogos já avisados sobre tela cheia exclusiva — ver `telaCheiaModelo.ts`. */
  jogosAvisadosDeTelaCheia: {
    type: "array",
    items: { type: "string" },
  } as JSONSchema.Array,
};

const store = new Store({
  schema,
  defaults: {
    firstLaunch: true,
    customFrame: true,
    minimiseToTray: true,
    startMinimisedToTray: false,
    spellchecker: true,
    hardwareAcceleration: true,
    windowState: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      isMaximised: false,
    },
    iniciarComSistema: false,
    /* `aoFechar` fica SEM padrão: quem nunca o gravou herda do
       `minimiseToTray` — ver `aoFecharInicial`. */
    lembrarJanela: true,
    sempreNoTopoEmChamada: false,
    reduzirEmSegundoPlano: true,
    janelasPorArranjo: {},
    jogosAvisadosDeTelaCheia: [],
  } as Partial<DesktopConfig>,
});

type Chave = keyof DesktopConfig;
const bruto = store as never as {
  get(k: string): unknown;
  set(k: string, v: unknown): void;
};
function ler<K extends Chave>(k: K): DesktopConfig[K] {
  return bruto.get(k) as DesktopConfig[K];
}
function gravar<K extends Chave>(k: K, v: DesktopConfig[K]): void {
  bruto.set(k, v);
}

/**
 * Shim for `electron-store` because typings are broken
 */
class Config {
  sync() {
    mainWindow.webContents.send("config", {
      firstLaunch: this.firstLaunch,
      customFrame: this.customFrame,
      minimiseToTray: this.minimiseToTray,
      startMinimisedToTray: this.startMinimisedToTray,
      spellchecker: this.spellchecker,
      hardwareAcceleration: this.hardwareAcceleration,
      windowState: this.windowState,
    });
  }

  get firstLaunch() {
    return (store as never as { get(k: string): boolean }).get("firstLaunch");
  }

  set firstLaunch(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "firstLaunch",
      value,
    );

    this.sync();
  }

  get customFrame() {
    return (store as never as { get(k: string): boolean }).get("customFrame");
  }

  set customFrame(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "customFrame",
      value,
    );

    this.sync();
  }

  get minimiseToTray() {
    return (store as never as { get(k: string): boolean }).get(
      "minimiseToTray",
    );
  }

  set minimiseToTray(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "minimiseToTray",
      value,
    );

    this.sync();
  }

  get startMinimisedToTray() {
    return (store as never as { get(k: string): boolean }).get(
      "startMinimisedToTray",
    );
  }

  set startMinimisedToTray(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "startMinimisedToTray",
      value,
    );

    this.sync();
  }

  get spellchecker() {
    return (store as never as { get(k: string): boolean }).get("spellchecker");
  }

  set spellchecker(value: boolean) {
    mainWindow.webContents.session.setSpellCheckerEnabled(value);

    (store as never as { set(k: string, value: boolean): void }).set(
      "spellchecker",
      value,
    );

    this.sync();
  }

  get hardwareAcceleration() {
    return (store as never as { get(k: string): boolean }).get(
      "hardwareAcceleration",
    );
  }

  set hardwareAcceleration(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "hardwareAcceleration",
      value,
    );

    this.sync();
  }

  get windowState() {
    return (
      store as never as { get(k: string): DesktopConfig["windowState"] }
    ).get("windowState");
  }

  set windowState(value: DesktopConfig["windowState"]) {
    (
      store as never as {
        set(k: string, value: DesktopConfig["windowState"]): void;
      }
    ).set("windowState", value);

    this.sync();
  }

  /*
    As da tela Desktop. ⚠ **Sem `sync()`**: aquele canal alimenta o cliente
    Solid do upstream, que não conhece estas chaves — e alguns destes setters
    rodam antes de a janela existir, onde `sync()` derrubaria o main.
  */
  get iniciarComSistema() {
    return ler("iniciarComSistema");
  }
  set iniciarComSistema(v: boolean) {
    gravar("iniciarComSistema", v);
  }

  get aoFechar(): AoFechar {
    return aoFecharInicial(ler("aoFechar"), this.minimiseToTray);
  }
  set aoFechar(v: AoFechar) {
    gravar("aoFechar", v);
  }

  get lembrarJanela() {
    return ler("lembrarJanela");
  }
  set lembrarJanela(v: boolean) {
    gravar("lembrarJanela", v);
  }

  get sempreNoTopoEmChamada() {
    return ler("sempreNoTopoEmChamada");
  }
  set sempreNoTopoEmChamada(v: boolean) {
    gravar("sempreNoTopoEmChamada", v);
  }

  get reduzirEmSegundoPlano() {
    return ler("reduzirEmSegundoPlano");
  }
  set reduzirEmSegundoPlano(v: boolean) {
    gravar("reduzirEmSegundoPlano", v);
  }

  get janelasPorArranjo() {
    return ler("janelasPorArranjo") ?? {};
  }
  set janelasPorArranjo(v: DesktopConfig["janelasPorArranjo"]) {
    gravar("janelasPorArranjo", v);
  }

  get jogosAvisadosDeTelaCheia() {
    return ler("jogosAvisadosDeTelaCheia") ?? [];
  }
  set jogosAvisadosDeTelaCheia(v: string[]) {
    gravar("jogosAvisadosDeTelaCheia", v);
  }
}

export const config = new Config();

ipc.on("config", (_, newConfig: Partial<DesktopConfig>) => {
  console.info("Received new configuration", newConfig);
  Object.entries(newConfig).forEach(
    ([key, value]) => (config[key as keyof DesktopConfig] = value as never),
  );
});
