import { createEphemeralStore } from "./ephemeral";

/**
 * O progresso de um upload em andamento, keyed pelo ID LOCAL da mensagem.
 *
 * ⚠ **Store EFÊMERO e separado, e isto é a lei nº 1 — não arrumação.** O
 * `progress` do `XMLHttpRequest` dispara dezenas de vezes por segundo. Se a
 * fração morasse no `MessageSnapshot`, cada quadro republicaria a mensagem, e
 * republicar uma mensagem acorda a linha inteira: corpo, markdown, anexos,
 * reações, avatar. Numa lista virtualizada com a janela cheia isso é o
 * defeito que o briefing chama de "update não-escopado", e ele é invisível em
 * desenvolvimento porque só aparece com arquivo grande e rede lenta.
 *
 * É exatamente a mesma separação de `falando` na sala de voz, e pelo mesmo
 * motivo: quem assina é o CARTÃO de progresso daquela mensagem, e mais nada.
 *
 * O `sendState` continua no store normal. Ele muda três vezes na vida de um
 * envio (`subindo` → `pending` → `sent`), que é frequência de ação humana.
 */
export type ProgressoDeUpload = {
  /** O nome do arquivo, para o cartão não precisar do `File`. */
  readonly nome: string;
  /** De 0 a 1. */
  readonly fracao: number;
  /**
   * `178 KB/s`, ou nada nos primeiros instantes.
   *
   * ⚠ Nada, e não zero: uma taxa medida sobre alguns milissegundos é ruído
   * que salta entre valores absurdos. O design escreve "62% · 178 KB/s"; até
   * haver amostra suficiente o cartão mostra só a porcentagem, em vez de um
   * número que muda de ordem de grandeza a cada quadro.
   */
  readonly taxaTexto: string | undefined;
};

export const progressoDeUpload = createEphemeralStore<ProgressoDeUpload>();

/**
 * Quem cancela.
 *
 * ⚠ **Um `Map` cru, e não um store.** Ninguém RENDERIZA um `AbortController`:
 * a existência do cancelamento já está dita pelo `sendState` da mensagem, que
 * é o que a linha assina. Um store aqui daria um segundo dono do mesmo fato,
 * e os dois poderiam discordar sobre se o envio ainda está em andamento.
 */
const cancelamentos = new Map<string, AbortController>();

export function registrarCancelamento(idLocal: string, c: AbortController): void {
  cancelamentos.set(idLocal, c);
}

/** Cancelar o upload desta mensagem. Sem efeito se ele já acabou. */
export function cancelarUpload(idLocal: string): void {
  cancelamentos.get(idLocal)?.abort();
}

/**
 * Larga o que este envio segurava.
 *
 * Chamado nos TRÊS desfechos — sucesso, falha e cancelamento —, e não só no
 * sucesso: sem isto o mapa e o store efêmero crescem para sempre numa sessão
 * de 8 horas, que é o erro nº 5 do briefing.
 */
export function esquecerUpload(idLocal: string): void {
  cancelamentos.delete(idLocal);
  progressoDeUpload.apagar(idLocal);
}

/**
 * A taxa, suavizada.
 *
 * Média móvel sobre a última meia dúzia de amostras. Sem ela o número pisca
 * entre "4 MB/s" e "60 KB/s" a cada quadro — o valor instantâneo de uma rede
 * real não é legível, e um campo que ninguém consegue ler não vale o espaço.
 */
export function criarMedidorDeTaxa(): (bytes: number) => number | undefined {
  const AMOSTRAS = 6;
  const janela: { t: number; bytes: number }[] = [];

  return (bytes: number) => {
    const agora = performance.now();
    janela.push({ t: agora, bytes });
    if (janela.length > AMOSTRAS) janela.shift();
    const primeiro = janela[0];
    if (primeiro === undefined || janela.length < 2) return undefined;

    const segundos = (agora - primeiro.t) / 1000;
    if (segundos <= 0) return undefined;
    return (bytes - primeiro.bytes) / segundos;
  };
}
