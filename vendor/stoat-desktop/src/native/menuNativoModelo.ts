/**
 * O menu nativo da casca — QUANDO ele existe e o que tem dentro.
 *
 * ⚠ **O que havia era um menu de corretor ortográfico com um botão solto.**
 * Ele montava as sugestões, "Add to dictionary" e — sempre, em qualquer lugar,
 * em inglês — "Toggle spellcheck". Como o último entrava incondicionalmente, a
 * guarda `menu.items.length > 0` era sempre verdadeira: clicar com o direito
 * em qualquer ponto que o app não interceptasse abria uma caixa com UM item
 * que ninguém procurava ali. E campo de texto não tinha recortar, copiar nem
 * colar pelo ponteiro — num app Electron, onde o menu do navegador não existe,
 * isso significa que não havia como colar com o mouse.
 *
 * ⚠ **"Nativo só onde o app não abre o próprio" é de graça, e vale dizer por
 * quê:** quando a página chama `preventDefault` no `contextmenu` — que é o que
 * o gatilho do Radix faz —, o Chromium não manda o pedido de menu, e este
 * evento simplesmente não dispara. O que sobra aqui é exatamente o resto: o
 * `textarea` do composer, um campo de login, o vão da janela. O trabalho deste
 * módulo é servir bem esse resto, e **não abrir nada quando não há o que
 * oferecer**.
 *
 * ⚠ **Sem `electron`, de propósito** — a mesma doutrina de
 * `preferenciasDoCliente.ts`. Aqui está a DECISÃO (o que entra, em que ordem,
 * com que rótulo), que é o que quebra em silêncio; os efeitos (`copy()`,
 * `downloadURL`, `shell.openExternal`) moram em `window.ts` e não têm o que
 * testar.
 */

/** O recorte de `ContextMenuParams` que a decisão usa. */
export type ParametrosDoMenu = {
  readonly isEditable: boolean;
  readonly editFlags: {
    readonly canCut: boolean;
    readonly canCopy: boolean;
    readonly canPaste: boolean;
    readonly canSelectAll: boolean;
  };
  readonly selectionText: string;
  /** `""` quando não há link sob o ponteiro. */
  readonly linkURL: string;
  /** `"none" | "image" | "video" | "audio" | "canvas" | "file" | "plugin"`. */
  readonly mediaType: string;
  readonly srcURL: string;
  readonly misspelledWord: string;
  readonly dictionarySuggestions: readonly string[];
};

export type AcaoDoMenu =
  | "aprenderPalavra"
  | "alternarCorretor"
  | "recortar"
  | "copiar"
  | "colar"
  | "colarSemFormato"
  | "selecionarTudo"
  | "abrirLink"
  | "copiarLink"
  | "copiarImagem"
  | "salvarImagem"
  | "copiarEnderecoDaImagem";

export type ItemDoMenu =
  | { readonly tipo: "sugestao"; readonly palavra: string }
  | { readonly tipo: "separador" }
  | { readonly tipo: "acao"; readonly acao: AcaoDoMenu; readonly rotulo: string };

/**
 * Os rótulos, em português.
 *
 * ⚠ **O app inteiro é em português e este menu estava em inglês** — "Add to
 * dictionary" e "Toggle spellcheck" eram as duas únicas strings da casca que
 * alguém lia sem querer. Ficam aqui, num mapa, porque é o que permite o teste
 * conferir a AÇÃO sem depender do texto.
 */
export const ROTULO: Record<AcaoDoMenu, string> = {
  aprenderPalavra: "Adicionar ao dicionário",
  alternarCorretor: "Corretor ortográfico",
  recortar: "Recortar",
  copiar: "Copiar",
  colar: "Colar",
  colarSemFormato: "Colar sem formatação",
  selecionarTudo: "Selecionar tudo",
  abrirLink: "Abrir link no navegador",
  copiarLink: "Copiar endereço do link",
  copiarImagem: "Copiar imagem",
  salvarImagem: "Salvar imagem como…",
  copiarEnderecoDaImagem: "Copiar endereço da imagem",
};

function acao(a: AcaoDoMenu): ItemDoMenu {
  return { tipo: "acao", acao: a, rotulo: ROTULO[a] };
}

/**
 * O menu, em ordem. Lista VAZIA significa "não abra nada".
 *
 * ⚠ **A ordem é a do sistema, e não a do design:** este é o menu do SISTEMA
 * operacional aparecendo dentro do app, e quem o abre espera a ordem que
 * aprendeu em todo outro programa — edição primeiro, depois o que está sob o
 * ponteiro. Inverter para "parecer nosso" seria o pior dos dois mundos.
 */
export function menuNativo(
  p: ParametrosDoMenu,
  opcoes: { readonly corretorLigado: boolean; readonly abrirLinkPermitido: boolean },
): ItemDoMenu[] {
  const itens: ItemDoMenu[] = [];

  /*
    O corretor, e ele só existe em campo EDITÁVEL.

    ⚠ Era o contrário: "Toggle spellcheck" entrava sempre, então a caixa abria
    em cima de uma mensagem, de um avatar ou do vão da janela oferecendo um
    ajuste que só afeta onde se digita.
  */
  if (p.isEditable) {
    for (const palavra of p.dictionarySuggestions) {
      itens.push({ tipo: "sugestao", palavra });
    }
    if (p.misspelledWord !== "") {
      if (itens.length > 0) itens.push({ tipo: "separador" });
      itens.push(acao("aprenderPalavra"));
    }
    if (itens.length > 0) itens.push({ tipo: "separador" });

    /*
      Edição pelo `editFlags` e não por adivinhação: é o Chromium dizendo o que
      o campo aceita AGORA. Um `input` somente-leitura tem `canPaste: false`, e
      oferecer "Colar" ali é um item que não faz nada.
    */
    if (p.editFlags.canCut) itens.push(acao("recortar"));
    if (p.editFlags.canCopy) itens.push(acao("copiar"));
    if (p.editFlags.canPaste) {
      itens.push(acao("colar"));
      /* Colar sem formatação: o composer é texto puro, e colar de um editor
         rico traz estilo que ele não sabe representar. */
      itens.push(acao("colarSemFormato"));
    }
    if (p.editFlags.canSelectAll) itens.push(acao("selecionarTudo"));

    /* A alternância do corretor no FIM, separada: ela é configuração, não
       ação sobre o que está ali. O estado vai no `checked` do item real. */
    if (itens.length > 0) itens.push({ tipo: "separador" });
    itens.push(acao("alternarCorretor"));
    return limpar(itens);
  }

  /*
    Fora de campo editável: só COPIAR, e só com seleção de verdade.

    `canCopy` sozinho não basta — o Chromium o marca `true` em qualquer lugar
    selecionável, e um "Copiar" que copia string vazia é pior que a ausência.
  */
  if (p.selectionText.trim() !== "") itens.push(acao("copiar"));

  if (p.linkURL !== "") {
    if (itens.length > 0) itens.push({ tipo: "separador" });
    /*
      ⚠ **"Abrir link" só existe para o que o navegador do sistema aceita.**
      `abrirNoNavegadorDoSistema` já decide isso em `privilegioModelo.ts` —
      `http:`, `https:` e `mailto:` — e é a mesma função que o
      `setWindowOpenHandler` consulta. Passar um `file:` ou um esquema
      inventado para `shell.openExternal` é entregar ao sistema uma URL escrita
      por outra pessoa; copiar o endereço continua valendo em qualquer caso,
      porque copiar não executa nada.
    */
    if (opcoes.abrirLinkPermitido) itens.push(acao("abrirLink"));
    itens.push(acao("copiarLink"));
  }

  if (p.mediaType === "image" && p.srcURL !== "") {
    if (itens.length > 0) itens.push({ tipo: "separador" });
    itens.push(acao("copiarImagem"));
    itens.push(acao("salvarImagem"));
    itens.push(acao("copiarEnderecoDaImagem"));
  }

  return limpar(itens);
}

/**
 * Sem separador no começo, no fim, nem dois seguidos.
 *
 * A montagem acima decide item a item, e cada `if` que não entra deixaria uma
 * régua sem nada de um dos lados — que num menu de sistema lê como item que
 * falhou ao carregar.
 */
function limpar(itens: readonly ItemDoMenu[]): ItemDoMenu[] {
  const saida: ItemDoMenu[] = [];
  for (const item of itens) {
    if (item.tipo !== "separador") {
      saida.push(item);
      continue;
    }
    if (saida.length === 0) continue;
    if (saida[saida.length - 1]?.tipo === "separador") continue;
    saida.push(item);
  }
  while (saida.length > 0 && saida[saida.length - 1]?.tipo === "separador") {
    saida.pop();
  }
  return saida;
}

/**
 * O idioma do corretor, a partir do que o sistema diz.
 *
 * ⚠ **`setSpellCheckerLanguages` nunca foi chamado**, então o corretor ficava
 * no padrão do Chromium — inglês — dentro de um app em português: TODA palavra
 * digitada saía sublinhada, o que é o mesmo que não ter corretor, com o custo
 * de riscar a tela inteira.
 *
 * ⚠ **A lista disponível é consultada, e o pedido é FILTRADO por ela.**
 * `setSpellCheckerLanguages` LANÇA com um código que a sessão não conhece, e
 * um erro no caminho de partida derrubaria a janela por causa de um corretor.
 *
 * ⚠ **`en-US` de reserva e não de acréscimo.** Somar inglês ao português faria
 * o corretor aceitar palavra inglesa escrita por engano no meio do português —
 * ele passa a validar contra a UNIÃO dos dicionários. Só entra quando o
 * idioma do sistema não está disponível, que é o caso em que a alternativa é
 * ficar sem corretor nenhum.
 *
 * ⚠ **macOS ignora a lista** (usa o corretor do sistema), e chamar lá é no-op
 * — não é erro, e por isso não há exceção escrita aqui.
 */
export function idiomasDoCorretor(
  doSistema: string,
  disponiveis: readonly string[],
): string[] {
  const querer = doSistema.trim();
  if (querer !== "" && disponiveis.includes(querer)) return [querer];

  /* `pt-BR` pedido com só `pt` disponível, ou o contrário: o prefixo é o
     mesmo idioma com outra granularidade, e recusá-lo por causa do sufixo
     deixaria sem corretor quem tem o dicionário certo instalado. */
  const prefixo = querer.split("-")[0]?.toLowerCase() ?? "";
  if (prefixo !== "") {
    const perto = disponiveis.find((d) => d.toLowerCase().split("-")[0] === prefixo);
    if (perto) return [perto];
  }

  if (disponiveis.includes("en-US")) return ["en-US"];
  return [];
}
