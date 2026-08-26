import { ArrowsLeftRight, Eye, EyeSlash } from "@phosphor-icons/react";
import { useEffect, useSyncExternalStore } from "react";

import {
  PAINEIS,
  PRESET_PADRAO,
  SLOTS,
  type PainelId,
  type SlotId,
} from "../preset/schema";
import { iniciarArraste, terminarArraste } from "../store/arraste";
import { assinarEdicao, lerEdicao, sair, temMudanca } from "../store/edicao";
import { assinarLayout, definirSlot, lerLayout } from "../store/layout";
import { PickerDePaleta } from "./PickerDePaleta";
import css from "./PainelDeEdicao.module.css";

const NOME: Record<PainelId, string> = {
  rail: "servidores",
  canais: "canais",
  membros: "membros",
};

const ROTULO_DO_SLOT: Record<SlotId, string> = {
  a: "início",
  b: "meio",
  d: "fim",
};

/**
 * Troca o painel de um slot, sem deixar dois slots com o mesmo painel.
 *
 * O caso: a pessoa escolhe "membros" num slot onde já havia "canais",
 * enquanto "membros" estava em outro. Sem cuidado, membros aparece duas vezes
 * e some do lugar antigo — ou pior, aparece duas vezes de verdade, porque
 * nada no tipo impede.
 *
 * A regra é troca: quem estava no destino vai para a origem. É o que a pessoa
 * espera de "mover um painel para cá", e mantém a invariante de que cada
 * painel ocupa no máximo um slot sem precisar validar nada depois.
 */
function escolherPainel(id: SlotId, painel: PainelId | null) {
  const slots = lerLayout().layout.slots;
  const anterior = slots[id].painel;
  const outro = painel
    ? (SLOTS.find((s) => s !== id && slots[s].painel === painel) ?? null)
    : null;

  // Uma escrita por slot, e as duas antes de qualquer remedição: a lista
  // remede uma vez no fim em vez de uma por escrita.
  iniciarArraste();
  definirSlot(id, { painel });
  if (outro) definirSlot(outro, { painel: anterior });
  terminarArraste();
}

/**
 * O modo edição.
 *
 * Manipulação direta, não menu de configuração enterrado: a largura se ajusta
 * arrastando a borda do próprio painel, e este painel cuida do que não tem
 * borda para arrastar — visibilidade, qual painel vai em qual slot, reset.
 *
 * Não existe botão de "aplicar", e isso é decisão da referência: tudo já está
 * valendo enquanto se mexe. O preço é que "cancelar" precisa de um retrato
 * tirado na entrada — ver `store/edicao.ts`.
 */
export function PainelDeEdicao() {
  const editando = useSyncExternalStore(assinarEdicao, lerEdicao);
  const layout = useSyncExternalStore(assinarLayout, lerLayout);

  /**
   * Esc cancela. Effect é o uso certo: teclado é sistema externo.
   *
   * Só enquanto o modo está ligado — um listener global permanente roubaria o
   * Esc de todo modal e menu do app.
   */
  useEffect(() => {
    if (!editando) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") sair(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [editando]);

  if (!editando) return null;

  const slots = layout.layout.slots;

  return (
    <div
      className={css.painel}
      role="dialog"
      aria-label="Editar layout"
      aria-modal={false}
    >
      <header className={css.cabecalho}>
        <h2 className={css.titulo}>Editar layout</h2>
        <span className={css.dica}>
          arraste as bordas · setas ajustam · Esc cancela
        </span>
      </header>

      <div className={css.slots}>
        {SLOTS.map((id) => {
          const slot = slots[id];
          const padrao = PRESET_PADRAO.layout.slots[id];
          const igualAoPadrao =
            slot.painel === padrao.painel &&
            slot.largura === padrao.largura &&
            slot.visivel === padrao.visivel;

          return (
            <div key={id} className={css.linha}>
              <span className={css.rotulo}>{ROTULO_DO_SLOT[id]}</span>

              <select
                className={css.campo}
                value={slot.painel ?? ""}
                aria-label={`Painel do slot ${ROTULO_DO_SLOT[id]}`}
                onChange={(e) =>
                  escolherPainel(id, (e.target.value || null) as PainelId | null)
                }
              >
                <option value="">— vazio —</option>
                {PAINEIS.map((p) => (
                  <option key={p} value={p}>
                    {NOME[p]}
                  </option>
                ))}
              </select>

              <span className={css.medida}>
                {slot.painel ? `${slot.largura}px` : "—"}
              </span>

              <button
                type="button"
                className={css.acao}
                disabled={slot.painel === null}
                aria-pressed={slot.visivel}
                onClick={() => {
                  iniciarArraste();
                  definirSlot(id, { visivel: !slot.visivel });
                  terminarArraste();
                }}
              >
                {slot.visivel ? (
                  <Eye size={20} aria-hidden />
                ) : (
                  <EyeSlash size={20} aria-hidden />
                )}
                {slot.visivel ? "visível" : "oculto"}
              </button>

              <button
                type="button"
                className={css.acao}
                disabled={igualAoPadrao}
                onClick={() => {
                  iniciarArraste();
                  definirSlot(id, padrao);
                  terminarArraste();
                }}
              >
                <ArrowsLeftRight size={20} aria-hidden />
                repor
              </button>
            </div>
          );
        })}
      </div>

      <PickerDePaleta />

      <footer className={css.rodape}>
        <button
          type="button"
          className={`${css.acao} ${css.esquerda}`}
          onClick={() => {
            iniciarArraste();
            for (const id of SLOTS) definirSlot(id, PRESET_PADRAO.layout.slots[id]);
            terminarArraste();
          }}
        >
          repor tudo
        </button>

        {/* "Cancelar" só promete desfazer quando há o que desfazer. */}
        <button
          type="button"
          className={`${css.acao} ${css.secundario}`}
          onClick={() => sair(false)}
        >
          {temMudanca() ? "cancelar" : "fechar"}
        </button>

        <button
          type="button"
          className={`${css.acao} ${css.primario}`}
          onClick={() => sair(true)}
        >
          concluir
        </button>
      </footer>
    </div>
  );
}
