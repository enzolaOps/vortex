/**
 * Classes compartilhadas entre menu de contexto e dropdown.
 *
 * O Radix expõe os dois em namespaces separados, mas a anatomia é a mesma:
 * content, item, separator, label. Duplicar o estilo faria os dois divergirem
 * na primeira mudança de token — e um menu que abre no botão direito diferente
 * do que abre no botão "..." é o tipo de inconsistência que ninguém reporta e
 * todo mundo sente.
 *
 * O que NÃO é compartilhado: a var de altura disponível, que o Radix nomeia por
 * primitivo (`--radix-context-menu-content-available-height` contra
 * `--radix-dropdown-menu-content-available-height`). Cada wrapper passa a sua.
 *
 * ⚠ **A separação da camada flutuante mudou de mecanismo, e a razão anterior
 * caiu junto com a rampa antiga.**
 *
 * O que estava escrito aqui: `border-border-strong` porque a sutil sobre
 * `--vx-surface-2` media 1,05:1, e `box-shadow` era proibido pela regra
 * "profundidade vem de camada, não de sombra". Os dois pressupostos morreram
 * com a identidade nova:
 *
 * 1. **O menu não mora mais em `surface-2`.** Aquela era a superfície mais alta
 *    de uma rampa de QUATRO, e ela também era o conteúdo — daí o 1,05:1. A
 *    rampa tem cinco degraus agora e `surface-4` existe só para o que flutua.
 * 2. **Sombra deixou de ser proibida, e por medição.** No tema claro do design
 *    `surface-3` e `surface-4` são os dois branco puro: um menu sobre um card
 *    não tem degrau de luminosidade nenhum, e sem sombra a camada some. É a
 *    razão de `--vx-elev-1..3` existir.
 *
 * Com o degrau de superfície E a sombra fazendo o trabalho, a borda volta a ser
 * a hairline que o design desenha. Mesma troca em `Dialog` (e3), `Popover`,
 * `HoverCard`, `Tooltip` (e2) e `Toast` (e3).
 *
 * O realce do item passou de `bg-surface-3` para `bg-state-hover`: véu em vez
 * de tinta. Um item realçado dentro de um menu que já está em `surface-4`
 * precisaria de um sexto degrau para se destacar por superfície — a camada de
 * estado funciona sobre qualquer fundo e é o que o design usa.
 *
 * `z-flutuante` e não `z-50` cru: a escala de z é nomeada por PAPEL, para "o
 * que fica na frente do quê" ser legível sem abrir dois arquivos.
 */

/*
  ⚠ **`min-w-56` e não `min-w-48`.** O design desenha 264px no menu de mensagem
  e 300 no do usuário; o nosso encolhia até o conteúdo e media 207. Num menu de
  quinze itens onde a metade tem tecla à direita, largura curta faz cada linha
  terminar num lugar diferente — e a coluna de atalhos deixa de ser coluna.
*/
import css from "./menu.module.css";

export const menuContent =
  `${css.conteudo} ` +
  "z-flutuante rounded-08 border border-hairline-10 bg-surface-4 p-05 shadow-e2 " +
  "text-md text-text-1 overflow-y-auto " +
  /*
    ⚠ **Animação e não transição de opacidade, e a troca conserta a SAÍDA.**

    A régua anterior era `data-[state=closed]:opacity-0 … anim-fast`, e ela só
    funcionava na metade da abertura: o `Presence` do Radix espera
    `animationend`, não `transitionend`, então ao fechar ele desmontava o nó na
    hora e o fade de saída nunca acontecia. O menu abria devagar e sumia
    instantâneo — o inverso da regra, que é entrar com calma e sair rápido.
  */
  "data-[state=open]:camada-chega data-[state=closed]:camada-sai";

/*
  `7px 9px` e raio 5 — os números do design, e o par mais repetido dele: 102
  ocorrências de `padding: 7px 9px` nos treze arquivos. Era `8px 4px` com raio
  4, e o item ficava 6px mais baixo que o desenhado.
*/
export const menuItem =
  "flex cursor-default items-center gap-08 rounded-05 px-09 py-07 outline-none select-none " +
  "data-highlighted:bg-state-hover-elevado " +
  /*
    ⚠ **O item de menu não respondia a ser PRESSIONADO**, e ele é o alvo mais
    clicado do app depois da linha de canal. `data-highlighted` cobre o
    ponteiro E o teclado (é o Radix quem o escreve), mas ele é o mesmo tom nos
    dois momentos: apontar e apertar ficavam indistinguíveis, e o menu fechava
    sem nunca ter confirmado o clique.

    Fundo e nunca escala: um item de largura cheia encolhendo dentro de um
    menu lê como defeito de renderização, não como pressão.
  */
  "active:bg-state-press " +
  "data-disabled:pointer-events-none data-disabled:text-text-3";

/**
 * Ação destrutiva. Cor sozinha não basta, mas ajuda quem enxerga cor.
 *
 * ⚠ **`danger-text` e não `danger`.** O design usa DOIS vermelhos, e o menu é
 * exatamente onde a diferença aparece: `#E8596B` para borda e fundo tingido,
 * `#F0808D` para a palavra "Excluir". Medido antes de o token existir — o item
 * saía em 4,28:1 sobre `surface-4`, contra os 6,1:1 do design.
 */
export const menuItemPerigo =
  `${css.itemPerigo} text-danger-text data-highlighted:text-danger-text`;
export const menuItemNormal = "text-text-2";

/* `margin: 5px 4px` no design: a régua não vai até a borda do menu, porque o
   item também não vai — ela se alinha ao TEXTO, não à caixa. */
export const menuSeparator = "mx-04 my-05 h-px bg-border-subtle";

/**
 * A tecla de atalho à direita do item — o "R", o "E", o "⇧⌘C" do design.
 *
 * `ms-auto` porque o item já é `flex`: empurrar com margem automática é o que
 * mantém rótulos de comprimentos diferentes alinhados sem grid nem largura
 * fixa. Mono, porque é uma TECLA e não uma palavra — a mesma escolha da dica
 * do editor e da faixa do composer.
 *
 * `text-4` e não `text-3`: é a informação menos importante da linha, e ela
 * compete com o rótulo se tiver o mesmo peso. Quem procura o atalho já sabe
 * onde olhar.
 */
export const menuLargo = css.largo;

export const menuAtalho = "ms-auto ps-16 font-mono text-2xs text-text-4";

export const menuLabel = "px-08 py-04 text-xs text-text-3";

/**
 * "Copiar ID" — mono e terciário, sempre o último.
 *
 * ⚠ Ele morava no `MessageRow.module.css` e agora serve SEIS menus, então
 * mora onde os outros estilos de menu moram. Duas cópias do mesmo tom em dois
 * arquivos é onde a divergência começa — o `Avancado.tsx` desenha uma
 * ilustração deste item, e ela precisa continuar parecendo com ele.
 */
export const menuItemId = "font-mono text-sm text-text-3";
