/**
 * Registro de auditoria — SDK → domínio.
 *
 * ⚠ **A única das cinco páginas que faltavam com o protocolo A FAVOR.**
 * `GET /servers/{target}/audit_logs` existe, com filtro por autor, por alvo e
 * por tipo, e devolve as entradas junto com os usuários e membros citados —
 * ou seja, o nome de quem agiu vem na MESMA resposta e não exige uma segunda
 * volta ao servidor.
 *
 * ⚠ **`client.api` direto, e não um método do SDK**, porque `stoat.js` não
 * envolve esta rota. É o mesmo caminho de `fetchInvites` cru que já usamos em
 * convite e amizade: `client.api` é tipado sobre o OpenAPI inteiro, então a
 * chamada continua conferida em compilação.
 */
import { decodeTime, encodeTime } from "ulid";

import { client } from "./client";
import { motivoDoErro } from "./erros";
import { toast } from "../components/ui/toastStore";

/**
 * O que uma entrada diz, já em português e sem forma de protocolo.
 *
 * ⚠ **`frase` e não a união das 24 variantes.** O protocolo tem vinte e quatro
 * tipos de ação, cada um com campos próprios; trazer a união inteira para o
 * domínio faria todo componente que lê auditoria conhecer a forma do Stoat, e
 * é exatamente o que a camada anticorrupção existe para impedir. O que a tela
 * precisa é de UMA frase, o tipo cru para filtrar, e o par antes/depois quando
 * houver — que é o que ela desenha.
 *
 * O `tipo` cru sobrevive porque ele é o que o FILTRO do servidor aceita
 * (`query.type`), e traduzi-lo de ida e volta só para escondê-lo daria duas
 * tabelas que precisam concordar.
 */
export type EntradaDeAuditoria = {
  readonly id: string;
  /** Quem agiu. Nome resolvido; ID cru se o servidor não o mandou. */
  readonly autor: string;
  /** Quem agiu, por ID — é o que o filtro do servidor aceita (`query.user`). */
  readonly autorId: string;
  /**
   * Sobre quem a ação foi, quando há alguém.
   *
   * ⚠ **Lido de `entry.target` E do corpo da ação**, e não de um só. `target`
   * é o campo genérico que a rota filtra (`query.target`), mas nem todo
   * chamador do servidor o preenche; `BanCreate`, `BanDelete`, `MemberKick` e
   * `MemberEdit` carregam `user` dentro da própria ação, que é onde o dado
   * está garantido. Sem juntar os dois, "banido por / data" viria vazio para
   * metade das entradas.
   */
  readonly alvoId: string | undefined;
  /** O alvo com nome resolvido, quando o servidor o mandou junto. */
  readonly alvo: string | undefined;
  /** O que aconteceu, em português. */
  readonly frase: string;
  /** O tipo do protocolo — é o que o filtro manda de volta. */
  readonly tipo: string;
  /** Razão escrita por quem agiu, quando houve. */
  readonly razao: string | undefined;
  /** Quando, do ULID — o `_id` carrega o tempo. */
  readonly quandoMs: number;
  readonly quandoTexto: string;
  /**
   * O diff, quando a ação é uma EDIÇÃO.
   *
   * ⚠ Par `antes`/`depois` e nunca só o depois: a referência desenha o diff
   * sempre em par, e uma linha que diz "cor: #E8596B" sem o valor anterior não
   * responde a pergunta que se faz num registro de auditoria — o que MUDOU.
   */
  readonly mudancas: readonly {
    readonly campo: string;
    readonly antes: string;
    readonly depois: string;
  }[];
};

/**
 * O que a rota aceita restringir — os mesmos nomes do protocolo, traduzidos.
 *
 * ⚠ **Um `tipo` por consulta, e não uma lista.** A rota aceita `type` como
 * array (`type=A&type=B`), mas o cliente do `stoat-api` monta a query com
 * `URLSearchParams.append` UMA vez por chave — passar um array daria
 * `type=A,B`, que o Rocket lê como um único tipo chamado "A,B" e devolve lista
 * vazia. Um filtro que silenciosamente não acha nada é pior que não ter
 * filtro, então o tipo aqui é uma string só.
 */
export type FiltroDeAuditoria = {
  readonly autorId?: string;
  readonly alvoId?: string;
  readonly tipo?: string;
  /** Entradas ANTES deste id de entrada. */
  readonly antesDe?: string;
  /** Entradas DEPOIS deste id de entrada — `idDeInstante` monta um. */
  readonly depoisDe?: string;
  /** Teto do servidor: 100. Sem isto ele devolve 50. */
  readonly limite?: number;
  /**
   * Falhar sem toast.
   *
   * ⚠ **Não é preguiça de tratar erro — é para quem consulta a auditoria como
   * COMPLEMENTO.** A tela de Banimentos a usa para preencher duas colunas, e
   * `ViewAuditLogs` é permissão separada de `BanMembers`: sem isto, todo
   * moderador que só pode desbanir abriria a página e levaria um toast
   * vermelho sobre algo que ele não pediu. Quem chama com isto ligado
   * continua recebendo `undefined` e tem de dizer na tela que não soube.
   */
  readonly silencioso?: boolean;
};

/** O que a auditoria sabe sobre um banimento, e o `ServerBan` não. */
export type InformacaoDeBanimento = {
  readonly porNome: string;
  readonly quandoMs: number;
  readonly quandoTexto: string;
};

/**
 * Um id de entrada que serve de PISO para um instante.
 *
 * ⚠ **A rota pagina por id de entrada, não por data**, e o filtro é `_id > x`
 * no Mongo. ULID começa com o tempo em base32, então o menor id possível de um
 * instante é o tempo dele seguido de zeros na parte aleatória — e comparar
 * strings ULID é comparar tempos. Isto é o que torna "últimos 90 dias"
 * exprimível numa rota que só conhece ids.
 */
export function idDeInstante(ms: number): string {
  return encodeTime(ms, 10) + "0".repeat(16);
}

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Uma frase por tipo de ação.
 *
 * ⚠ **Sujeito FORA da frase.** A tela desenha "Marina · atualizou o cargo", com
 * o nome em peso próprio; embutir "Marina" aqui daria um texto que a tela não
 * consegue quebrar em duas hierarquias. Mesma razão pela qual `FraseDeSistema`
 * recebe o `NomeDoAutor` como componente em vez de string.
 *
 * ⚠ **Objeto e não `switch`, porque o filtro precisa da LISTA.** A tela oferece
 * "todas as ações" mais as escolhidas, e derivar as opções do mesmo mapa que
 * traduz é o que impede uma ação nova aparecer no registro e sumir do filtro.
 */
export const ACOES: Record<string, string> = {
  MessageDelete: "apagou uma mensagem",
  MessageBulkDelete: "apagou mensagens em lote",
  MessagePin: "fixou uma mensagem",
  MessageUnpin: "desafixou uma mensagem",
  BanCreate: "baniu alguém",
  BanDelete: "removeu um banimento",
  ChannelCreate: "criou um canal",
  ChannelEdit: "editou um canal",
  ChannelRolePermissionsEdit: "alterou permissões de um canal",
  ChannelDelete: "apagou um canal",
  MemberEdit: "editou um membro",
  MemberKick: "expulsou alguém",
  ServerEdit: "editou o servidor",
  RoleEdit: "atualizou um cargo",
  RoleCreate: "criou um cargo",
  RoleDelete: "apagou um cargo",
  RolesReorder: "reordenou os cargos",
  InviteCreate: "criou um convite",
  InviteDelete: "apagou um convite",
  WebhookCreate: "criou um webhook",
  WebhookDelete: "apagou um webhook",
  EmojiCreate: "adicionou um emoji",
  EmojiUpdate: "editou um emoji",
  EmojiDelete: "removeu um emoji",
};

/**
 * Sobre quem a ação foi, lido do CORPO dela.
 *
 * ⚠ **Quatro variantes carregam `user`, e é onde o dado está garantido.** O
 * `entry.target` do topo é o que a ROTA filtra, mas quem o preenche é cada
 * chamador do servidor; `BanCreate`, `BanDelete`, `MemberKick` e `MemberEdit`
 * declaram `user` no próprio `action`. Ler os dois e preferir o que houver é o
 * que faz "banido por / data" chegar completo.
 */
export function alvoDaAcao(acao: Record<string, unknown>): string | undefined {
  const u = acao.user;
  return typeof u === "string" ? u : undefined;
}

/**
 * A mudança de cargos de um membro, em nomes.
 *
 * ⚠ **É o que D-LAC-18 pede, e o que o diff cru não entregava.** Um
 * `MemberEdit` de cargo saía como `roles: ["01A","01B"] → ["01A","01B","01C"]`
 * — dois arrays de ULID onde a diferença é UM elemento no meio. A pergunta que
 * um registro de auditoria responde é "o que mudou", e aqui a resposta é um
 * nome de cargo.
 *
 * `undefined` quando a edição não tocou em cargos: apelido e castigo são
 * `MemberEdit` também, e inventar "nenhum cargo mudou" seria uma frase sobre
 * algo que não aconteceu.
 */
export function cargosMudados(
  acao: Record<string, unknown>,
  nomeDoCargo: (id: string) => string,
): { readonly dados: readonly string[]; readonly tirados: readonly string[] } | undefined {
  const antes = (acao.before as Record<string, unknown> | undefined)?.roles;
  const depois = (acao.after as Record<string, unknown> | undefined)?.roles;
  if (!Array.isArray(antes) && !Array.isArray(depois)) return undefined;
  const a = new Set((Array.isArray(antes) ? antes : []).map(String));
  const d = new Set((Array.isArray(depois) ? depois : []).map(String));
  const dados = [...d].filter((id) => !a.has(id)).map(nomeDoCargo);
  const tirados = [...a].filter((id) => !d.has(id)).map(nomeDoCargo);
  if (dados.length === 0 && tirados.length === 0) return undefined;
  return { dados, tirados };
}

/**
 * A frase da entrada, específica onde dá para ser.
 *
 * ⚠ **`ACOES` sozinho dizia "editou um membro" para toda mudança de cargo**, e
 * é a divergência que a auditoria registrou: o design escreve "atribuiu Design
 * a Téo". A frase genérica continua sendo o piso — ação nova que este cliente
 * não traduz nunca some da lista —, e as que dá para nomear são nomeadas.
 *
 * ⚠ **O ALVO fica fora da frase**, pela mesma razão que o sujeito: a tela
 * desenha autor e alvo em pesos próprios, e embutir o nome aqui daria um texto
 * que ela não consegue quebrar em hierarquias.
 */
export function fraseDaAcao(
  acao: Record<string, unknown>,
  nomeDoCargo: (id: string) => string,
): string {
  const tipo = String(acao.type);
  if (tipo === "MemberEdit") {
    const cargos = cargosMudados(acao, nomeDoCargo);
    if (cargos) {
      const partes: string[] = [];
      if (cargos.dados.length > 0) partes.push(`atribuiu ${cargos.dados.join(", ")}`);
      if (cargos.tirados.length > 0) partes.push(`removeu ${cargos.tirados.join(", ")}`);
      return partes.join(" e ");
    }
  }
  return ACOES[tipo] ?? "fez algo que este cliente ainda não traduz";
}

/**
 * O par antes/depois, quando a ação carrega `before` e `after`.
 *
 * ⚠ **Só as chaves que MUDARAM**, e a comparação é por JSON. Um objeto de
 * canal tem dezenas de campos e a edição toca dois; listar todos afogaria a
 * mudança no que ficou igual — que é o oposto do que um diff serve para fazer.
 */
function diffDe(acao: Record<string, unknown>): EntradaDeAuditoria["mudancas"] {
  const antes = acao.before;
  const depois = acao.after;
  if (
    typeof antes !== "object" ||
    antes === null ||
    typeof depois !== "object" ||
    depois === null
  ) {
    return [];
  }

  const a = antes as Record<string, unknown>;
  const d = depois as Record<string, unknown>;
  const campos = new Set([...Object.keys(a), ...Object.keys(d)]);

  const saida: { campo: string; antes: string; depois: string }[] = [];
  for (const campo of campos) {
    const va = JSON.stringify(a[campo] ?? null);
    const vd = JSON.stringify(d[campo] ?? null);
    if (va === vd) continue;
    saida.push({ campo, antes: va, depois: vd });
  }
  return saida;
}

/**
 * Traz as entradas.
 *
 * ⚠ **`undefined` para FALHA e `[]` para vazio**, como `listarBanidos` e
 * `listarConvites` passaram a fazer. Devolver lista vazia nos dois casos faz a
 * página afirmar "nada aconteceu neste servidor" quando na verdade a consulta
 * não completou — numa tela de moderação é o pior dos dois erros.
 */
export async function listarAuditoria(
  serverId: string,
  filtro: FiltroDeAuditoria = {},
): Promise<readonly EntradaDeAuditoria[] | undefined> {
  try {
    /*
      `as never` é o mesmo escape que `GET /invites/{code}` já usa aqui: o
      cliente tipado do `stoat-api` só aceita as rotas que o `stoat.js` envolve,
      e esta não está entre elas. O tipo da RESPOSTA é declarado logo abaixo, e
      é ele que impede o resto do arquivo de tratar isto como `any`.

      ⚠ **Os filtros vão como PARÂMETROS e não colados no caminho.** O
      `stoat-api` conhece esta rota (`queryParams["/servers/{target}/audit_logs"]`
      lista `user`, `target`, `type`, `before`, `after` e `limit`), então ele
      próprio os move para a query; escrevê-los na string daria `?` duplicado,
      porque o cliente já concatena um.
    */
    const r = (await client.api.get(`/servers/${serverId}/audit_logs` as never, {
      user: filtro.autorId,
      target: filtro.alvoId,
      type: filtro.tipo,
      before: filtro.antesDe,
      after: filtro.depoisDe,
      limit: filtro.limite,
    } as never)) as {
      audit_logs: {
        _id: string;
        user: string;
        target?: string | null;
        reason?: string | null;
        action: unknown;
      }[];
      users: { _id: string; username: string }[];
    };

    /* O nome vem na MESMA resposta — sem isto a coluna sairia com ULID cru. */
    const nomes = new Map(r.users.map((u) => [u._id, u.username]));
    /*
      Os cargos vêm do cache do SDK e não da resposta: `AuditLogQueryResponse`
      traz usuários e membros, nunca cargos. Quem está numa página de
      configuração do servidor já tem a tabela dele pelo `Ready`; o que não
      estiver ali cai no ID, que é a verdade sobre o que foi gravado.
    */
    const cargos = client.servers.get(serverId)?.roles;
    const nomeDoCargo = (id: string) => cargos?.get(id)?.name ?? id;

    return r.audit_logs.map((e) => {
      /* `action` chega como `unknown` do tipo declarado acima — a asserção só nomeia
         a forma que `diffDe` e o `type` esperam. */
      const acao = e.action as Record<string, unknown>;
      const tipo = String(acao.type);
      const quandoMs = decodeTime(e._id);
      const alvoId = e.target ?? alvoDaAcao(acao);
      return {
        id: e._id,
        autor: nomes.get(e.user) ?? e.user,
        autorId: e.user,
        alvoId,
        alvo: alvoId === undefined ? undefined : nomes.get(alvoId),
        frase: fraseDaAcao(acao, nomeDoCargo),
        tipo,
        razao: e.reason ?? undefined,
        quandoMs,
        quandoTexto: QUANDO.format(new Date(quandoMs)),
        mudancas: diffDe(acao),
      };
    });
  } catch (e) {
    if (!filtro.silencioso) {
      toast({
        tipo: "erro",
        titulo: "Não deu para carregar o registro.",
        descricao: motivoDoErro(e),
      });
    }
    return undefined;
  }
}

/**
 * O que o servidor sabe sobre cada banimento e o objeto `ServerBan` não diz.
 *
 * ⚠ **`ServerBan` tem `_id`, `reason` e a conta — e nada mais.** "Banido por" e
 * "Data" são duas colunas do design que a tela de Banimentos não desenhava, e
 * o rodapé dela dizia onde a informação realmente mora: na auditoria, na
 * entrada `BanCreate`. Isto é essa ponte.
 *
 * ⚠ **Só `BanCreate`, e o filtro vai ao SERVIDOR.** Sem ele a consulta traria
 * as últimas N entradas de qualquer tipo, e num servidor movimentado cem
 * entradas podem não conter banimento nenhum — a tabela ficaria vazia à toa.
 *
 * ⚠ **A primeira ocorrência de cada conta ganha, e a ordem é do servidor:**
 * `_id` decrescente, ou seja, do mais recente para o mais antigo. Quem foi
 * banido, perdoado e banido de novo tem duas entradas, e a que importa é a
 * que está valendo.
 *
 * ⚠ **`undefined` para FALHA e `Map` vazio para "nada encontrado"**, a mesma
 * disciplina de `listarBanidos`. A tela precisa distinguir: com falha ela não
 * pode afirmar "sem registro" sobre nenhuma linha.
 */
export async function autoriaDosBanimentos(
  serverId: string,
): Promise<ReadonlyMap<string, InformacaoDeBanimento> | undefined> {
  const entradas = await listarAuditoria(serverId, {
    tipo: "BanCreate",
    limite: 100,
    silencioso: true,
  });
  if (entradas === undefined) return undefined;

  const mapa = new Map<string, InformacaoDeBanimento>();
  for (const e of entradas) {
    if (e.alvoId === undefined || mapa.has(e.alvoId)) continue;
    mapa.set(e.alvoId, {
      porNome: e.autor,
      quandoMs: e.quandoMs,
      quandoTexto: e.quandoTexto,
    });
  }
  return mapa;
}

/**
 * O histórico de UMA pessoa neste servidor.
 *
 * ⚠ **Filtrado no SERVIDOR (`query.target`) e não aqui.** Filtrar no cliente
 * exigiria trazer a página inteira e torcer para a pessoa aparecer nela —
 * numa auditoria de noventa dias, o histórico de quem entrou ontem estaria
 * fora das últimas cem entradas. É a mesma razão pela qual a busca da tela de
 * auditoria continua sendo do cliente: lá o conjunto já está na mão, aqui não.
 */
export function historicoDoMembro(
  serverId: string,
  userId: string,
): Promise<readonly EntradaDeAuditoria[] | undefined> {
  return listarAuditoria(serverId, { alvoId: userId, limite: 100 });
}
