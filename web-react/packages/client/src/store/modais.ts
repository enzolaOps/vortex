/**
 * Qual modal está aberto.
 *
 * O upstream tem **59 modais de produto** e o port tem zero; o `Dialog` da
 * fase 2 nasceu com um consumidor só. O plano de paridade abre dezenas deles —
 * criar servidor, convite, apagar canal, perfil, MFA — e sem um lugar comum
 * cada um viraria um store próprio mais um `{visivel ? <X/> : null}` no `App`.
 * Cinquenta e nove vezes.
 *
 * Store module-level pela lei nº 1, e aqui ela é literal: quem abre um modal é
 * um item de menu de contexto, um atalho de teclado ou um caminho de erro, e
 * nenhum dos três está numa árvore de componentes que o `App` controle.
 *
 * **O `PainelDeEdicao` NÃO passa por aqui, e é decisão.** Ele não é modal: não
 * escurece o app, não prende foco, e existe justamente para a pessoa MEXER no
 * que está atrás dele enquanto ele está aberto. Empurrá-lo para cá o
 * transformaria no que ele não é.
 */

/**
 * Os modais que existem. União FECHADA — é o mecanismo, não a documentação.
 *
 * `Record<ModalId, …>` no registro de renderização faz modal novo não compilar
 * até ser registrado, exatamente como `NOME_DO_PAINEL` faz por `PainelId`. O
 * default de uma decisão esquecida é "pare".
 *
 * Não há entrada especulativa: o dia em que "criar servidor" existir na
 * interface é o dia em que ela entra aqui. A ausência é o que impede esta
 * união de virar uma cópia otimista do roadmap.
 */
export const MODAIS = [
  "paleta",
  "adicionarServidor",
  "canal",
  "exclusao",
  "convite",
  "moderar",
  "imagem",
  "link",
  "encaminhar",
  "enquete",
  "novoGrupo",
  "grupo",
  "privacidadeDoServidor",
  "apelido",
  "tela",
  "pasta",
] as const;

export type ModalId = (typeof MODAIS)[number];

type Ouvinte = () => void;

let aberto: ModalId | null = null;
const ouvintes = new Set<Ouvinte>();

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarModal(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * Qual está aberto, ou `null`.
 *
 * Devolve a STRING e não um objeto de estado: primitivo é comparado por valor
 * pelo `Object.is`, então não há armadilha de referência a evitar — e quem
 * assina só acorda quando o modal realmente troca.
 */
export function lerModal(): ModalId | null {
  return aberto;
}

/**
 * Um de cada vez, e abrir por cima FECHA o anterior.
 *
 * Pilha de modais é o que produz a tela com três véus empilhados onde `Esc`
 * fecha um e ninguém sabe qual. Se um dia houver um fluxo que precise de dois
 * — MFA dentro de "apagar conta" —, ele é UM modal com dois passos, que é
 * como o upstream já resolve o `mfaFlow`.
 */
export function abrirModal(id: ModalId): void {
  if (aberto === id) return;
  aberto = id;
  avisar();
}

export function fecharModal(): void {
  if (aberto === null) return;
  aberto = null;
  avisar();
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparModais(): void {
  aberto = null;
}
