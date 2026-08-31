/**
 * Cargos e permissões.
 *
 * A superfície mais densa do plano de paridade, e a que mais precisa da camada
 * anticorrupção: o protocolo fala em BITS de um inteiro de 64, e o produto fala
 * em "pode apagar mensagem". Nenhum `BigInt` sai daqui.
 */
import { Permission } from "stoat.js";

import { client } from "./client";
import { toast } from "../components/ui/toastStore";

/**
 * As permissões que a interface mostra, agrupadas como quem administra pensa.
 *
 * ⚠ **Não é a lista inteira do protocolo, e a diferença é decisão.** Ficaram
 * de fora `GrantAllSafe` (não é permissão, é um atalho perigoso de um clique),
 * `Masquerade` (é para bot) e as reservadas. Uma lista que espelha o protocolo
 * campo a campo transforma a tela num despejo de bits; esta responde perguntas
 * que alguém de fato faz.
 *
 * O nome do protocolo fica no `id`, e é o único lugar deste arquivo onde ele
 * aparece. A tela usa `rotulo` e `detalhe`.
 */
export type Permissao = {
  readonly id: string;
  readonly rotulo: string;
  readonly detalhe: string;
};

export type GrupoDePermissoes = {
  readonly titulo: string;
  readonly itens: readonly Permissao[];
};

export const PERMISSOES: readonly GrupoDePermissoes[] = [
  {
    titulo: "Servidor",
    itens: [
      {
        id: "ManageServer",
        rotulo: "Gerenciar o servidor",
        detalhe: "Mudar nome, descrição e ícone.",
      },
      {
        id: "ManageChannel",
        rotulo: "Gerenciar canais",
        detalhe: "Criar, renomear e apagar canais e categorias.",
      },
      {
        id: "ManageRole",
        rotulo: "Gerenciar cargos",
        detalhe: "Criar, editar e apagar cargos abaixo do seu.",
      },
      {
        id: "ManagePermissions",
        rotulo: "Gerenciar permissões",
        detalhe: "Mudar o que cada cargo pode fazer.",
      },
      {
        id: "ManageCustomisation",
        rotulo: "Gerenciar emojis",
        detalhe: "Adicionar e remover emojis do servidor.",
      },
    ],
  },
  {
    titulo: "Pessoas",
    itens: [
      {
        id: "KickMembers",
        rotulo: "Expulsar",
        detalhe: "Quem for expulso volta pelo próximo convite.",
      },
      {
        id: "BanMembers",
        rotulo: "Banir",
        detalhe: "Quem for banido não volta, nem por convite.",
      },
      {
        id: "TimeoutMembers",
        rotulo: "Deixar de castigo",
        detalhe: "Impedir alguém de falar por um tempo.",
      },
      {
        id: "AssignRoles",
        rotulo: "Dar cargos",
        detalhe: "Só cargos abaixo do seu.",
      },
      {
        id: "ManageNicknames",
        rotulo: "Mudar apelidos",
        detalhe: "Trocar o apelido de outras pessoas no servidor.",
      },
    ],
  },
  {
    titulo: "Canais de texto",
    itens: [
      { id: "ViewChannel", rotulo: "Ver o canal", detalhe: "Sem isto, o canal some da coluna." },
      {
        id: "ReadMessageHistory",
        rotulo: "Ler o histórico",
        detalhe: "Ver o que foi dito antes de entrar.",
      },
      { id: "SendMessage", rotulo: "Enviar mensagem", detalhe: "Escrever no canal." },
      {
        id: "ManageMessages",
        rotulo: "Gerenciar mensagens",
        detalhe: "Apagar mensagem dos outros e fixar.",
      },
      { id: "React", rotulo: "Reagir", detalhe: "Usar emoji nas mensagens." },
      { id: "UploadFiles", rotulo: "Anexar arquivo", detalhe: "Mandar imagem e arquivo." },
      { id: "SendEmbeds", rotulo: "Enviar links com prévia", detalhe: "Deixar o link virar cartão." },
      { id: "InviteOthers", rotulo: "Criar convite", detalhe: "Gerar link de entrada." },
      {
        id: "MentionEveryone",
        rotulo: "Mencionar todo mundo",
        detalhe: "Avisar o canal inteiro de uma vez.",
      },
      { id: "MentionRoles", rotulo: "Mencionar cargos", detalhe: "Avisar um cargo inteiro." },
      {
        id: "BypassSlowmode",
        rotulo: "Ignorar o modo lento",
        detalhe: "Falar sem esperar o intervalo.",
      },
    ],
  },
  {
    titulo: "Voz",
    itens: [
      { id: "Connect", rotulo: "Entrar na sala", detalhe: "Conectar a um canal de voz." },
      { id: "Speak", rotulo: "Falar", detalhe: "Usar o microfone." },
      { id: "Listen", rotulo: "Ouvir", detalhe: "Escutar quem está falando." },
      { id: "Video", rotulo: "Câmera e tela", detalhe: "Compartilhar vídeo." },
      { id: "MuteMembers", rotulo: "Silenciar na voz", detalhe: "Cortar o microfone de outros." },
      {
        id: "DeafenMembers",
        rotulo: "Ensurdecer na voz",
        detalhe: "Cortar o áudio de outros.",
      },
      { id: "MoveMembers", rotulo: "Mover entre salas", detalhe: "Puxar alguém para outra sala." },
    ],
  },
];

export type Cargo = {
  readonly id: string;
  readonly nome: string;
  readonly cor: string | undefined;
  /** Aparece em seção própria na member list. */
  readonly destacado: boolean;
  /** Quanto MENOR, mais alto — é a ordem do protocolo. */
  readonly rank: number;
  /** As permissões concedidas, por nome do protocolo. */
  readonly concedidas: readonly string[];
};

/**
 * Os cargos do servidor, PRONTOS para desenhar — do mais alto ao mais baixo.
 *
 * ⚠ **Leitura síncrona do cache, e é o que separa esta função de
 * `listarCargos`.** Aquela é `async` porque a página de configurações pode
 * abrir antes do `Ready` e precisa esperar; esta é chamada por um menu de
 * contexto que já está em cima de uma member list carregada. Uma promessa ali
 * daria um submenu que abre vazio e preenche um quadro depois.
 *
 * `orderedRoles` do SDK já vem do mais alto para o mais baixo aqui (ao
 * contrário do de MEMBRO, que vem invertido) — a assimetria é do protocolo, e
 * está normalizada nos dois lugares.
 */
export function cargosDoServidor(serverId: string): readonly Cargo[] {
  const servidor = client.servers.get(serverId);
  if (!servidor) return [];
  return servidor.orderedRoles.map((c) => ({
    id: c.id,
    nome: c.name,
    cor: c.colour ?? undefined,
    destacado: c.hoist ?? false,
    rank: c.rank ?? 0,
    /* Vazio de propósito: o submenu de cargos não desenha permissão, e
       traduzir o bitmask de cada cargo a cada abertura de menu seria trabalho
       por nada. Quem precisa delas é a página de configurações. */
    concedidas: [],
  }));
}

/**
 * Dar ou tirar um cargo de alguém.
 *
 * ⚠ `ServerMember.edit({ roles })` substitui a LISTA inteira — o protocolo não
 * tem "adicionar" nem "remover". Ler, mexer e reescrever é o único caminho, e
 * é onde mora a corrida: duas pessoas mexendo nos cargos do mesmo membro ao
 * mesmo tempo, a última escrita ganha e a primeira some sem aviso. O upstream
 * tem exatamente o mesmo problema; registrar é o que dá para fazer hoje.
 */
export async function alternarCargo(
  serverId: string,
  userId: string,
  roleId: string,
): Promise<boolean> {
  const membro = client.serverMembers.getByKey({
    server: serverId,
    user: userId,
  });
  if (!membro) return false;

  const atuais = membro.roles;
  const roles = atuais.includes(roleId)
    ? atuais.filter((r) => r !== roleId)
    : [...atuais, roleId];

  try {
    await membro.edit({ roles });
    return true;
  } catch (e) {
    falhou("Não deu para mudar os cargos.", e);
    return false;
  }
}

/**
 * O apelido desta pessoa NESTE servidor.
 *
 * ⚠ Vazio APAGA em vez de guardar string vazia: o protocolo distingue "sem
 * apelido" de "apelido em branco", e a segunda daria uma linha sem nome
 * nenhum na member list. `remove` é o campo que o `DataMemberEdit` usa para
 * isso.
 */
export async function definirApelido(
  serverId: string,
  userId: string,
  apelido: string,
): Promise<boolean> {
  const membro = client.serverMembers.getByKey({
    server: serverId,
    user: userId,
  });
  if (!membro) return false;

  const limpo = apelido.trim();
  try {
    await membro.edit(
      limpo.length === 0 ? { remove: ["Nickname"] } : { nickname: limpo },
    );
    return true;
  } catch (e) {
    falhou("Não deu para mudar o apelido.", e);
    return false;
  }
}

/**
 * Puxar alguém para outro canal de voz.
 *
 * ⚠ Só funciona com a pessoa JÁ numa sala — `voice_channel` move, não convoca.
 * O protocolo devolve 400 para quem não está em voz nenhuma, e é por isso que
 * o submenu só aparece quando ela está.
 */
export async function moverParaCanalDeVoz(
  serverId: string,
  userId: string,
  channelId: string,
): Promise<boolean> {
  const membro = client.serverMembers.getByKey({
    server: serverId,
    user: userId,
  });
  if (!membro) return false;

  try {
    await membro.edit({ voice_channel: channelId });
    return true;
  } catch (e) {
    falhou("Não deu para mover.", e);
    return false;
  }
}

function motivo(e: unknown): string {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status === 403) return "Você não pode mexer neste cargo.";
  if (status === 404) return "Este cargo não existe mais.";
  if (status !== undefined && status >= 500) return "O servidor não respondeu.";
  if (status !== undefined) return "O servidor recusou.";
  return "Sem resposta do servidor.";
}

function falhou(oQue: string, e: unknown): void {
  toast({ tipo: "erro", titulo: oQue, descricao: motivo(e) });
}

/**
 * Quais permissões um valor de bits concede.
 *
 * ⚠ **`BigInt` e não `number`.** As permissões de voz e menção moram nos bits
 * 30 a 39, e `2**31` já estoura o inteiro de 32 bits que os operadores
 * bitwise do JavaScript usam — `Speak` (bit 31) viraria negativo e
 * `MentionRoles` (bit 38) sumiria. É o tipo de erro que só aparece nas
 * permissões do fim da lista, e passa despercebido nas primeiras.
 */
/**
 * O bit de uma permissão, pelo id do protocolo.
 *
 * Exportado porque as permissões POR CANAL precisam do bit cru: lá o estado
 * não é "concedida ou não", é um par allow/deny em que a ausência nos dois
 * significa herdar. `concedidasDe` colapsa isso num booleano e serve ao editor
 * de cargos; a matriz de canal precisa do bit para montar o tri-state.
 */
export function bitDaPermissao(id: string): bigint {
  return TABELA[id] ?? 0n;
}

function concedidasDe(valor: bigint, tabela: Record<string, bigint>): string[] {
  const out: string[] = [];
  for (const grupo of PERMISSOES) {
    for (const p of grupo.itens) {
      const bit = tabela[p.id];
      if (bit !== undefined && (valor & bit) === bit) out.push(p.id);
    }
  }
  return out;
}

function paraBits(ids: readonly string[], tabela: Record<string, bigint>): bigint {
  let v = 0n;
  for (const id of ids) {
    const bit = tabela[id];
    if (bit !== undefined) v |= bit;
  }
  return v;
}

/**
 * A tabela de bits do protocolo.
 *
 * ⚠ Era um `await import("stoat.js")`, e o build reclamou com razão:
 * `INEFFECTIVE_DYNAMIC_IMPORT` — o SDK já está no chunk principal por
 * `adapter.ts` e `client.ts`, então o import dinâmico não movia nada e só
 * tornava toda função desta seção assíncrona sem motivo. Import estático, como
 * o resto de `src/sdk/`.
 */
const TABELA = Permission as unknown as Record<string, bigint>;

/**
 * Síncrona desde que a tabela virou import estático.
 *
 * Devolve `Promise` mesmo assim, e é escolha: `fetchBans` e `fetchInvites` ao
 * lado são chamadas de rede de verdade, e uma função que às vezes é `await` e
 * às vezes não obriga quem chama a lembrar de qual é qual. Uniformidade aqui
 * custa uma microtask por abertura da tela de cargos.
 */
export function listarCargos(serverId: string): Promise<readonly Cargo[]> {
  try {
    const servidor = client.servers.get(serverId);
    if (!servidor) return Promise.resolve([]);
    const lista = servidor.orderedRoles.map((r) => ({
      id: r.id,
      nome: r.name,
      cor: r.colour ?? undefined,
      destacado: r.hoist === true,
      rank: r.rank ?? 0,
      concedidas: concedidasDe(BigInt(r.permissions?.a ?? 0), TABELA),
    }));
    return Promise.resolve(lista);
  } catch (e) {
    falhou("Não deu para listar os cargos.", e);
    return Promise.resolve([]);
  }
}

export async function criarCargo(
  serverId: string,
  nome: string,
): Promise<string | undefined> {
  try {
    const r = await client.servers.get(serverId)?.createRole(nome);
    return r?.id;
  } catch (e) {
    falhou("Não deu para criar o cargo.", e);
    return undefined;
  }
}

export async function salvarCargo(
  serverId: string,
  roleId: string,
  nome: string,
  cor: string | undefined,
  destacado: boolean,
): Promise<boolean> {
  try {
    await client.servers.get(serverId)?.editRole(roleId, {
      name: nome,
      hoist: destacado,
      ...(cor ? { colour: cor } : { remove: ["Colour"] }),
    } as never);
    return true;
  } catch (e) {
    falhou("Não deu para salvar o cargo.", e);
    return false;
  }
}

/**
 * Grava as permissões do cargo.
 *
 * `allow` é o que este cargo concede; `deny` é sempre `0` no nível do SERVIDOR
 * — negar só faz sentido como sobreposição de canal, e o protocolo trata o
 * servidor como a base sobre a qual os canais negam. Mandar `deny` aqui daria
 * um estado que a interface de canal não sabe representar.
 */
export async function salvarPermissoes(
  serverId: string,
  roleId: string,
  ids: readonly string[],
): Promise<boolean> {
  try {
    const allow = paraBits(ids, TABELA);
    await client.servers.get(serverId)?.setPermissions(roleId, {
      allow: allow.toString(),
      deny: "0",
    } as never);
    return true;
  } catch (e) {
    falhou("Não deu para salvar as permissões.", e);
    return false;
  }
}

export async function apagarCargo(
  serverId: string,
  roleId: string,
): Promise<boolean> {
  try {
    await client.servers.get(serverId)?.deleteRole(roleId);
    return true;
  } catch (e) {
    falhou("Não deu para apagar o cargo.", e);
    return false;
  }
}

/* -------------------------------------------------------------- emojis */

export type Emoji = {
  readonly id: string;
  readonly nome: string;
  readonly url: string;
};

export async function listarEmojis(serverId: string): Promise<readonly Emoji[]> {
  try {
    const lista = (await client.servers.get(serverId)?.fetchEmojis()) ?? [];
    return lista.map((e) => ({ id: e.id, nome: e.name, url: e.url }));
  } catch (e) {
    falhou("Não deu para listar os emojis.", e);
    return [];
  }
}

export async function apagarEmoji(emojiId: string): Promise<boolean> {
  try {
    await client.emojis.get(emojiId)?.delete();
    return true;
  } catch (e) {
    falhou("Não deu para apagar o emoji.", e);
    return false;
  }
}
