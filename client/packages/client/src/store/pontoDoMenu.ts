/**
 * O que havia SOB O PONTEIRO quando o menu foi pedido.
 *
 * ⚠ **O Radix suprime o menu nativo, e com ele sumiu metade do que um menu de
 * contexto faz.** "Copiar seleção", "Copiar endereço do link", "Abrir link",
 * "Copiar imagem" e "Salvar imagem" são do navegador, e o `preventDefault` que
 * abre o menu do app os apaga sem oferecer substituto — a auditoria de clique
 * direito mediu isso como a quebra nº 7. Numa superfície onde o conteúdo é
 * escrito por outras pessoas, "copiar o endereço do link" é também a única
 * forma de conferir para onde ele vai antes de clicar.
 *
 * ⚠ **Store SEPARADO do alvo, e a separação é o ponto.** `menuDeMensagem`
 * responde "sobre QUEM é o menu", e a linha inteira assina essa resposta —
 * pendurar o ponto do clique ali faria cada gesto acordar duas linhas por um
 * dado que só o CONTEÚDO do menu lê. São duas perguntas, e a segunda tem um
 * leitor só.
 *
 * ⚠ **Lido do DOM, sem atributo novo.** O texto já é `<a href>`, a imagem já é
 * `<img src>` e o arquivo já é `<a href download>` — o DOM diz tudo. Marcar a
 * árvore com `data-` para repetir o que os elementos padrão já dizem seria
 * inventar um segundo vocabulário para a mesma coisa.
 */

export type PontoDoMenu = {
  /** A seleção, quando ela está DENTRO da linha alvo. `""` quando não há. */
  readonly selecao: string;
  /** O `href` do `<a>` sob o ponteiro — link de texto, nunca anexo. */
  readonly link: string | undefined;
  /** A `src` da `<img>` sob o ponteiro. */
  readonly imagem: string | undefined;
  /** O nome dela, para "Salvar imagem" entregar o arquivo com nome. */
  readonly nomeDaImagem: string | undefined;
  /** O `href` de um `<a download>` — anexo que não é mídia. */
  readonly arquivo: string | undefined;
};

const VAZIO: PontoDoMenu = {
  selecao: "",
  link: undefined,
  imagem: undefined,
  nomeDaImagem: undefined,
  arquivo: undefined,
};

/**
 * Referência cacheada — a armadilha nº 1 do briefing.
 *
 * Montar o objeto no getter faria `useSyncExternalStore` concluir que mudou a
 * cada render, e o menu entraria em loop. `VAZIO` é constante pelo mesmo
 * motivo: "não havia nada sob o ponteiro" precisa ser sempre o MESMO objeto.
 */
let ponto: PontoDoMenu = VAZIO;

const ouvintes = new Set<() => void>();

export function assinarPontoDoMenu(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerPontoDoMenu(): PontoDoMenu {
  return ponto;
}

export function definirPontoDoMenu(novo: PontoDoMenu): void {
  if (
    ponto.selecao === novo.selecao &&
    ponto.link === novo.link &&
    ponto.imagem === novo.imagem &&
    ponto.nomeDaImagem === novo.nomeDaImagem &&
    ponto.arquivo === novo.arquivo
  ) {
    return;
  }
  ponto = novo;
  for (const o of ouvintes) o();
}

export function limparPontoDoMenu(): void {
  definirPontoDoMenu(VAZIO);
}

/**
 * A seleção, SE ela estiver dentro do nó alvo.
 *
 * ⚠ **O `contains` não é zelo.** Selecionar num lugar e clicar com o direito
 * noutro é o gesto mais comum de quem lê rolando — sem o teste, "Copiar
 * seleção" apareceria no menu de uma mensagem oferecendo o texto de outra, e o
 * erro só apareceria na colagem.
 *
 * ⚠ **`isCollapsed` antes de `toString`**: um clique simples deixa uma seleção
 * de comprimento zero ancorada onde se clicou, e ela passa no `contains`. Sem
 * este teste o item apareceria em todo clique direito, com texto vazio.
 */
export function selecaoDentroDe(no: Element | null): string {
  if (!no) return "";
  const sel = no.ownerDocument.defaultView?.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return "";
  const faixa = sel.getRangeAt(0);
  if (!no.contains(faixa.commonAncestorContainer)) return "";
  return sel.toString().trim();
}

/**
 * Resolve o ponto a partir do nó que recebeu o gesto.
 *
 * ⚠ **A ordem entre link e ARQUIVO importa.** Um anexo que não é mídia é um
 * `<a href download>`; tratá-lo como link de texto ofereceria "Abrir link"
 * para um `.pdf`, que no navegador é baixar por outro nome. O `download`
 * distingue os dois sem precisar olhar a extensão.
 */
export function pontoNoDom(
  alvoDoDom: EventTarget | null,
  linha: Element | null,
): PontoDoMenu {
  /* Pato e não `instanceof Element`: nó de texto, e alvo vindo de outro
     `window` (o popout) não é `Element` DESTE realm. */
  const cru = alvoDoDom as Partial<Element> | null;
  if (typeof cru?.closest !== "function") return VAZIO;
  const el = cru as Element;

  const ancora = el.closest<HTMLAnchorElement>("a[href]");
  const baixa = ancora?.hasAttribute("download") === true;
  const img = el.closest<HTMLImageElement>("img");

  const novo: PontoDoMenu = {
    selecao: selecaoDentroDe(linha),
    link: ancora && !baixa ? ancora.href : undefined,
    /* `currentSrc` e não `src`: com `srcset` é ele que diz o que o navegador
       realmente baixou, e é esse arquivo que a pessoa está vendo. */
    imagem: img ? (img.currentSrc || img.src) : undefined,
    nomeDaImagem: img?.alt !== undefined && img.alt !== "" ? img.alt : undefined,
    arquivo: ancora && baixa ? ancora.href : undefined,
  };

  /* Sem nada sob o ponteiro, a constante — para o getter continuar estável. */
  if (
    novo.selecao === "" &&
    novo.link === undefined &&
    novo.imagem === undefined &&
    novo.arquivo === undefined
  ) {
    return VAZIO;
  }
  return novo;
}
