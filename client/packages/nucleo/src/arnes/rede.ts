/**
 * As respostas que o firehose não tinha como gerar.
 *
 * ⚠ **É a 11ª vez que o arnês aparece mais pobre que o protocolo, e desta vez
 * o conserto é de FORMA diferente das dez anteriores.** Ali bastava enriquecer
 * o gerador — mais recados, mais markdown, mais tipos de anexo. Aqui não: as
 * quatro páginas passam por REDE (`fetchInvites`, `fetchBans`, `fetchEmojis` e
 * um `client.api.get` cru), e o firehose semeia o cache do SDK por hidratação.
 * Sem servidor no ar elas ficam em "Carregando…" para sempre.
 *
 * O custo disso não é estético: **quatro das treze páginas de servidor nunca
 * foram VISTAS com dado** — só nos estados vazio e de falha. A varredura 1:1
 * contra a referência não tinha como cobri-las, e "não consigo comparar" é
 * indistinguível de "está igual" num relatório.
 *
 * ⚠ **Dublagem por INSTÂNCIA, e não por módulo.** Os métodos são trocados no
 * objeto `Server` que a hidratação criou, e o `client.api.get` ganha um
 * envelope que só intercepta a rota de auditoria e repassa todo o resto. A
 * alternativa — um `if (arnes)` dentro de `sdk/` — poria caminho de teste no
 * código que vai a produção, que é o oposto do que a camada anticorrupção
 * existe para fazer.
 *
 * Nada aqui entra no bundle de produção: o módulo só é importado pelo arnês.
 */
import { ulid } from "ulid";

import { client } from "../sdk/client";

/**
 * Um instante N horas atrás, como ULID — o `_id` é quem carrega o tempo.
 *
 * ⚠ **A biblioteca, e não `toString(32)`.** A primeira versão montava a
 * marca de tempo com base 32 do JavaScript, que usa o alfabeto `0-9a-v`;
 * Crockford — que é o do ULID — TIRA `I`, `L`, `O` e `U` de propósito, para
 * não confundir com `1` e `0`. Um `U` no meio da marca fazia `decodeTime`
 * lançar, a página caía no ramo de falha e dizia "a consulta não completou".
 * Ou seja: o arnês reproduzia um erro de servidor com um dado que ele mesmo
 * inventou errado.
 */
const ulidEm = (ms: number) => ulid(ms);

const AGORA = Date.now();

/**
 * As mensagens das DMs de desconhecido que o firehose semeia, pela rota que
 * `fetchMessage` chama. Registradas por `semearConversas`, servidas pelo
 * envelope abaixo.
 */
const PREVIAS = new Map<string, unknown>();

export function registrarPreviaDublada(
  channelId: string,
  mensagem: { readonly _id: string; readonly author: string; readonly content: string },
): void {
  PREVIAS.set(`/channels/${channelId}/messages/${mensagem._id}`, {
    ...mensagem,
    channel: channelId,
  });
}
const HORA = 3_600_000;

/**
 * Liga as quatro respostas.
 *
 * `userIds` e `canais` vêm do próprio firehose para as listas citarem gente e
 * lugares que EXISTEM na tela — um convite para `#canal-fantasma` testaria a
 * resolução de nome pelo caminho da falha, que não é o caso comum.
 */
export function dublarRedeDoServidor(
  serverId: string,
  userIds: readonly string[],
  canalIds: readonly string[],
): void {
  const servidor = client.servers.get(serverId);
  if (servidor === undefined) return;

  const alvo = servidor as unknown as Record<string, unknown>;
  /* Os cargos REAIS do servidor semeado: a entrada de auditoria que muda cargo
     precisa citar IDs que o cache do SDK resolve, senão ela exercita só o ramo
     de fallback e a frase sai com ULID no lugar de "Design". */
  const cargoIds = servidor.orderedRoles.map((c) => c.id);

  /* ------------------------------------------------------- convites */
  /*
    Cinco, e o CRIADOR varia de propósito: a coluna resolve o nome pelo cache
    de usuários, e uma lista com um criador só nunca exercita o caso de quem
    já saiu do servidor.
  */
  alvo.fetchInvites = () =>
    Promise.resolve(
      ["a9Kq2", "TmP44", "DSN01", "oldX1", "exp77"].map((codigo, i) => ({
        id: codigo,
        channelId: canalIds[i % canalIds.length],
        creatorId: userIds[i % userIds.length],
      })),
    );

  /* ------------------------------------------------------ banimentos */
  /*
    ⚠ **Um SEM motivo, de propósito.** `ServerBan.reason` é opcional no
    protocolo, e a coluna precisa mostrar a ausência sem virar "undefined".
    Uma lista onde todo mundo tem motivo nunca prova isso.
  */
  alvo.fetchBans = () =>
    Promise.resolve([
      {
        id: { server: serverId, user: "01JQ00000000000000BAN00001" },
        reason: "Divulgação em massa em 6 canais",
        user: { username: "spam_842" },
      },
      {
        id: { server: serverId, user: "01JQ00000000000000BAN00002" },
        reason: "Participação em raid coordenada",
        user: { username: "raid_bot_11" },
      },
      {
        id: { server: serverId, user: "01JQ00000000000000BAN00003" },
        reason: undefined,
        user: { username: "tox.user" },
      },
    ]);

  /* ---------------------------------------------------------- emojis */
  alvo.fetchEmojis = () =>
    Promise.resolve(
      ["vtx", "ship_it", "wip", "no_alvo"].map((nome, i) => ({
        id: `01JQ0000000000000EMOJI000${String(i)}`,
        name: nome,
        /*
          ⚠ **`url` vazia, e não um link inventado.** O `<img>` que não carrega
          cai no que estiver atrás dele, que é o comportamento real quando o
          servidor de mídia está fora — e é justamente o estado que a página
          precisa aguentar. Uma URL de terceiro faria o arnês buscar na
          internet a cada abertura.
        */
        url: "",
      })),
    );

  /* ------------------------------------------------------- auditoria */
  /*
    Aqui a dublagem é do TRANSPORTE e não do objeto: a rota não tem método no
    `stoat.js`, então quem a chama é `client.api.get`. O envelope repassa tudo
    o que não for auditoria — sem isso, ligar o arnês derrubaria login,
    convite e amizade juntos.
  */
  const api = client.api as unknown as {
    get: (rota: string, ...resto: unknown[]) => Promise<unknown>;
  };
  if ((api as unknown as { __dublado?: boolean }).__dublado === true) return;
  const original = api.get.bind(api);
  (api as unknown as { __dublado?: boolean }).__dublado = true;

  api.get = (rota: string, ...resto: unknown[]) => {
    /*
      ⚠ **Em comum e prévia de solicitação, e as duas são REDE.** Sem elas as
      abas do perfil e a fila de desconhecidos só apareciam no estado de erro.
      Servidores: o do arnês. Amigos: um em cada três ids, que é outra
      distribuição que a das relações — uma lista igual à de amigos não prova
      que a interseção veio da resposta e não do cache.
    */
    if (rota.endsWith("/mutual")) {
      const alvoId = rota.split("/")[2] ?? "";
      const n = alvoId.charCodeAt(alvoId.length - 1) % 4;
      return Promise.resolve({
        servers: n === 0 ? [] : [serverId],
        users: userIds
          .filter((id, i) => i > 0 && id !== alvoId && i % 3 === n % 3)
          .slice(0, n + 1),
        channels: [],
      });
    }
    /*
      ⚠ **O convite, e sem ele o embed no chat (D-EVT-40) nasceria
      INALCANÇÁVEL.** `GET /invites/{code}` é rede como as outras quatro
      páginas deste arquivo, e é a linha de mensagem que o chama — ou seja, o
      cartão existiria, compilaria, teria teste, e não haveria como olhar. É a
      família do painel de fixadas, e a 12ª vez que o arnês aparece mais pobre
      que o protocolo.

      ⚠ **O servidor do convite NÃO é o do arnês**, de propósito: com ele o
      cartão cairia direto em `jaSouMembro` e o botão diria "Abrir". O caminho
      que interessa — "Entrar", e os desfechos de pedido e banimento — só
      existe para um servidor de fora.
    */
    if (/^\/invites\/[^/]+$/.test(rota)) {
      return Promise.resolve({
        type: "Server",
        code: rota.slice("/invites/".length),
        server_id: "01JQ000000000000CONVITE01",
        server_name: "Vortex Core",
        member_count: 1204,
        channel_id: "01JQ00000000000CONVITECH1",
        channel_name: "boas-vindas",
        channel_description: "Comece por aqui.",
        user_name: "Júlia Prado",
      });
    }

    const previa = PREVIAS.get(rota);
    if (previa !== undefined) return Promise.resolve(previa);
    if (!rota.endsWith("/audit_logs")) return original(rota, ...resto);
    /*
      ⚠ **O filtro `type` é HONRADO aqui, e ignorá-lo escondia um consumidor
      inteiro.** A tela de Banimentos consulta a auditoria com
      `type=BanCreate` para preencher "Banido por" e "Data"; um envelope que
      devolve tudo faz a página funcionar por acidente — ela receberia as
      cinco entradas e acharia a de banimento no meio. No servidor de verdade
      o filtro corta, e com ele o número de entradas devolvidas muda. É a
      enésima vez que o arnês é mais pobre que o protocolo, e a primeira em
      que ele é mais GENEROSO: devolver a mais também esconde defeito.
    */
    const filtros = (resto[0] ?? {}) as { type?: string; target?: string };
    type Entrada = {
      readonly _id: string;
      readonly target?: string;
      readonly action: { readonly type: string };
    };
    /*
      ⚠ **Ordena por `_id` DECRESCENTE, como o servidor.** O Mongo devolve
      `sort: { _id: -1 }`, e a tela conta com isso: a régua de dia só aparece
      quando o dia MUDA em relação à linha anterior, então uma lista fora de
      ordem produziria duas réguas do mesmo dia e um "16 de setembro" acima de
      um evento das 19h. Medido na primeira corrida com este envelope — a
      ordem do array-fonte vazou para a tela.
    */
    const filtrar = <T extends Entrada>(lista: readonly T[]): readonly T[] =>
      lista
        .filter(
          (e) =>
            (filtros.type === undefined || e.action.type === filtros.type) &&
            (filtros.target === undefined || e.target === filtros.target),
        )
        .sort((a, b) => (a._id < b._id ? 1 : a._id > b._id ? -1 : 0));
    return Promise.resolve({
      users: [
        ...userIds.slice(0, 3).map((id, i) => ({
          _id: id,
          username: ["Marina", "Téo", "Rafa"][i],
        })),
        /*
          ⚠ **As contas banidas entram em `users`.** Sem elas o alvo de um
          `BanCreate` viria sem nome resolvido, e a coluna "Banido por" da
          tabela de Banimentos casaria por ID mas a tela de auditoria
          mostraria o ULID cru — o caso que `alvo === undefined` cobre,
          exercitado por `no_alvo` mais abaixo.
        */
        { _id: "01JQ00000000000000BAN00001", username: "spam_842" },
        { _id: "01JQ00000000000000BAN00002", username: "raid_bot_11" },
      ],
      audit_logs: filtrar([
        {
          _id: ulidEm(AGORA - HORA),
          user: userIds[0],
          action: {
            type: "RoleEdit",
            /*
              ⚠ **`before` e `after` com uma chave IGUAL entre eles.** `diffDe`
              lista só o que mudou, e sem um campo repetido o filtro dela nunca
              é exercitado — a tela passaria mesmo com a comparação quebrada.
            */
            before: { name: "Moderação", colour: "#E2B15C", hoist: false },
            after: { name: "Moderação", colour: "#E8596B", hoist: true },
          },
        },
        {
          _id: ulidEm(AGORA - 2 * HORA),
          user: userIds[1],
          reason: "revisão de permissões",
          action: { type: "ChannelRolePermissionsEdit" },
        },
        /*
          ⚠ **Mudança de CARGO, e ela não existia.** `MemberEdit` com `roles`
          é a única entrada que produz a frase específica do design ("atribuiu
          Design a Téo") em vez de "editou um membro"; sem ela, o caminho que
          resolve nome de cargo e monta a frase nunca chegava à tela. É a
          mesma família do `ehMencao` que passou três fases sem devolver
          `true`.

          Os IDs de cargo saem do FIREHOSE, não de constantes: o mapa de nomes
          vem do cache do SDK, e IDs inventados exercitariam só o ramo de
          fallback (que cai no ID cru).
        */
        {
          _id: ulidEm(AGORA - 3 * HORA),
          user: userIds[0],
          target: userIds[1],
          action: {
            type: "MemberEdit",
            user: userIds[1],
            before: { roles: cargoIds.slice(0, 1) },
            after: cargoIds.length > 1 ? { roles: cargoIds.slice(0, 2) } : { roles: [] },
          },
        },
        /*
          ⚠ **Duas contas banidas, e só DUAS das três que `fetchBans` devolve.**
          A terceira fica de fora de propósito: a auditoria guarda uma janela,
          não a história inteira, e "banimento fora do registro" é um estado
          que a tabela precisa dizer em vez de deixar em branco. Uma amostra
          onde toda linha tem autoria nunca prova isso.
        */
        {
          _id: ulidEm(AGORA - 20 * HORA),
          user: userIds[2],
          target: "01JQ00000000000000BAN00001",
          reason: "divulgação em massa",
          action: { type: "BanCreate", user: "01JQ00000000000000BAN00001" },
        },
        {
          _id: ulidEm(AGORA - 34 * HORA),
          user: userIds[0],
          target: "01JQ00000000000000BAN00002",
          action: { type: "BanCreate", user: "01JQ00000000000000BAN00002" },
        },
        {
          _id: ulidEm(AGORA - 26 * HORA),
          user: userIds[0],
          action: { type: "InviteCreate" },
        },
        {
          /*
            ⚠ **Um tipo que o mapa NÃO traduz.** `ACOES` cobre as 24 do
            protocolo de hoje; o ramo de fallback ("fez algo que este cliente
            ainda não traduz") nunca tinha aparecido em tela, e é ele que
            decide como a página envelhece quando o servidor ganha uma ação
            nova.
          */
          _id: ulidEm(AGORA - 30 * HORA),
          user: userIds[1],
          action: { type: "AlgoQueAindaNaoExiste" },
        },
      ]),
    });
  };
}
