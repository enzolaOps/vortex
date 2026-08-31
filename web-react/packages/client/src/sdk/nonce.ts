/**
 * A reconciliação por nonce.
 *
 * **É a peça que o briefing chama de capaz de arruinar a decisão do port**, e a
 * razão é geométrica, não filosófica.
 *
 * O `Channel.sendMessage` do SDK é round-trip completo: POST, o servidor
 * atribui o `_id`, e a mensagem só se materializa quando a resposta volta. Para
 * a linha aparecer no instante em que a pessoa aperta Enter, o app cria uma
 * mensagem com ID LOCAL. Depois o servidor devolve a mesma mensagem com ID
 * DELE.
 *
 * Numa lista virtualizada com `getItemKey` por ID de entidade, isso é a chave
 * da linha mudando debaixo do virtualizador — e o virtualizador responde a uma
 * chave nova desmontando a linha e montando outra. O que a pessoa vê é a
 * própria mensagem piscando, e num histórico longo a âncora vai junto.
 *
 * O nonce é como o protocolo resolve isso: quem envia escolhe um identificador,
 * o servidor o devolve, e as duas pontas sabem que falam da mesma mensagem sem
 * precisar do ID. Este módulo é só o mapa entre os dois lados, isolado para ser
 * testável sem SDK e sem rede — que é o único jeito de exercitar hoje o caminho
 * que só a fase 6 vai rodar de verdade.
 *
 * O que ele NÃO faz é decidir o que acontece com a lista. Isso é do adapter,
 * que é quem sabe publicar.
 */

/**
 * O nonce de uma mensagem otimista, e o caminho de volta.
 *
 * Dois sentidos porque as duas perguntas acontecem: "chegou resposta para este
 * nonce, qual era o ID local?" no caminho de rede, e "esta mensagem local já
 * foi confirmada?" no de reenvio.
 */
type Pendente = {
  readonly nonce: string;
  readonly idLocal: string;
  readonly channelId: string;
};

const porNonce = new Map<string, Pendente>();
const porIdLocal = new Map<string, Pendente>();

/**
 * Registra uma mensagem otimista à espera de confirmação.
 *
 * O nonce vem de fora e não é gerado aqui: quem envia precisa dele ANTES, para
 * pôr no corpo do POST, e uma função que devolvesse o nonce depois obrigaria a
 * duas chamadas onde uma basta.
 */
export function aguardar(nonce: string, idLocal: string, channelId: string): void {
  const p: Pendente = { nonce, idLocal, channelId };
  porNonce.set(nonce, p);
  porIdLocal.set(idLocal, p);
}

/**
 * Chegou a mensagem do servidor. Qual era a otimista?
 *
 * `undefined` para mensagem de outra pessoa, ou para a minha depois de já
 * reconciliada — e os dois casos são normais, não erros. O servidor reenvia o
 * evento em reconexão, e tratar a segunda vez como problema encheria o console
 * de ruído no exato momento em que ele precisa estar legível.
 */
export function reconciliar(
  nonce: string | undefined,
  /**
   * O ID da mensagem que chegou.
   *
   * Existe por causa de um caso que só apareceu no teste: a mensagem OTIMISTA
   * também carrega o nonce — ela precisa, é o que vai no POST — e ela também
   * dispara o evento de criação. Sem este parâmetro ela reconciliava consigo
   * mesma, era tratada como confirmação, e a linha nunca entrava na lista: a
   * pessoa apertava Enter e nada aparecia.
   *
   * Comparar os IDs responde a pergunta certa — "isto veio de fora?" — sem
   * depender da ordem em que as coisas acontecem, que é o tipo de premissa
   * que a rede quebra.
   */
  idQueChegou: string,
): Pendente | undefined {
  if (nonce === undefined) return undefined;
  const p = porNonce.get(nonce);
  if (!p || p.idLocal === idQueChegou) return undefined;

  porNonce.delete(nonce);
  porIdLocal.delete(p.idLocal);
  return p;
}

/** Esta mensagem local ainda espera confirmação? */
export function aguardando(idLocal: string): boolean {
  return porIdLocal.has(idLocal);
}

/**
 * Desiste de esperar — falha definitiva, ou o canal saiu de cena.
 *
 * Sem isto o mapa cresce para sempre numa sessão de 8h com rede instável, que
 * é o erro nº 5 do briefing: vazamento que só aparece na sexta hora.
 */
export function desistir(idLocal: string): void {
  const p = porIdLocal.get(idLocal);
  if (!p) return;
  porIdLocal.delete(idLocal);
  porNonce.delete(p.nonce);
}

/** Quantas esperam. Só para assertion e teste — nunca para decidir UI. */
export function pendentes(): number {
  return porIdLocal.size;
}

/** Estado limpo entre testes. O mapa é module-level e sobrevive. */
export function limparPendentes(): void {
  porNonce.clear();
  porIdLocal.clear();
}
