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
  canaisDeTexto,
  canaisDeVoz,
  categorias,
  channels,
  members,
  membrosOffline,
  membrosOnline,
  RAIZ,
  serverIds,
  servers,
} from "../sdk/adapter";
import { chaveDeMembro } from "../sdk/domain";

export type TipoDeEntrada = "servidor" | "canal" | "pessoa";

export type Entrada = {
  readonly tipo: TipoDeEntrada;
  readonly id: string;
  readonly rotulo: string;
  /** Onde isto vive — o nome do servidor, para canais e pessoas. */
  readonly contexto: string | undefined;
  /** Só para canal: decide o ícone. */
  readonly canalDeVoz?: boolean;
  /** Servidor a abrir junto, quando a entrada é canal ou pessoa. */
  readonly serverId?: string;
};

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

  const idsDeServidor = serverIds.peek(RAIZ) ?? [];

  for (const id of idsDeServidor) {
    const servidor = servers.peek(id);
    if (!servidor) continue;
    out.push({ tipo: "servidor", id, rotulo: servidor.name, contexto: undefined });
  }

  for (const serverId of idsDeServidor) {
    const nomeDoServidor = servers.peek(serverId)?.name;

    // Pelas CATEGORIAS quando existem: é a ordem que quem administra definiu,
    // e a paleta não deve reordenar o que a coluna respeita.
    const grupos = categorias.peek(serverId);
    const idsDeCanal = grupos
      ? grupos.flatMap((g) => [...g.canais])
      : [
          ...(canaisDeTexto.peek(serverId) ?? []),
          ...(canaisDeVoz.peek(serverId) ?? []),
        ];

    for (const id of idsDeCanal) {
      const canal = channels.peek(id);
      if (!canal) continue;
      out.push({
        tipo: "canal",
        id,
        rotulo: canal.name,
        contexto: nomeDoServidor,
        canalDeVoz: canal.tipo === "voz",
        serverId,
      });
    }
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
