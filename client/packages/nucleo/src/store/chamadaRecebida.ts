/**
 * A chamada que está TOCANDO — alguém ligou numa DM ou num grupo, e você
 * ainda não entrou.
 *
 * ⚠ **Store próprio, e não um campo de `Chamada`.** `Chamada` é a SUA sala:
 * quem assina é o cartão flutuante, a faixa do rodapé, o painel de usuário e a
 * linha do canal. Tocar é um fato sobre OUTRA pessoa querendo falar com você,
 * e pode acontecer enquanto você está numa chamada diferente — misturar os
 * dois faria "alguém ligou" acordar a doca da sala em que você já está. É a
 * mesma separação que tirou `palco` e `falando` de `Chamada`.
 *
 * ⚠ **Como o protocolo sinaliza, e a resposta é DUAS fontes.** O serviço
 * `voice-ingress`, quando a PRIMEIRA pessoa entra na sala de uma DM ou grupo,
 * publica `VoiceCallUpdate { initiator_id, channel_id, ended: false }` em
 * privado para cada destinatário, e `ended: true` no canal quando a sala
 * esvazia. O `stoat.js` não trata esse evento (não há `case` para ele), então
 * ele chega só pelo evento CRU. A segunda fonte é o `VoiceChannelJoin` de
 * alguém numa sala de DM que estava vazia — ele chega ANTES do
 * `VoiceCallUpdate`, porque o serviço consulta os participantes do LiveKit
 * entre um e outro. As duas desembocam em `comecou`, e a deduplicação por
 * canal é o que as torna uma só.
 *
 * ⚠ **O servidor NÃO manda "parou de tocar".** `ended` descreve a sala
 * esvaziando, e quem ligou pode ficar esperando sozinho para sempre. Por isso
 * o toque EXPIRA do lado de cá (`TOQUE_MS`) — sem isso, sair para almoçar com
 * uma ligação não atendida deixaria o aviso na tela até alguém desligar do
 * outro lado.
 *
 * A lógica é uma função PURA (`proximoToque`), e o store só a aplica: é o que
 * permite testar as oito regras sem relógio nem SDK.
 */

/** Quanto tempo uma chamada toca antes de desistir sozinha. */
export const TOQUE_MS = 30_000;

export type ChamadaRecebida = {
  /** O canal da DM ou do grupo — é nele que "atender" entra. */
  readonly channelId: string;
  /** Quem começou a chamada. */
  readonly quemLigou: string;
  /** Quando começou a tocar do lado de cá, em epoch ms. */
  readonly desde: number;
  /**
   * Mostrar o aviso na tela.
   *
   * ⚠ **Separado de "está tocando"**, porque a matriz de notificações pode
   * desligar o toast e manter o som ou o push. A chamada continua existindo —
   * atender pela notificação do sistema precisa dela — e só o desenho some.
   */
  readonly visivel: boolean;
};

export type EstadoDoToque = {
  readonly tocando: ChamadaRecebida | undefined;
  /**
   * Canais que NÃO podem voltar a tocar por enquanto, com o instante até o
   * qual valem.
   *
   * ⚠ **Existe por causa das duas fontes.** O `VoiceChannelJoin` chega
   * primeiro e o `VoiceCallUpdate` depois; quem recusa entre os dois veria a
   * chamada recusada tocar DE NOVO meio segundo depois. Recusar e atender
   * anotam o canal aqui até o fim da janela de toque, e a sala esvaziar
   * (`terminou`) solta antes.
   */
  readonly ignorados: ReadonlyMap<string, number>;
};

export type EventoDeToque =
  | {
      readonly tipo: "comecou";
      readonly channelId: string;
      readonly quemLigou: string;
      readonly agora: number;
      readonly visivel: boolean;
    }
  | { readonly tipo: "terminou"; readonly channelId: string }
  | { readonly tipo: "expirou"; readonly agora: number }
  | { readonly tipo: "recusou"; readonly agora: number }
  | { readonly tipo: "atendeu"; readonly agora: number };

/** O que o redutor precisa saber do resto do app — e só isto. */
export type ContextoDoToque = {
  /** Você. `undefined` antes da sessão, e aí nada toca. */
  readonly eu: string | undefined;
  /** O canal da chamada em que você está, ou vazio fora de chamada. */
  readonly canalDaChamada: string;
};

export const SEM_TOQUE: EstadoDoToque = {
  tocando: undefined,
  ignorados: new Map(),
};

function ignorar(
  ignorados: ReadonlyMap<string, number>,
  channelId: string,
  ate: number,
): ReadonlyMap<string, number> {
  const novo = new Map(ignorados);
  novo.set(channelId, ate);
  return novo;
}

/**
 * O próximo estado. Devolve a MESMA referência quando nada muda, que é o que
 * deixa o store não publicar à toa — a armadilha nº 1 do briefing no lado da
 * escrita.
 */
export function proximoToque(
  atual: EstadoDoToque,
  evento: EventoDeToque,
  ctx: ContextoDoToque,
): EstadoDoToque {
  switch (evento.tipo) {
    case "comecou": {
      /* A sua própria ligação chega de volta para você: o serviço publica
         para os destinatários, mas o `VoiceChannelJoin` vai para o canal. */
      if (ctx.eu === undefined || evento.quemLigou === ctx.eu) return atual;
      /* Já está nessa sala — entrou antes do sinal chegar, ou atendeu por
         outro caminho. */
      if (ctx.canalDaChamada === evento.channelId) return atual;
      const ate = atual.ignorados.get(evento.channelId);
      if (ate !== undefined && evento.agora < ate) return atual;
      /*
        ⚠ **Uma chamada tocando por vez, e a PRIMEIRA fica.** A segunda
        ligação trocando o aviso debaixo do ponteiro faria "Atender" entrar
        numa conversa diferente da que a pessoa leu. Ela não se perde: a sala
        da DM mostra quem está dentro, e quando a primeira terminar a segunda
        pode ser atendida por lá.
      */
      if (atual.tocando) return atual;
      return {
        ...atual,
        tocando: {
          channelId: evento.channelId,
          quemLigou: evento.quemLigou,
          desde: evento.agora,
          visivel: evento.visivel,
        },
      };
    }

    case "terminou": {
      const soltou = atual.ignorados.has(evento.channelId);
      const parou = atual.tocando?.channelId === evento.channelId;
      if (!soltou && !parou) return atual;
      const ignorados = new Map(atual.ignorados);
      ignorados.delete(evento.channelId);
      return { tocando: parou ? undefined : atual.tocando, ignorados };
    }

    case "expirou": {
      const t = atual.tocando;
      if (!t || evento.agora < t.desde + TOQUE_MS) return atual;
      /* Expirar também ignora: o `VoiceCallUpdate` de uma sala que continua
         cheia não pode reacender o que já desistiu. */
      return {
        tocando: undefined,
        ignorados: ignorar(atual.ignorados, t.channelId, t.desde + TOQUE_MS),
      };
    }

    case "recusou":
    case "atendeu": {
      const t = atual.tocando;
      if (!t) return atual;
      return {
        tocando: undefined,
        ignorados: ignorar(atual.ignorados, t.channelId, evento.agora + TOQUE_MS),
      };
    }
  }
}

/* ============================================================
   O store
   ============================================================ */

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

let estado: EstadoDoToque = SEM_TOQUE;

export function assinarChamadaRecebida(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Referência cacheada — o snapshot só troca quando o redutor troca. */
export function lerChamadaRecebida(): ChamadaRecebida | undefined {
  return estado.tocando;
}

export function aplicarToque(evento: EventoDeToque, ctx: ContextoDoToque): void {
  const proximo = proximoToque(estado, evento, ctx);
  if (proximo === estado) return;
  const mudouQuemToca = proximo.tocando !== estado.tocando;
  estado = proximo;
  if (!mudouQuemToca) return;
  for (const o of ouvintes) o();
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparChamadaRecebida(): void {
  estado = SEM_TOQUE;
}
