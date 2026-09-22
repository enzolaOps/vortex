/**
 * O único listener de atalho do app.
 *
 * Module-level e idempotente, pela razão de sempre: um `keydown` no
 * `document` não pertence a árvore de componente nenhuma, e prendê-lo a uma
 * faria o `App` re-renderizar a cada tecla. É o mesmo padrão de `ligarRota`,
 * `ligarSonsDeVoz` e `ligarAtalhosDeVoz`.
 *
 * ⚠ **Ele SUBSTITUI `ligarAtalhoDaPaleta`, que só era chamado pelo arnês.**
 * Medido: `ligarAtalhoDaPaleta()` tinha um chamador, `dev/Arnes.tsx` — ou
 * seja, ⌘K funcionava na tela de medição e não funcionava no produto. A única
 * combinação que a auditoria deu como "funciona" não funcionava onde importa.
 */
import { ATALHOS, type Atalho } from "./registro";
import { combinacaoDoEvento, mesmaCombinacao } from "../store/atalhosDeVoz";
import { EH_MAC } from "../lib/plataforma";
import { lerDrawer } from "../store/drawer";
import { lerEdicaoDeMensagem } from "../store/edicaoDeMensagem";
import { lerModal } from "../store/modais";

/**
 * Os do listener global. Os de `composer` chegam por `executarAtalho`, e os de
 * `nativo` e `superficie` não chegam nunca — quem os executa é o `<textarea>`
 * e a tela que os declara.
 *
 * O predicado é TIPADO (`a is …`) e não um `filter` solto: sem a anotação o
 * TypeScript devolve a união inteira e `atalho.executar` deixa de existir no
 * tipo — que é exatamente a garantia que o registro existe para dar.
 */
type AtalhoGlobal = Atalho & { escopo: "documento"; executar: () => void };

const GLOBAIS: readonly AtalhoGlobal[] = ATALHOS.filter(
  (a): a is AtalhoGlobal => a.escopo === "documento",
);

/**
 * Está escrevendo?
 *
 * ⚠ **`shift+R` e `Esc` não podem disparar dentro de um campo** — a primeira
 * apagaria um "R" maiúsculo de quem digita e a segunda marcaria o canal como
 * lido no meio de uma frase. Já `⌘K`, `⌘F` e `⌘U` DEVEM disparar com o cursor
 * no composer: é de lá que a mão sai para navegar, e um atalho que só funciona
 * com o foco em lugar nenhum é um atalho que ninguém alcança.
 *
 * Então a régua não é "está num campo", é "a combinação carrega modificador".
 * `alt` conta junto com `mod`: ⌥↑ / ⌥↓ trocam de canal com o cursor no
 * composer, que é exatamente onde ele fica.
 */
function emCampoDeTexto(alvo: EventTarget | null): boolean {
  const cru = alvo as Partial<Element> | null;
  if (typeof cru?.closest !== "function") return false;
  return (
    (cru as Element).closest(
      "input, textarea, select, [contenteditable]:not([contenteditable=false])",
    ) !== null
  );
}

/**
 * Há uma camada sobreposta pedindo o `Esc` para si?
 *
 * ⚠ **Sem isto, fechar um modal com `Esc` marcaria o canal como lido junto** —
 * e "junto" é o pior tipo de efeito, porque ninguém liga uma coisa à outra. A
 * pergunta é feita ao DOM e não a um store porque os donos são muitos: modal
 * do registro, drawer, popover e menu do Radix, seletor de emoji, lightbox.
 *
 * `defaultPrevented` cobre quem já tratou o evento antes de ele chegar aqui —
 * é o caso de `ChamadaRecebida`, que escuta na CAPTURA justamente para que o
 * `Esc` de recusar não desça até aqui.
 */
function camadaSobreposta(): boolean {
  if (lerModal() !== null || lerDrawer() !== null) return true;
  if (lerEdicaoDeMensagem() !== undefined) return true;
  return (
    document.querySelector(
      '[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]',
    ) !== null
  );
}

function podeDisparar(atalho: AtalhoGlobal, evento: KeyboardEvent): boolean {
  const c = atalho.combinacao;
  const comModificador = c.mod || c.alt;

  if (!comModificador && emCampoDeTexto(evento.target)) return false;

  /*
    `Esc` é a tecla mais disputada do app, e a única cujo dono muda a cada
    quadro. As outras combinações não precisam desta pergunta — ninguém abre
    um modal e aperta ⌘U esperando que ele não faça nada.
  */
  if (c.codigo === "Escape" && camadaSobreposta()) return false;

  return true;
}

/**
 * Executa um atalho pelo id — o caminho que o composer usa.
 *
 * Devolve se houve alguém para executar: o composer precisa saber se deve
 * `preventDefault`, e um `void` o obrigaria a repetir a decisão.
 */
export function executarAtalho(id: string): boolean {
  const atalho = ATALHOS.find((a) => a.id === id);
  if (atalho?.escopo !== "documento" && atalho?.escopo !== "composer") {
    return false;
  }
  atalho.executar();
  return true;
}

let ligado = false;

export function ligarAtalhos(): void {
  if (ligado) return;
  ligado = true;

  document.addEventListener("keydown", (evento) => {
    /* Quem já tratou tem prioridade — ver `camadaSobreposta`. */
    if (evento.defaultPrevented) return;

    const c = combinacaoDoEvento(evento, EH_MAC);
    if (!c) return;

    for (const atalho of GLOBAIS) {
      if (!mesmaCombinacao(c, atalho.combinacao)) continue;
      if (evento.repeat && !atalho.repetivel) return;
      if (!podeDisparar(atalho, evento)) return;

      /*
        `preventDefault` porque quase toda combinação daqui é também do
        navegador: ⌘K abre a barra de busca, ⌘P imprime, ⌘F acha na página,
        ⌘0 reseta o zoom. Sem ele o atalho funciona E o navegador também.
      */
      evento.preventDefault();
      atalho.executar();
      return;
    }
  });
}
