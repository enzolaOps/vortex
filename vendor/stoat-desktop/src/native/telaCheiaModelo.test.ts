import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  QUNS_D3D_TELA_CHEIA,
  chaveDoJogo,
  decidir,
  nomeParaMostrar,
  registrarAvisado,
} from "./telaCheiaModelo";

const JOGO = "C:\\Games\\Elden Ring\\Game\\eldenring.exe";

describe("tela cheia exclusiva", () => {
  it("avisa uma vez por jogo", () => {
    const leitura = { estado: QUNS_D3D_TELA_CHEIA, executavel: JOGO };
    const primeira = decidir(leitura, []);
    assert.deepEqual(primeira, { esconder: true, avisar: "eldenring.exe" });
    const avisados = registrarAvisado([], primeira.avisar!);
    assert.deepEqual(decidir(leitura, avisados), { esconder: true, avisar: undefined });
  });

  /* O 2 é o que tela cheia SEM BORDAS reporta — onde o overlay funciona. */
  it("QUNS_BUSY e os outros estados não são tela cheia exclusiva", () => {
    for (const estado of [0, 1, 2, 4, 5, 6, 7]) {
      assert.deepEqual(decidir({ estado, executavel: JOGO }, []), { esconder: false, avisar: undefined });
    }
    assert.deepEqual(decidir(undefined, []), { esconder: false, avisar: undefined });
  });

  it("sem o nome do executável esconde, mas não tem a quem avisar", () => {
    assert.deepEqual(decidir({ estado: QUNS_D3D_TELA_CHEIA, executavel: undefined }, []), {
      esconder: true,
      avisar: undefined,
    });
  });

  /* A loja move o jogo de disco; o aviso não pode voltar por isso. */
  it("a chave é o nome, sem pasta e sem caixa", () => {
    assert.equal(chaveDoJogo("D:\\Outra\\Pasta\\EldenRing.EXE"), "eldenring.exe");
    assert.equal(chaveDoJogo(""), undefined);
    assert.equal(nomeParaMostrar("EldenRing.exe"), "EldenRing");
  });

  it("a lista não repete e não cresce sem fim", () => {
    assert.deepEqual(registrarAvisado(["a.exe"], "a.exe"), ["a.exe"]);
    let lista: string[] = [];
    for (let i = 0; i < 250; i++) lista = registrarAvisado(lista, `${String(i)}.exe`);
    assert.equal(lista.length, 200);
    assert.equal(lista[0], "50.exe");
  });
});
