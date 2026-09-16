import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aoFecharInicial,
  assinaturaDasTelas,
  cabeNasTelas,
  camposDaGravacao,
  estadoParaRestaurar,
  guardarEstado,
  preferenciasParaOCliente,
  validarGravacao,
  type ConfigDasPreferencias,
} from "./preferenciasDoCliente";

/*
  As chaves que `client/…/store/desktop.ts` grava. ⚠ Copiadas À MÃO de
  propósito: o defeito que este módulo conserta foi exatamente a casca e o
  cliente discordarem sobre esta lista. Se o cliente ganhar uma chave, este
  teste não a vê — e a revisão de quem a acrescentar precisa passar aqui.
*/
const CHAVES_DO_CLIENTE = [
  "iniciarComSistema",
  "minimizarParaBandeja",
  "abrirMinimizado",
  "lembrarJanela",
  "sempreNoTopoEmChamada",
  "barraNativa",
  "aoFechar",
  "aceleracaoDeHardware",
  "reduzirEmSegundoPlano",
];

const PADRAO: ConfigDasPreferencias = {
  iniciarComSistema: false,
  minimiseToTray: true,
  startMinimisedToTray: false,
  lembrarJanela: true,
  sempreNoTopoEmChamada: false,
  customFrame: true,
  aoFechar: "bandeja",
  hardwareAcceleration: true,
  reduzirEmSegundoPlano: true,
};

describe("gravação", () => {
  it("aceita toda chave que o cliente grava", () => {
    for (const chave of CHAVES_DO_CLIENTE) {
      const valor = chave === "aoFechar" ? "perguntar" : true;
      assert.ok(validarGravacao(chave, valor), chave);
    }
  });

  it("recusa as chaves do upstream e as desconhecidas", () => {
    for (const chave of ["customFrame", "minimiseToTray", "spellchecker", "windowState", "__proto__"]) {
      assert.equal(validarGravacao(chave, true), undefined, chave);
    }
  });

  /* O cliente é conteúdo de terceiro; o arquivo é lido pelo main no início. */
  it("recusa o tipo errado", () => {
    assert.equal(validarGravacao("barraNativa", "sim"), undefined);
    assert.equal(validarGravacao("aoFechar", "minimizar"), undefined);
    assert.equal(validarGravacao("aoFechar", true), undefined);
    assert.equal(validarGravacao(7, true), undefined);
  });

  it("barra nativa inverte o customFrame, e não mexe em nada no macOS", () => {
    const g = validarGravacao("barraNativa", true)!;
    assert.deepEqual(camposDaGravacao(g, "win32"), { customFrame: false });
    assert.deepEqual(camposDaGravacao(g, "darwin"), {});
  });

  /* A tela mostra as duas; guardadas soltas dariam "minimizar sim, ao fechar encerrar". */
  it("minimizar para a bandeja e ao fechar são a mesma decisão", () => {
    assert.deepEqual(camposDaGravacao(validarGravacao("minimizarParaBandeja", false)!, "win32"), {
      aoFechar: "encerrar",
      minimiseToTray: false,
    });
    assert.deepEqual(camposDaGravacao(validarGravacao("aoFechar", "perguntar")!, "win32"), {
      aoFechar: "perguntar",
      minimiseToTray: false,
    });
  });
});

describe("leitura", () => {
  it("devolve as chaves do cliente, e não as do upstream", () => {
    const lidas = preferenciasParaOCliente(PADRAO, PADRAO, "win32") as Record<string, unknown>;
    for (const chave of CHAVES_DO_CLIENTE) assert.ok(chave in lidas, chave);
    assert.equal("customFrame" in lidas, false);
  });

  it("gravar e ler dá o mesmo valor, em toda chave", () => {
    for (const chave of CHAVES_DO_CLIENTE) {
      for (const valor of chave === "aoFechar" ? ["bandeja", "encerrar", "perguntar"] : [true, false]) {
        const c = { ...PADRAO, ...camposDaGravacao(validarGravacao(chave, valor)!, "win32") };
        const lidas = preferenciasParaOCliente(c, PADRAO, "win32") as Record<string, unknown>;
        assert.equal(lidas[chave], valor, `${chave}=${String(valor)}`);
      }
    }
  });

  /* Marcar a barra nativa não pode tirar a barra custom da janela que ainda não tem moldura. */
  it("o que está em uso não segue a preferência gravada", () => {
    const gravado = { ...PADRAO, customFrame: false, hardwareAcceleration: false };
    const lidas = preferenciasParaOCliente(gravado, PADRAO, "win32");
    assert.equal(lidas.barraNativa, true);
    assert.equal(lidas.barraNativaEmUso, false);
    assert.equal(lidas.aceleracaoDeHardware, false);
    assert.equal(lidas.aceleracaoEmUso, true);
  });

  /* `minimiseToTray` ainda é escrito pela ponte `desktopConfig` do upstream;
     a fonte do interruptor é `aoFechar`, senão os dois controles discordam. */
  it("o interruptor da bandeja lê `aoFechar`, não o campo do upstream", () => {
    const lidas = preferenciasParaOCliente({ ...PADRAO, aoFechar: "perguntar", minimiseToTray: true }, PADRAO, "win32");
    assert.equal(lidas.minimizarParaBandeja, false);
  });

  it("quem desligou a bandeja numa casca antiga encerra ao fechar", () => {
    assert.equal(aoFecharInicial(undefined, false), "encerrar");
    assert.equal(aoFecharInicial(undefined, true), "bandeja");
    assert.equal(aoFecharInicial("perguntar", true), "perguntar");
    assert.equal(aoFecharInicial("lixo", true), "bandeja");
  });
});

describe("janela por arranjo de monitores", () => {
  const notebook = { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
  const ultrawide = { bounds: { x: 1920, y: 0, width: 3440, height: 1440 }, workArea: { x: 1920, y: 0, width: 3440, height: 1400 } };
  const noUltrawide = { x: 2000, y: 40, width: 2400, height: 1200, isMaximised: false };

  it("a ordem em que o sistema lista as telas não muda a chave", () => {
    assert.equal(assinaturaDasTelas([notebook, ultrawide]), assinaturaDasTelas([ultrawide, notebook]));
    assert.notEqual(assinaturaDasTelas([notebook]), assinaturaDasTelas([notebook, ultrawide]));
  });

  it("cada arranjo restaura o seu", () => {
    let guardado = guardarEstado(undefined, assinaturaDasTelas([notebook, ultrawide]), noUltrawide);
    const soNotebook = { x: 100, y: 100, width: 1280, height: 720, isMaximised: true };
    guardado = guardarEstado(guardado, assinaturaDasTelas([notebook]), soNotebook);
    assert.deepEqual(estadoParaRestaurar(guardado, [ultrawide, notebook]), noUltrawide);
    assert.deepEqual(estadoParaRestaurar(guardado, [notebook]), soNotebook);
  });

  it("janela fora de qualquer tela não é restaurada", () => {
    assert.equal(cabeNasTelas(noUltrawide, [notebook]), false);
    assert.equal(cabeNasTelas({ x: 0, y: 0, width: 0, height: 0 }, [notebook]), false);
    assert.equal(cabeNasTelas({ x: 1900, y: 10, width: 800, height: 600 }, [notebook]), false);
  });

  it("guarda no máximo oito arranjos, e sai o mais antigo", () => {
    let g: ReturnType<typeof guardarEstado> | undefined;
    for (let i = 0; i < 10; i++) g = guardarEstado(g, `a${String(i)}`, noUltrawide);
    assert.deepEqual(Object.keys(g!), ["a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"]);
  });
});
