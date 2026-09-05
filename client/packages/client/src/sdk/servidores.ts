/**
 * Servidores: criar, entrar por convite, administrar.
 *
 * Mora em `src/sdk/` pela regra de sempre — `ServerPublicInvite`, `Server` e a
 * grafia do protocolo ficam dentro; o que sai são IDs e tipos do domínio.
 */
import { PublicChannelInvite, ServerPublicInvite, type Server } from "stoat.js";

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
  /**
   * Ícone, banner, assunto do canal e avatar de quem convidou.
   *
   * ⚠ **Os quatro chegam pelo fio desde sempre e nunca foram desenhados.**
   * `InviteResponse` carrega `server_icon`, `server_banner`,
   * `channel_description` e `user_avatar`, e o `ServerPublicInvite` do SDK os
   * expõe os quatro. A landing mostrava só a sigla — é a mesma família do
   * `ehMencao` que passou três fases sem devolver `true`.
   *
   * `undefined` é o caso comum e continua sendo o certo: sem ícone o ladrilho
   * cai no gradiente por ID, que identifica melhor que um cinza.
   */
  readonly iconeUrl: string | undefined;
  readonly bannerUrl: string | undefined;
  readonly assuntoDoCanal: string | undefined;
  readonly avatarDeQuemConvidou: string | undefined;
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
      /* `createFileURL()` e não a URL crua: quem monta o endereço do autumn é
         o SDK, com a configuração que ele buscou do servidor. Montar aqui
         seria a forma do protocolo vazando para a tela. */
      iconeUrl: convite.serverIcon?.createFileURL(),
      bannerUrl: convite.serverBanner?.createFileURL(),
      assuntoDoCanal: convite.channelDescription || undefined,
      avatarDeQuemConvidou: convite.userAvatar?.createFileURL(),
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

/**
 * Cria o servidor e os canais que ele nasce com.
 *
 * ⚠ **`DataCreateServer` aceita `name`, `description` e `nsfw` — e nada mais.**
 * Canal não entra na criação; cada um é uma chamada própria. É por isso que o
 * modelo é uma LISTA que este cliente percorre, e não um objeto que o servidor
 * saiba interpretar.
 *
 * ⚠ **Canal que falha não derruba a criação.** O servidor já existe quando o
 * primeiro canal é pedido; abortar ali deixaria um servidor órfão e a pessoa
 * sem nada. Cada falha vira um toast e o resto continua — melhor um servidor
 * com quatro dos cinco canais que nenhum servidor.
 *
 * ⚠ **Em série, não em paralelo.** O protocolo devolve os canais na ordem em
 * que foram criados, e é essa ordem que a coluna mostra. Com `Promise.all` a
 * lista sairia embaralhada de um jeito diferente a cada criação.
 */
export async function criarServidor(
  nome: string,
  categoria: string,
  canais: readonly { readonly nome: string; readonly voz: boolean }[] = [],
): Promise<string | undefined> {
  let id: string;
  /* O objeto que o `createServer` devolveu. Ver `servidorPara`. */
  let criado: Server;
  try {
    const servidor = await client.servers.createServer({ name: nome });
    id = servidor.id;
    criado = servidor;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para criar o servidor.",
      descricao: motivo(e),
    });
    return undefined;
  }

  if (canais.length === 0) return id;

  /*
    ⚠ **A categoria vem ANTES dos canais, e sem ela não há onde pô-los.** Um
    servidor recém-criado não tem categoria nenhuma, e canal não nasce fora de
    grupo — decisão de produto. Se a criação da categoria falhar, os canais do
    modelo não são criados: melhor um servidor com o canal padrão do backend
    que cinco canais soltos numa coluna que o produto não desenha.
  */
  /*
    ⚠ **O objeto do `createServer` é passado adiante, e não o id sozinho.** Ver
    `servidorPara`: a coleção do SDK ainda não conhece este servidor, então um
    lookup por id aqui devolve `undefined` e o modelo inteiro é descartado sem
    uma palavra.
  */
  const categoriaId = await criarCategoriaEDevolverId(id, categoria, criado);
  if (categoriaId === undefined) {
    toast({
      tipo: "erro",
      titulo: "O servidor foi criado, mas sem os canais do modelo.",
      descricao: "Não deu para criar a categoria. Crie os canais à mão.",
    });
    return id;
  }

  /*
    O servidor nasce com um canal padrão do próprio backend. Os do modelo vêm
    DEPOIS dele, e é o comportamento certo: apagar o padrão para impor a lista
    seria destruir um canal que a pessoa não pediu para destruir.
  */
  for (const c of canais) {
    await criarCanal(id, c.nome, c.voz, categoriaId, criado);
  }

  return id;
}

/* --------------------------------------------------------------- canais */

/**
 * Cria um canal DENTRO de uma categoria.
 *
 * ⚠ **`categoriaId` é obrigatório, e antes ele nem existia aqui.** O alvo do
 * modal carregava um `categoriaId` desde sempre e esta função nunca o
 * recebeu — então TODO canal nascia fora de categoria, inclusive o criado por
 * "Novo canal aqui" no menu de uma categoria. O menu prometia um lugar e o
 * canal aparecia noutro, sem erro nenhum.
 *
 * Obrigatório no TIPO e não conferido no corpo: é a ordem de preferência do
 * projeto — tornar impossível ganha de validar. Nenhum chamador pode
 * esquecer.
 *
 * ⚠ **São DUAS escritas, e a segunda pode falhar sozinha.** O protocolo não
 * aceita categoria na criação do canal: `createChannel` cria, e pôr numa
 * categoria é reescrever o array inteiro de `categories` (ver
 * `reescreverCategorias`). Se a segunda falhar, o canal existe e fica fora de
 * grupo — melhor que abortar, porque o canal já foi criado e não há como
 * desfazer sem apagar o que a pessoa acabou de pedir.
 */
export async function criarCanal(
  serverId: string,
  nome: string,
  voz: boolean,
  categoriaId: string,
  /** O servidor já em mãos — ver `servidorPara`. */
  dado?: Server,
): Promise<string | undefined> {
  let id: string;
  try {
    const servidor = servidorPara(serverId, dado);
    if (!servidor) return undefined;
    const canal = await servidor.createChannel({
      // O protocolo NÃO tem `VoiceChannel`: canal de voz é `Text` com um
      // objeto `voice`. A descoberta está registrada em `map.ts`, e é o mesmo
      // engano que fez o arnês criar um tipo que não existe.
      type: voz ? "Voice" : "Text",
      name: nome,
    });
    id = canal.id;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para criar o canal.",
      descricao: motivo(e),
    });
    return undefined;
  }

  await reescreverCategorias(
    serverId,
    (atuais) =>
      atuais.map((c) =>
        c.id === categoriaId ? { ...c, channels: [...c.channels, id] } : c,
      ),
    dado,
  );

  publicarCanaisDe(serverId);
  return id;
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
/**
 * O servidor, preferindo o que o chamador JÁ TEM na mão.
 *
 * ⚠ **A coleção do SDK não conhece um servidor recém-criado, e isso quebrava
 * o caminho mais visível do produto em silêncio.** `createServer` devolve o
 * objeto, mas quem popula `client.servers` é o `ServerCreate` que chega pelo
 * SOCKET — no tique seguinte à criação, `client.servers.get(id)` responde
 * `undefined`.
 *
 * Consequência medida na leitura do código: criar servidor a partir de um
 * modelo fazia `criarCategoriaEDevolverId` cair no `if (!servidor) return`,
 * devolver `undefined`, e o laço de canais nem começar. O servidor nascia com
 * o canal padrão do backend e NENHUM canal do modelo, sem erro, sem toast, sem
 * nada no console — a pessoa escolhe "Jogos" com cinco canais na prévia e
 * recebe um servidor vazio.
 *
 * Achado por uma sessão vizinha construindo o upload de ícone, que precisou de
 * duas chamadas pelo mesmo motivo. O conserto é passar o objeto adiante em vez
 * de perguntar de novo por ele.
 */
function servidorPara(serverId: string, dado?: Server): Server | undefined {
  return dado ?? client.servers.get(serverId);
}

async function reescreverCategorias(
  serverId: string,
  mudar: (atuais: Categoria[]) => Categoria[],
  dado?: Server,
): Promise<boolean> {
  try {
    const servidor = servidorPara(serverId, dado);
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

/**
 * Cria a categoria e devolve o ID dela.
 *
 * Existe porque criar um servidor precisa do ID para pôr os canais dentro, e
 * `criarCategoria` devolve só sucesso. O ID é gerado AQUI e não pelo servidor:
 * categoria não é entidade própria no protocolo — é um item de um array que o
 * cliente propõe.
 */
export async function criarCategoriaEDevolverId(
  serverId: string,
  titulo: string,
  dado?: Server,
): Promise<string | undefined> {
  const id = novoId();
  const ok = await reescreverCategorias(
    serverId,
    (atuais) => [...atuais, { id, title: titulo, channels: [] }],
    dado,
  );
  return ok ? id : undefined;
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

/**
 * Passa o servidor para outra pessoa.
 *
 * ⚠ **Existe no protocolo, e eu quase a registrei como pendência.**
 * `DataEditServer` tem `owner?: string | null` — o campo está no schema do
 * `stoat-api@0.14.0`, e a rota é o mesmo `PATCH /servers/{id}` que salva nome
 * e descrição.
 *
 * ⚠ **Não tem volta pelo mesmo caminho.** Depois disto quem chamou deixa de
 * ser dono, e só o novo dono pode devolver — é por isso que a confirmação
 * pede o nome do servidor digitado, que é o único lugar deste app onde isso
 * é exigido. Apagar um canal não pede porque canal se recria; propriedade
 * não se retoma.
 */
export async function transferirPropriedade(
  serverId: string,
  novoDonoId: string,
): Promise<boolean> {
  try {
    await client.servers.get(serverId)?.edit({ owner: novoDonoId });
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para transferir.",
      descricao: motivo(e),
    });
    return false;
  }
}

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

/**
 * Move canais para uma categoria.
 *
 * ⚠ **Tira de onde estiverem ANTES de pôr**, pela mesma razão de
 * `moverParaPasta` no rail: sem isso um canal movido entre categorias
 * apareceria nas duas, e a coluna o desenharia duas vezes.
 *
 * Uma escrita só para o lote inteiro. `reescreverCategorias` reescreve o array
 * completo de qualquer jeito — mover cinco canais numa chamada por canal
 * seriam cinco reescritas do MESMO array, e a última ganharia sobre as
 * anteriores.
 */
export function moverCanaisParaCategoria(
  serverId: string,
  categoriaId: string,
  canais: readonly string[],
): Promise<boolean> {
  const mover = new Set(canais);
  return reescreverCategorias(serverId, (atuais) =>
    atuais.map((c) =>
      c.id === categoriaId
        ? {
            ...c,
            channels: [...c.channels.filter((x) => !mover.has(x)), ...mover],
          }
        : { ...c, channels: c.channels.filter((x) => !mover.has(x)) },
    ),
  );
}

/* ------------------------------------------------------- ícone do servidor */

/**
 * Prende ao servidor um ícone já subido ao `autumn`.
 *
 * ⚠ **Duas chamadas e não uma, e é o protocolo que manda.**
 * `POST /servers/create` aceita `name`, `description` e `nsfw` — não aceita
 * ícone. Quem o recebe é `DataEditServer.icon`, que leva o ID devolvido pelo
 * servidor de mídia. Então o caminho é criar, depois vestir.
 *
 * ⚠ **A falha aqui NÃO desfaz a criação, de propósito.** O servidor já existe
 * e já tem nome, canais e você dentro; apagá-lo porque uma imagem não colou
 * seria perder o trabalho todo por causa do enfeite. Quem chama segue em
 * frente e avisa — o ícone se põe depois em Configurações.
 *
 * Devolve se colou, para quem chama decidir o que dizer.
 */
export async function vestirIconeNoServidor(
  serverId: string,
  iconeId: string,
): Promise<boolean> {
  /*
    ⚠ **Uma tentativa não basta, e o motivo é o próprio fluxo de criação.**
    Criar um servidor a partir de um modelo já gasta a cota: são uma criação,
    dois canais e uma edição de categoria em sequência. O PATCH do ícone cai no
    mesmo balde e volta `429`.

    Medido com a sonda, num fluxo normal de interface:
    `edit falhou: {"retry_after":9965}`. Não é artefato de teste — acontece com
    quem escolhe um modelo, que é o caminho que o modal oferece primeiro.

    O servidor diz EXATAMENTE quanto esperar, então esperar é a resposta certa;
    inventar um intervalo seria chutar contra um número que veio de graça.
  */
  for (let tentativa = 0; ; tentativa += 1) {
    const erro = await tentarVestir(serverId, iconeId);
    if (erro === undefined) return true;

    const esperar = msDeEspera(erro);
    if (tentativa >= 1 || esperar === undefined) return false;
    await new Promise((r) => setTimeout(r, esperar));
  }
}

/** `undefined` = colou. Qualquer outra coisa é o erro cru, para o chamador ler. */
async function tentarVestir(
  serverId: string,
  iconeId: string,
): Promise<unknown> {
  /*
    ⚠ **A coleção do SDK NÃO tem o servidor logo depois de criá-lo.**
    `createServer` devolve o objeto, mas `client.servers.get(id)` no tique
    seguinte ainda responde `undefined` — quem popula a coleção é o evento
    `ServerCreate`, que vem pelo socket e chega depois. Por isso há o caminho
    cru: ele não depende de hidratação.

    O objeto é tentado primeiro quando existe, porque aí o SDK atualiza o
    estado local na hora, sem esperar o evento dar a volta.
  */
  const servidor = client.servers.get(serverId);
  try {
    if (servidor !== undefined) await servidor.edit({ icon: iconeId });
    else await client.api.patch(`/servers/${serverId as ""}`, { icon: iconeId });
    return undefined;
  } catch (e) {
    return e;
  }
}

/**
 * O `retry_after` do corpo, em milissegundos, quando é isso que aconteceu.
 *
 * ⚠ O `stoat-api` LANÇA o corpo cru, e ele chega ora como objeto ora como o
 * texto que veio no fio — as duas formas foram vistas. Ler só uma deixaria
 * metade dos `429` passando por falha definitiva.
 *
 * O teto existe porque um `retry_after` grande é um servidor dizendo "não
 * insista": segurar a interface por um minuto para pôr um ícone é pior que
 * avisar e deixar a pessoa terminar em Configurações.
 */
const TETO_DE_ESPERA_MS = 15_000;

function msDeEspera(erro: unknown): number | undefined {
  let corpo: unknown = erro;
  if (typeof corpo === "string") {
    try {
      corpo = JSON.parse(corpo);
    } catch {
      return undefined;
    }
  }
  const ms = (corpo as { retry_after?: unknown } | null)?.retry_after;
  if (typeof ms !== "number" || ms <= 0 || ms > TETO_DE_ESPERA_MS) {
    return undefined;
  }
  /* Uma folga: o relógio do servidor e o daqui não são o mesmo. */
  return ms + 250;
}
