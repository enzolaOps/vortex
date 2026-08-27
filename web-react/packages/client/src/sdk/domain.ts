/**
 * Tipos de domínio do Vortex.
 *
 * Declarados pelo app, NUNCA derivados dos tipos do `stoat.js`. Derivar faria a
 * forma do protocolo vazar para todo componente que lê um snapshot, e aí a
 * primeira feature que o Stoat não tem viraria refactor do app inteiro.
 *
 * Este arquivo não importa `stoat.js`. Se algum dia importar, a desvinculação
 * acabou — o lint de boundary existe para impedir isso.
 */

/** Estado de envio. Vive no cliente; o protocolo não tem esse conceito. */
export type SendState = "sent" | "pending" | "failed";

/**
 * Teto de caracteres de uma mensagem.
 *
 * Declarado pelo Vortex, não lido do SDK — mesmo que hoje coincida com o do
 * Stoat. É limite de produto: o dia em que o backend divergir, quem manda é
 * esta linha, e o composer não precisa saber que houve divergência.
 */
export const LIMITE_DE_CONTEUDO = 2000;

export type MessageSnapshot = {
  readonly id: string;
  readonly channelId: string;
  readonly authorId: string | undefined;
  readonly content: string;
  readonly createdAt: number;
  /**
   * Hora já formatada. Derivação acontece no adapter, uma vez na escrita —
   * `toLocaleTimeString` no render é custo de Intl multiplicado por cada
   * re-render de linha, e apareceu no firehose a 4x.
   */
  readonly createdAtText: string;
  readonly editedAt: number | undefined;
  /**
   * Presente = a linha é do SISTEMA, não de alguém.
   *
   * "Entrou", "saiu", "renomeou o canal". O protocolo carrega isso como
   * mensagem com `system`, e o cliente hoje renderiza como se fosse fala —
   * com avatar, nome e conteúdo vazio.
   *
   * É um campo do snapshot e não um tipo de linha separado por decisão de
   * arquitetura: no protocolo é a MESMA entidade, ocupa a mesma posição no
   * histórico e tem o mesmo ID. Um segundo tipo de item na lista faria os
   * índices do virtualizador deixarem de casar com os de mensagem — o mesmo
   * motivo pelo qual o divisor de data é parte da linha e não um item próprio.
   */
  readonly sistema: SistemaSnapshot | undefined;
  /**
   * IDs das mensagens a que esta responde.
   *
   * Array e não um ID só porque o protocolo permite responder a várias — raro,
   * mas representável, e achatar para uma perderia dado sem avisar. A linha
   * renderiza uma citação por item; na prática é sempre uma.
   *
   * Guarda o ID, nunca o conteúdo citado. Copiar o texto no momento da
   * resposta congelaria a citação: editar o original deixaria a citação
   * mentindo, e apagar deixaria uma cópia órfã de algo que não existe mais.
   */
  readonly respostas: readonly string[];
  /**
   * As reações, já achatadas e ordenadas.
   *
   * Array e não `Map<emoji, número>`: a contagem sozinha não diz se EU reagi,
   * e sem isso o chip não sabe se está aceso nem o clique sabe se adiciona ou
   * remove. Era o que faltava para as reações saírem de "renderizadas" para
   * "usáveis".
   *
   * Ordem de primeira reação, herdada da iteração do Map do SDK — estável, e
   * é o que impede os chips de dançarem quando alguém reage.
   */
  readonly reactions: readonly ReacaoSnapshot[];

  /**
   * Campo do Vortex que o protocolo não carrega.
   *
   * Está aqui desde o primeiro dia de propósito: é a prova barata de que a
   * camada anticorrupção comporta um modelo mais rico que o do Stoat. O adapter
   * preenche com default; quando existir backend para isso, só o adapter muda.
   */
  readonly sendState: SendState;

  /**
   * Primeira mensagem do autor naquela janela: mostra avatar, nome e hora.
   *
   * Mensagens consecutivas do mesmo autor dentro de uma janela curta agrupam
   * sem repetir avatar e nome. É o que faz a lista parecer conversa em vez de
   * log — e é densidade, não enfeite: repetir o cabeçalho a cada linha custa
   * ~28px de altura por mensagem num app onde caber histórico é o ponto.
   */
  readonly iniciaGrupo: boolean;

  /**
   * Rótulo do divisor de data, quando esta linha abre um dia novo.
   *
   * Vive no snapshot, e não no render, porque depende da mensagem ANTERIOR — e
   * a lei nº 1 diz que a linha assina apenas a si mesma. Ler o vizinho no
   * render faria a linha re-renderizar quando o vizinho mudasse.
   *
   * O que torna isso possível: `authorId` e `createdAt` são imutáveis depois
   * da criação, então agrupamento e divisor só mudam em INSERÇÃO e REMOÇÃO,
   * nunca em edição ou reaction. O adapter recalcula nesses dois momentos e o
   * campo se comporta como qualquer outro do snapshot.
   */
  readonly dia: string | undefined;
};

/** Uma reação agregada. `minha` é o que faz o chip ser um botão de dois estados. */
export type ReacaoSnapshot = {
  readonly emoji: string;
  readonly total: number;
  readonly minha: boolean;
};

export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

export type UserSnapshot = {
  readonly id: string;
  readonly username: string;
  readonly status: PresenceStatus;
};

/* ------------------------------------------------------- colunas laterais */

/**
 * Iniciais de um nome, para o avatar sem imagem.
 *
 * Vive no snapshot e não no render pela mesma razão de `createdAtText`: é
 * derivação de escrita. Uma member list de servidor grande rola milhares de
 * linhas, e recalcular isto por render multiplicaria um `split`/`slice` por
 * cada passagem de scroll.
 */
export type ComSigla = {
  readonly sigla: string;
};

export type ServerSnapshot = ComSigla & {
  readonly id: string;
  readonly name: string;
  /**
   * Não-lidas e menções são do CLIENTE, como `sendState`.
   *
   * O protocolo tem `unread` booleano por canal; o Vortex conta. Contagem é
   * produto — é o que diferencia "tem coisa nova" de "tem 300 coisas novas" —
   * e é exatamente o tipo de divergência que a camada anticorrupção existe
   * para comportar sem tocar em componente.
   */
  readonly naoLidas: number;
  readonly mencoes: number;
};

/**
 * Uma linha do SISTEMA — "entrou", "saiu", "renomeou o canal".
 *
 * União fechada, e o texto é montado no COMPONENTE, não aqui. Guardar a frase
 * pronta no snapshot congelaria o idioma no momento em que o evento chegou: a
 * pessoa que troca de idioma veria o histórico antigo na língua antiga, e o
 * `i18n` não teria onde encostar. O domínio guarda o FATO; a frase é
 * apresentação.
 *
 * `texto` é a válvula de escape para os tipos do protocolo que este cliente
 * ainda não estrutura (fixar mensagem, chamada iniciada, troca de dono). Sem
 * ela, um tipo novo do upstream renderizaria uma linha vazia — que é pior que
 * uma linha genérica, porque não dá para diferenciar de bug.
 */
export type SistemaSnapshot =
  | { readonly tipo: "entrou" | "saiu"; readonly userId: string }
  | {
      readonly tipo: "adicionou" | "removeu";
      readonly userId: string;
      readonly porId: string;
    }
  | { readonly tipo: "renomeou"; readonly porId: string; readonly nome: string }
  | { readonly tipo: "texto"; readonly texto: string };

export type CanalTipo = "texto" | "voz";

/**
 * Uma categoria de canais.
 *
 * A coluna partia por TIPO — texto de um lado, voz do outro — e isso era
 * placeholder assumido: o protocolo tem `server.categories`, e quem administra
 * o servidor decide os grupos. Partir por tipo impunha uma organização que
 * ninguém pediu, e escondia a que alguém pediu.
 *
 * O tipo do canal não some: ele continua no `ChannelSnapshot`, decidindo o
 * ícone e se a linha carrega uma sala. O que muda é que ele não organiza mais
 * a coluna.
 *
 * `titulo` é `undefined` na categoria padrão — a cesta dos canais que ninguém
 * categorizou. Sem título, ela renderiza sem cabeçalho, no topo: é o que
 * significa "não está em grupo nenhum", e inventar um rótulo ("Geral",
 * "Outros") criaria um grupo que o servidor não tem.
 */
export type CategoriaDeCanais = {
  readonly id: string;
  readonly titulo: string | undefined;
  readonly canais: readonly string[];
};

/** O `id` que o protocolo dá à cesta dos não categorizados. */
export const CATEGORIA_PADRAO = "default";

export type ChannelSnapshot = {
  readonly id: string;
  readonly serverId: string | undefined;
  readonly name: string;
  readonly tipo: CanalTipo;
  /**
   * O tópico do canal (`description` no protocolo).
   *
   * `topico` e não `descricao`: no produto isto é o assunto do canal, e é
   * assim que quem usa chama. Nome de campo do protocolo não é nome de
   * conceito do domínio.
   */
  readonly topico: string | undefined;
  readonly naoLidas: number;
  readonly mencoes: number;
};

/**
 * A chave de um membro: servidor MAIS usuário.
 *
 * Marcada (`branded`) de propósito. A pendência que isto fecha era descrita
 * assim: *"o snapshot de membro é keyed por ID de USUÁRIO, e apelido mora no
 * ServerMember — uma chave de usuário não sabe de qual servidor se fala"*.
 *
 * Trocar a chave por uma string composta resolveria o dado e deixaria o erro
 * possível: `members.getSnapshot(userId)` continuaria compilando e devolvendo
 * `undefined` para sempre, sem erro nenhum. Com a marca, passar um ID de
 * usuário onde se espera uma chave de membro **não compila**.
 *
 * Tornar impossível > tipo > lint. Aqui o tipo é o mecanismo inteiro.
 */
export type ChaveDeMembro = string & { readonly __chaveDeMembro: unique symbol };

export function chaveDeMembro(serverId: string, userId: string): ChaveDeMembro {
  return `${serverId}:${userId}` as ChaveDeMembro;
}

/** O lado de volta, para quem tem a chave e precisa assinar presença. */
export function usuarioDaChave(chave: ChaveDeMembro): string {
  return chave.slice(chave.indexOf(":") + 1);
}

export type MemberSnapshot = ComSigla & {
  /**
   * ID de USUÁRIO, não a chave.
   *
   * Presença é do usuário, não do membro: a mesma pessoa aparece online nos
   * cinco servidores dela ao mesmo tempo. `PontoDePresenca` assina por este
   * campo, e é por isso que ele sobrevive à chave composta.
   */
  readonly id: string;
  readonly displayName: string;
  /**
   * Cor do cargo que hasteia a pessoa. `undefined` = cor de texto normal.
   *
   * Vem crua do protocolo (é escolha de quem administra o servidor, não do
   * nosso sistema de tokens), então é o único lugar do app onde uma cor
   * literal é legítima — e por isso ela nunca pinta fundo, só texto sobre
   * superfície conhecida.
   */
  /** Username global — o que a pessoa é fora deste servidor. */
  readonly username: string;
  /** `undefined` quando não declarados. Nunca inventar um valor. */
  readonly pronomes: string | undefined;
  /** Status escrito pela pessoa. Vazio é ausência, não string vazia. */
  readonly statusTexto: string | undefined;
  readonly cor: string | undefined;
  /**
   * Fim do castigo, em epoch ms. `undefined` = sem castigo.
   *
   * Número e não `Date`: `getSnapshot` precisa devolver referência estável, e
   * um `Date` novo a cada leitura é exatamente o erro nº 1 do briefing.
   */
  readonly silenciadoAte: number | undefined;
};

/**
 * Balde de ordenação da member list.
 *
 * Dois, não quatro: separar `idle` e `dnd` em seções próprias faria toda
 * mudança de presença reordenar a lista, e presença é o evento mais volumoso
 * do app. Com dois baldes, `online → idle → dnd` não move ninguém — só o
 * pontinho muda, e ele assina sozinho.
 *
 * É a mesma decisão de escopo da lei nº 1, aplicada à ordenação em vez de à
 * subscrição.
 */
export type Balde = "online" | "offline";

/**
 * Uma seção da member list.
 *
 * Seção por CARGO, e só do lado online — que é o que o Discord faz, e não por
 * imitação: é o que preserva a decisão dos dois baldes. Presença muda o tempo
 * todo (55% da carga do firehose) e **cargo não pisca**, então seccionar por
 * cargo não reordena nada; `online → idle → dnd` continua não movendo ninguém,
 * porque os três caem na mesma seção. Offline permanece um balde só,
 * independente de cargo, pelo mesmo motivo.
 *
 * A lei nº 1 não proíbe seção. Proíbe seção sobre estado de alta frequência.
 */
export type SecaoDeMembros = {
  /** ID do cargo, ou `SEM_CARGO` para quem não tem cargo hasteado. */
  readonly id: string;
  readonly rotulo: string;
  readonly cor: string | undefined;
  readonly ids: readonly string[];
};

export const SEM_CARGO = "@sem-cargo";

/**
 * O que a pessoa está publicando na sala. Tela ganha de vídeo, vídeo de voz —
 * a mesma precedência que o SDK aplica, mantida aqui porque é regra de
 * apresentação e o domínio é quem a declara.
 */
export type EstadoDeVoz = "voz" | "video" | "tela";

/**
 * Alguém DENTRO de um canal de voz.
 *
 * A peça que separa sala de chamada. No Stoat um canal de voz é uma chamada
 * que se faz; aqui é um lugar onde há gente, visível antes de entrar — e o
 * protocolo sempre soube disso: `Ready.voice_states` entrega quem está em cada
 * canal no login, antes de entrar em qualquer um.
 *
 * `desde` é epoch ms, e não `Date`, pela mesma razão de `silenciadoAte`:
 * `getSnapshot` precisa devolver referência estável.
 */
export type ParticipanteDeVoz = {
  readonly userId: string;
  readonly estado: EstadoDeVoz;
  readonly desde: number;
};

export function baldeDe(status: PresenceStatus): Balde {
  return status === "offline" ? "offline" : "online";
}
