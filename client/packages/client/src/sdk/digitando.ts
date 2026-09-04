/**
 * Notificação de digitação — o lado de SAÍDA do estado efêmero.
 *
 * O store efêmero cuida do que CHEGA (quem está digitando, com throttle na
 * fronteira). Isto cuida do que SAI, e o problema é o mesmo invertido: uma
 * tecla é um evento, e mandar um evento de rede por tecla significa ~7
 * pacotes por segundo por pessoa digitando. Num servidor movimentado isso é
 * ordens de grandeza mais tráfego do que as mensagens em si.
 *
 * Duas janelas, e as duas importam:
 *
 *   intervalo → no máximo um "começou" a cada N; a rajada de teclas vira um sinal
 *   silêncio  → parou de teclar e não avisou nada? manda "parou" sozinho
 *
 * Sem a segunda, quem fecha a aba no meio de uma frase fica digitando para
 * sempre na tela dos outros. É o bug de typing indicator que todo mundo já viu.
 *
 * Lógica pura, com o transporte injetado: dá para testar as duas janelas com
 * relógio falso, sem socket e sem SDK.
 */

export const INTERVALO_DE_DIGITACAO_MS = 3_000;
export const SILENCIO_ATE_PARAR_MS = 6_000;

export type NotificadorDeDigitacao = {
  /** Chamado a cada alteração do rascunho. Barato de propósito. */
  aoDigitar(channelId: string): void;
  /** Enviou, apagou tudo ou saiu do campo: para AGORA, sem esperar silêncio. */
  aoParar(channelId: string): void;
};

type Estado = {
  /** 0 = não estamos anunciados como digitando naquele canal. */
  ultimoInicio: number;
  timer: ReturnType<typeof setTimeout> | undefined;
};

export function criarNotificadorDeDigitacao(opcoes: {
  iniciar: (channelId: string) => void;
  parar: (channelId: string) => void;
  intervaloMs?: number;
  silencioMs?: number;
  agora?: () => number;
}): NotificadorDeDigitacao {
  const intervaloMs = opcoes.intervaloMs ?? INTERVALO_DE_DIGITACAO_MS;
  const silencioMs = opcoes.silencioMs ?? SILENCIO_ATE_PARAR_MS;
  const agora = opcoes.agora ?? (() => Date.now());

  const estados = new Map<string, Estado>();

  function estadoDe(channelId: string): Estado {
    let estado = estados.get(channelId);
    if (!estado) {
      estado = { ultimoInicio: 0, timer: undefined };
      estados.set(channelId, estado);
    }
    return estado;
  }

  function pararAgora(channelId: string, estado: Estado) {
    clearTimeout(estado.timer);
    estado.timer = undefined;
    if (estado.ultimoInicio === 0) return;
    estado.ultimoInicio = 0;
    opcoes.parar(channelId);
  }

  return {
    aoDigitar(channelId) {
      const estado = estadoDe(channelId);
      const t = agora();

      if (t - estado.ultimoInicio >= intervaloMs) {
        estado.ultimoInicio = t;
        opcoes.iniciar(channelId);
      }

      // O relógio do silêncio reinicia a cada tecla: o que interessa é o tempo
      // desde a ÚLTIMA, não desde o começo da frase.
      clearTimeout(estado.timer);
      estado.timer = setTimeout(() => pararAgora(channelId, estado), silencioMs);
    },

    aoParar(channelId) {
      pararAgora(channelId, estadoDe(channelId));
    },
  };
}
