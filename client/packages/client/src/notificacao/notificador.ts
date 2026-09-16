import { toast } from "../components/ui/toastStore";
import { ARNES_ATIVO } from "../dev/arnesAtivo";
import { tocar } from "../som/sons";
import { lerMeuStatus } from "../store/meuStatus";
import { abrirConversa, irPara } from "../store/navegacao";
import { lerNotificacoes } from "../store/notificacoes";
import {
  estaSilenciado,
  nivelEfetivo,
  opcoesDoServidor,
  servidorSilenciado,
} from "../store/silencio";
import {
  decidirEntrega,
  decidirEntregaDeEvento,
  textoDaNotificacao,
  textoDeAmizade,
  type MensagemRecebida,
  type MudancaDeAmizade,
} from "./decidir";

/**
 * O notificador: recebe a mensagem que chegou e entrega por toast, som ou
 * notificação do sistema, conforme `decidirEntrega`.
 *
 * ⚠ **Notificação do sistema pela API `Notification` da web**, e não por um
 * verbo da casca. No Electron ela já vira a notificação nativa do sistema
 * operacional; um caminho próprio seria o segundo jeito de fazer a mesma
 * coisa. A casca só entra no que a web não tem: o contador no ícone e o
 * piscar da barra de tarefas (ver `ponteDeNotificacoes`).
 */

/** A ponte da casca para o que a web não alcança. Separada, pela versão. */
export type PonteDeNotificacoes = {
  readonly contador: (n: number) => void;
  readonly chamarAtencao: () => void;
  readonly focar: () => void;
};

declare global {
  interface Window {
    readonly vortexNotificacoes?: PonteDeNotificacoes;
  }
}

export function ponteDeNotificacoes(): PonteDeNotificacoes | undefined {
  if (typeof window === "undefined") return undefined;
  const p = window.vortexNotificacoes as Record<string, unknown> | undefined;
  if (!p) return undefined;
  return ["contador", "chamarAtencao", "focar"].every((v) => typeof p[v] === "function")
    ? window.vortexNotificacoes
    : undefined;
}

let canalVisto: string | undefined;

/**
 * Quem mais quer ver a mensagem que foi notificada com a janela atrás — o
 * overlay do jogo. Gancho, e não import: o overlay lê stores do adapter, e o
 * adapter chama este módulo; importar de volta fecharia um ciclo.
 */
let espelho: ((m: MensagemRecebida, titulo: string, corpo: string) => void) | undefined;

export function definirEspelhoDeMensagem(
  fn: ((m: MensagemRecebida, titulo: string, corpo: string) => void) | undefined,
): void {
  espelho = fn;
}

/** A navegação avisa qual canal está na tela — o adapter já sabe e empurra. */
export function definirCanalVisto(channelId: string | undefined): void {
  canalVisto = channelId;
}

function abrir(m: MensagemRecebida): void {
  ponteDeNotificacoes()?.focar();
  if (typeof window !== "undefined") window.focus();
  if (m.serverId) irPara(m.serverId, m.channelId);
  else abrirConversa(m.channelId);
}

/** Uma notificação do sistema, quando o navegador ou a casca permitem. */
function notificarNoSistema(m: MensagemRecebida, titulo: string, corpo: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  try {
    const n = new Notification(titulo, {
      body: corpo,
      /* Por canal: dez mensagens seguidas no mesmo canal substituem a anterior
         em vez de empilhar dez avisos no canto da tela. */
      tag: m.channelId,
      /* O som é nosso (canal "som" da matriz) — o do sistema tocaria junto. */
      silent: true,
    });
    n.onclick = () => {
      abrir(m);
      n.close();
    };
  } catch {
    /* Contextos sem suporte a construtor (alguns Android) — sem notificação. */
  }
}

export function notificarMensagem(m: MensagemRecebida): void {
  if (ARNES_ATIVO) return;
  const prefs = lerNotificacoes();
  const janelaEmFoco = typeof document !== "undefined" && document.hasFocus();
  const opcoes = m.serverId ? opcoesDoServidor(m.serverId) : undefined;
  const entrega = decidirEntrega(m, {
    prefs,
    nivel: nivelEfetivo(m.channelId, m.serverId),
    silenciado: estaSilenciado(m.channelId),
    servidorSilenciado: m.serverId ? servidorSilenciado(m.serverId) : false,
    suprimirTodos: opcoes?.suprimirTodos ?? false,
    suprimirCargos: opcoes?.suprimirCargos ?? false,
    naoPerturbe: lerMeuStatus().presenca === "dnd",
    agora: new Date(),
    janelaEmFoco,
    vendoCanal: canalVisto === m.channelId,
  });
  if (!entrega) return;

  const { titulo, corpo } = textoDaNotificacao(m, prefs.previa);
  if (entrega.canais.has("som")) tocar("mensagem");
  if (entrega.canais.has("toast")) {
    toast({
      tipo: "info",
      titulo,
      descricao: corpo,
      acao: {
        rotulo: "Abrir",
        descricaoAlternativa: `Abrir a conversa de ${m.autorNome}`,
        aoAtivar: () => abrir(m),
      },
    });
  }
  if (entrega.canais.has("push")) {
    notificarNoSistema(m, titulo, corpo);
    espelho?.(m, titulo, corpo);
    /* Menção e DM com a janela atrás: a barra de tarefas pisca até olharem. */
    if (entrega.evento !== "mensagem") ponteDeNotificacoes()?.chamarAtencao();
  }
}

/** Uma mudança de relação, já traduzida pelo adapter. */
export type AmizadeRecebida = {
  readonly userId: string;
  readonly nome: string;
  readonly mudanca: MudancaDeAmizade;
};

/**
 * Pedido de amizade e aceite — o evento "amizade" da matriz.
 *
 * ⚠ **Aceitar e recusar moram no próprio toast**, como no design: um pedido
 * que só diz "chegou" obriga a abrir a tela de pessoas para responder, e o
 * aviso existe justamente para poupar esse caminho. As duas ações chegam por
 * parâmetro e não por import de `sdk/social`, pela mesma razão do espelho: o
 * adapter chama este módulo.
 */
export function notificarAmizade(
  a: AmizadeRecebida,
  responder: { aceitar: () => void; recusar: () => void },
): void {
  if (ARNES_ATIVO) return;
  const prefs = lerNotificacoes();
  const janelaEmFoco = typeof document !== "undefined" && document.hasFocus();
  const entrega = decidirEntregaDeEvento("amizade", {
    prefs,
    naoPerturbe: lerMeuStatus().presenca === "dnd",
    agora: new Date(),
    janelaEmFoco,
  });
  if (!entrega) return;

  const { titulo, corpo } = textoDeAmizade(a.mudanca, a.nome);
  if (entrega.canais.has("som")) tocar("mensagem");
  if (entrega.canais.has("toast")) {
    toast({
      tipo: "info",
      titulo,
      descricao: corpo,
      ...(a.mudanca === "pedido"
        ? {
            acao: {
              rotulo: "Aceitar",
              descricaoAlternativa: `Aceite o pedido de ${a.nome} na tela de pessoas, aba Pedidos`,
              aoAtivar: responder.aceitar,
            },
            acaoSecundaria: {
              rotulo: "Recusar",
              descricaoAlternativa: `Recuse o pedido de ${a.nome} na tela de pessoas, aba Pedidos`,
              aoAtivar: responder.recusar,
            },
          }
        : {}),
    });
  }
  if (entrega.canais.has("push") && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const n = new Notification(titulo, { body: corpo, tag: `amizade:${a.userId}`, silent: true });
      n.onclick = () => {
        ponteDeNotificacoes()?.focar();
        if (typeof window !== "undefined") window.focus();
        n.close();
      };
    } catch {
      /* Contexto sem construtor — sem notificação. */
    }
  }
}

/**
 * O contador de menções no ícone do app.
 *
 * "Só de menções, nunca de mensagens comuns" — é o que a tela promete. Na web,
 * `navigator.setAppBadge` só tem efeito em app instalado (PWA); na casca, o
 * main desenha no ícone da barra de tarefas.
 */
export function atualizarContador(mencoes: number): void {
  const n = lerNotificacoes().badge ? mencoes : 0;
  const casca = ponteDeNotificacoes();
  if (casca) {
    casca.contador(n);
    return;
  }
  const nav = typeof navigator === "undefined"
    ? undefined
    : (navigator as { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> });
  if (!nav?.setAppBadge) return;
  void (n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge?.())?.catch(() => undefined);
}
