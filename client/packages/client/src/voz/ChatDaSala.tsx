import { useSyncExternalStore } from "react";

import { BotaoDeIcone } from "../components/ui/BotaoDeIcone";
import { ChatCircle, ICONE, SpeakerHigh, X } from "../components/ui/icones";
import { Tooltip } from "../components/ui/Tooltip";
import { Composer } from "../composer/Composer";
import { MessageList } from "../list/MessageList";
import { useChannel } from "../store/hooks";
import {
  alternarChatDaSala,
  assinarChatDaSala,
  definirChatDaSala,
  lerChatDaSala,
} from "../store/palcoDeVoz";
import css from "./ChatDaSala.module.css";

/**
 * O chat de texto embutido no canal de voz.
 *
 * ⚠ **Não é uma segunda lista, e é a razão de ele caber aqui sem custo novo.**
 * No Stoat um canal de voz é um `TextChannel` com `voice` — ele SEMPRE teve
 * mensagens. O que faltava era mostrá-las ao lado da sala: aqui estão a MESMA
 * `MessageList` e o MESMO `Composer` da coluna de conteúdo, com a mesma
 * virtualização, o mesmo rascunho por canal e o mesmo menu. Uma lista
 * simplificada "de chat de voz" seria a sexta cópia de alguma coisa que este
 * projeto já pagou para unificar.
 *
 * ⚠ **E só uma lista existe por vez.** Enquanto a sala ocupa a coluna, a
 * `ConteudoDoCanal` não monta a lista de lá; é esta que está montada. Duas
 * instâncias do mesmo canal disputariam foco, âncora e a gaveta de saltos
 * pendentes do permalink.
 *
 * ⚠ **`key` no canal**, pelo mesmo motivo de `ConteudoDoCanal`: trocar de
 * sala remonta a lista, e o virtualizador não reaproveita medição e âncora de
 * outro canal.
 *
 * O que o design desenha e NÃO entrou: entradas e saídas como eventos do
 * sistema no meio da conversa. O Stoat não grava `VoiceChannelJoin` como
 * mensagem, então elas existiriam só para quem estava olhando na hora — e o
 * próprio design diz que o histórico "persiste depois que todos saem".
 */
export function ChatDaSala({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const nome = canal?.name ?? "voz";

  return (
    <aside className={css.chat} aria-label={`Chat de ${nome}`}>
      <header className={css.cabecalho}>
        <SpeakerHigh className={css.glifo} aria-hidden />
        <div className={css.titulos}>
          <span className={css.nome}>{nome}</span>
          <span className={css.subtitulo}>
            chat do canal de voz · visível só para conectados
          </span>
        </div>
        <BotaoDeIcone
          rotulo="Fechar chat"
          icone={<X aria-hidden />}
          tamanho="sm"
          onClick={() => definirChatDaSala(false)}
        />
      </header>

      {/*
        ⚠ **Grid e não bloco, e é load-bearing.** O container de rolagem da
        lista precisa de altura DEFINIDA; sem ela o virtualizador monta todas
        as linhas de uma vez, sem erro nenhum — o defeito já registrado duas
        vezes no briefing. Item de grid estica para a trilha, e a trilha é o
        que sobra entre o cabeçalho e o composer.
      */}
      <div className={css.lista}>
        <MessageList key={channelId} channelId={channelId} />
      </div>

      <footer className={css.rodape}>
        <Composer channelId={channelId} />
        <p className={css.nota}>
          Histórico persiste depois que todos saem.
        </p>
      </footer>
    </aside>
  );
}

/**
 * O botão do cabeçalho da sala que abre e fecha o chat.
 *
 * ⚠ **Era "Voltar ao chat", e fechava a SALA.** Com o chat embutido, trocar a
 * sala inteira pela conversa deixou de ser o gesto: a conversa já está ao
 * lado. O botão agora alterna o painel, com o estado no `aria-pressed` e o
 * RECURSO no rótulo ("Chat do canal") — a regra do lint deste projeto para
 * controle que liga e desliga.
 *
 * Componente próprio porque as duas telas que o têm (grade e prancha) desenham
 * o cabeçalho cada uma, e assinar o store aqui evita que elas acordem ao abrir
 * o chat. A classe vem de quem chama: o alvo é do cabeçalho de cada uma.
 */
export function BotaoDoChatDaSala({ className }: { className?: string }) {
  const aberto = useSyncExternalStore(assinarChatDaSala, lerChatDaSala);
  return (
    <Tooltip texto={aberto ? "Fechar chat" : "Abrir chat"} lado="abaixo">
      <button
        type="button"
        className={className}
        aria-label="Chat do canal"
        aria-pressed={aberto}
        onClick={alternarChatDaSala}
      >
        <ChatCircle size={ICONE.controle} aria-hidden />
      </button>
    </Tooltip>
  );
}
