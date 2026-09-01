import {
  ArrowCounterClockwise,
  Check,
  Eye,
  EyeSlash,
  ICONE,
} from "../components/ui/icones";
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
  NOME_DO_PAINEL,
  PAINEIS,
  PRESET_PADRAO,
  SLOTS,
  type PainelId,
  type SlotId,
} from "../preset/schema";
import { iniciarArraste, terminarArraste } from "../store/arraste";
import {
  assinarEdicao,
  lerEdicao,
  reaplicarRetrato,
  sair,
  temMudanca,
} from "../store/edicao";
import { toast } from "../components/ui/Toast";
import {
  assinarLayout,
  definirSlot,
  lerBruto,
  lerLayout,
} from "../store/layout";
import { PickerDePaleta } from "./PickerDePaleta";
import css from "./PainelDeEdicao.module.css";

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
   * Descartar, com saída.
   *
   * Um caminho só para o botão e para o Esc — a versão anterior tinha dois
   * `sair(false)` soltos, e só um deles teria ganhado o desfazer. Dois donos da
   * mesma decisão é como o comportamento diverge sem ninguém notar.
   *
   * O retrato é lido ANTES de sair, porque `sair` o joga fora; e o estado
   * atual é capturado ANTES também, porque é ele que o desfazer reaplica.
   */
  function descartar() {
    const havia = temMudanca(lerLayout(), lerBruto());
    const atual = havia ? { preset: lerLayout(), bruto: lerBruto() } : null;
    sair(false);
    if (atual === null) return;
    toast({
      tipo: "info",
      titulo: "Layout descartado",
      descricao: "Voltou ao que estava quando você abriu a edição.",
      acao: {
        rotulo: "desfazer",
        descricaoAlternativa:
          "Desfazer o descarte e voltar ao layout que você tinha montado",
        aoAtivar: () => reaplicarRetrato(atual),
      },
    });
  }

  /**
   * Esc cancela. Effect é o uso certo: teclado é sistema externo.
   *
   * Só enquanto o modo está ligado — um listener global permanente roubaria o
   * Esc de todo modal e menu do app.
   */
  useEffect(() => {
    if (!editando) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") descartar();
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
          arraste as bordas · setas ajustam · Esc descarta
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
                      {slot.painel ? NOME_DO_PAINEL[slot.painel] : "vazio"}
                    </span>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent>
                  {PAINEIS.map((p) => (
                    <DropdownMenuItem key={p} onSelect={() => escolherPainel(id, p)}>
                      <Check
                        size={ICONE.calha}
                        aria-hidden
                        className={css.marca}
                        data-visivel={slot.painel === p}
                      />
                      {NOME_DO_PAINEL[p]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onSelect={() => escolherPainel(id, null)}>
                    <Check
                      size={ICONE.calha}
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
                /*
                  Nome ESTÁVEL, estado no `aria-pressed` — o mesmo conserto do
                  cartão de chamada, e o mesmo defeito.

                  Era `aria-label` de AÇÃO ("Esconder painel") junto de
                  `aria-pressed` de ESTADO: com os três painéis visíveis, o
                  leitor anunciava "Esconder painel, pressionado" nos três, que
                  se lê como "esconder está ativo" — todos escondidos.
                */
                aria-pressed={slot.visivel}
                aria-label={`Mostrar painel ${ROTULO_DO_SLOT[id]}`}
                icone={
                  slot.visivel ? (
                    <Eye size={ICONE.calha} aria-hidden />
                  ) : (
                    <EyeSlash size={ICONE.calha} aria-hidden />
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
                icone={<ArrowCounterClockwise size={ICONE.calha} aria-hidden />}
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
          icone={<ArrowCounterClockwise size={ICONE.calha} aria-hidden />}
          onClick={() => {
            iniciarArraste();
            for (const id of SLOTS) definirSlot(id, PRESET_PADRAO.layout.slots[id]);
            terminarArraste();
          }}
        >
          repor tudo
        </Botao>

        {/*
          A palavra carrega a consequência, e há saída depois dela.

          ⚠ Era "cancelar"/"fechar", e "cancelar" ainda é ambíguo ao lado de
          "concluir": os dois podem ser lidos como "terminei". Quem passou dois
          minutos ajustando matiz e larguras perdia tudo num clique de aparência
          inofensiva — e a explicação de que sair desfaz mora em `/config/
          aparencia`, outra tela.

          Confirmação antes seria pior: ela cobra de todo mundo, sempre, para
          proteger o arrependimento raro. O desfazer cobra só de quem errou. O
          retrato já existia — faltava oferecê-lo.
        */}
        <Botao variante="neutro" onClick={descartar}>
          {temMudanca(layout, lerBruto()) ? "descartar" : "fechar"}
        </Botao>

        <Botao variante="primario" onClick={() => sair(true)}>
          concluir
        </Botao>
      </footer>
      </div>
    </>
  );
}
