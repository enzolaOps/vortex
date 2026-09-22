/**
 * Qual seletor do composer está aberto — emoji, GIF, figurinha ou soundboard.
 *
 * ⚠ **Existe porque ⌘E e ⌘G eram anunciados na página de atalhos e não
 * abriam nada.** Os quatro popovers eram cada um dono do próprio
 * aberto/fechado, com estado local dentro de `SeletorEmPopover` — e estado
 * local não tem como ser alcançado por um listener de `document`, que é onde
 * um atalho de teclado precisa morar.
 *
 * Store module-level e não Context, pela lei nº 1: quem abre pode ser um
 * atalho global, e nenhum atalho global está dentro de árvore de componente.
 *
 * ⚠ **Um de cada vez, e isso é um GANHO e não uma limitação.** Com quatro
 * estados independentes, nada impedia dois popovers abertos ao mesmo tempo
 * sobre o mesmo composer — o Radix fecha por clique fora, mas abrir pelo
 * teclado com outro já aberto empilharia dois painéis de 452px na mesma
 * borda. É a mesma decisão do registro de modais.
 */

/**
 * O id da ferramenta, como `FerramentasDoComposer` a nomeia.
 *
 * `string` e não união fechada de propósito: a lista de ferramentas é dado do
 * componente (rótulo, ícone, painel), e duplicá-la aqui criaria duas listas
 * que precisam concordar. Quem garante o pareamento é o teste de atalhos, que
 * exige que os ids usados pelos atalhos existam na fileira.
 */
export type FerramentaDoComposer = string;

type Ouvinte = () => void;

let aberta: FerramentaDoComposer | null = null;
const ouvintes = new Set<Ouvinte>();

export function assinarFerramentaDoComposer(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável: uma string ou `null`, comparadas por valor. */
export function lerFerramentaDoComposer(): FerramentaDoComposer | null {
  return aberta;
}

function definir(nova: FerramentaDoComposer | null): void {
  if (aberta === nova) return;
  aberta = nova;
  for (const o of ouvintes) o();
}

/** Abre — ou fecha, se já for essa. É o que a mão espera de um atalho. */
export function abrirFerramentaDoComposer(id: FerramentaDoComposer): void {
  definir(aberta === id ? null : id);
}

/** O que o `onOpenChange` do Radix chama, e o que `Esc` e o clique fora usam. */
export function definirFerramentaDoComposer(
  id: FerramentaDoComposer,
  abrir: boolean,
): void {
  if (abrir) definir(id);
  else if (aberta === id) definir(null);
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparFerramentaDoComposer(): void {
  aberta = null;
}
