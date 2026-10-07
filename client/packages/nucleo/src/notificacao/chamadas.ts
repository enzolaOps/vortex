import { tocar } from "../som/sons";
import { assinarChamada, lerChamada } from "../store/chamada";
import {
  aplicarToque,
  assinarChamadaRecebida,
  lerChamadaRecebida,
  TOQUE_MS,
  type ChamadaRecebida,
} from "../store/chamadaRecebida";
import { lerMeuStatus } from "../store/meuStatus";
import { abrirConversa } from "../store/navegacao";
import { lerNotificacoes } from "../store/notificacoes";
import { estaSilenciado } from "../store/silencio";
import { decidirEntregaDeChamada } from "./decidir";
import { ponteDeNotificacoes } from "./notificador";

/**
 * A chamada recebida, do sinal do protocolo até o aviso — som, push e store.
 *
 * ⚠ **Módulo próprio e não mais uma função no `notificador`.** Mensagem é
 * evento PONTUAL: chega, avisa, acabou. Chamada é evento com DURAÇÃO — ela
 * toca, repete o som, expira, e para quando alguém atende de outro lugar —, e
 * isso pede relógio e subscrição, que o notificador não tem nem deve ter.
 *
 * O adapter chama `sinalizarChamada` com o que traduziu do evento cru; nada
 * aqui conhece o SDK. É a mesma fronteira de `MensagemRecebida`.
 */

/** O que o adapter entrega quando alguém começa uma chamada. */
export type SinalDeChamada = {
  readonly channelId: string;
  readonly quemLigou: string;
  /** Você, lido no adapter. Ver `ContextoDoToque.eu`. */
  readonly eu: string | undefined;
  readonly quemLigouNome: string;
  /** Nome do grupo. `undefined` numa DM 1:1. */
  readonly grupoNome: string | undefined;
  readonly amigo: boolean;
};

/**
 * Intervalo entre dois toques.
 *
 * O motivo dura ~0,36 s; 2,5 s de ciclo é o ritmo de campainha — rápido o
 * bastante para parecer insistente, lento o bastante para não virar alarme.
 */
const CICLO_DO_TOQUE_MS = 2500;

let eu: string | undefined;
/** O canal que está autorizado a fazer barulho — o que a decisão aprovou. */
let comSom: string | undefined;

function ctx() {
  return { eu, canalDaChamada: lerChamada().estado === "fora" ? "" : lerChamada().channelId };
}

/** Alguém começou uma chamada numa DM ou grupo. */
export function sinalizarChamada(s: SinalDeChamada): void {
  eu = s.eu;
  const janelaEmFoco = typeof document !== "undefined" && document.hasFocus();
  const entrega = decidirEntregaDeChamada({
    prefs: lerNotificacoes(),
    naoPerturbe: lerMeuStatus().presenca === "dnd",
    agora: new Date(),
    janelaEmFoco,
    silenciado: estaSilenciado(s.channelId),
    amigo: s.amigo,
  });
  if (!entrega) return;

  const antes = lerChamadaRecebida();
  /*
    ⚠ **Autorizado ANTES de aplicar, e não depois.** `aplicarToque` publica
    síncrono, e é o ouvinte de `ligarChamadasRecebidas` que começa o toque —
    anotado depois, ele leria "sem som" e a campainha nunca soaria. Se o
    redutor recusar, a autorização volta ao que era.
  */
  const somAnterior = comSom;
  if (entrega.canais.has("som") && !antes) comSom = s.channelId;
  aplicarToque(
    {
      tipo: "comecou",
      channelId: s.channelId,
      quemLigou: s.quemLigou,
      agora: Date.now(),
      visivel: entrega.canais.has("toast"),
    },
    ctx(),
  );
  const agora = lerChamadaRecebida();
  /* O redutor recusou — duplicata, recusada, ou outra já tocando. Nada de som
     nem de push para uma chamada que não está tocando. */
  if (!agora || agora === antes) {
    comSom = somAnterior;
    return;
  }

  if (entrega.canais.has("push")) {
    notificarNoSistema(agora, s);
    ponteDeNotificacoes()?.chamarAtencao();
  }
}

/** A sala da DM esvaziou — quem ligou desistiu, ou a chamada acabou. */
export function sinalizarFimDeChamada(channelId: string): void {
  aplicarToque({ tipo: "terminou", channelId }, ctx());
}

export function recusarNoStore(): void {
  aplicarToque({ tipo: "recusou", agora: Date.now() }, ctx());
}

export function atenderNoStore(): void {
  aplicarToque({ tipo: "atendeu", agora: Date.now() }, ctx());
}

function notificarNoSistema(c: ChamadaRecebida, s: SinalDeChamada): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  try {
    const n = new Notification(s.quemLigouNome, {
      body: s.grupoNome ? `Chamada de voz em ${s.grupoNome}` : "Chamada de voz…",
      /* Por canal, como a de mensagem: o segundo sinal do protocolo substitui
         em vez de empilhar. */
      tag: `chamada:${c.channelId}`,
      /* O toque é nosso e repete; o do sistema tocaria uma vez por cima. */
      silent: true,
      requireInteraction: true,
    });
    n.onclick = () => {
      /*
        ⚠ **Clicar ABRE a conversa e NÃO atende.** Atender abre o microfone, e
        um clique numa notificação no canto da tela — muitas vezes para
        dispensá-la — não é consentimento para transmitir. O aviso na janela
        está lá esperando a decisão.
      */
      ponteDeNotificacoes()?.focar();
      window.focus();
      abrirConversa(c.channelId);
      n.close();
    };
  } catch {
    /* Contextos sem suporte a construtor — sem notificação. */
  }
}

/**
 * Liga o relógio da chamada recebida: o toque que repete, a expiração e o
 * "já atendeu por outro caminho".
 *
 * Module-level, como `ligarSonsDeVoz`: o que ele assina são stores, e nenhum
 * componente vive o mesmo tanto que a sessão. O aviso na tela pode desmontar
 * (a matriz desliga o toast) e o toque precisa continuar.
 */
export function ligarChamadasRecebidas(): () => void {
  let repetir: ReturnType<typeof setInterval> | undefined;
  let expirar: ReturnType<typeof setTimeout> | undefined;
  let atual: ChamadaRecebida | undefined;

  const parar = () => {
    if (repetir !== undefined) clearInterval(repetir);
    if (expirar !== undefined) clearTimeout(expirar);
    repetir = undefined;
    expirar = undefined;
  };

  const pararToque = assinarChamadaRecebida(() => {
    const proxima = lerChamadaRecebida();
    if (proxima === atual) return;
    parar();
    atual = proxima;
    if (!proxima) {
      comSom = undefined;
      return;
    }
    expirar = setTimeout(
      () => aplicarToque({ tipo: "expirou", agora: Date.now() }, ctx()),
      Math.max(0, proxima.desde + TOQUE_MS - Date.now()),
    );
    if (comSom === proxima.channelId) {
      tocar("toque");
      repetir = setInterval(() => tocar("toque"), CICLO_DO_TOQUE_MS);
    }
  });

  /*
    Entrou na sala que tocava por QUALQUER caminho — o botão de ligar da DM, o
    menu de um membro, a sala na coluna — e o aviso precisa sumir. Sem isto
    ele continuaria tocando com você já dentro, porque o redutor só sabe da
    chamada no instante do sinal.
  */
  const pararChamada = assinarChamada(() => {
    const t = lerChamadaRecebida();
    const c = lerChamada();
    if (t && c.estado !== "fora" && c.channelId === t.channelId) atenderNoStore();
  });

  return () => {
    parar();
    pararToque();
    pararChamada();
  };
}
