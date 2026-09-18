import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  idiomasDoCorretor,
  menuNativo,
  type AcaoDoMenu,
  type ItemDoMenu,
  type ParametrosDoMenu,
} from "./menuNativoModelo";

const VAZIO: ParametrosDoMenu = {
  isEditable: false,
  editFlags: { canCut: false, canCopy: false, canPaste: false, canSelectAll: false },
  selectionText: "",
  linkURL: "",
  mediaType: "none",
  srcURL: "",
  misspelledWord: "",
  dictionarySuggestions: [],
};

const EDITAVEL: ParametrosDoMenu = {
  ...VAZIO,
  isEditable: true,
  editFlags: { canCut: true, canCopy: true, canPaste: true, canSelectAll: true },
};

function acoes(itens: readonly ItemDoMenu[]): AcaoDoMenu[] {
  return itens.flatMap((i) => (i.tipo === "acao" ? [i.acao] : []));
}

const OPCOES = { corretorLigado: true, abrirLinkPermitido: true };

describe("menu nativo da casca", () => {
  /*
    ⚠ **O defeito que mais aparecia:** "Toggle spellcheck" entrava
    incondicionalmente, então `menu.items.length > 0` era sempre verdadeiro e a
    caixa abria em cima de qualquer coisa — com UM item que ninguém procurava
    ali.
  */
  it("sem nada sob o ponteiro, NÃO abre menu nenhum", () => {
    assert.deepEqual(menuNativo(VAZIO, OPCOES), []);
  });

  it("campo editável tem as quatro de edição e o corretor no fim", () => {
    const itens = menuNativo(EDITAVEL, OPCOES);
    assert.deepEqual(acoes(itens), [
      "recortar",
      "copiar",
      "colar",
      "colarSemFormato",
      "selecionarTudo",
      "alternarCorretor",
    ]);
  });

  /*
    ⚠ `editFlags` e não adivinhação: um campo somente-leitura tem
    `canPaste: false`, e "Colar" ali é um item que não faz nada.
  */
  it("campo somente-leitura não oferece colar nem recortar", () => {
    const itens = menuNativo(
      {
        ...EDITAVEL,
        editFlags: { canCut: false, canCopy: true, canPaste: false, canSelectAll: true },
      },
      OPCOES,
    );
    assert.deepEqual(acoes(itens), ["copiar", "selecionarTudo", "alternarCorretor"]);
  });

  it("palavra errada traz sugestões, dicionário e depois a edição", () => {
    const itens = menuNativo(
      { ...EDITAVEL, misspelledWord: "menssagem", dictionarySuggestions: ["mensagem", "massagem"] },
      OPCOES,
    );
    assert.deepEqual(
      itens.flatMap((i) => (i.tipo === "sugestao" ? [i.palavra] : [])),
      ["mensagem", "massagem"],
    );
    assert.equal(acoes(itens)[0], "aprenderPalavra");
    assert.equal(acoes(itens).at(-1), "alternarCorretor");
  });

  /* O corretor é configuração de onde se DIGITA — fora de campo editável ele
     não tem sobre o que agir. */
  it("o corretor NÃO aparece fora de campo editável", () => {
    const itens = menuNativo({ ...VAZIO, selectionText: "algo" }, OPCOES);
    assert.equal(acoes(itens).includes("alternarCorretor"), false);
  });

  it("seleção fora de campo dá copiar, e só", () => {
    assert.deepEqual(acoes(menuNativo({ ...VAZIO, selectionText: "trecho" }, OPCOES)), [
      "copiar",
    ]);
  });

  /*
    ⚠ `canCopy` é `true` em quase todo lugar selecionável; um "Copiar" que
    copia string vazia é pior que a ausência.
  */
  it("seleção só de espaços não conta", () => {
    assert.deepEqual(menuNativo({ ...VAZIO, selectionText: "   \n " }, OPCOES), []);
  });

  it("link dá abrir e copiar endereço", () => {
    assert.deepEqual(
      acoes(menuNativo({ ...VAZIO, linkURL: "https://exemplo.test/x" }, OPCOES)),
      ["abrirLink", "copiarLink"],
    );
  });

  /*
    ⚠ **O caso de SEGURANÇA.** `shell.openExternal` entrega ao sistema uma URL
    escrita por outra pessoa; só os esquemas que `abrirNoNavegadorDoSistema`
    aceita podem chegar lá. Copiar continua valendo — copiar não executa nada.
  */
  it("esquema que o navegador não aceita perde ABRIR e mantém copiar", () => {
    const itens = menuNativo(
      { ...VAZIO, linkURL: "file:///C:/Windows/System32/cmd.exe" },
      { ...OPCOES, abrirLinkPermitido: false },
    );
    assert.deepEqual(acoes(itens), ["copiarLink"]);
  });

  it("imagem dá copiar, salvar e copiar endereço", () => {
    assert.deepEqual(
      acoes(
        menuNativo(
          { ...VAZIO, mediaType: "image", srcURL: "https://exemplo.test/i.png" },
          OPCOES,
        ),
      ),
      ["copiarImagem", "salvarImagem", "copiarEnderecoDaImagem"],
    );
  });

  it("vídeo não é imagem — nada de copiar imagem", () => {
    assert.deepEqual(
      menuNativo({ ...VAZIO, mediaType: "video", srcURL: "https://x.test/v.mp4" }, OPCOES),
      [],
    );
  });

  /*
    Separador no começo, no fim ou dobrado lê como item que falhou ao
    carregar — e a montagem, item a item, produziria os três.
  */
  it("nenhum separador no começo, no fim, nem dois seguidos", () => {
    const casos: ParametrosDoMenu[] = [
      EDITAVEL,
      { ...EDITAVEL, misspelledWord: "x", dictionarySuggestions: ["y"] },
      { ...VAZIO, selectionText: "t", linkURL: "https://a.test", mediaType: "image", srcURL: "https://a.test/i.png" },
      { ...VAZIO, linkURL: "https://a.test" },
      { ...VAZIO, mediaType: "image", srcURL: "https://a.test/i.png" },
    ];
    for (const caso of casos) {
      const itens = menuNativo(caso, OPCOES);
      assert.notEqual(itens[0]?.tipo, "separador");
      assert.notEqual(itens.at(-1)?.tipo, "separador");
      for (let i = 1; i < itens.length; i++) {
        if (itens[i]?.tipo === "separador") {
          assert.notEqual(itens[i - 1]?.tipo, "separador");
        }
      }
    }
  });
});

describe("idioma do corretor", () => {
  /*
    ⚠ **`setSpellCheckerLanguages` nunca era chamado**, então o corretor ficava
    em inglês dentro de um app em português — toda palavra sublinhada, que é o
    mesmo que não ter corretor com o custo de riscar a tela.
  */
  it("usa o do sistema quando ele existe", () => {
    assert.deepEqual(idiomasDoCorretor("pt-BR", ["en-US", "pt-BR", "es"]), ["pt-BR"]);
  });

  it("aceita o mesmo idioma com outra granularidade", () => {
    assert.deepEqual(idiomasDoCorretor("pt-BR", ["en-US", "pt-PT"]), ["pt-PT"]);
    assert.deepEqual(idiomasDoCorretor("pt", ["en-US", "pt-BR"]), ["pt-BR"]);
  });

  /* ⚠ Reserva e NÃO acréscimo: somar inglês faria o corretor validar contra a
     união dos dicionários e aceitar palavra inglesa no meio do português. */
  it("cai em inglês só quando o idioma do sistema não está disponível", () => {
    assert.deepEqual(idiomasDoCorretor("ja", ["en-US", "pt-BR"]), ["en-US"]);
  });

  /* Pedir um código que a sessão não conhece LANÇA, e um erro na partida
     derrubaria a janela por causa de um corretor. */
  it("sem nada disponível, não pede nada", () => {
    assert.deepEqual(idiomasDoCorretor("pt-BR", []), []);
    assert.deepEqual(idiomasDoCorretor("", []), []);
  });
});
