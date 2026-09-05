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
import { decodeTime } from "ulid";

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
): Promise<readonly EntradaDeAuditoria[] | undefined> {
  try {
    /*
      `as never` é o mesmo escape que `GET /invites/{code}` já usa aqui: o
      cliente tipado do `stoat-api` só aceita as rotas que o `stoat.js` envolve,
      e esta não está entre elas. O tipo da RESPOSTA é declarado logo abaixo, e
      é ele que impede o resto do arquivo de tratar isto como `any`.
    */
    const r = (await client.api.get(
      `/servers/${serverId}/audit_logs` as never,
    )) as {
      audit_logs: {
        _id: string;
        user: string;
        reason?: string | null;
        action: unknown;
      }[];
      users: { _id: string; username: string }[];
    };

    /* O nome vem na MESMA resposta — sem isto a coluna sairia com ULID cru. */
    const nomes = new Map(r.users.map((u) => [u._id, u.username]));

    return r.audit_logs.map((e) => {
      /* `action` chega como `unknown` do tipo declarado acima — a asserção só nomeia
         a forma que `diffDe` e o `type` esperam. */
      const acao = e.action as Record<string, unknown>;
      const tipo = String(acao.type);
      const quandoMs = decodeTime(e._id);
      return {
        id: e._id,
        autor: nomes.get(e.user) ?? e.user,
        frase: ACOES[tipo] ?? "fez algo que este cliente ainda não traduz",
        tipo,
        razao: e.reason ?? undefined,
        quandoMs,
        quandoTexto: QUANDO.format(new Date(quandoMs)),
        mudancas: diffDe(acao),
      };
    });
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para carregar o registro.",
      descricao: motivoDoErro(e),
    });
    return undefined;
  }
}
