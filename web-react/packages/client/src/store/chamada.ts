/**
 * A chamada de voz em andamento.
 *
 * Store module-level, lei nº 1: quem muda isto é um evento do LiveKit, e
 * nenhum deles está numa árvore de componentes.
 *
 * ⚠ **Duas velocidades, dois stores, e essa separação é a razão de este
 * arquivo existir.** A LISTA de quem está na chamada muda por ação humana —
 * alguém entra, alguém sai — e cabe num store normal. **Quem está FALANDO
 * muda dezenas de vezes por segundo**, e é o estado efêmero que a lei nº 1
 * nomeia. Misturar os dois faria a coluna inteira repintar a cada sílaba.
 *
 * O `CLAUDE.md` registrou esse risco antes de a etapa existir: *"canal de voz
 * movimentado repinta a coluna inteira"*. É o único aviso do plano que descreve
 * um defeito de performance que ainda não aconteceu.
 */
import { createEphemeralStore } from "./ephemeral";

/**
 * Onde a chamada está.
 *
 * `conectando` é estado próprio e não um sinalizador: entrar numa sala leva
 * segundos de rede, e uma interface que não distingue "entrando" de "dentro"
 * faz a pessoa clicar de novo achando que não pegou.
 */
export type EstadoDaChamada =
  | "fora"
  | "conectando"
  | "dentro"
  | "reconectando";

/**
 * A qualidade da conexão de voz, como o LiveKit a reporta.
 *
 * ⚠ **Isto não é latência em milissegundos, e a diferença importa.** O design
 * mostra "Conectado · 42 ms"; o LiveKit expõe `ConnectionQuality`, que é uma
 * classificação (`excellent | good | poor | lost`) e não um número. Inventar
 * um número a partir dela seria pior que não mostrá-lo: um "42 ms" derivado de
 * "good" é dado falso numa superfície onde a pessoa toma decisão — sair da
 * chamada, trocar de rede.
 *
 * `desconhecida` é o estado antes do primeiro relatório, e não um erro: a sala
 * leva alguns segundos para medir.
 */
export type QualidadeDeVoz = "otima" | "boa" | "ruim" | "perdida" | "desconhecida";

/** Ver `Chamada.telaAudio`. */
export type AudioDaTela = "sem" | "mudo" | "ligado";

export type Chamada = {
  readonly estado: EstadoDaChamada;
  readonly qualidade: QualidadeDeVoz;
  /** Em qual canal. Vazio quando `fora`. */
  readonly channelId: string;
  /** Quem está na sala, incluindo você. */
  readonly participantes: readonly string[];
  /**
   * Quem está transmitindo a tela, por ID. Não inclui você.
   *
   * ⚠ **Lista, e não um booleano por pessoa em outro lugar.** Ela responde a
   * pergunta que a grade e a coluna de canais fazem — "tem alguém ao vivo
   * aqui?" — sem que ninguém precise assinar faixa de vídeo para descobrir.
   * Com `autoSubscribe: false` a faixa só chega depois de alguém pedir, então
   * "existe stream" e "tenho o stream" são fatos DIFERENTES, e confundi-los
   * daria uma sala onde ninguém sabe que há o que assistir.
   */
  readonly transmitindo: readonly string[];
  /**
   * Quem está com o microfone silenciado, por ID.
   *
   * ⚠ **Estado de TRANSPORTE de outra pessoa, e por isso vive aqui e não no
   * snapshot dela.** `mudo` no snapshot de pessoa seria um fato sobre a
   * pessoa; isto é um fato sobre a SALA — a mesma pessoa pode estar muda numa
   * chamada e falando noutra. Publicar no snapshot faria a member list
   * inteira acordar a cada alguém que aperta o microfone.
   */
  readonly mudos: readonly string[];
  /** Quem está com a câmera publicada. Mesma razão de `transmitindo`. */
  readonly comCamera: readonly string[];
  readonly mudo: boolean;
  readonly surdo: boolean;
  readonly camera: boolean;
  readonly tela: boolean;
  /**
   * A transmissão está PAUSADA — a faixa continua publicada, sem quadros.
   *
   * ⚠ **Pausar não é parar, e a diferença é o que torna o controle útil.**
   * Parar despublica a faixa: quem assiste perde a caixa, e voltar exige
   * escolher a fonte de novo. Pausar congela a imagem no último quadro e
   * mantém o lugar — é o que se usa para trocar de aba sem mostrar o e-mail.
   */
  readonly telaPausada: boolean;
  /**
   * O áudio que acompanha a tela — TRÊS estados, e não um booleano.
   *
   * ⚠ **Um booleano conflaciona "silenciei" com "nunca teve som", e as duas
   * pedem interfaces opostas.** O navegador só entrega áudio de tela quando a
   * pessoa marca a caixa no seletor do sistema, e Safari e Firefox não
   * oferecem a caixa. Com `false` para os dois, o HUD mostraria um botão de
   * "ligar áudio" que não liga nada — o alvo inerte que este projeto passou
   * uma fase inteira removendo.
   *
   * Com a união, `sem` desabilita o controle e diz por quê; `mudo` e `ligado`
   * alternam. É a mesma razão de `PresencaEscolhida` ser tipo separado de
   * `PresenceStatus`.
   */
  readonly telaAudio: AudioDaTela;
  /**
   * Quando a conexão foi estabelecida, em epoch ms. `0` fora da chamada.
   *
   * ⚠ Guarda o INSTANTE, e não a duração — o store não tem relógio. Quem
   * mostra o cronômetro calcula `agora − desde` a cada segundo e é o único
   * que re-renderiza; se o store guardasse os segundos, ele publicaria
   * sessenta vezes por minuto e acordaria todo mundo que assina a chamada.
   *
   * É a mesma separação de `falando`: o que muda depressa não mora onde
   * muita gente escuta.
   */
  readonly desde: number;
};

const VAZIA: Chamada = {
  estado: "fora",
  qualidade: "desconhecida",
  channelId: "",
  participantes: [],
  transmitindo: [],
  comCamera: [],
  mudos: [],
  mudo: false,
  surdo: false,
  camera: false,
  tela: false,
  telaPausada: false,
  telaAudio: "sem",
  desde: 0,
};

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

/** Referência cacheada — armadilha nº 1. */
let chamada: Chamada = VAZIA;

export function assinarChamada(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerChamada(): Chamada {
  return chamada;
}

export function definirChamada(mudanca: Partial<Chamada>): void {
  const nova = { ...chamada, ...mudanca };
  if (igual(nova, chamada)) return;
  chamada = nova;
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * Duas chamadas são a mesma?
 *
 * ⚠ **Varre as CHAVES, e a primeira versão listava os campos a dedo — o que
 * transformou cada campo novo num defeito silencioso.** Ela nomeava oito
 * comparações; quando `transmitindo`, `comCamera` e `mudos` entraram para a
 * grade de vídeo, mudanças que tocassem SÓ esses três eram lidas como "nada
 * mudou" e engolidas. E `publicarFontes` no motor publica exatamente esses
 * três: contra um servidor real, ninguém apareceria com câmera nunca, e a
 * causa não estaria no vídeo, nem no LiveKit, nem na grade.
 *
 * Medido no arnês: os ladrilhos saíam com `data-video="false"` e o alvo
 * "Assistir" não existia, com o store dizendo que havia quem transmitisse.
 *
 * A comparação campo a campo existe por uma razão que continua válida: o
 * LiveKit emite mudança de participantes a cada faixa, e a maioria não muda a
 * lista. Sem ela, cada uma acordaria o cartão de chamada e a coluna de canais.
 * O que estava errado era ela ser uma LISTA que alguém precisa lembrar de
 * atualizar.
 */
function igual(a: Chamada, b: Chamada): boolean {
  for (const chave of Object.keys(a) as (keyof Chamada)[]) {
    const x: unknown = a[chave];
    const y: unknown = b[chave];
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) return false;
      if (x.some((v, i) => v !== y[i])) return false;
      continue;
    }
    if (x !== y) return false;
  }
  return true;
}


/* ------------------------------------------------- mudo e surdo: a REGRA */

/**
 * Alternar mudo, e devolver o valor novo para quem precisa aplicá-lo.
 *
 * ⚠ **A regra mora AQUI e não no motor, e a mudança de lugar tem razão.**
 * Mudo e surdo são PREFERÊNCIA, não estado de transporte: valem antes de
 * entrar na sala, sobrevivem a sair dela, e são o que `entrarNaChamada` lê
 * para decidir se abre o microfone. O motor só as APLICA no LiveKit.
 *
 * A separação passou a importar quando o painel de usuário ganhou os botões:
 * fora da chamada não há motor carregado — e carregar meio megabyte de WebRTC
 * para virar um booleano seria absurdo. Com a regra no store, os dois lados
 * chamam a mesma função e só o de dentro toca a faixa de áudio.
 */
export function alternarMudoNoStore(): boolean {
  const mudo = !chamada.mudo;
  definirChamada({ mudo });
  return mudo;
}

/**
 * Ensurdecer também emudece.
 *
 * Quem não está ouvindo não deve continuar falando: é a convenção de todo
 * cliente de voz, e a razão é social — falar sem ouvir a resposta atropela a
 * conversa. Desensurdecer NÃO desfaz o mudo automaticamente: se a pessoa já
 * estava muda antes, voltar a transmitir seria uma decisão que ela não tomou.
 *
 * A regra estava escrita dentro do motor. Duplicá-la para o caminho de fora da
 * chamada daria duas cópias que precisam concordar, e a que diverge é sempre a
 * que ninguém abriu naquela semana.
 */
export function alternarSurdoNoStore(): { surdo: boolean; mudo: boolean } {
  const surdo = !chamada.surdo;
  const mudo = surdo ? true : chamada.mudo;
  definirChamada({ surdo, mudo });
  return { surdo, mudo };
}

export function encerrarChamada(): void {
  if (chamada.estado === "fora") return;
  chamada = VAZIA;
  for (const ouvinte of ouvintes) ouvinte();
}

/* ------------------------------------------------------- quem está falando */

/**
 * O anel de fala.
 *
 * **Store efêmero, com throttle de 120ms na fronteira** — o mesmo de presença
 * e digitação, e pela mesma razão elevada ao quadrado: o LiveKit calcula nível
 * de áudio continuamente, e `activeSpeakersChanged` chega várias vezes por
 * segundo por pessoa numa sala movimentada.
 *
 * Keyed por usuário: quem assina é o avatar daquela pessoa, e ninguém mais
 * acorda quando ela começa a falar. É a lei nº 1 na granularidade mais fina
 * que o app tem.
 */
export const falando = createEphemeralStore<boolean>();

/**
 * Publica quem está falando agora.
 *
 * Recebe a lista INTEIRA e apaga quem saiu dela — o LiveKit manda o conjunto
 * ativo, não deltas. Sem apagar, o anel ficaria aceso para sempre em quem
 * falou uma vez.
 */
let ultimosFalantes: readonly string[] = [];

export function definirFalantes(ids: readonly string[]): void {
  for (const id of ultimosFalantes) {
    if (!ids.includes(id)) falando.set(id, false);
  }
  for (const id of ids) falando.set(id, true);
  ultimosFalantes = ids;
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparChamada(): void {
  chamada = VAZIA;
  ultimosFalantes = [];
}
