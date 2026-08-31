import {
  ChartBar,
  Gif,
  Microphone,
  MusicNotes,
  Smiley,
  Sticker,
} from "@phosphor-icons/react";
import type { ComponentType, ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/Popover";
import { Tooltip } from "../components/ui/Tooltip";
import { aindaNao } from "../pendente/pendencias";
import { SeletorDeEmoji } from "../seletores/SeletorDeEmoji";
import { SeletorDeFigurinhas } from "../seletores/SeletorDeFigurinhas";
import { SeletorDeGif } from "../seletores/SeletorDeGif";
import { Soundboard } from "../seletores/Soundboard";
import { administrar } from "../store/administracao";
import css from "./FerramentasDoComposer.module.css";

/**
 * A fileira de ferramentas do composer.
 *
 * ⚠ **Quatro das seis deixaram de ser `aindaNao` e passaram a ABRIR um
 * painel.** O que era um toast dizendo "ainda não" agora é o seletor
 * construído: emoji, GIF, figurinha e soundboard têm a casca do design, e o
 * emoji funciona de verdade — inserir texto no rascunho é o que o composer já
 * faz a cada tecla.
 *
 * As outras duas continuam pendentes por razões diferentes: enquete abre o
 * modal de criação (que é 1:1 e não escreve no protocolo) e mensagem de voz
 * muda o MODO do composer, que é a única das seis que não é um painel.
 *
 * A ordem é a do design, e ela não é aleatória: emoji primeiro porque é o mais
 * usado por ordens de grandeza, voz por último porque é o único que muda o
 * modo em vez de inserir algo.
 */
type Ferramenta = {
  readonly id: string;
  readonly rotulo: string;
  readonly Icone: ComponentType<{ size?: number }>;
} & (
  | { readonly painel: (aoFechar: () => void) => ReactNode; readonly acao?: never }
  | { readonly painel?: never; readonly acao: () => void }
);

export function FerramentasDoComposer({
  desabilitado,
  aoInserir,
}: {
  desabilitado: boolean;
  /** Insere texto no rascunho. É como o emoji chega ao campo. */
  aoInserir: (texto: string) => void;
}) {
  const ferramentas: readonly Ferramenta[] = [
    {
      id: "emoji",
      rotulo: "Emoji",
      Icone: Smiley,
      painel: (aoFechar) => (
        <SeletorDeEmoji
          aoEscolher={(glifo) => {
            aoInserir(glifo);
            /*
              Fecha ao escolher, e é o contrato do design ("Enter envia · Esc
              fecha"). Manter aberto para escolher vários parece generoso e é o
              contrário: o painel cobre a conversa, e quem quer dois emojis
              reabre — quem quer um só fica com a tela tapada.
            */
            aoFechar();
          }}
        />
      ),
    },
    { id: "gif", rotulo: "GIF", Icone: Gif, painel: () => <SeletorDeGif /> },
    {
      id: "figurinha",
      rotulo: "Figurinha",
      Icone: Sticker,
      painel: () => <SeletorDeFigurinhas />,
    },
    {
      id: "soundboard",
      rotulo: "Efeitos sonoros",
      Icone: MusicNotes,
      painel: () => <Soundboard />,
    },
    {
      id: "enquete",
      rotulo: "Enquete",
      Icone: ChartBar,
      acao: () => administrar({ tipo: "enquete" }),
    },
    {
      id: "mensagemDeVoz",
      rotulo: "Mensagem de voz",
      Icone: Microphone,
      acao: aindaNao("mensagemDeVoz"),
    },
  ];

  return (
    <div className={css.ferramentas}>
      {ferramentas.map((f) =>
        f.painel ? (
          <SeletorEmPopover key={f.id} ferramenta={f} desabilitado={desabilitado} />
        ) : (
          <Tooltip key={f.id} texto={f.rotulo}>
            <button
              type="button"
              className={css.ferramenta}
              aria-label={f.rotulo}
              disabled={desabilitado}
              onClick={f.acao}
            >
              <f.Icone size={20} />
            </button>
          </Tooltip>
        ),
      )}
    </div>
  );
}

/**
 * Uma ferramenta que abre painel.
 *
 * Componente próprio para cada uma ter o PRÓPRIO estado de aberto/fechado —
 * um estado só no pai faria as quatro compartilharem uma variável e o
 * `aoFechar` do emoji fecharia o GIF.
 *
 * ⚠ **O conteúdo é montado só quando ABRE.** `Popover.Content` do Radix não
 * renderiza nada fechado, e é isso que faz o seletor de emoji — 170 botões e
 * um índice — custar zero enquanto ninguém o abriu. Montar sempre e esconder
 * seria pagar quatro painéis por composer.
 */
function SeletorEmPopover({
  ferramenta,
  desabilitado,
}: {
  ferramenta: Ferramenta & { painel: (aoFechar: () => void) => ReactNode };
  desabilitado: boolean;
}) {
  return (
    <Popover>
      <Tooltip texto={ferramenta.rotulo}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={css.ferramenta}
            aria-label={ferramenta.rotulo}
            /*
              Segue o campo: sem permissão de escrever no canal, nenhuma destas
              ferramentas tem para onde inserir o que produz. Um seletor de
              emoji aberto sobre um campo desligado é um beco.
            */
            disabled={desabilitado}
          >
            <ferramenta.Icone size={20} />
          </button>
        </PopoverTrigger>
      </Tooltip>

      {/*
        `p-02` porque a casca traz o próprio recheio, e `side="top"` porque o
        composer mora no rodapé — um painel de 452px abrindo para baixo sairia
        da janela e o Radix o viraria sozinho, com um quadro de salto no meio.
      */}
      <PopoverContent className="p-02" side="top" align="end">
        <PopoverFechavel render={ferramenta.painel} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * A ponte entre o painel e o `Close` do Popover.
 *
 * O seletor precisa fechar por dentro (escolher um emoji fecha), e quem sabe
 * fechar é o primitivo. Um `PopoverClose` embrulhando o painel inteiro faria
 * QUALQUER clique fechar — inclusive o do campo de busca.
 */
function PopoverFechavel({
  render,
}: {
  render: (aoFechar: () => void) => ReactNode;
}) {
  return (
    <>
      {render(() => {
        /*
          `Escape` em vez de uma ref para o `Close`: é o mesmo caminho que o
          teclado já usa, então fechar por escolha e fechar por Esc devolvem o
          foco ao gatilho exatamente igual — que é o comportamento que o Radix
          garante e que uma ref manual perderia.
        */
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      })}
    </>
  );
}
