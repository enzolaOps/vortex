/**
 * Servidores: criar, entrar por convite, administrar.
 *
 * Mora em `src/sdk/` pela regra de sempre — `ServerPublicInvite`, `Server` e a
 * grafia do protocolo ficam dentro; o que sai são IDs e tipos do domínio.
 */
import { PublicChannelInvite, ServerPublicInvite } from "stoat.js";

import { ulid } from "ulid";

import { client } from "./client";
import { publicarCanaisDe } from "./adapter";
import { toast } from "../components/ui/toastStore";
import { sigla } from "../lib/sigla";
import { motivoDoErro } from "./erros";

/**
 * O convite, reduzido ao que a tela de pré-visualização mostra.
 *
 * Tipo do Vortex e não `ServerPublicInvite`: a tela não deve conhecer `File`
 * nem `ServerFlags`, e o dia em que o preview mostrar banner é um campo a mais
 * aqui, não um import a mais lá.
 */
export type Convite = {
  readonly codigo: string;
  readonly serverId: string;
  readonly nomeDoServidor: string;
  readonly sigla: string;
  readonly membros: number;
  readonly nomeDoCanal: string;
  readonly convidadoPor: string;
  /** Já sou membro — o botão diz "Abrir" em vez de "Entrar". */
  readonly jaSouMembro: boolean;
};

const novoId = (): string => ulid();


/* Delega para o tradutor unico — ver `sdk/erros.ts`. O corpo que
   estava aqui lia `e.response.status`, que o `stoat-api` nunca
   produz, entao TODA falha virava "Sem resposta do servidor". */
function motivo(e: unknown): string {
  return motivoDoErro(e);
}

/* ------------------------------------------------------------- convites */

/**
 * O convite guardado entre a busca e o "entrar".
 *
 * Module-level e não no store: é o objeto do SDK, com o método `join` dentro,
 * e ele não pode sair daqui — a tela recebe o tipo `Convite`, que é domínio.
 */
let pendente: ServerPublicInvite | undefined;

/**
 * Busca um convite pelo código.
 *
 * ⚠ **`GET /invites/{code}` não tem método no SDK** — só o `join` tem. O
 * cliente Solid também chama esta crua. `client.api` é tipado sobre o OpenAPI
 * inteiro, então "não está no SDK" não quer dizer "não dá".
 *
 * Aceita o código ou a URL inteira: quem recebe um convite copia o link, não o
 * código, e obrigar a extrair o pedaço à mão é atrito por nada.
 */
export async function buscarConvite(
  entrada: string,
): Promise<Convite | { readonly erro: string }> {
  const codigo = codigoDe(entrada);
  if (!codigo) return { erro: "Isso não parece um convite." };

  try {
    const bruto = await client.api.get(`/invites/${codigo}` as never);
    const convite = PublicChannelInvite.from(client, bruto as never);

    /*
      Tipo desconhecido NÃO vira erro genérico.

      O protocolo tem convite de servidor e reserva espaço para outros; o SDK
      devolve `UnknownPublicInvite` para o que ele não sabe montar. Dizer o que
      houve é melhor que "convite inválido", que manda a pessoa procurar erro
      num link que está certo.
    */
    if (!(convite instanceof ServerPublicInvite)) {
      return { erro: "Este tipo de convite ainda não é suportado aqui." };
    }

    pendente = convite;
    return {
      codigo: convite.code,
      serverId: convite.serverId,
      nomeDoServidor: convite.serverName,
      sigla: sigla(convite.serverName),
      membros: convite.memberCount,
      nomeDoCanal: convite.channelName,
      convidadoPor: convite.userName,
      jaSouMembro: client.servers.get(convite.serverId) !== undefined,
    };
  } catch (e) {
    return { erro: motivo(e) };
  }
}

/**
 * Entra no servidor do convite buscado.
 *
 * Devolve o ID para quem chamou navegar — este módulo não navega: `sdk/` traduz
 * protocolo, e para onde a pessoa vai é do store de navegação.
 */
export async function entrarPorConvite(): Promise<string | undefined> {
  if (!pendente) return undefined;
  try {
    const servidor = await pendente.join();
    pendente = undefined;
    return servidor.id;
  } catch (e) {
    toast({ tipo: "erro", titulo: "Não deu para entrar.", descricao: motivo(e) });
    return undefined;
  }
}

/**
 * O código, de um código ou de um link.
 *
 * Aceita `abc123`, `https://stt.gg/abc123` e `https://qualquer/convite/abc123`.
 * O último segmento não vazio é o código em todas as formas que circulam.
 */
export function codigoDe(entrada: string): string | undefined {
  const limpo = entrada.trim();
  if (!limpo) return undefined;

  /*
    Querystring e fragmento são CORTADOS antes, não tratados como segmento.

    A primeira versão partia em `[/?#]` e pegava o último pedaço — então
    `…/convite/abc123?ref=x` devolvia `ref=x`, que não é código nenhum. O
    convite com parâmetro de rastreio é a forma mais comum de link colado, e o
    defeito só apareceu porque o teste tinha esse caso.
  */
  const semCauda = limpo.split(/[?#]/)[0] ?? "";
  const partes = semCauda.split("/").filter(Boolean);
  const ultimo = partes[partes.length - 1];
  if (!ultimo || !/^[A-Za-z0-9_-]{1,64}$/.test(ultimo)) return undefined;
  return ultimo;
}

/* ------------------------------------------------------------ servidores */

export async function criarServidor(nome: string): Promise<string | undefined> {
  try {
    const servidor = await client.servers.createServer({ name: nome });
    return servidor.id;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para criar o servidor.",
      descricao: motivo(e),
    });
    return undefined;
  }
}

/* --------------------------------------------------------------- canais */

export async function criarCanal(
  serverId: string,
  nome: string,
  voz: boolean,
): Promise<string | undefined> {
  try {
    const servidor = client.servers.get(serverId);
    if (!servidor) return undefined;
    const canal = await servidor.createChannel({
      // O protocolo NÃO tem `VoiceChannel`: canal de voz é `Text` com um
      // objeto `voice`. A descoberta está registrada em `map.ts`, e é o mesmo
      // engano que fez o arnês criar um tipo que não existe.
      type: voz ? "Voice" : "Text",
      name: nome,
    });
    publicarCanaisDe(serverId);
    return canal.id;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para criar o canal.",
      descricao: motivo(e),
    });
    return undefined;
  }
}

export async function renomearCanal(
  channelId: string,
  nome: string,
  topico: string | undefined,
): Promise<boolean> {
  try {
    const canal = client.channels.get(channelId);
    if (!canal) return false;
    await canal.edit({
      name: nome,
      // `description` é o nome do protocolo; "tópico" é o do produto.
      ...(topico !== undefined ? { description: topico } : {}),
    });
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para salvar.",
      descricao: motivo(e),
    });
    return false;
  }
}

export async function apagarCanal(channelId: string): Promise<boolean> {
  try {
    const canal = client.channels.get(channelId);
    const serverId = canal?.serverId;
    await canal?.delete();
    if (serverId) publicarCanaisDe(serverId);
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para apagar o canal.",
      descricao: motivo(e),
    });
    return false;
  }
}

/**
 * Cria um convite para um canal.
 *
 * ⚠ **Não existe `Server.createInvite`** — o convite é sempre de um CANAL, e
 * quem entra por ele cai naquele canal. Convite "de servidor" é convite do
 * canal padrão, e a interface é que escolhe qual.
 */
export async function criarConvite(channelId: string): Promise<string | undefined> {
  try {
    const convite = await client.channels.get(channelId)?.createInvite();
    // `_id` e não `id`: a resposta de criação é o objeto CRU do protocolo, não
    // uma entidade hidratada do SDK. O tipo pega isso; a leitura não pegaria.
    return convite?._id;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para criar o convite.",
      descricao: motivo(e),
    });
    return undefined;
  }
}

/* ----------------------------------------------------------- categorias */

/**
 * ⚠ **Categoria NÃO tem CRUD no protocolo.**
 *
 * Não existe `POST /categories` nem `DELETE`. `DataEditServer.categories` é o
 * ARRAY INTEIRO, e mexer numa categoria é ler, modificar e reescrever tudo.
 *
 * A consequência é dita e não resolvida: **duas pessoas mexendo ao mesmo tempo
 * = a última escrita ganha, em silêncio**. O upstream tem o mesmo problema, e
 * consertá-lo exigiria versionamento no backend. Risco aceito, registrado no
 * `CLAUDE.md`.
 */
async function reescreverCategorias(
  serverId: string,
  mudar: (atuais: Categoria[]) => Categoria[],
): Promise<boolean> {
  try {
    const servidor = client.servers.get(serverId);
    if (!servidor) return false;
    // Cópia rasa dos objetos também: mutar o que veio do SDK escreveria no
    // cache antes de o servidor confirmar.
    const atuais = (servidor.categories ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      channels: [...c.channels],
    }));
    await servidor.edit({ categories: mudar(atuais) });
    publicarCanaisDe(serverId);
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para salvar as categorias.",
      descricao: motivo(e),
    });
    return false;
  }
}

type Categoria = { id: string; title: string; channels: string[] };

export function criarCategoria(serverId: string, titulo: string): Promise<boolean> {
  return reescreverCategorias(serverId, (atuais) => [
    ...atuais,
    // ULID como ID: é o que o protocolo usa, e o servidor aceita o que o
    // cliente propuser — a categoria não é entidade própria lá.
    { id: novoId(), title: titulo, channels: [] },
  ]);
}

export function renomearCategoria(
  serverId: string,
  categoriaId: string,
  titulo: string,
): Promise<boolean> {
  return reescreverCategorias(serverId, (atuais) =>
    atuais.map((c) => (c.id === categoriaId ? { ...c, title: titulo } : c)),
  );
}

/**
 * Apaga a categoria — e NÃO os canais dela.
 *
 * Os canais voltam para a cesta sem categoria, que o protocolo trata como
 * "fora de grupo". Apagar canal junto seria destruir histórico por causa de
 * uma decisão de organização, e é o tipo de coisa que ninguém espera.
 */
export function apagarCategoria(
  serverId: string,
  categoriaId: string,
): Promise<boolean> {
  return reescreverCategorias(serverId, (atuais) =>
    atuais.filter((c) => c.id !== categoriaId),
  );
}

/* ---------------------------------------------- convites e banimentos */

/**
 * Puxa a lista COMPLETA de membros do servidor.
 *
 * ⚠ **É o que separa a página de Membros da coluna lateral.** O cliente só
 * conhece quem falou ou quem está online; a página promete "1.204 membros", e
 * cumprir isso é uma chamada de rede. A member list nunca a faz porque nunca
 * promete — ela mostra quem já está no cache.
 *
 * Sem paginação, e é o protocolo que decide: `GET /servers/{id}/members`
 * devolve tudo de uma vez. O design fala em "50 por página com rolagem
 * infinita", que é o Discord; aqui a paginação seria do CLIENTE sobre uma
 * lista já inteira na memória — trabalho sem economia.
 *
 * ⚠ Devolve `void`: quem publica é o efeito do store, que já observa a coleção
 * do SDK. Devolver a lista daria um segundo caminho de dado para a mesma
 * informação, e os dois teriam de concordar.
 */
export async function carregarMembros(serverId: string): Promise<void> {
  try {
    await client.servers.get(serverId)?.fetchMembers();
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para carregar os membros.",
      descricao: motivo(e),
    });
  }
}

/**
 * ⚠ **O que o design mostra e o protocolo NÃO tem, medido no schema:** `uses`,
 * `max_uses`, `expires_at`, `temporary` e `vanity` dão ZERO ocorrências em
 * `stoat-api`. O `Invite` do Stoat carrega quatro campos — `_id`, `server`,
 * `creator`, `channel` — e nada mais.
 *
 * Das cinco colunas do design (código · criador · canal · usos · expira),
 * três não existem. Só CRIADOR entrou; contagem de uso e validade são
 * conceito do Discord, e trazê-los exige fork do serviço `api`.
 */
export type ConviteDoServidor = {
  readonly codigo: string;
  readonly canal: string;
  readonly porId: string;
};

export type Banido = {
  readonly userId: string;
  readonly nome: string;
  readonly razao: string | undefined;
};

/**
 * Os convites do servidor, ou `undefined` se a consulta falhou.
 *
 * ⚠ **Falha NÃO é lista vazia, e a versão anterior devolvia `[]` nas duas.** A
 * página então escrevia "Nenhum convite ativo" — que afirma um fato — enquanto
 * o toast dizia que a consulta não completou. Duas superfícies contando
 * histórias diferentes sobre a mesma tentativa, e a que fica na tela é a
 * errada: alguém criaria um segundo convite acreditando não haver nenhum.
 *
 * `undefined` obriga quem chama a distinguir. É a mesma disciplina de
 * `entrouEm`: ausência de dado tem forma própria e nunca vira um valor
 * plausível.
 */
export async function listarConvites(
  serverId: string,
): Promise<readonly ConviteDoServidor[] | undefined> {
  try {
    const lista = (await client.servers.get(serverId)?.fetchInvites()) ?? [];
    /*
      `fetchInvites` devolve `ChannelInvite`, que é a base abstrata — só a
      variante de servidor carrega `id`, `channelId` e `creatorId`. Filtrar por
      forma e não por `instanceof`: a classe concreta não é exportada, e o que
      importa é ter os campos.
    */
    return lista
      .filter((i): i is typeof i & { id: string; creatorId: string } =>
        typeof (i as { id?: unknown }).id === "string",
      )
      .map((i) => ({
        codigo: i.id,
        canal:
          client.channels.get(
            (i as unknown as { channelId: string }).channelId,
          )?.name ?? "canal",
        porId: i.creatorId,
      }));
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para listar os convites.",
      descricao: motivo(e),
    });
    return undefined;
  }
}

export async function revogarConvite(
  serverId: string,
  codigo: string,
): Promise<boolean> {
  try {
    /*
      `DELETE /invites/{code}` direto: o SDK só expõe `delete()` no objeto
      hidratado, e a listagem não guarda os objetos numa coleção que dê para
      consultar por código depois. A rota é a mesma que o método chamaria.
    */
    void serverId;
    await client.api.delete(`/invites/${codigo}` as never);
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para revogar.",
      descricao: motivo(e),
    });
    return false;
  }
}

/**
 * Quem está banido, ou `undefined` se a consulta falhou.
 *
 * ⚠ **Ausência não é lista vazia**, pela mesma razão de `listarConvites`:
 * "ninguém banido" e "não deu para saber" são fatos diferentes, e numa tela de
 * moderação o segundo virando o primeiro é o pior dos dois erros possíveis.
 *
 * ⚠ **Duas colunas do design NÃO existem no protocolo.** `ServerBan` carrega
 * `_id`, `reason` e o usuário — quem baniu e quando não são campos. O design
 * desenha "Banido por" e "Data"; as duas ficaram de fora em vez de virar
 * coluna com traço. Elas VÃO existir: `/servers/{id}/audit_logs` guarda
 * `BanCreate` com autor e ID ordenável por tempo, então a informação está no
 * servidor — só não neste objeto.
 */
export async function listarBanidos(
  serverId: string,
): Promise<readonly Banido[] | undefined> {
  try {
    const lista = (await client.servers.get(serverId)?.fetchBans()) ?? [];
    return lista.map((b) => ({
      userId: b.id.user,
      /*
        O nome vem do BANIMENTO, não do cache de usuários.

        Quem foi banido normalmente não está mais em lugar nenhum que o cliente
        conheça — pedir à coleção de usuários devolveria um ID cru na tela, que
        é a informação menos útil possível numa lista de banimentos.
      */
      nome: b.user?.username ?? b.id.user,
      razao: b.reason ?? undefined,
    }));
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para listar os banimentos.",
      descricao: motivo(e),
    });
    return undefined;
  }
}

export async function perdoar(
  serverId: string,
  userId: string,
): Promise<boolean> {
  try {
    await client.servers.get(serverId)?.unbanUser(userId);
    return true;
  } catch (e) {
    toast({ tipo: "erro", titulo: "Não deu para perdoar.", descricao: motivo(e) });
    return false;
  }
}

/* --------------------------------------------------- editar o servidor */

export async function salvarServidor(
  serverId: string,
  nome: string,
  descricao: string,
): Promise<boolean> {
  try {
    await client.servers.get(serverId)?.edit({
      name: nome,
      ...(descricao ? { description: descricao } : { remove: ["Description"] }),
    });
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para salvar.",
      descricao: motivo(e),
    });
    return false;
  }
}

/**
 * Sair do servidor — ou apagá-lo, se for seu.
 *
 * ⚠ **A mesma chamada faz as duas coisas**, e é o protocolo que decide pelo
 * dono: `DELETE /servers/{id}` sai para quem é membro e APAGA para quem é
 * dono. A interface precisa dizer qual das duas vai acontecer, senão o dono
 * clica em "sair" e destrói o servidor de todo mundo.
 */
export async function sairDoServidor(
  serverId: string,
  silenciosamente: boolean,
): Promise<boolean> {
  try {
    await client.servers.get(serverId)?.delete(silenciosamente);
    return true;
  } catch (e) {
    toast({ tipo: "erro", titulo: "Não deu para sair.", descricao: motivo(e) });
    return false;
  }
}

/** Sou o dono deste servidor? Muda o que o botão destrutivo significa. */
export function souDono(serverId: string): boolean {
  const s = client.servers.get(serverId);
  return s?.ownerId !== undefined && s.ownerId === client.user?.id;
}

/* ----------------------------------------------------------- moderação */

export async function expulsar(
  serverId: string,
  userId: string,
): Promise<boolean> {
  try {
    await client.servers.get(serverId)?.kickUser(userId);
    return true;
  } catch (e) {
    toast({ tipo: "erro", titulo: "Não deu para expulsar.", descricao: motivo(e) });
    return false;
  }
}

export async function banir(
  serverId: string,
  userId: string,
  razao: string | undefined,
): Promise<boolean> {
  try {
    await client.servers.get(serverId)?.banUser(userId, razao ? { reason: razao } : {});
    return true;
  } catch (e) {
    toast({ tipo: "erro", titulo: "Não deu para banir.", descricao: motivo(e) });
    return false;
  }
}

/**
 * Deixa alguém de castigo por um tempo.
 *
 * Minutos e não uma data: quem modera pensa em "meia hora", não em
 * `2026-08-27T21:14:00Z`. A conversão para o instante fica aqui, que é a
 * fronteira do protocolo.
 */
export async function silenciarMembro(
  serverId: string,
  userId: string,
  minutos: number,
): Promise<boolean> {
  try {
    const membro = client.serverMembers.get(serverId + userId);
    if (!membro) return false;
    if (minutos <= 0) await membro.removeTimeout();
    else {
      await membro.setTimeout(new Date(Date.now() + minutos * 60_000).toISOString());
    }
    return true;
  } catch (e) {
    toast({ tipo: "erro", titulo: "Não deu para aplicar.", descricao: motivo(e) });
    return false;
  }
}
