/**
 * Leva os estilos da janela principal para o documento da janela destacada e
 * os mantém em dia.
 *
 * ⚠ **Incremental, e não "apaga tudo e copia de novo".** Uma folha nova (o
 * chunk de CSS de uma tela aberta agora, uma `<style>` que um componente
 * injeta) muta a `<head>` da principal; recopiar todas as `<link>` a cada
 * mutação faria a janela recarregar cada folha — e piscar sem estilo — por
 * causa de uma folha que ela nem usa. Aqui a fonte é a chave: fonte nova
 * ganha cópia, fonte que saiu leva a cópia junto, `<style>` que mudou de
 * texto (HMR) tem o texto atualizado.
 *
 * ⚠ **Os atributos de `<html>` vêm junto**: tema (`data-tema`), paleta
 * escolhida (custom properties no `style`), idioma e direção moram ali, e sem
 * eles a janela abriria no tema padrão enquanto a principal está em outro.
 * Por isso nada que a janela precise pode morar em atributo do `<html>` dela:
 * o próximo espelhamento o apaga. O que é só dela vai no `<body>`.
 *
 * Devolve a função que para de acompanhar.
 */
const SELETOR_DE_ESTILO = 'style, link[rel="stylesheet"]';

function copiar(fonte: Element, destino: Document): Element {
  const copia = destino.importNode(fonte, true);
  /* O `href` RESOLVIDO: relativo a quê, num documento `about:blank`, depende de
     regra de herança de base que não vale a pena apostar. */
  if (fonte.tagName === "LINK") {
    copia.setAttribute("href", (fonte as HTMLLinkElement).href);
  }
  return copia;
}

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
