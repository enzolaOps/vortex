/**
 * O que a pessoa pode fazer.
 *
 * **Isto é a REGRA do briefing virando código: nunca renderizar ação que a
 * pessoa não pode executar.** Ela foi registrada assim, com a razão explícita:
 * custa zero adotada cedo e é varredura em todo componente se adotada depois.
 *
 * Mora em `src/sdk/` porque é tradução de protocolo: `havePermission` e
 * `ManageChannel` são conceitos do Stoat, e `Acao` é conceito do Vortex. A
 * camada anticorrupção existe exatamente para essa troca.
 *
 * A união fechada é o mecanismo. Não existe `pode(canal, "qualquer string")`:
 * ação nova precisa entrar em `Acao`, e entrar em `Acao` sem ser mapeada é
 * erro de compilação, não bug silencioso.
 *
 * ⚠ **Até a etapa 4 isto devolvia `true` para tudo**, com um comentário
 * dizendo que viraria uma linha quando houvesse login. Virou — e a linha tinha
 * uma armadilha que o comentário não previa: **o default de "não sei" agora é
 * `false`**, e sem cuidado isso esconderia a interface inteira de si mesma
 * durante o desenvolvimento, onde não há servidor para responder. Ver
 * `SEM_SERVIDOR`.
 *
 * ⚠ **É leitura no render, não subscrição.** `MessageRow` é `memo`, então uma
 * permissão que mudasse não repintaria as linhas montadas. A resposta NÃO é
 * transformar isto em hook com store — seriam três subscrições por linha, para
 * sempre, por um valor que muda quando alguém edita um cargo. O que funciona é
 * `repensarPermissoes`, no adapter: reescrever os SNAPSHOTS dos assinados.
 */
import { client } from "./client";

/**
 * As ações que a interface oferece.
 *
 * Cada uma corresponde a um alvo real na tela. Não há entrada especulativa: a
 * ausência é o que impede este arquivo de virar uma cópia otimista da tabela
 * de permissões do protocolo.
 */
export type Acao =
  /* --- mensagem ------------------------------------------------------- */
  /** Escrever no composer e enviar. */
  | "enviar"
  /** Responder a uma mensagem — no protocolo é o mesmo direito de enviar. */
  | "responder"
  /** Reagir com emoji. Direito próprio no Stoat: `React`. */
  | "reagir"
  /** Fixar e desafixar no canal. `ManageMessages`. */
  | "fixar"
  /** Marcar como lida. Não é permissão de servidor — é do próprio usuário. */
  | "marcarLida"
  /* --- administração -------------------------------------------------- */
  /** Criar, renomear e apagar canal; mexer nas categorias. */
  | "gerenciarCanais"
  /** Editar nome, descrição e ícone do servidor. */
  | "gerenciarServidor"
  /** Criar convite para o canal. */
  | "criarConvite"
  /** Expulsar alguém do servidor. */
  | "expulsar"
  /** Banir e desbanir. */
  | "banir"
  /** Deixar alguém de castigo. */
  | "silenciarMembro"
  /* --- fase 6: as que a tabela de cargos resolvida destravou ----------- */
  /** Dar e tirar cargo de alguém. `ManageRole`. */
  | "gerenciarCargos"
  /** Trocar o apelido de alguém neste servidor. */
  | "gerenciarApelidos"
  /** Puxar alguém de um canal de voz para outro. */
  | "moverMembros";

/**
 * A permissão do protocolo por trás de cada ação.
 *
 * `Record<Acao, …>` e não um `switch`: ação nova não compila até ser mapeada,
 * que é a mesma mecânica de `NOME_DO_PAINEL` sobre `PainelId`.
 *
 * `undefined` marca as que NÃO são permissão de servidor. `marcarLida` é do
 * próprio usuário sobre o próprio estado de leitura — perguntar ao servidor
 * seria inventar uma pergunta que o protocolo não faz.
 */
const PERMISSAO: Record<Acao, string | undefined> = {
  enviar: "SendMessage",
  responder: "SendMessage",
  reagir: "React",
  fixar: "ManageMessages",
  marcarLida: undefined,

  gerenciarCanais: "ManageChannel",
  gerenciarServidor: "ManageServer",
  criarConvite: "InviteOthers",
  expulsar: "KickMembers",
  banir: "BanMembers",
  silenciarMembro: "TimeoutMembers",

  gerenciarCargos: "ManageRole",
  /*
    ⚠ **`ManageNickname` e não `ChangeNickname`** — o protocolo tem os dois, e
    a diferença é de quem: `Change` é mexer no PRÓPRIO apelido, `Manage` é no
    dos outros. Este item do menu aparece sobre outra pessoa, então é o
    segundo; o caso "eu mesmo" passa por fora da permissão.
  */
  gerenciarApelidos: "ManageNickname",
  moverMembros: "MoveMembers",
};

/**
 * O que responder quando não há servidor para perguntar.
 *
 * ⚠ **Esta constante é a diferença entre um app utilizável e uma tela morta
 * durante todo o desenvolvimento.** Sem sessão e sem socket, `havePermission`
 * não tem tabela de cargos para consultar: ele responderia `false` para tudo,
 * e o arnês — onde este projeto é construído e medido — perderia composer,
 * reação, resposta, menu e a coluna inteira de administração.
 *
 * O default de "não sei" continua sendo `false` **onde há servidor**, que é o
 * correto. Isto é a exceção explícita para o caso em que não há, e ela é
 * estreita de propósito: uma condição só, verificável, e não um `||` espalhado
 * por cada chamada.
 */
function semServidorParaPerguntar(): boolean {
  /*
    `client.user` é o sinal mais honesto de "há sessão de verdade".

    Não é `conectado()`: o socket cai o tempo todo e as permissões não somem
    junto — a tabela de cargos continua no cliente. O que define se há a quem
    perguntar é ter havido um `Ready`.
  */
  return client.user === undefined;
}

/**
 * A pessoa pode fazer isto neste canal?
 *
 * O `channelId` decide sozinho o escopo: o SDK resolve a permissão do canal
 * subindo para o servidor quando é canal de servidor, e usa o padrão de DM
 * quando não é. É por isso que não há uma função separada para servidor —
 * perguntar "posso banir neste canal" é a mesma pergunta que "posso banir
 * neste servidor", e ter as duas convidaria a divergirem.
 */
export function pode(channelId: string, acao: Acao): boolean {
  const permissao = PERMISSAO[acao];
  // Não é permissão de servidor — ninguém precisa autorizar você a ler o que
  // já está na sua tela.
  if (permissao === undefined) return true;

  if (semServidorParaPerguntar()) return true;

  const canal = client.channels.get(channelId);
  if (!canal) return false;

  try {
    return canal.havePermission(permissao as never);
  } catch {
    /*
      O SDK estoura quando falta contexto — servidor ainda não hidratado, cargo
      que sumiu no meio da consulta. Com servidor presente, "não sei" é `false`:
      é melhor esconder uma ação que existia do que oferecer uma que o servidor
      vai recusar, porque a segunda vira erro depois do clique.
    */
    return false;
  }
}
