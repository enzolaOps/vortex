import {
  chaveDaMatriz,
  type CanalDeEntrega,
  type EventoDeNotificacao,
  type Preferencias,
} from "../store/notificacoes";
import type { NivelDeNotificacao } from "../store/silencio";

/**
 * Uma mensagem que chegou, na forma que o notificador precisa — montada pelo
 * adapter, sem nada do SDK.
 */
export type MensagemRecebida = {
  readonly mensagemId: string;
  readonly channelId: string;
  readonly serverId: string | undefined;
  readonly tipoDoCanal: "dm" | "grupo" | "servidor";
  readonly autorNome: string;
  readonly canalNome: string | undefined;
  readonly servidorNome: string | undefined;
  readonly texto: string;
  readonly minha: boolean;
  /** `@você`, `@everyone`, `@online` ou resposta mencionando. */
  readonly mencionaVoce: boolean;
  /** Um cargo que você TEM foi mencionado. */
  readonly mencionaCargo: boolean;
};

export type Contexto = {
  readonly prefs: Preferencias;
  readonly nivel: NivelDeNotificacao | undefined;
  readonly silenciado: boolean;
  readonly naoPerturbe: boolean;
  readonly agora: Date;
  readonly janelaEmFoco: boolean;
  readonly vendoCanal: boolean;
};

export type Entrega = {
  readonly evento: EventoDeNotificacao;
  readonly canais: ReadonlySet<CanalDeEntrega>;
};

function minutos(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * O horário de silêncio está valendo agora?
 *
 * ⚠ **A janela atravessa a meia-noite** (22:00 → 08:00 é o padrão), e o DIA
 * que conta é o em que ela COMEÇOU: segunda às 02:00 pertence ao silêncio que
 * começou domingo à noite. Contar pelo dia de agora silenciaria a madrugada de
 * sábado para domingo com a semana marcada de segunda a sexta — e liberaria a
 * de sexta para sábado.
 */
export function emSilencioNoturno(prefs: Preferencias, agora: Date): boolean {
  if (!prefs.silencioNoturno) return false;
  const t = agora.getHours() * 60 + agora.getMinutes();
  const das = minutos(prefs.silencioDas);
  const ate = minutos(prefs.silencioAte);
  if (das === ate) return false;

  const dia = agora.getDay();
  if (das < ate) {
    return t >= das && t < ate && prefs.silencioDias.includes(dia);
  }
  if (t >= das) return prefs.silencioDias.includes(dia);
  if (t < ate) return prefs.silencioDias.includes((dia + 6) % 7);
  return false;
}

/**
 * Notificar, e por onde — ou `undefined` para nada.
 *
 * A ordem é a que a tela de notificações escreve: não perturbe → horário de
 * silêncio → canal silenciado → nível do canal → matriz de eventos.
 */
export function decidirEntrega(
  m: MensagemRecebida,
  ctx: Contexto,
): Entrega | undefined {
  if (m.minha) return undefined;
  /* Quem está olhando para o canal já está vendo a mensagem. */
  if (ctx.vendoCanal && ctx.janelaEmFoco) return undefined;
  if (ctx.naoPerturbe) return undefined;
  if (emSilencioNoturno(ctx.prefs, ctx.agora)) return undefined;
  if (ctx.silenciado || ctx.nivel === "nada") return undefined;

  let evento: EventoDeNotificacao;
  if (m.tipoDoCanal !== "servidor") evento = "dm";
  else if (m.mencionaVoce) evento = "mencaoDireta";
  else if (m.mencionaCargo) evento = "mencaoDeCargo";
  else evento = "mensagem";

  /*
    ⚠ **Mensagem comum só em canal marcado "todas as mensagens".** É o que o
    próprio evento diz na tela ("Canais com 'todas as mensagens'"). O padrão
    de canal de servidor é só menções — bipe por mensagem em servidor
    movimentado é o motivo pelo qual as pessoas desligam notificação inteira.
  */
  if (evento === "mensagem" && ctx.nivel !== "todas") return undefined;

  const canais = new Set<CanalDeEntrega>();
  for (const canal of ["toast", "som", "push"] as const) {
    if (!ctx.prefs.matriz.has(chaveDaMatriz(evento, canal))) continue;
    /*
      Toast é DENTRO do app e só serve com ele à frente; push é do sistema, e é
      o caminho de quando a janela está atrás. Os dois juntos avisariam duas
      vezes a mesma coisa.
    */
    if (canal === "toast" && !ctx.janelaEmFoco) continue;
    if (canal === "push" && (ctx.janelaEmFoco || !ctx.prefs.desktop)) continue;
    canais.add(canal);
  }
  return canais.size > 0 ? { evento, canais } : undefined;
}

/** O que a decisão de uma chamada precisa saber. */
export type ContextoDeChamada = {
  readonly prefs: Preferencias;
  readonly naoPerturbe: boolean;
  readonly agora: Date;
  readonly janelaEmFoco: boolean;
  /** A DM ou o grupo está silenciado. */
  readonly silenciado: boolean;
  /** Quem ligou é amigo — o horário de silêncio o deixa passar. */
  readonly amigo: boolean;
};

/**
 * Anunciar uma chamada recebida, e por onde — ou `undefined` para nada.
 *
 * ⚠ **Não é a regra da mensagem, e as diferenças estão escritas na própria
 * tela de notificações.** *"Só o toast de chamada ignora tudo menos não
 * perturbe"* e, no horário de silêncio, *"suprime tudo menos chamadas de
 * amigos"*. Por isso:
 *
 * - **não perturbe** cala tudo, inclusive o aviso na tela;
 * - **o toast** ignora silêncio de canal e horário de silêncio, e ignora o
 *   FOCO — ao contrário do da mensagem. O aviso de chamada não expira em cinco
 *   segundos: ele fica até alguém decidir, e é a única forma de atender. Quem
 *   volta para a janela no meio do toque precisa encontrá-lo lá;
 * - **som e push** respeitam o canal silenciado e o horário de silêncio, com a
 *   exceção de amigo no horário.
 *
 * Vista na tela como "a pessoa escolheu não ser chamada" é o que DND é; o
 * resto é "não quero ser incomodado por barulho", que não é o mesmo que "não
 * quero saber que me ligaram".
 */
export function decidirEntregaDeChamada(
  ctx: ContextoDeChamada,
): Entrega | undefined {
  if (ctx.naoPerturbe) return undefined;

  const quieto =
    ctx.silenciado || (!ctx.amigo && emSilencioNoturno(ctx.prefs, ctx.agora));

  const canais = new Set<CanalDeEntrega>();
  for (const canal of ["toast", "som", "push"] as const) {
    if (!ctx.prefs.matriz.has(chaveDaMatriz("chamada", canal))) continue;
    if (canal !== "toast" && quieto) continue;
    if (canal === "push" && (ctx.janelaEmFoco || !ctx.prefs.desktop)) continue;
    canais.add(canal);
  }
  return canais.size > 0 ? { evento: "chamada", canais } : undefined;
}

/** O título e o corpo, respeitando a prévia. */
export function textoDaNotificacao(
  m: MensagemRecebida,
  previa: boolean,
): { titulo: string; corpo: string } {
  const onde =
    m.tipoDoCanal === "servidor"
      ? ` em #${m.canalNome ?? "canal"}${m.servidorNome ? ` · ${m.servidorNome}` : ""}`
      : m.tipoDoCanal === "grupo" && m.canalNome
        ? ` em ${m.canalNome}`
        : "";
  const corpo = previa
    ? m.texto
        /* Menção crua é `<@01H…>`: ilegível numa notificação do sistema. */
        .replace(/<@[0-9A-Z]{26}>/g, "@menção")
        .replace(/<#[0-9A-Z]{26}>/g, "#canal")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180) || "Enviou um anexo"
    : "Nova mensagem";
  return { titulo: `${m.autorNome}${onde}`, corpo };
}
