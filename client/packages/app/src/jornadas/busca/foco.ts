/**
 * Para onde o foco volta quando a busca fecha, e o pedido de foco no campo.
 *
 * Mesmo desenho de `chat/saltos.ts`: um canal de comunicação mínimo, sem estado
 * de React. O painel de busca vive na gaveta do shell e o atalho vive na área do
 * canal — duas árvores que não se conhecem.
 */

let origem: HTMLElement | null = null;

/** Guarda quem tinha o foco ao abrir (o botão do cabeçalho, o campo de escrever, a lista). */
export function lembrarOrigemDoFoco(el: Element | null = document.activeElement): void {
  origem = el instanceof HTMLElement && el !== document.body ? el : null;
}

/**
 * Devolve o foco a quem o tinha. Se esse elemento já não existe (a pessoa
 * trocou de canal, o painel do outro lado desmontou), cai no botão da busca no
 * cabeçalho — o foco nunca fica no vazio, que é onde o teclado deixa de servir.
 */
export function devolverFoco(gatilho = "[data-busca-gatilho]"): void {
  const alvo =
    origem !== null && origem.isConnected
      ? origem
      : document.querySelector<HTMLElement>(gatilho);
  origem = null;
  alvo?.focus();
}

const pedidosDeFoco = new Set<() => void>();

/** O painel aberto escuta: Ctrl+F de novo traz o foco ao campo. */
export function aoPedirFocoNoCampo(ouvinte: () => void): () => void {
  pedidosDeFoco.add(ouvinte);
  return () => {
    pedidosDeFoco.delete(ouvinte);
  };
}

export function pedirFocoNoCampo(): void {
  for (const ouvinte of pedidosDeFoco) ouvinte();
}

/** Mac usa Cmd; o resto, Ctrl. */
export function ehMac(): boolean {
  return /Mac|iPhone|iPad/u.test(globalThis.navigator.platform);
}

/** O atalho como a plataforma o escreve. */
export function atalhoDaBusca(): string {
  return ehMac() ? "⌘F" : "Ctrl+F";
}
