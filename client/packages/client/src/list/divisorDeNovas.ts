/**
 * O rótulo do divisor de não lidas — D-CANAIS-22.
 *
 * Num tópico o que chega são RESPOSTAS a uma mensagem-raiz, e o design escreve
 * "NOVAS RESPOSTAS" ali; no canal, "novas mensagens". A caixa alta é do CSS
 * (`sobrancelhaDeSecao`), então o texto fica em minúsculas como o do canal.
 */
export function rotuloDoDivisorDeNovas(ehTopico: boolean): string {
  return ehTopico ? "novas respostas" : "novas mensagens";
}
