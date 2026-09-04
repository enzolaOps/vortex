import { Composer } from "../composer/Composer";
import { MessageList } from "../list/MessageList";
import { PalcoDeVoz } from "../voz/PalcoDeVoz";
import { useNaSala } from "../voz/useSalaDeVoz";

/**
 * O que a coluna de conteúdo mostra num canal: a conversa, ou a sala de voz.
 *
 * ⚠ **Isto existe para o `Cliente` NÃO assinar a chamada.** A escolha depende
 * de dois stores que publicam com a chamada viva — participante entrando,
 * câmera ligando, qualidade de rede mudando —, e lê-los no `Cliente` faria o
 * shell inteiro re-renderizar a cada um deles: rail, coluna de canais, lista
 * de membros e os painéis, todos por causa de alguém que apertou mudo. É a lei
 * nº 1 na forma que ela mais cobra — assinar onde se consome, e não acima.
 *
 * Aqui os assinantes são FOLHAS do shell: quando a chamada publica, quem
 * acorda é a coluna de conteúdo e o composer, que é exatamente quem muda.
 * O predicado em si mora em `voz/useSalaDeVoz`, porque o cartão flutuante
 * precisa da mesma resposta.
 */

export function ConteudoDoCanal({ channelId }: { channelId: string }) {
  /*
    ⚠ **A `key` continua no `MessageList` e não neste componente.** Ela é o que
    faz trocar de canal REMONTAR a lista — o virtualizador guarda cache de
    medição e âncora por instância, e reaproveitá-los entre canais abriria a
    lista nova na rolagem da anterior. Pô-la aqui daria o mesmo efeito hoje e
    deixaria de dar no dia em que este componente ganhasse estado.

    ⚠ **Custo assumido: alternar sala ↔ chat REMONTA a lista.** É o mesmo custo
    de trocar de canal, pago num canal de voz — cujo histórico é curto por
    natureza. Manter as duas montadas custaria a lista medindo enquanto está
    invisível, que é a família de defeito que a assertion de linha em 0px já
    registrou.
  */
  /* Em variável e não dentro do `if`: o hook roda incondicionalmente das duas
     formas, mas a regra do lint lê a POSIÇÃO e não a semântica. */
  const naSala = useNaSala(channelId);
  if (naSala) return <PalcoDeVoz />;
  return <MessageList key={channelId} channelId={channelId} />;
}

/**
 * O composer, ausente enquanto a sala ocupa a coluna.
 *
 * Uma caixa de escrever embaixo de uma grade de participantes prometeria um
 * chat que aquela tela não tem — o chat do canal de voz é o que "Voltar ao
 * chat" abre, com o composer junto, porque lá ele é a conversa de sempre.
 */
export function ComposerDoCanal({ channelId }: { channelId: string }) {
  const naSala = useNaSala(channelId);
  if (naSala) return null;
  return <Composer channelId={channelId} />;
}
