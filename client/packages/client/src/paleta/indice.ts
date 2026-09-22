/**
 * O índice da paleta de comandos.
 *
 * Montado no momento em que a paleta ABRE, nunca mantido em memória nem
 * assinado. A razão é a lei nº 1 aplicada ao contrário: um índice vivo teria
 * que assinar todos os servidores, todos os canais e todos os membros — o
 * escopo de update mais largo possível num app cuja arquitetura inteira existe
 * para manter escopo estreito.
 *
 * O custo do jeito certo: uma varredura de algumas centenas de entradas, uma
 * vez por abertura, disparada por um atalho humano. Microssegundos.
 *
 * `peek` e não `getSnapshot`: ler sem assinar é exatamente o que se quer aqui,
 * e é a única parte do app que usa `peek` por escolha em vez de por ser fora
 * de componente.
 */
import {
  channels,
  conversas,
  members,
  membrosOffline,
  membrosOnline,
  RAIZ,
  servers,
  vozPorCanal,
} from "../sdk/adapter";
import { canaisOrdenados, servidoresOrdenados } from "../sdk/ordem";
import { chaveDeMembro } from "../sdk/domain";
import { chaveDoCanal, listasDeTopicos, topicos } from "../sdk/topicos";
import { ATALHOS } from "../atalhos/registro";

export type TipoDeEntrada =
  | "servidor"
  | "canal"
  | "pessoa"
  | "topico"
  | "acao";

/**
 * Os cinco chips de filtro do design, e o PREFIXO que cada um representa.
 *
 * ⚠ **Um dono só para o filtro: a string de busca.** O design escreve a
 * promessa por extenso — *"quem digita e quem clica chega ao mesmo estado"* —,
 * e a única forma de garanti-la é o chip ESCREVER o prefixo no campo em vez de
 * guardar um estado paralelo. Com dois donos, digitar `#` deixaria o chip
 * apagado e clicar no chip deixaria o campo sem o prefixo; os dois seriam
 * "corretos" e a tela se contradiria.
 */
export const CHIPS = [
  { prefixo: "#", tipo: "canal", rotulo: "canais" },
  { prefixo: "@", tipo: "pessoa", rotulo: "pessoas" },
  { prefixo: "*", tipo: "servidor", rotulo: "servidores" },
  { prefixo: "!", tipo: "topico", rotulo: "tópicos" },
  { prefixo: ">", tipo: "acao", rotulo: "ações" },
] as const satisfies readonly {
  prefixo: string;
  tipo: TipoDeEntrada;
  rotulo: string;
}[];

export type Entrada = {
  readonly tipo: TipoDeEntrada;
  readonly id: string;
  readonly rotulo: string;
  /** Onde isto vive — o nome do servidor, o canal pai, o estado do canal. */
  readonly contexto: string | undefined;
  /** Só para canal: decide o ícone. */
  readonly canalDeVoz?: boolean;
  /** Servidor a abrir junto, quando a entrada é canal, tópico ou pessoa. */
  readonly serverId?: string;
  /** Não lidas do canal — vira selo `danger`. */
  readonly naoLidas?: number;
  readonly mencoes?: number;
  /** Gente na sala de voz — vira selo `success` ("3 na chamada"). */
  readonly naSala?: number;
  readonly silenciado?: boolean;
  /** Só para `acao`: o que ↵ executa. */
  readonly executar?: () => void;
};

/**
 * O que a busca PEDE: um tipo (do prefixo) e o termo que sobrou.
 *
 * ⚠ **O prefixo só conta no INÍCIO**, e o espaço depois dele é opcional. Um
 * `#` no meio da frase é parte do nome de um canal, e tratá-lo como filtro
 * faria `ver #geral` deixar de achar nada.
 */
export function analisarBusca(bruto: string): {
  readonly tipo: TipoDeEntrada | undefined;
  readonly termo: string;
} {
  const chip = CHIPS.find((c) => bruto.startsWith(c.prefixo));
  if (!chip) return { tipo: undefined, termo: bruto };
  return { tipo: chip.tipo, termo: bruto.slice(chip.prefixo.length).trimStart() };
}

/** Escreve (ou apaga) o prefixo, preservando o que já estava digitado. */
export function alternarPrefixo(bruto: string, prefixo: string): string {
  const { tipo, termo } = analisarBusca(bruto);
  const doChip = CHIPS.find((c) => c.prefixo === prefixo);
  /* Clicar no chip ATIVO desativa — é toggle, e está no design. */
  if (doChip && tipo === doChip.tipo) return termo;
  return `${prefixo}${termo}`;
}

/**
 * Monta o índice. Ordem: servidores, canais, pessoas.
 *
 * A ordem NÃO é alfabética entre tipos, e isso é decisão: quem digita "ger"
 * quase sempre quer o canal `#geral`, não uma pessoa chamada Geraldo. Tipos
 * mais específicos primeiro seria o inverso do útil — servidor é o contexto
 * mais amplo e o mais raro de buscar, mas quando é buscado é inequívoco.
 *
 * Pessoas só do servidor ATIVO. Indexar os membros de todos os servidores
 * significaria dezenas de milhares de entradas para achar uma — e o caso real
 * é "falar com alguém daqui", não "achar essa pessoa em algum lugar".
 */
export function montarIndice(servidorAtivo: string): readonly Entrada[] {
  const out: Entrada[] = [];

  const idsDeServidor = servidoresOrdenados();

  for (const id of idsDeServidor) {
    const servidor = servers.peek(id);
    if (!servidor) continue;
    out.push({
      tipo: "servidor",
      id,
      rotulo: servidor.name,
      contexto: undefined,
      naoLidas: servidor.naoLidas,
      mencoes: servidor.mencoes,
    });
  }

  for (const serverId of idsDeServidor) {
    const nomeDoServidor = servers.peek(serverId)?.name;

    /* A ordem da COLUNA, e a mesma que os atalhos ⌥↑/↓ percorrem — ver
       `sdk/ordem.ts`. A paleta não deve reordenar o que a coluna respeita. */
    for (const id of canaisOrdenados(serverId)) {
      const canal = channels.peek(id);
      if (!canal) continue;
      const deVoz = canal.tipo === "voz";
      out.push({
        tipo: "canal",
        id,
        rotulo: canal.name,
        contexto: nomeDoServidor,
        canalDeVoz: deVoz,
        serverId,
        naoLidas: canal.naoLidas,
        mencoes: canal.mencoes,
        silenciado: canal.silenciado,
        /* `vozPorCanal` já é o store da sala, lido sem assinar — é o mesmo
           dado que a coluna de canais desenha, e não uma segunda contagem. */
        naSala: deVoz ? (vozPorCanal.peek(id)?.length ?? 0) : undefined,
      });

      /*
        Os TÓPICOS que a sessão já conhece.

        ⚠ **Só os já carregados, e a degradação é dita.** A lista de tópicos de
        um canal chega por REDE (`listasDeTopicos`), e montar o índice não pode
        disparar busca — ele roda a cada abertura da paleta, num gesto humano
        que precisa ser instantâneo. Quem abriu o painel de tópicos daquele
        canal os encontra aqui; quem nunca abriu, não. É a mesma escolha de
        indexar pessoas só do servidor ativo.
      */
      for (const topicoId of listasDeTopicos.peek(chaveDoCanal(id)) ?? []) {
        const t = topicos.peek(topicoId);
        if (!t) continue;
        out.push({
          tipo: "topico",
          id: topicoId,
          rotulo: t.nome,
          contexto: canal.name,
          serverId,
        });
      }
    }
  }

  /*
    As conversas da casa — DM, grupo e notas.

    ⚠ **Faltavam, e a ausência era maior do que parece:** a paleta é a
    superfície de MOVIMENTO do app, e o lugar para onde mais se vai num
    cliente de chat é uma conversa. Sem elas, `⌘K` servia a servidores e
    canais e obrigava a voltar ao rail para falar com alguém.
  */
  for (const id of conversas.peek(RAIZ) ?? []) {
    const canal = channels.peek(id);
    if (!canal) continue;
    out.push({
      tipo: "canal",
      id,
      rotulo: canal.name,
      contexto: "Conversas",
      naoLidas: canal.naoLidas,
      mencoes: canal.mencoes,
      silenciado: canal.silenciado,
    });
  }

  if (servidorAtivo) {
    const nomeDoServidor = servers.peek(servidorAtivo)?.name;
    const pessoas = [
      ...(membrosOnline.peek(servidorAtivo) ?? []),
      ...(membrosOffline.peek(servidorAtivo) ?? []),
    ];

    for (const userId of pessoas) {
      const membro = members.peek(chaveDeMembro(servidorAtivo, userId));
      if (!membro) continue;
      out.push({
        tipo: "pessoa",
        id: userId,
        rotulo: membro.displayName,
        contexto: nomeDoServidor,
        serverId: servidorAtivo,
      });
    }
  }

  /*
    As AÇÕES, e elas são o registro de atalhos.

    ⚠ **Não é uma segunda lista de comandos.** `atalhos/registro.ts` já é a
    tabela de "coisas que o app faz por uma tecla", com handler obrigatório
    por tipo — reusá-la aqui significa que um comando novo aparece na paleta
    e na página de atalhos no mesmo commit, e que nenhum dos dois pode
    anunciar algo que não executa. Só as de escopo `documento`: as de composer
    dependem do cursor estar num campo, e a paleta acabou de tirá-lo de lá.
  */
  for (const a of ATALHOS) {
    if (a.escopo !== "documento") continue;
    out.push({
      tipo: "acao",
      id: a.id,
      rotulo: a.rotulo,
      contexto: undefined,
      executar: a.executar,
    });
  }

  return out;
}

/**
 * Filtro por SUBSEQUÊNCIA, não por substring.
 *
 * "gr" acha "geral" e "cnv" acha "conversa" — é o que faz uma paleta parecer
 * rápida, porque a pessoa digita as consoantes que lembra em vez do prefixo
 * exato. Substring obrigaria a acertar o começo, e aí a paleta vira uma lista
 * com campo de busca.
 *
 * Sem biblioteca de fuzzy: elas trazem ranking por distância de edição, que é
 * caro e resolve um problema que não temos — nossos rótulos são curtos e em
 * dezenas, não milhares.
 */
export function combina(rotulo: string, busca: string): boolean {
  if (!busca) return true;

  const alvo = normalizar(rotulo);
  const termo = normalizar(busca);

  let i = 0;
  for (const letra of alvo) {
    if (letra === termo[i]) i++;
    if (i === termo.length) return true;
  }
  return false;
}

/**
 * Sem acento e em minúscula.
 *
 * `NFD` + remoção de diacríticos: quem procura "emilia" precisa achar
 * "Emília", e quem tem teclado sem acento não pode ficar de fora da própria
 * lista de contatos.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * A pontuação, para ordenar os que combinam.
 *
 * Prefixo ganha de subsequência espalhada — quem digita "ger" espera `#geral`
 * antes de `#gerenciamento-de-recursos`. Depois disso, o mais curto ganha: com
 * o mesmo prefixo, o rótulo menor é quase sempre o mais usado.
 */
export function pontuar(rotulo: string, busca: string): number {
  // Sem busca, TODOS empatam — e a ordenação estável preserva a ordem do
  // índice: servidores, canais, pessoas. Pontuar por comprimento aqui
  // misturaria os três tipos numa lista ordenada por tamanho de nome, que é
  // exatamente o que a ordem do índice existe para evitar.
  if (!busca) return 0;

  const alvo = normalizar(rotulo);
  const termo = normalizar(busca);

  const faixa = alvo.startsWith(termo) ? 0 : alvo.includes(termo) ? 1 : 2;

  // Faixa em milhares, comprimento nas unidades: um número só, e a ordem sai
  // certa sem um comparador com dois critérios espalhado por dois arquivos.
  //
  // O comprimento estava DESCRITO neste comentário e ausente do código — o
  // teste "ordena de fato uma lista realista" pegou, e é a mesma família do
  // `py-0.5`: prosa afirmando o que o código não faz. Sem o desempate,
  // `gerenciamento-de-recursos` vinha antes de `geral`, porque os dois
  // pontuavam 0 e a ordenação estável mantinha a ordem do índice.
  return faixa * 1000 + Math.min(alvo.length, 999);
}
