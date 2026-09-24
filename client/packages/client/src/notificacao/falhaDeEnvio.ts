import { toast } from "../components/ui/toastStore";

/**
 * O toast de erro da falha de envio (D-NOTIF-24): △ "Falha ao enviar
 * mensagem · #produto · sem conexão", com a ação "Tentar".
 *
 * ⚠ **A decisão anterior era não avisar, e ela tinha razão num ponto que
 * continua valendo:** a falha já está na LINHA, com o texto e o "tentar de
 * novo", e um toast por mensagem transformaria uma queda de rede numa pilha
 * de avisos sobre o mesmo fato. O design pede o toast, e três coisas o tornam
 * compatível com aquela razão:
 *
 * 1. **Um por canal, contado.** O texto é o mesmo para toda falha do mesmo
 *    canal, e a pilha junta aviso idêntico em "2×" em vez de empilhar.
 * 2. **"Tentar" reenvia TODAS as falhadas do canal**, não a primeira — o toast
 *    contado fala de todas, e a ação tem de cumprir o que ele diz.
 * 3. **Expira, ao contrário do erro comum.** A saída mora na linha, não aqui:
 *    um toast de falha que não some ficaria dizendo "falhou" depois que a
 *    pessoa já reenviou pela linha.
 *
 * O toast é o que faltava para quem NÃO está olhando o canal — mandou e
 * trocou de conversa antes de o servidor responder.
 */
export function textoDaFalhaDeEnvio(
  onde: string,
  conectado: boolean,
): { titulo: string; descricao: string } {
  return {
    titulo: "Falha ao enviar mensagem",
    descricao: `${onde} · ${conectado ? "o servidor não aceitou" : "sem conexão"}`,
  };
}

export function avisarFalhaDeEnvio(
  onde: string,
  conectado: boolean,
  tentar: () => void,
): void {
  toast({
    tipo: "erro",
    ...textoDaFalhaDeEnvio(onde, conectado),
    icone: "alerta",
    expira: true,
    acao: {
      rotulo: "Tentar",
      descricaoAlternativa:
        "A mensagem continua na conversa, com a opção de tentar de novo ao lado",
      aoAtivar: tentar,
    },
  });
}
