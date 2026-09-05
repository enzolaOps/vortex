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
    if (!rota.endsWith("/audit_logs")) return original(rota, ...resto);
    return Promise.resolve({
      users: userIds.slice(0, 3).map((id, i) => ({
        _id: id,
        username: ["Marina", "Téo", "Rafa"][i],
      })),
      audit_logs: [
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
        {
          _id: ulidEm(AGORA - 20 * HORA),
          user: userIds[2],
          reason: "divulgação em massa",
          action: { type: "BanCreate" },
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
      ],
    });
  };
}
