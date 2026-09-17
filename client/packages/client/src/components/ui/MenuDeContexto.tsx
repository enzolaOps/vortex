import type { ReactElement, ReactNode } from "react";

import { ContextMenu, ContextMenuTrigger } from "./ContextMenu";

/**
 * O GATILHO de todo menu de contexto do produto.
 *
 * O `ContextMenu.tsx` continua sendo o primitivo (caixa, item, régua,
 * submenu); isto é o mecanismo de ABERTURA, e ele existe porque a auditoria
 * achou o mesmo defeito em seis superfícies escritas em seis momentos
 * diferentes. Cada uma resolvia "quem é o alvo" do seu jeito, e das três
 * formas de abrir um menu — ponteiro, toque e teclado — só a timeline cobria
 * mais de uma.
 *
 * Três invariantes, e nenhuma delas é opcional:
 *
 * 1. **O alvo é resolvido no `pointerdown`, e não só no `contextmenu`.** O
 *    long-press do Radix (700 ms, toque e caneta) abre o menu SEM disparar
 *    `contextmenu` nenhum — então quem só escutava `contextmenu` abria com o
 *    alvo do gesto ANTERIOR. Num menu que tem "Excluir", isso é apagar a
 *    mensagem errada.
 * 2. **Sem alvo, o menu não abre.** `preventDefault` no `contextmenu` (o Radix
 *    respeita: `composeEventHandlers` confere `defaultPrevented`) e no
 *    `pointerdown` (o long-press nem chega a ser armado). Caixa vazia é pior
 *    que nenhuma resposta — ela parece um menu quebrado.
 * 3. **Teclado abre o mesmo menu, pelo mesmo caminho.** Tecla Menu e
 *    `Shift+F10` sintetizam o `contextmenu` que o clique direito enviaria, no
 *    elemento FOCADO. Nada de segunda lista de itens para manter em sincronia.
 *
 * ⚠ **`modal` fica no default (`true`), e a decisão é MEDIDA.** O
 * `ContextMenu.tsx` avisa desde a fase 2 que o Radix trava o scroll ao abrir
 * (`react-remove-scroll`) e que isso não pode perder a âncora da lista
 * virtualizada. Medido no arnês com 10 mil mensagens carregadas, abrindo o
 * menu numa linha e fechando com `Esc`:
 *
 * ```
 * antes   scrollTop 991663 · topo da 1ª linha -658 · body overflow visible
 * aberto  scrollTop 991663 · topo da 1ª linha -658 · body overflow hidden
 * fechado scrollTop 991663 · topo da 1ª linha -658 · body overflow visible
 * ```
 *
 * `padding-right` do `body` fica em 0px nos três momentos — o `body` deste app
 * não rola, então não há barra a compensar, que é de onde viria o salto de
 * layout. Nada se move, e as 9 linhas montadas continuam as mesmas. `modal`
 * fica: ele é o que dá `Esc`, foco preso e clique fora, e trocá-lo por
 * `modal={false}` custaria essas três coisas para consertar um salto que não
 * acontece.
 *
 * ⚠ **`mirar` GRAVA e responde.** Ela escreve o alvo no store da superfície e
 * devolve se há alvo. Uma função só porque as duas coisas precisam acontecer
 * na mesma ordem em três eventos diferentes; duas funções divergiriam na
 * primeira que alguém esquecesse de chamar. Omitida, o gatilho É o alvo — o
 * caso do rail, da linha de canal e da conversa, onde o Root já é por item.
 */

/**
 * O gesto já foi reivindicado por um menu mais interno.
 *
 * ⚠ **Menu dentro de menu abria DOIS no toque, e só no toque.** Com mouse o
 * `contextmenu` do gatilho interno chama `preventDefault`, e o externo o vê
 * prevenido ao receber o evento na bolha. O long-press não passa por ali: cada
 * gatilho arma o próprio timer de 700 ms no `pointerdown`, os dois disparam, e
 * a coluna de canais abria o menu do canal E o da área vazia.
 *
 * `WeakSet` e não um campo no evento: o evento morre no fim do gesto e leva a
 * marca junto, sem tipo inventado e sem lixo acumulado.
 */
const reivindicados = new WeakSet<Event>();

/**
 * Reivindica o gesto para este gatilho.
 *
 * `false` significa "um gatilho mais interno já pegou" — e aí este precisa
 * chamar `preventDefault` para o Radix não armar um segundo long-press.
 */
export function reivindicarGesto(evento: Event): boolean {
  if (reivindicados.has(evento)) return false;
  reivindicados.add(evento);
  return true;
}

/**
 * Onde `Enter` pertence ao CONTROLE, e não ao menu.
 *
 * `abrirComEnter` existe para a linha de mensagem, que não é botão nem link —
 * lá `Enter` não tinha dono. Num link dentro do texto ou num botão da barra de
 * ações, `Enter` é ativar, e abrir o menu no lugar seria roubar a tecla.
 */
const INTERATIVO =
  'a[href], button, input, textarea, select, [contenteditable="true"], [role="button"], [role="link"], [role="textbox"], [role="menuitem"], [role="option"]';

/** O formato mínimo de tecla que `aoTeclarNoGatilho` precisa. */
export type TeclaDeMenu = {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
};

/**
 * O caminho de TECLADO, separado do componente para poder ser exercitado.
 *
 * Devolve o nó em que o menu foi pedido, ou `null` quando a tecla não é deste
 * mecanismo. Quem chama decide o que fazer com o `preventDefault` — e ele é
 * obrigatório, porque a ação padrão de `Shift+F10` e da tecla Menu é o
 * navegador disparar o PRÓPRIO `contextmenu` no elemento focado: sem prevenir,
 * o menu abriria duas vezes.
 *
 * ⚠ **O FOCO decide, não o gatilho.** O gatilho é o container — a lista
 * inteira, a coluna inteira. Ancorar o menu nele poria a caixa no canto de uma
 * coluna de dez mil linhas, longe da linha sobre a qual ele age.
 */
export function aoTeclarNoGatilho(
  tecla: TeclaDeMenu,
  gatilho: HTMLElement,
  foco: Element | null,
  abrirComEnter: boolean,
): HTMLElement | null {
  if (tecla.ctrlKey || tecla.altKey || tecla.metaKey) return null;

  const porTecla =
    tecla.key === "ContextMenu" || (tecla.key === "F10" && tecla.shiftKey);
  const porEnter = abrirComEnter && tecla.key === "Enter" && !tecla.shiftKey;
  if (!porTecla && !porEnter) return null;

  /*
    Pato e não `instanceof HTMLElement`, pela mesma razão de `alvoDoEvento` em
    `menuDoParticipante.ts`: o popout é OUTRO `window`, e um elemento de lá não
    é `HTMLElement` deste realm — o `instanceof` devolveria falso e o menu
    nasceria ancorado no container em vez de no item.
  */
  const candidato = foco as Partial<HTMLElement> | null;
  const no =
    typeof candidato?.closest === "function" &&
    gatilho.contains(candidato as unknown as Node)
      ? (candidato as HTMLElement)
      : gatilho;

  if (porEnter && no.closest(INTERATIVO)) return null;

  return no;
}

/**
 * Dispara no nó o MESMO evento que o clique direito envia.
 *
 * As coordenadas são as do nó e não `(0,0)`: o Radix ancora o menu no ponto do
 * evento, e a origem jogaria a caixa no canto da janela.
 */
export function despacharMenuEm(
  no: HTMLElement,
  /**
   * Onde o menu nasce.
   *
   * `canto` é o padrão e serve ao teclado, que pede o menu "sobre este item".
   * `abaixo` serve aos gatilhos de BOTÃO — o `▾` do cabeçalho do servidor, o
   * `⋯` do canal e o da tabela de membros: um menu que nasce no canto de cima
   * de um botão de 28px cobre o próprio botão, e a pessoa perde a referência
   * do que abriu.
   */
  ancora: "canto" | "abaixo" = "canto",
): void {
  /*
    O construtor vem do `window` DO NÓ, e não do global.

    Mesma razão do pato acima: no popout o elemento pertence a outro realm, e
    um `MouseEvent` deste não é o que os handlers de lá esperam. `defaultView`
    é nulo só em documento destacado, e aí não há menu a abrir.
  */
  const janela = no.ownerDocument.defaultView;
  if (!janela) return;

  const caixa = no.getBoundingClientRect();
  no.dispatchEvent(
    new janela.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(caixa.left + (ancora === "abaixo" ? 0 : 8)),
      clientY: Math.round(
        ancora === "abaixo" ? caixa.bottom + 4 : caixa.top + 8,
      ),
    }),
  );
}

/**
 * Para onde o foco volta quando o menu fecha.
 *
 * ⚠ **O Radix devolve o foco ao GATILHO, e o gatilho aqui é a superfície.** Na
 * timeline ele é o container de dez mil linhas: abrir o menu com `Shift+F10`
 * numa linha e fechar com `Esc` largava o foco na lista inteira, e a pessoa
 * perdia o lugar — medido, `document.activeElement` voltava com
 * `role="log"`. Onde o gesto nasceu é a resposta certa, e é o que todo menu de
 * sistema faz.
 *
 * Module-level e não estado: quem escreve é um handler de evento, quem lê é o
 * `ContextMenuContent`, e não há árvore de componentes entre os dois. É a lei
 * nº 1 pela mesma razão do alvo do menu.
 */
let devolverPara: HTMLElement | null = null;

/** O que pode receber foco de volta — o item, não o container. */
const FOCAVEL =
  '[tabindex]:not([tabindex="-1"]), [tabindex="-1"], button, a[href], [role="listitem"]';

function lembrarFoco(no: EventTarget | null, gatilho: HTMLElement): void {
  const cru = no as Partial<HTMLElement> | null;
  const candidato =
    typeof cru?.closest === "function"
      ? (cru as HTMLElement).closest<HTMLElement>(FOCAVEL)
      : null;
  /* O gatilho é o último recurso e não o primeiro: sem candidato o
     comportamento volta a ser o do Radix, que já era o que havia. */
  devolverPara = candidato ?? gatilho;
}

/**
 * O nó que deve receber o foco, consumido UMA vez.
 *
 * Consumir importa: guardar depois de devolver faria um menu aberto por clique
 * em outro lugar mandar o foco para a linha do gesto anterior.
 */
export function consumirFocoDeVolta(): HTMLElement | null {
  const no = devolverPara;
  devolverPara = null;
  return no;
}

/** Resolve e grava o alvo a partir do nó que recebeu o gesto. */
export type MiraDeMenu = (no: EventTarget | null) => boolean;

export function MenuDeContexto({
  mirar,
  desabilitado,
  abrirComEnter = false,
  gatilho,
  children,
}: {
  mirar?: MiraDeMenu;
  desabilitado?: boolean;
  abrirComEnter?: boolean;
  /** O elemento que recebe o clique direito. Um só — `asChild` do Radix. */
  gatilho: ReactElement;
  /** O `ContextMenuContent`. */
  children: ReactNode;
}) {
  const mira: MiraDeMenu = mirar ?? (() => true);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        disabled={desabilitado}
        /*
          O caminho do TOQUE. O mouse não passa por aqui de propósito: o
          `whenTouchOrPen` do Radix já ignora `pointerType === "mouse"`, e o
          clique direito é resolvido no `contextmenu` logo abaixo — que chega
          antes de o menu abrir. Rodar a mira no `pointerdown` do mouse
          escreveria no store a cada clique ESQUERDO da lista mais quente do
          app, por nada.
        */
        onPointerDown={(evento) => {
          if (evento.pointerType === "mouse") return;
          if (!reivindicarGesto(evento.nativeEvent)) {
            evento.preventDefault();
            return;
          }
          if (!mira(evento.target)) evento.preventDefault();
        }}
        /*
          O caminho do PONTEIRO — e o do teclado, porque a tecla sintetiza
          este mesmo evento.

          `defaultPrevented` no começo: um gatilho mais interno já abriu (ou
          já recusou), e reescrever o alvo aqui trocaria o alvo debaixo do
          menu que está abrindo.
        */
        onContextMenu={(evento) => {
          if (evento.defaultPrevented) return;
          if (!mira(evento.target)) {
            evento.preventDefault();
            return;
          }
          lembrarFoco(evento.target, evento.currentTarget);
        }}
        onKeyDown={(evento) => {
          const no = aoTeclarNoGatilho(
            evento,
            evento.currentTarget,
            document.activeElement,
            abrirComEnter,
          );
          if (!no) return;
          evento.preventDefault();
          despacharMenuEm(no);
        }}
      >
        {gatilho}
      </ContextMenuTrigger>

      {children}
    </ContextMenu>
  );
}
