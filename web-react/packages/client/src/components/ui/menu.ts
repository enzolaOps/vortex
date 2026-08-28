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
 */

export const menuContent =
  "z-50 min-w-48 rounded-2 border border-border-subtle bg-surface-2 p-1 " +
  "text-md text-text-1 overflow-y-auto " +
  "data-[state=closed]:opacity-0 data-[state=open]:opacity-100 anim-fast";

export const menuItem =
  "flex cursor-default items-center gap-2 rounded-1 px-2 py-1 outline-none select-none " +
  "data-highlighted:bg-surface-3 " +
  "data-disabled:pointer-events-none data-disabled:text-text-3";

/** Ação destrutiva. Cor sozinha não basta, mas ajuda quem enxerga cor. */
export const menuItemPerigo = "text-danger data-highlighted:text-danger";
export const menuItemNormal = "text-text-2";

export const menuSeparator = "my-1 h-px bg-border-subtle";

export const menuLabel = "px-2 py-1 text-xs text-text-3";
