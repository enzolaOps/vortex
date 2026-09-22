import {
  ChartBar,
  Gif,
  Microphone,
  MusicNotes,
  Smiley,
  Sticker,
} from "../components/ui/icones";
import {
  lazy,
  Suspense,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";

import { Girador } from "../components/ui/Girador";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/Popover";
import { Tooltip } from "../components/ui/Tooltip";
import { enviarFigurinha } from "../sdk/adapter";
import { SeletorDeEmoji } from "../seletores/SeletorDeEmoji";
import { SeletorDeFigurinhas } from "../seletores/SeletorDeFigurinhas";
import { fonteDeGifs } from "../sdk/fonteDeGifs";
import { CascaDeSeletor } from "../seletores/CascaDeSeletor";
import { Soundboard } from "../seletores/Soundboard";
import { administrar } from "../store/administracao";
import {
  assinarFerramentaDoComposer,
  definirFerramentaDoComposer,
  lerFerramentaDoComposer,
} from "../store/ferramentaDoComposer";
import css from "./FerramentasDoComposer.module.css";
import { EstadoVazio } from "../components/ui/EstadoVazio";

/**
 * O seletor de GIF chega sob demanda, no primeiro clique no botão.
 *
 * ⚠ **É o único dos quatro seletores que não entra no bundle inicial**, e o
 * critério é o que ele carrega: paginação, observador e a camada do provedor.
 * O de emoji fica estático porque é o mais usado por ordens de grandeza, e
 * esperar um chunk no primeiro emoji do dia seria atrito no gesto mais comum.
 */
const SeletorDeGif = lazy(async () => {
  const m = await import("../seletores/SeletorDeGif");
  return { default: m.SeletorDeGif };
});

/**
 * Enquanto o chunk chega: a MESMA casca, com o girador no lugar do grid. A
 * caixa já nasce 400×452, então nada salta quando o seletor substitui. Sem
 * classe própria: uma regra aqui voltaria para a folha inicial.
 */
function CarregandoGif() {
  return (
    <CascaDeSeletor
      rotulo="GIF"
      busca={{ valor: "", aoMudar: () => {}, placeholder: "Buscar GIF" }}
      desabilitarBusca
    >
      <EstadoVazio icone={<Girador tamanho={20} rotulo="" />} titulo="Carregando GIFs" />
    </CascaDeSeletor>
  );
}

/**
 * A fileira de ferramentas do composer.
 *
 * ⚠ **Quatro das seis deixaram de ser `aindaNao` e passaram a ABRIR um
 * painel.** O que era um toast dizendo "ainda não" agora é o seletor
 * construído: emoji, GIF, figurinha e soundboard têm a casca do design, e o
 * emoji funciona de verdade — inserir texto no rascunho é o que o composer já
 * faz a cada tecla.
 *
 * As outras duas não são painel: enquete abre o modal de criação (que é 1:1 e
 * não escreve no protocolo) e mensagem de voz muda o MODO do composer — o
 * gravador ocupa o lugar da caixa, ver `GravadorDeVoz`.
 *
 * A ordem é a do design, e ela não é aleatória: emoji primeiro porque é o mais
 * usado por ordens de grandeza, voz por último porque é o único que muda o
 * modo em vez de inserir algo.
 */
/** Monta o texto a inserir a partir do rascunho e da seleção `[a, b)`. */
export type MontarInsercao = (valor: string, a: number, b: number) => string;

type Ferramenta = {
  readonly id: string;
  readonly rotulo: string;
  readonly Icone: ComponentType<{ size?: number | string }>;
} & (
  | { readonly painel: (aoFechar: () => void) => ReactNode; readonly acao?: never }
  | {
      readonly painel?: never;
      /** `undefined` = a ação não está disponível aqui, e o botão desliga. */
      readonly acao: (() => void) | undefined;
    }
);

export function FerramentasDoComposer({
  channelId,
  desabilitado,
  aoInserir,
  aoEnviar,
  aoGravar,
}: {
  /** Para onde a figurinha vai — ela é mensagem inteira, não texto do rascunho. */
  channelId: string;
  desabilitado: boolean;
  /**
   * Insere texto no rascunho. É como o emoji chega ao campo. Uma função monta
   * o texto a partir do rascunho e da seleção — é como o GIF põe espaço onde
   * o link encostaria numa palavra.
   */
  aoInserir: (texto: string | MontarInsercao) => void;
  /**
   * Manda uma mensagem só com este texto, sem tocar no rascunho. É como o GIF
   * chega ao canal: o link vira embed no servidor, e o que a pessoa já estava
   * escrevendo continua lá.
   */
  aoEnviar: (texto: string) => void;
  /**
   * Começa a mensagem de voz. `undefined` = não dá para gravar aqui (sem
   * microfone no navegador ou sem servidor de mídia), e o botão desliga em
   * vez de pedir um microfone cujo áudio não teria para onde ir.
   */
  aoGravar: (() => void) | undefined;
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
    {
      id: "gif",
      rotulo: "GIF",
      Icone: Gif,
      painel: (aoFechar) => (
        <Suspense fallback={<CarregandoGif />}>
          <SeletorDeGif
            fonte={fonteDeGifs}
            /* O rodapé do design: clique (ou Enter) envia, shift+clique só
               insere. Os dois fecham, pela mesma razão do emoji. */
            aoEnviar={(url) => {
              aoEnviar(url);
              aoFechar();
            }}
            aoInserir={(montar) => {
              aoInserir(montar);
              aoFechar();
            }}
          />
        </Suspense>
      ),
    },
    {
      id: "figurinha",
      rotulo: "Figurinha",
      Icone: Sticker,
      painel: (aoFechar) => (
        <SeletorDeFigurinhas
          aoEscolher={(f) => {
            enviarFigurinha(channelId, f.id);
            aoFechar();
          }}
        />
      ),
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
      /* Muda o MODO do composer — ver `GravadorDeVoz`. */
      acao: aoGravar,
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
              disabled={desabilitado || f.acao === undefined}
              onClick={f.acao}
            >
              <f.Icone />
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
 * ⚠ **O aberto/fechado saiu do Radix e foi para um store module-level**, e a
 * razão é ⌘E e ⌘G: os dois eram anunciados na página de atalhos e não abriam
 * nada, porque o estado morava dentro deste componente e um listener de
 * `document` não alcança estado de componente. Ver
 * `store/ferramentaDoComposer.ts`.
 *
 * Cada instância assina SOZINHA, e a comparação é por string — abrir o emoji
 * acorda o botão do emoji e o do painel que fechou, não os seis.
 *
 * ⚠ **O conteúdo continua sendo montado só quando ABRE.** `Popover.Content` do
 * Radix não renderiza nada fechado, e é isso que faz o seletor de emoji — 170
 * botões e um índice — custar zero enquanto ninguém o abriu. Montar sempre e
 * esconder seria pagar quatro painéis por composer.
 */
function SeletorEmPopover({
  ferramenta,
  desabilitado,
}: {
  ferramenta: Ferramenta & { painel: (aoFechar: () => void) => ReactNode };
  desabilitado: boolean;
}) {
  const aberta = useSyncExternalStore(
    assinarFerramentaDoComposer,
    lerFerramentaDoComposer,
  );

  return (
    <Popover
      open={aberta === ferramenta.id && !desabilitado}
      onOpenChange={(v) => definirFerramentaDoComposer(ferramenta.id, v)}
    >
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
            <ferramenta.Icone />
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
