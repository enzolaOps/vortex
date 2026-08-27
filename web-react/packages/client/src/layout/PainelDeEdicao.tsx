import { ArrowCounterClockwise, Check, Eye, EyeSlash } from "@phosphor-icons/react";
import { useEffect, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import { Lamina } from "../components/ui/Lamina";

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
  fixados: "fixados",
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
    <>
      {/* O véu separa o painel do fundo sem borrar nada — ver o CSS. */}
      <div className={css.veu} aria-hidden />

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
            <div key={id} className={css.linha} data-oculto={!slot.visivel}>
              {/* A lamina marca o slot preenchido: a assinatura repetindo
                  o mesmo gesto do rail e do segmentado. */}
              <Lamina
                estado={
                  slot.painel !== null && slot.visivel ? "ativa" : "repouso"
                }
              />
              <span className={css.rotulo}>{ROTULO_DO_SLOT[id]}</span>

              {/*
                Menu do Radix, e não `<select>`.

                O nativo é desenhado pelo SISTEMA: num app dark no Windows ele
                chega com cromo claro, e a identidade do produto termina na
                borda dele. Nós construímos este wrapper na fase 2 e a fase 4
                não o usou — o componente certo já existia.
              */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={css.campo}
                    aria-label={`Painel do slot ${ROTULO_DO_SLOT[id]}`}
                  >
                    <span className={css.campoValor} data-vazio={slot.painel === null}>
                      {slot.painel ? NOME[slot.painel] : "vazio"}
                    </span>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent>
                  {PAINEIS.map((p) => (
                    <DropdownMenuItem key={p} onSelect={() => escolherPainel(id, p)}>
                      <Check
                        size={20}
                        aria-hidden
                        className={css.marca}
                        data-visivel={slot.painel === p}
                      />
                      {NOME[p]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onSelect={() => escolherPainel(id, null)}>
                    <Check
                      size={20}
                      aria-hidden
                      className={css.marca}
                      data-visivel={slot.painel === null}
                    />
                    deixar vazio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <span className={css.medida}>
                {slot.painel ? `${slot.largura}px` : "—"}
              </span>

              <Botao
                variante="sutil"
                disabled={slot.painel === null}
                aria-pressed={slot.visivel}
                aria-label={slot.visivel ? "Esconder painel" : "Mostrar painel"}
                icone={
                  slot.visivel ? (
                    <Eye size={20} aria-hidden />
                  ) : (
                    <EyeSlash size={20} aria-hidden />
                  )
                }
                onClick={() => {
                  iniciarArraste();
                  definirSlot(id, { visivel: !slot.visivel });
                  terminarArraste();
                }}
              />

              <Botao
                variante="sutil"
                disabled={igualAoPadrao}
                aria-label="Repor este slot"
                icone={<ArrowCounterClockwise size={20} aria-hidden />}
                onClick={() => {
                  iniciarArraste();
                  definirSlot(id, padrao);
                  terminarArraste();
                }}
              />
            </div>
          );
        })}
      </div>

      <PickerDePaleta />

      <footer className={css.rodape}>
        <Botao
          variante="sutil"
          className={css.esquerda}
          icone={<ArrowCounterClockwise size={20} aria-hidden />}
          onClick={() => {
            iniciarArraste();
            for (const id of SLOTS) definirSlot(id, PRESET_PADRAO.layout.slots[id]);
            terminarArraste();
          }}
        >
          repor tudo
        </Botao>

        {/* "Cancelar" só promete desfazer quando há o que desfazer. */}
        <Botao variante="neutro" onClick={() => sair(false)}>
          {temMudanca() ? "cancelar" : "fechar"}
        </Botao>

        <Botao variante="primario" onClick={() => sair(true)}>
          concluir
        </Botao>
      </footer>
      </div>
    </>
  );
}
