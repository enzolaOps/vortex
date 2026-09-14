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
import { esperaDoLimite, motivoDoErro } from "./erros";
import { executarEmLote, type ResultadoDeLote } from "../lib/lote";

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
  /**
   * A imagem que acompanha o nome de quem tem o cargo, ou ausência.
   *
   * URL já resolvida contra o `autumn` — o `File` do SDK não sai daqui. Vazio
   * também quando a instância não tem servidor de mídia: aí não há de onde
   * baixar, e uma `<img>` quebrada seria pior que nenhuma.
   */
  readonly iconeUrl: string | undefined;
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
    iconeUrl: c.icon?.createFileURL() || undefined,
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

/* Delega para o tradutor unico — ver `sdk/erros.ts`. O corpo que
   estava aqui lia `e.response.status`, que o `stoat-api` nunca
   produz, entao TODA falha virava "Sem resposta do servidor". */
function motivo(e: unknown): string {
  return motivoDoErro(e);
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
 * O valor novo de uma máscara, mexendo SÓ nos bits que a tela mostra.
 *
 * ⚠ **A lista `PERMISSOES` é curada — e é por isso que gravar `paraBits(ids)`
 * cru apagava permissão.** `ChangeNickname`, `ChangeAvatar`, `Masquerade` e as
 * reservadas não aparecem na matriz; uma máscara montada só do que está
 * marcado na tela zera todas elas no servidor. No `@everyone` isso é grave de
 * verdade: o padrão do Stoat concede `ChangeNickname` e `ChangeAvatar` a todo
 * mundo, e "salvar sem mexer em nada" tiraria de todos os membros o direito de
 * trocar o próprio apelido — sem erro, sem nada na tela que o denunciasse.
 *
 * Os bits fora da lista atravessam intactos; os de dentro passam a ser
 * exatamente os marcados. Vale igual para o editor de cargo, que tinha o mesmo
 * furo desde que nasceu.
 */
export function mesclarPermissoes(atual: bigint, marcadas: readonly string[]): bigint {
  let curados = 0n;
  for (const grupo of PERMISSOES) {
    for (const p of grupo.itens) curados |= TABELA[p.id] ?? 0n;
  }
  return (atual & ~curados) | paraBits(marcadas, TABELA);
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
      iconeUrl: r.icon?.createFileURL() || undefined,
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

/**
 * Reordena a hierarquia inteira.
 *
 * ⚠ **`setRoleOrdering` e NÃO `DataEditRole.rank`, e a distinção estava
 * registrada como armadilha.** O `rank` no editor de cargo não tem efeito —
 * escrevê-lo dá um arrasto que parece funcionar e não salva, que é pior que
 * não ter arrasto. O protocolo reordena pelo ARRAY inteiro (`role_ranks`),
 * porque rank é posição relativa e não um número que cada cargo carrega
 * sozinho.
 *
 * ⚠ **Recebe a lista COMPLETA, do mais alto para o mais baixo.** Mandar só o
 * que mudou seria impossível: mover um cargo muda o rank de todos os que
 * ficaram entre a origem e o destino.
 */
export async function reordenarCargos(
  serverId: string,
  idsDoMaisAlto: readonly string[],
): Promise<boolean> {
  try {
    await client.servers.get(serverId)?.setRoleOrdering([...idsDoMaisAlto]);
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para reordenar os cargos.",
      descricao: motivoDoErro(e),
    });
    return false;
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
    const servidor = client.servers.get(serverId);
    const atual = BigInt(servidor?.roles.get(roleId)?.permissions?.a ?? 0);
    const allow = mesclarPermissoes(atual, ids);
    await servidor?.setPermissions(roleId, {
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

/* ------------------------------------------------- permissões padrão */

/**
 * O que TODO membro pode, antes de qualquer cargo.
 *
 * ⚠ **`@everyone` não é uma entrada de `roles`** — é `default_permissions`,
 * campo do SERVIDOR, e um número só (não o par allow/deny dos cargos). Por
 * isso ele não vem em `listarCargos` e não tem rank: é o piso sobre o qual a
 * hierarquia soma.
 */
export function lerPermissoesPadrao(serverId: string): readonly string[] {
  const servidor = client.servers.get(serverId);
  if (!servidor) return [];
  return concedidasDe(BigInt(servidor.defaultPermissions ?? 0), TABELA);
}

/**
 * Grava `default_permissions`.
 *
 * ⚠ **`PUT /servers/{id}/permissions/default` com `{ permissions: número }`**,
 * e não o `{ allow, deny }` dos cargos — lido da fonte
 * (`delta/src/routes/servers/permissions_set_default.rs`, que desserializa
 * `DataPermissionsValue`). O SDK já monta o corpo certo quando o segundo
 * argumento de `setPermissions("default", …)` é número.
 *
 * `Number` e não a string do `BigInt`: o campo é `u64` em JSON NUMÉRICO, e as
 * permissões vão até o bit 39 — bem dentro dos 53 bits exatos de um `double`.
 *
 * ⚠ O servidor RECUSA conceder o que quem salva não tem
 * (`throw_permission_override`). A frase de `NotElevated`/`MissingPermission`
 * sai do toast.
 */
export async function salvarPermissoesPadrao(
  serverId: string,
  ids: readonly string[],
): Promise<boolean> {
  const servidor = client.servers.get(serverId);
  if (!servidor) return false;
  try {
    const novo = mesclarPermissoes(BigInt(servidor.defaultPermissions ?? 0), ids);
    await servidor.setPermissions("default", Number(novo));
    return true;
  } catch (e) {
    falhou("Não deu para salvar as permissões padrão.", e);
    return false;
  }
}

/* -------------------------------------------------- ícone do cargo */

/**
 * Põe (ou tira) a imagem do cargo.
 *
 * O arquivo já subiu ao `autumn` pela tag `icons` — é a tag que o servidor
 * exige: `File::use_role_icon` busca o anexo em `icons` e recusa qualquer
 * outra (`crates/core/database/src/models/files/model.rs`). O ID vai em
 * `DataEditRole.icon`; tirar é `remove: ["Icon"]`, que também marca o arquivo
 * antigo como apagado lá.
 *
 * ⚠ **Lança em vez de devolver `false`**, ao contrário das vizinhas. A tela de
 * ícone tem estado de erro PRÓPRIO, junto do controle — um toast solto longe
 * da caixa que falhou diria o que houve sem dizer onde.
 */
export async function definirIconeDoCargo(
  serverId: string,
  roleId: string,
  arquivoId: string | undefined,
): Promise<void> {
  const servidor = client.servers.get(serverId);
  if (!servidor) throw new Error("Este servidor não está carregado.");
  try {
    await servidor.editRole(
      roleId,
      (arquivoId === undefined ? { remove: ["Icon"] } : { icon: arquivoId }) as never,
    );
  } catch (e) {
    throw new Error(motivoDoErro(e), { cause: e });
  }
}

/* ------------------------------------------------ membros do cargo */

/**
 * Até onde EU alcanço neste servidor.
 *
 * `topo` é o rank do meu cargo mais alto — menor é mais alto, como no
 * protocolo. Só mexo em cargo com rank MAIOR que ele (`roles_edit.rs` e
 * `member_edit.rs` recusam com `NotElevated` o resto).
 *
 * ⚠ **Dono é `-Infinity`**, porque é o que o servidor faz: `get_member_rank`
 * devolve `i64::MIN` para quem é dono, e todo cargo fica abaixo dele.
 *
 * ⚠ **Sem sessão, também `-Infinity` e tudo permitido** — a mesma exceção
 * estreita de `pode()`, pela mesma razão: sem `Ready` não há tabela de cargos
 * a consultar, e responder "não pode" esconderia a tela de si mesma no arnês,
 * que é onde ela é construída e medida. Com sessão, o default de "não sei" é
 * não pode.
 */
export type Alcance = {
  readonly topo: number;
  /** `AssignRoles` — dar e tirar cargo de alguém. */
  readonly podeAtribuir: boolean;
  /** `ManageRole` — editar o cargo em si, ícone incluído. */
  readonly podeEditarCargos: boolean;
  /** `ManagePermissions` — mexer na matriz, inclusive a do `@everyone`. */
  readonly podeEditarPermissoes: boolean;
};

export function meuAlcance(serverId: string): Alcance {
  if (client.user === undefined) {
    return {
      topo: -Infinity,
      podeAtribuir: true,
      podeEditarCargos: true,
      podeEditarPermissoes: true,
    };
  }
  const servidor = client.servers.get(serverId);
  if (!servidor) {
    return {
      topo: Infinity,
      podeAtribuir: false,
      podeEditarCargos: false,
      podeEditarPermissoes: false,
    };
  }

  const dono = servidor.ownerId === client.user.id;
  const eu = servidor.member;
  const ranks = (eu?.orderedRoles ?? []).map((c) => c.rank ?? Infinity);
  const tem = (p: "AssignRoles" | "ManageRole" | "ManagePermissions") => {
    try {
      return servidor.havePermission(p);
    } catch {
      return false;
    }
  };

  return {
    topo: dono ? -Infinity : Math.min(Infinity, ...ranks),
    podeAtribuir: dono || tem("AssignRoles"),
    podeEditarCargos: dono || tem("ManageRole"),
    podeEditarPermissoes: dono || tem("ManagePermissions"),
  };
}

/**
 * Uma pessoa do servidor, do jeito que a aba "Gerenciar membros" precisa.
 *
 * ⚠ **Lido do SDK na abertura da aba, e não assinado.** Filtrar dez mil
 * pessoas por nome exige ler dez mil nomes; um `useMembro` por pessoa
 * assinaria a member list inteira dentro de uma tela de configuração. É a
 * decisão de "ordenar quando é observável", já tomada pela contagem da coluna
 * de cargos — e a consequência é a mesma: mudança feita por OUTRA pessoa com a
 * aba aberta só aparece ao reabrir. As feitas daqui releem ao terminar.
 */
export type PessoaParaCargo = {
  readonly id: string;
  readonly nome: string;
  readonly username: string;
  readonly cargosIds: readonly string[];
  /**
   * Posso mexer nos cargos DESTA pessoa?
   *
   * `member_edit.rs` recusa editar quem está no mesmo nível ou acima
   * (`NotElevated`), exceto a si mesmo. Saber antes é o que deixa a tela
   * travar a linha em vez de oferecer uma escolha que volta erro.
   */
  readonly editavel: boolean;
};

/**
 * ⚠ **Recebe os IDs em vez de varrer `client.serverMembers`**, e o motivo é o
 * React Compiler: ele memoiza chamada de função pelos ARGUMENTOS, então
 * `pessoasDoServidor(serverId)` saía do cache enquanto o `serverId` fosse o
 * mesmo — e a coluna de cargos seguia dizendo 1 depois de a aba adicionar
 * três pessoas. Com a lista do store (`useMembrosDoServidor`) como argumento,
 * hidratar ou mudar membros troca o argumento e a leitura acontece de novo.
 * De quebra, o custo é o da lista do servidor, não o de todos os servidores.
 */
export function pessoasDoServidor(
  serverId: string,
  userIds: readonly string[],
): readonly PessoaParaCargo[] {
  const semSessao = client.user === undefined;
  const eu = semSessao ? undefined : client.servers.get(serverId)?.member;
  const dono = !semSessao && client.servers.get(serverId)?.ownerId === client.user?.id;

  const out: PessoaParaCargo[] = [];
  for (const userId of userIds) {
    const m = client.serverMembers.getByKey({ server: serverId, user: userId });
    if (!m) continue;
    const usuario = m.user;
    const souEu = !semSessao && m.id.user === client.user?.id;
    out.push({
      id: m.id.user,
      nome: m.nickname || usuario?.displayName || usuario?.username || m.id.user,
      username: usuario?.username ?? "",
      cargosIds: m.roles ?? [],
      editavel:
        semSessao || dono || souEu || (eu !== undefined && m.inferiorTo(eu)),
    });
  }
  return out;
}

/** A frase que ESTE módulo escreveu — a única que passa crua para a tela. */
class FraseProntaDeLote extends Error {}

/**
 * Dá (ou tira) um cargo de várias pessoas.
 *
 * Uma chamada por pessoa, com simultaneidade baixa e 429 honrado — o porquê
 * está em `lib/lote.ts`. Quem já está no estado pedido é pulado sem chamada:
 * dar o cargo a quem já o tem gastaria limite de taxa para escrever a mesma
 * lista.
 *
 * ⚠ **A lista de cargos é relida por pessoa, na hora da escrita.** `edit({
 * roles })` substitui a lista inteira (ver `alternarCargo`); usar uma lista
 * lida quando a aba abriu apagaria qualquer cargo que alguém deu à pessoa no
 * meio do caminho.
 */
export async function aplicarCargoEmLote(
  serverId: string,
  roleId: string,
  userIds: readonly string[],
  dar: boolean,
  aoProgredir?: (terminados: number, total: number) => void,
): Promise<ResultadoDeLote<string>> {
  return executarEmLote(
    userIds,
    async (userId) => {
      const membro = client.serverMembers.getByKey({ server: serverId, user: userId });
      if (!membro) throw new FraseProntaDeLote("Essa pessoa não está mais no servidor.");
      const atuais = membro.roles ?? [];
      const tem = atuais.includes(roleId);
      if (tem === dar) return;
      await membro.edit({
        roles: dar ? [...atuais, roleId] : atuais.filter((r) => r !== roleId),
      });
    },
    {
      concorrencia: 2,
      aoProgredir,
      esperaDe: esperaDoLimite,
      /* Só a frase que ESTE módulo escreveu passa crua. Um `TypeError` de rede
         tem mensagem em inglês ("Failed to fetch") e iria parar na linha. */
      motivoDe: (e) => (e instanceof FraseProntaDeLote ? e.message : motivoDoErro(e)),
    },
  );
}

/* -------------------------------------------------------------- emojis */

export type Emoji = {
  readonly id: string;
  readonly nome: string;
  readonly url: string;
  /**
   * Quem subiu — o nome, já resolvido.
   *
   * ⚠ **Existe no protocolo (`Emoji.creator`) e nunca tinha sido lido.** A
   * referência tem a coluna "enviado por", e sem este campo ela seria a única
   * das três tabelas de servidor a não dizer de quem é a linha. Numa lista
   * onde a ação disponível é APAGAR, saber quem pôs é metade da decisão.
   */
  readonly porNome: string | undefined;
  /**
   * Animado.
   *
   * O protocolo separa os dois no LIMITE (são cotas diferentes), e é por isso
   * que a contagem do topo da página diz "N estáticos · M animados" em vez de
   * um número só.
   */
  readonly animado: boolean;
};

export async function listarEmojis(serverId: string): Promise<readonly Emoji[]> {
  try {
    const lista = (await client.servers.get(serverId)?.fetchEmojis()) ?? [];
    return lista.map((e) => ({
      id: e.id,
      nome: e.name,
      url: e.url,
      porNome: e.creator?.username,
      animado: e.animated,
    }));
  } catch (e) {
    falhou("Não deu para listar os emojis.", e);
    return [];
  }
}

/**
 * Cria um emoji de servidor a partir de um arquivo já subido ao `autumn`.
 *
 * ⚠ **O ID do emoji É o ID do arquivo — não há dois.** A rota é
 * `PUT /custom/emoji/{id}` onde `{id}` é o que o servidor de mídia devolveu.
 * Lido da fonte (`crates/delta/src/routes/customisation/emoji_create.rs`), e
 * é o que explica por que o protocolo não tem "editar emoji": renomear seria
 * apagar e subir de novo, com ID novo, quebrando toda mensagem que usava o
 * antigo.
 *
 * ⚠ **O nome é validado por regex no servidor** (`RE_EMOJI`, 1–32). Um nome
 * com espaço ou acento volta `FailedValidation`, e a frase que a pessoa lê sai
 * de `motivo` — não vale duplicar a regex aqui para adivinhar antes: ela é do
 * servidor e muda com ele.
 *
 * `parent: { type: "Server", id }` é o que prende o emoji ao servidor; a outra
 * variante do protocolo (`Detached`) é para emoji sem dono, que este app não
 * cria.
 */
export async function criarEmoji(
  serverId: string,
  arquivoId: string,
  nome: string,
): Promise<boolean> {
  try {
    await client.api.put(`/custom/emoji/${arquivoId as ""}`, {
      name: nome,
      parent: { type: "Server", id: serverId },
    });
    return true;
  } catch (e) {
    falhou("Não deu para criar o emoji.", e);
    return false;
  }
}

/**
 * O nome de um emoji personalizado, quando o SDK já o conhece.
 *
 * ⚠ **Sem buscar, e a ausência é deliberada.** O upstream dispara um
 * `emojis.fetch(id)` quando não conhece — numa lista virtualizada isso é uma
 * requisição por emoji desconhecido visível, disparada durante a rolagem, no
 * componente mais quente do app. Quem já entrou no servidor tem os emojis
 * dele pelo `Ready`; o caso restante é emoji de servidor onde você não está,
 * e ali a linha mostra o código escrito, que é a verdade sobre o que a pessoa
 * digitou.
 */
export function nomeDeEmoji(emojiId: string): string | undefined {
  return client.emojis.get(emojiId)?.name;
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
