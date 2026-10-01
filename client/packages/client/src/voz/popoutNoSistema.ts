/**
 * O popout da chamada como janela do SISTEMA (D-VOZ-15) — a decisão, sem
 * janela nenhuma.
 *
 * O design pede a janelinha "sempre no topo, arrastável, sem rail nem
 * sidebar". No navegador ela é um cartão dentro da página, e continua sendo;
 * na casca ela sai para uma janela própria, que fica visível com o Vortex
 * atrás de outro app — que é o caso inteiro para o qual ela existe.
 *
 * ⚠ **A janela é SUPERFÍCIE, não segunda sessão.** Ela é aberta por
 * `window.open("")` na MESMA origem e no MESMO processo, e o React desenha
 * nela por portal: uma árvore, um store e uma conexão de voz. É também o que
 * mantém o vídeo — a faixa já está neste renderer, e um retrato do estado
 * mandado por porta (como faz o overlay do jogo) não atravessaria um
 * `MediaStreamTrack`.
 *
 * O acoplamento com a casca é o nome da janela e mais nada: a casca libera
 * `window.open` só para ele (`vendor/stoat-desktop/src/native/
 * popoutDeVozModelo.ts`). Casca antiga nega, `window.open` devolve `null`, e o
 * cliente fica com o cartão.
 */

/** O MESMO texto de `NOME_DO_POPOUT` na casca. */
export const NOME_DA_JANELA = "vortex-popout-de-voz";

export type CondicaoDoPopout = {
  readonly fora: boolean;
  readonly fechado: boolean;
  /** A sala da chamada está na coluna de conteúdo. */
  readonly naSala: boolean;
  /** O popout vai para uma janela do sistema, e não para o cartão. */
  readonly noSistema: boolean;
  /** A janela PRINCIPAL tem o foco. Só conta no sistema. */
  readonly principalComFoco: boolean;
};

/**
 * O popout aparece?
 *
 * ⚠ **A sala na coluna só o esconde enquanto a principal está à frente**, e
 * é a diferença entre cartão e janela. O cartão some com a sala aberta porque
 * os dois estariam na mesma tela dizendo a mesma coisa. A janela do sistema
 * existe para quando a pessoa SAI do app: com a sala na coluna e o Vortex
 * atrás de outro programa, esconder a janela seria sumir com a chamada
 * justamente quando ela não está mais em lugar nenhum da tela.
 */
export function popoutVisivel(c: CondicaoDoPopout): boolean {
  if (c.fora || c.fechado) return false;
  if (!c.naSala) return true;
  return c.noSistema && !c.principalComFoco;
}

/* ------------------------------------------------------ os estilos */

const SELETOR_DE_ESTILO = 'style, link[rel="stylesheet"]';

function copiar(fonte: Element, destino: Document): Element {
  const copia = destino.importNode(fonte, true);
  /*
    O `href` RESOLVIDO: o atributo pode ser relativo, e relativo a quê num
    documento `about:blank` depende de regra de herança de base que não vale
    a pena apostar.
  */
  if (fonte.tagName === "LINK") {
    copia.setAttribute("href", (fonte as HTMLLinkElement).href);
  }
  return copia;
}

/**
 * Leva os estilos da principal para o documento da janela e os mantém em dia.
 *
 * ⚠ **Incremental, e não "apaga tudo e copia de novo".** Uma folha nova (o
 * chunk de CSS de uma tela aberta agora, uma `<style>` que um componente
 * injeta) muta a `<head>` da principal; recopiar todas as `<link>` a cada
 * mutação faria a janela recarregar cada folha — e piscar sem estilo — por
 * causa de uma folha que ela nem usa. Aqui a fonte é a chave: fonte nova
 * ganha cópia, fonte que saiu leva a cópia junto, `<style>` que mudou de
 * texto (HMR) tem o texto atualizado.
 *
 * ⚠ **Os atributos de `<html>` vêm junto**: tema (`data-theme`), paleta
 * escolhida (custom properties no `style`), idioma e direção moram ali, e sem
 * eles a janela abriria no tema padrão enquanto a principal está em outro.
 *
 * Devolve a função que para de acompanhar.
 */
export function espelharEstilos(origem: Document, destino: Document): () => void {
  const copias = new Map<Element, Element>();

  const sincronizarFolhas = (): void => {
    const fontes = Array.from(origem.head.querySelectorAll(SELETOR_DE_ESTILO));
    const vivas = new Set(fontes);
    for (const [fonte, copia] of copias) {
      if (!vivas.has(fonte)) {
        copia.remove();
        copias.delete(fonte);
      }
    }
    for (const fonte of fontes) {
      const copia = copias.get(fonte);
      if (!copia) {
        const nova = copiar(fonte, destino);
        destino.head.append(nova);
        copias.set(fonte, nova);
      } else if (fonte.tagName === "STYLE" && copia.textContent !== fonte.textContent) {
        copia.textContent = fonte.textContent;
      }
    }
  };

  const sincronizarRaiz = (): void => {
    const de = origem.documentElement;
    const para = destino.documentElement;
    for (const nome of Array.from(para.getAttributeNames())) {
      if (!de.hasAttribute(nome)) para.removeAttribute(nome);
    }
    for (const nome of de.getAttributeNames()) {
      const valor = de.getAttribute(nome) ?? "";
      if (para.getAttribute(nome) !== valor) para.setAttribute(nome, valor);
    }
  };

  sincronizarFolhas();
  sincronizarRaiz();

  const Observador = origem.defaultView?.MutationObserver;
  if (!Observador) return () => undefined;

  const naCabeca = new Observador(sincronizarFolhas);
  naCabeca.observe(origem.head, { childList: true, subtree: true, characterData: true });
  const naRaiz = new Observador(sincronizarRaiz);
  naRaiz.observe(origem.documentElement, { attributes: true });

  return () => {
    naCabeca.disconnect();
    naRaiz.disconnect();
  };
}
