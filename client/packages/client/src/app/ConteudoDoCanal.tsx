import { Composer } from "../composer/Composer";
import { MessageList } from "../list/MessageList";
import { PalcoDeVoz } from "../voz/PalcoDeVoz";
import { useNaSala } from "../voz/useSalaDeVoz";
import { GaleriaDeMidia } from "../forum/GaleriaDeMidia";
import { TelaDoForum } from "../forum/TelaDoForum";
import { useExigeConfirmacaoDeIdade, useForum, useTopico } from "../store/hooks";
import { RaizDoTopico } from "../topicos/RaizDoTopico";
import { PortaoDeIdade } from "./PortaoDeIdade";

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

    ⚠ **Custo assumido: entrar e sair da sala REMONTA a lista** — a da coluna
    dá lugar à do chat embutido (`ChatDaSala`), que é outra instância. É o
    mesmo custo de trocar de canal, pago num canal de voz, cujo histórico é
    curto por natureza. Manter as duas montadas custaria a lista medindo
    enquanto está invisível, que é a família de defeito que a assertion de
    linha em 0px já registrou.
  */
  /* Em variável e não dentro do `if`: o hook roda incondicionalmente das duas
     formas, mas a regra do lint lê a POSIÇÃO e não a semântica. */
  const naSala = useNaSala(channelId);
  /*
    Fórum e galeria NÃO têm timeline: o canal é a lista de posts, e a conversa
    mora dentro de cada um. O tópico aberto é a timeline de sempre com a
    mensagem-raiz no topo do scroller.
  */
  const forum = useForum(channelId);
  const topico = useTopico(channelId);
  const exigeIdade = useExigeConfirmacaoDeIdade(channelId);
  if (naSala) return <PalcoDeVoz />;
  /*
    Canal +18 pede confirmação ANTES de montar qualquer coisa do canal
    (D-CCANAL-06) — lista, fórum ou galeria. Depois da sala de voz de
    propósito: quem já está dentro da chamada já passou pela porta, e trocar a
    grade pelo aviso no meio dela seria a chamada sumindo.

    ⚠ **A lista NÃO monta atrás do aviso.** Montá-la escondida buscaria o
    histórico e desenharia as mídias que o aviso existe para não mostrar.
  */
  if (exigeIdade) return <PortaoDeIdade channelId={channelId} />;
  if (forum) {
    return forum.midia ? (
      <GaleriaDeMidia key={channelId} channelId={channelId} />
    ) : (
      <TelaDoForum key={channelId} channelId={channelId} />
    );
  }
  return (
    <MessageList
      key={channelId}
      channelId={channelId}
      topo={topico ? <RaizDoTopico channelId={channelId} /> : undefined}
    />
  );
}

/**
 * O composer, ausente enquanto a sala ocupa a coluna.
 *
 * ⚠ **A sala tem o PRÓPRIO composer, dentro do chat embutido** (`ChatDaSala`).
 * Um segundo embaixo da grade daria duas caixas de escrever para o mesmo
 * canal, com o mesmo rascunho — e digitar numa faria o texto aparecer na outra.
 */
export function ComposerDoCanal({ channelId }: { channelId: string }) {
  const naSala = useNaSala(channelId);
  // Num fórum ou galeria não se escreve no canal — escreve-se num post.
  const forum = useForum(channelId);
  // Sem composer atrás do aviso: escrever num canal que você ainda não viu.
  const exigeIdade = useExigeConfirmacaoDeIdade(channelId);
  if (naSala || forum || exigeIdade) return null;
  return <Composer channelId={channelId} />;
}
