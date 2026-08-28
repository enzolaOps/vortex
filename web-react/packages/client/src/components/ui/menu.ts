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
 * ⚠ **Duas correções que valem para toda camada flutuante do app**, e as duas
 * saíram da auditoria de design:
 *
 * 1. `border-border-strong` e não a sutil. `--vx-border-subtle` sobre
 *    `--vx-surface-2` mede **1,05:1** — invisível. Com `box-shadow` proibido
 *    por regra do projeto ("profundidade vem de camada, não de sombra"), a
 *    borda é a ÚNICA separação que sobra, e o degrau de superfície sozinho dá
 *    ~1,29:1. A regra está certa; era o degrau que estava curto para a camada
 *    que flutua sobre conteúdo arbitrário. Mesma troca em `Dialog`,
 *    `Popover`, `HoverCard`, `Tooltip` e `Toast`.
 * 2. `z-flutuante` e não `z-50` cru. A escala de z virou token nomeado por
 *    PAPEL justamente para "o que fica na frente do quê" ser legível; este era
 *    o último número solto, e ficava ao lado de um `40` em outro arquivo sem
 *    nada dizer qual vencia.
 */

export const menuContent =
  "z-flutuante min-w-48 rounded-2 border border-border-strong bg-surface-2 p-1 " +
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
