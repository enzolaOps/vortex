import { memo } from "react";

import { count } from "../dev/stats";
import { useMessage, usePresence } from "../store/hooks";

const STATUS_CLASS: Record<string, string> = {
  online: "bg-status-online",
  idle: "bg-status-idle",
  dnd: "bg-status-dnd",
  offline: "bg-status-offline",
};

/**
 * Assina APENAS a própria mensagem.
 *
 * É aqui que a lei nº 1 se paga: editar uma mensagem, somar uma reaction ou
 * resolver um upload toca esta linha e nenhuma outra. A lista acima só conhece
 * IDs e não re-renderiza por causa disto.
 */
/**
 * O ponto de presença assina sozinho.
 *
 * Assinar presença dentro do MessageRow fazia uma rajada de presença
 * re-renderizar a linha INTEIRA — texto, reações, timestamp — para mudar um
 * ponto de 8px. Era o maior custo do firehose: 265 renders de linha por
 * segundo, quase todos por causa disto.
 *
 * É a regra de granularidade da lei nº 1 aplicada um nível abaixo: quem assina
 * é quem muda. A linha volta a re-renderizar só quando a MENSAGEM muda.
 */
function PresenceDot({ userId }: { userId: string }) {
  const status = usePresence(userId);
  count("presenceRenders");

  return (
    <span
      className={`absolute -end-1 -bottom-1 size-2 rounded-4 ring-2 ring-surface-0 ${
        STATUS_CLASS[status] ?? "bg-status-offline"
      }`}
    />
  );
}

/**
 * `memo` aqui NÃO é brigar com o React Compiler.
 *
 * O compiler declarou explicitamente que pula o `MessageList`
 * (`react-hooks/incompatible-library`, por causa do `useVirtualizer`). Sem
 * compilação, os elementos filhos são recriados a cada render da lista e as
 * ~25 linhas visíveis re-renderizam junto — medido: 300 renders de lista
 * viraram 7.500 de linha, exatamente 25x.
 *
 * Como `id` é string estável, `memo` corta a cascata e a linha volta a
 * re-renderizar só quando a própria mensagem muda. É a fronteira onde a
 * memoização automática parou, não uma otimização preventiva.
 */
export const MessageRow = memo(function MessageRow({ id }: { id: string }) {
  const message = useMessage(id);
  count("rowRenders");

  // Linha ainda não resolvida NUNCA devolve `null`.
  //
  // Numa lista virtualizada, `null` mede zero: o total encolhe, a janela
  // visível muda, outras linhas montam sem snapshot, e o ciclo se realimenta
  // até "Maximum update depth exceeded". O snapshot está estável o tempo todo
  // — o loop é entre a latência do store e a medição do virtualizador.
  //
  // Placeholder com a MESMA altura mínima de uma linha real mantém a medição
  // honesta enquanto o dado não chega.
  if (!message) {
    return (
      <article aria-hidden className="flex gap-3 px-4 py-2">
        <div className="mt-1 size-5 shrink-0 rounded-4 bg-surface-2" />
        <div className="min-w-0 flex-1 text-md leading-message">&nbsp;</div>
      </article>
    );
  }

  return (
    <article className="flex gap-3 px-4 py-2">
      <div className="relative mt-1 size-5 shrink-0">
        <div className="size-5 rounded-4 bg-surface-3" />
        {/* Presença nunca só por cor: o anel de fundo dá a forma. */}
        <PresenceDot userId={message.authorId ?? ""} />
      </div>

      {/* minmax(0,1fr) do lado flex: sem isto uma URL de 400 chars estoura. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-md font-medium text-text-1">
            {message.authorId ?? "desconhecido"}
          </span>
          <time className="text-xs text-text-3">
            {message.createdAtText}
          </time>
          {message.editedAt ? (
            <span className="text-xs text-text-3">(editada)</span>
          ) : null}
          {message.sendState !== "sent" ? (
            <span className="text-xs text-warning">{message.sendState}</span>
          ) : null}
        </div>

        <p className="text-md leading-message wrap-anywhere text-text-2">
          {message.content}
        </p>

        {message.reactions.size > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {[...message.reactions].map(([emoji, count]) => (
              <span
                key={emoji}
                className="rounded-2 bg-surface-2 px-2 text-xs text-text-2"
              >
                {emoji} {count}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
});
