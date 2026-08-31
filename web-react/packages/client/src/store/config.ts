/**
 * As configurações abertas.
 *
 * ⚠ **Rota, e não modal** — decisão do plano de paridade. O upstream põe as 42
 * páginas dentro de um `Dialog` em tela cheia, e paga por isso: nada é
 * linkável, o botão voltar não fecha, e recarregar cai na tela inicial. Aqui
 * `/config/perfil` é um endereço, `voltar` fecha, e F5 continua onde estava.
 *
 * ⚠ **E ela fica SOBRE o shell, não no lugar dele.** Substituir o shell
 * desmontaria a lista de mensagens — que numa sessão real tem dez mil linhas
 * medidas, âncora e posição de rolagem. Reconstruir tudo isso porque alguém
 * abriu "Aparência" seria o custo mais caro do app pago pela ação mais barata.
 */

/**
 * As seções, como união fechada.
 *
 * `Record<SecaoId, …>` no menu e no roteador faz seção nova não compilar até
 * ter nome e tela — a mesma mecânica de `PainelId` e `ModalId`.
 *
 * As de servidor carregam o ID no store, não no tipo: "cargos" é uma seção;
 * "os cargos do servidor X" é uma seção com um alvo, e misturar os dois faria
 * a união crescer por instância, que é o erro que o schema do preset torna
 * irrepresentável desde a fase 4.
 */
export const SECOES = [
  "perfil",
  "conta",
  "sessoes",
  "privacidade",
  "vozEVideo",
  "aparencia",
  "notificacoes",
  "atalhos",
  "desktop",
  "avancado",
  "servidor",
  "membros",
  "cargos",
  "convites",
  "banimentos",
  "emojis",
  /*
    As de CANAL, e elas carregam o `channelId` pela mesma razão que as de
    servidor carregam o `serverId`: "permissões" é uma seção, "as permissões
    do canal X" é uma seção com um alvo. A união cresceria por instância se o
    ID entrasse no tipo — o erro que o schema do preset torna irrepresentável
    desde a fase 4.
  */
  "canal",
  "canalPermissoes",
  "canalConvites",
] as const;

export type SecaoId = (typeof SECOES)[number];

/**
 * O nome de cada seção, e ele mora AQUI e não na tela.
 *
 * A casca de configurações tinha a lista para si. Com a porta do servidor
 * abrindo as mesmas seções por fora, duas listas passariam a precisar
 * concordar — e a que diverge é sempre a que ninguém abriu naquela semana.
 * `Record<SecaoId, string>` mantém a exaustividade: seção nova não compila até
 * ganhar nome.
 */
export const NOME_DA_SECAO: Record<SecaoId, string> = {
  perfil: "Perfil",
  conta: "Conta",
  sessoes: "Dispositivos",
  privacidade: "Privacidade",
  vozEVideo: "Voz e vídeo",
  aparencia: "Aparência",
  notificacoes: "Notificações",
  atalhos: "Atalhos de teclado",
  desktop: "Desktop",
  avancado: "Avançado",
  servidor: "Visão geral",
  membros: "Membros",
  cargos: "Cargos",
  convites: "Convites",
  banimentos: "Banimentos",
  emojis: "Emojis",
  canal: "Visão geral",
  canalPermissoes: "Permissões",
  canalConvites: "Convites",
};

/**
 * O subtítulo da página, quando ela tem um.
 *
 * ⚠ `Partial` e não `Record` completo, e é a única exaustividade que este
 * arquivo dispensa de propósito: a maioria das seções não precisa de subtítulo,
 * e exigir um faria alguém inventar uma frase para "Perfil" só para o build
 * passar. Título vazio é pior que ausente — ocupa a mesma altura sem dizer nada.
 */
export const DESCRICAO_DA_SECAO: Partial<Record<SecaoId, string>> = {
  privacidade: "Quem pode falar com você e o que o Vortex guarda.",
  atalhos:
    "Combinações do app. Atalhos globais (mesmo em segundo plano) ficam em Voz e vídeo.",
  avancado: "Ferramentas para quem administra servidores e reporta problemas.",
  desktop: "Opções que só existem no app instalado.",
};

/** As que falam de um servidor, e por isso precisam de um. */
export const DE_SERVIDOR: readonly SecaoId[] = [
  "servidor",
  "membros",
  "cargos",
  "convites",
  "banimentos",
  "emojis",
];

/** As que falam de um canal, e por isso precisam de um. */
export const DE_CANAL: readonly SecaoId[] = [
  "canal",
  "canalPermissoes",
  "canalConvites",
];

export type Config = {
  /** `null` = fechadas. */
  readonly secao: SecaoId | null;
  /** Só existe nas seções de servidor. */
  readonly serverId: string | undefined;
  /** Só existe nas seções de canal. */
  readonly channelId: string | undefined;
};

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

const FECHADA: Config = { secao: null, serverId: undefined, channelId: undefined };

/** Referência cacheada — armadilha nº 1. */
let config: Config = FECHADA;

export function assinarConfig(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerConfig(): Config {
  return config;
}

function publicar(nova: Config): void {
  if (
    nova.secao === config.secao &&
    nova.serverId === config.serverId &&
    nova.channelId === config.channelId
  ) {
    return;
  }
  config = nova;
  for (const ouvinte of ouvintes) ouvinte();
}

export function abrirConfig(secao: SecaoId, serverId?: string): void {
  /*
    O canal é PRESERVADO ao trocar de seção dentro das de canal.

    Sem isto, clicar em "Permissões" no menu esqueceria de qual canal se está
    falando — e a tela abriria vazia sem dizer por quê. É o mesmo motivo pelo
    qual `serverId` já era opcional aqui: quem navega DENTRO da casca não
    reinforma o alvo.
  */
  const deCanal = DE_CANAL.includes(secao);
  publicar({
    secao,
    serverId,
    channelId: deCanal ? config.channelId : undefined,
  });
}

/** Abre as configurações DE UM CANAL. O alvo entra aqui, não na navegação. */
export function abrirConfigDeCanal(secao: SecaoId, channelId: string): void {
  publicar({ secao, serverId: config.serverId, channelId });
}

/**
 * Fecha.
 *
 * `history.back()` e não um caminho novo: abrir configurações empurrou uma
 * entrada, então voltar devolve exatamente onde a pessoa estava — canal,
 * rolagem e tudo. Empurrar `/` funcionaria e perderia o lugar, além de deixar
 * duas entradas de histórico para uma ida e volta.
 */
export function fecharConfig(): void {
  if (config.secao === null) return;
  publicar(FECHADA);
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparConfig(): void {
  config = FECHADA;
}
