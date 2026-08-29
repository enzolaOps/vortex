/**
 * O alvo da ação administrativa aberta.
 *
 * Existe pela regra que o registro de modais estabeleceu: **modal que precisa
 * de alvo lê o alvo do próprio store**, e não recebe dados por prop. O
 * registro passa só `aoFechar`, e tipar uma carga por `ModalId` daria uma
 * generalidade que nenhum modal pediu.
 *
 * É o mesmo padrão de `store/menuDeMensagem.ts`, que já resolvia isto para o
 * menu de contexto da lista — e pela mesma razão: quem abre é um item de menu
 * numa linha, e a linha não conhece o modal.
 */
import { abrirModal } from "./modais";

/**
 * O que a ação vai fazer, como união marcada.
 *
 * Criar e editar canal são o MESMO modal porque são o mesmo formulário — nome,
 * tópico, voz — e o que muda é o título e se os campos começam preenchidos.
 * Dois modais teriam dois formulários que precisam concordar.
 */
export type Alvo =
  | {
      readonly tipo: "criarCanal";
      readonly serverId: string;
      /** Onde o canal nasce. `undefined` = fora de categoria. */
      readonly categoriaId: string | undefined;
      readonly voz: boolean;
    }
  | { readonly tipo: "editarCanal"; readonly channelId: string }
  | { readonly tipo: "apagarCanal"; readonly channelId: string }
  | { readonly tipo: "criarCategoria"; readonly serverId: string }
  | {
      readonly tipo: "renomearCategoria";
      readonly serverId: string;
      readonly categoriaId: string;
    }
  | {
      readonly tipo: "apagarCategoria";
      readonly serverId: string;
      readonly categoriaId: string;
    }
  /*
    Pasta do rail. `pastaId` ausente = criar, presente = renomear — a mesma
    forma de `criarCategoria`/`renomearCategoria`, porque é o mesmo FORMULÁRIO:
    um campo de nome. Dois alvos e um componente, como o resto desta união.
  */
  | { readonly tipo: "criarPasta"; readonly serverId: string }
  | { readonly tipo: "renomearPasta"; readonly pastaId: string; readonly nome: string }
  | { readonly tipo: "convite"; readonly channelId: string }
  | { readonly tipo: "apagarMensagem"; readonly messageId: string }
  | {
      readonly tipo: "verImagem";
      readonly url: string;
      readonly nome: string;
      readonly largura: number | undefined;
      readonly altura: number | undefined;
    }
  | {
      readonly tipo: "linkExterno";
      readonly href: string;
      /** O que estava ESCRITO. Se difere do destino, o aviso endurece. */
      readonly texto: string;
    }
  /*
    Encaminhar. Alvo é a MENSAGEM, e o destino é escolhido dentro do modal —
    a lista de canais e pessoas é grande demais para caber num submenu, e o
    design a desenha com busca, chips de destino e comentário.
  */
  | { readonly tipo: "encaminhar"; readonly messageId: string }
  /*
    Criar enquete. Sem alvo além do canal, que o modal lê da navegação — e é
    por isso que a variante não carrega campo nenhum: o alvo de "criar" é o
    lugar onde se está, não um objeto que já existe.
  */
  | { readonly tipo: "enquete" }
  | {
      readonly tipo: "moderar";
      readonly serverId: string;
      readonly userId: string;
      readonly acao: "expulsar" | "banir" | "castigo";
    };

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

/** Referência cacheada — armadilha nº 1. */
let alvo: Alvo | undefined;

export function assinarAlvo(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerAlvo(): Alvo | undefined {
  return alvo;
}

/**
 * Define o alvo E abre o modal certo, numa chamada só.
 *
 * As duas coisas juntas de propósito: separá-las abriria a porta para um modal
 * aberto sem alvo — que renderizaria um formulário sobre `undefined` e é
 * exatamente o estado inconsistente que o resto do projeto gasta tipo para
 * tornar irrepresentável.
 */
export function administrar(novo: Alvo): void {
  alvo = novo;
  for (const ouvinte of ouvintes) ouvinte();
  abrirModal(MODAL_DE[novo.tipo]);
}

/**
 * Qual modal cada alvo abre.
 *
 * `Record` sobre o tipo do alvo: alvo novo não compila até dizer onde abre.
 * Quatro modais para oito alvos — o formulário de canal serve a criar e
 * editar, e a confirmação destrutiva serve a canal e categoria, porque a
 * pergunta é a mesma.
 */
const MODAL_DE: Record<
  Alvo["tipo"],
  | "canal"
  | "exclusao"
  | "convite"
  | "moderar"
  | "imagem"
  | "link"
  | "encaminhar"
  | "enquete"
> = {
  criarCanal: "canal",
  editarCanal: "canal",
  criarCategoria: "canal",
  renomearCategoria: "canal",
  criarPasta: "canal",
  renomearPasta: "canal",
  apagarCanal: "exclusao",
  apagarMensagem: "exclusao",
  verImagem: "imagem",
  linkExterno: "link",
  apagarCategoria: "exclusao",
  convite: "convite",
  moderar: "moderar",
  encaminhar: "encaminhar",
  enquete: "enquete",
};

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparAlvo(): void {
  alvo = undefined;
}
