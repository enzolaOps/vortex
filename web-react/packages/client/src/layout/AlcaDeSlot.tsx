import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import { LARGURA, type PainelId, type SlotId } from "../preset/schema";
import { encaixarNaFaixa, PASSO } from "./faixa";
import { iniciarArraste, terminarArraste } from "../store/arraste";
import { definirSlot } from "../store/layout";
import css from "./AlcaDeSlot.module.css";

/** Passo do teclado. Seta anda um passo; com Shift, um salto. */
const PASSO_TECLADO = PASSO;
const SALTO_TECLADO = 48;

/**
 * A alça que redimensiona um slot.
 *
 * Aqui moram as duas armadilhas técnicas da fase 4, e as duas são sobre a
 * mesma coisa: o que NÃO fazer a cada frame.
 *
 * **1. O store não é tocado durante o arraste.** A largura vai direto para o
 * DOM, por ref. Escrever no store a cada `pointermove` re-renderizaria o shell
 * e, por tabela, a lista de mensagens — a 60fps, enquanto a pessoa arrasta. É
 * o caso mais óbvio de update não-escopado que este projeto consegue produzir,
 * e está nomeado assim na referência. O commit acontece uma vez, no drop.
 *
 * Funciona porque o React só reaplica `style` quando renderiza, e não há
 * render nenhum entre o `pointerdown` e o `pointerup`. Por isso o cancelamento
 * precisa restaurar o DOM à mão: não haveria render para desfazer.
 *
 * **2. A lista não remede durante o arraste.** Ela remede no fim, uma vez —
 * ver `store/arraste.ts`.
 *
 * Acessibilidade não é enfeite aqui: `separator` com `aria-valuenow` é o papel
 * certo para um splitter, e as setas fazem o mesmo trabalho do ponteiro. Um
 * layout que só pode ser ajustado com mouse exclui gente do produto inteiro,
 * não de um botão.
 */
export function AlcaDeSlot({
  id,
  painel,
  largura,
  lado,
  aplicar,
}: {
  id: SlotId;
  painel: PainelId;
  largura: number;
  lado: "inicio" | "fim";
  /**
   * Escreve a largura direto no DOM, sem passar pelo React.
   *
   * Callback e não a ref do slot, e isso não é preferência de estilo: o
   * React Compiler reprova mutar o elemento de uma ref recebida por PROP —
   * props são imutáveis, e uma ref continua sendo prop. A regra do projeto é
   * consertar o código quando o compiler reclama, não desligá-lo, e o
   * conserto aqui melhora o desenho: quem é dono do elemento é quem escreve
   * nele, e esta alça deixou de precisar ler o DOM para saber a largura.
   */
  aplicar: (largura: number) => void;
}) {
  const arraste = useRef<{
    x: number;
    inicial: number;
    atual: number;
    sinal: number;
  } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);

  const limites = LARGURA[painel];

  function limitar(valor: number) {
    return encaixarNaFaixa(valor, limites);
  }

  function aoDescer(e: PointerEvent<HTMLButtonElement>) {
    /**
     * O sinal depende do lado E da direção do texto.
     *
     * Num slot de início, arrastar no sentido do fim aumenta a largura; num
     * slot de fim, diminui. E em RTL o "sentido do fim" é o outro lado da
     * tela. Ler `direction` do elemento é o que faz a mesma alça servir aos
     * dois lados e às duas direções — a lei nº 6 no lugar onde ela custa
     * alguma coisa.
     */
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const sinal = (lado === "inicio" ? 1 : -1) * (rtl ? -1 : 1);

    arraste.current = { x: e.clientX, inicial: largura, atual: largura, sinal };
    e.currentTarget.setPointerCapture(e.pointerId);
    iniciarArraste();
    document.body.classList.add(css.arrastando!);
    // Atributo escrito à mão, não por estado: um `setState` aqui provocaria
    // exatamente o render que este componente inteiro existe para evitar.
    botao.current?.setAttribute("data-arrastando", "true");
  }

  function aoMover(e: PointerEvent<HTMLButtonElement>) {
    const atual = arraste.current;
    if (!atual) return;
    const valor = limitar(atual.inicial + (e.clientX - atual.x) * atual.sinal);
    atual.atual = valor;
    aplicar(valor);
  }

  function encerrar(commit: boolean) {
    const atual = arraste.current;
    if (!atual) return;
    arraste.current = null;
    document.body.classList.remove(css.arrastando!);
    botao.current?.removeAttribute("data-arrastando");

    if (commit) {
      // O valor já está guardado: nada de medir o DOM para descobrir o que
      // nós mesmos acabamos de escrever nele.
      definirSlot(id, { largura: atual.atual });
    } else {
      // Cancelar precisa desfazer NO DOM: não houve render para reverter.
      aplicar(atual.inicial);
    }

    // Depois do commit, nunca antes: é aqui que a lista remede e reancora.
    terminarArraste();
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>) {
    const passo = e.shiftKey ? SALTO_TECLADO : PASSO_TECLADO;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const paraOFim = e.key === (rtl ? "ArrowLeft" : "ArrowRight");
    const paraOInicio = e.key === (rtl ? "ArrowRight" : "ArrowLeft");

    if (!paraOFim && !paraOInicio && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();

    const sinal = lado === "inicio" ? 1 : -1;
    const novo =
      e.key === "Home"
        ? limites.min
        : e.key === "End"
          ? limites.max
          : largura + (paraOFim ? passo : -passo) * sinal;

    // Pelo teclado o commit é imediato: não existe "durante o arraste" para
    // proteger, e adiar deixaria a lista sem remedir até um drop que não vem.
    iniciarArraste();
    definirSlot(id, { largura: limitar(novo) });
    terminarArraste();
  }

  return (
    <button
      ref={botao}
      type="button"
      className={`${css.alca} ${lado === "inicio" ? css.inicio : css.fim}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Largura do painel ${painel}`}
      aria-valuenow={largura}
      aria-valuemin={limites.min}
      aria-valuemax={limites.max}
      onPointerDown={aoDescer}
      onPointerMove={aoMover}
      onPointerUp={() => encerrar(true)}
      onPointerCancel={() => encerrar(false)}
      onLostPointerCapture={() => encerrar(true)}
      onKeyDown={aoTeclar}
    />
  );
}
