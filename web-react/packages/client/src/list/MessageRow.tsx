import { ArrowBendUpLeft, Copy, PencilSimple, Trash } from "@phosphor-icons/react";
import { memo } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";

import { count } from "../dev/stats";
import { cn } from "../lib/cn";
import { useMessage, usePresence } from "../store/hooks";

const STATUS_CLASS: Record<string, string> = {
  online: "bg-status-online",
  idle: "bg-status-idle",
  dnd: "bg-status-dnd",
  offline: "bg-status-offline",
};

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
 * Divisor de data.
 *
 * Faz parte da MESMA linha virtualizada, não é um item separado da lista.
 * Item próprio significaria que os índices do virtualizador deixam de
 * casar com os índices de mensagem, e o `getItemKey` por ID de entidade —
 * que é o que segura a âncora no prepend — perderia o sentido.
 */
function DivisorDeDia({ rotulo }: { rotulo: string }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-1" role="separator">
      <span className="h-px flex-1 bg-border-subtle" />
      <span className="text-xs text-text-3">{rotulo}</span>
      <span className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

/**
 * Assina APENAS a própria mensagem — inclusive o agrupamento.
 *
 * É aqui que a lei nº 1 se paga: editar, reagir ou resolver um upload toca
 * esta linha e nenhuma outra. A lista acima só conhece IDs.
 *
 * Agrupamento e divisor de data dependem do vizinho, mas chegam prontos no
 * snapshot: a derivação acontece no adapter, na escrita. A linha continua sem
 * saber que existe uma linha antes dela.
 *
 * `memo` NÃO é brigar com o React Compiler. Ele declarou que pula o
 * `MessageList` (`react-hooks/incompatible-library`, por causa do
 * `useVirtualizer`), e sem compilação os filhos são recriados a cada render da
 * lista — medido: 300 renders de lista viraram 7.500 de linha, exatamente 25x.
 * Como `id` é string estável, `memo` corta a cascata. É a fronteira onde a
 * memoização automática parou, não otimização preventiva.
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

  const falhou = message.sendState === "failed";

  return (
    <>
      {message.dia ? <DivisorDeDia rotulo={message.dia} /> : null}

      <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          className={cn(
            "flex gap-3 px-4 data-[state=open]:bg-surface-1",
            // Espaço acima só quando o grupo abre. Linha de continuação cola na
            // anterior — é o que faz a lista parecer conversa em vez de log, e
            // o que devolve altura para caber histórico.
            message.iniciaGrupo ? "pt-3 pb-0.5" : "py-0.5",
            // Envio pendente esmaece a linha inteira; falha marca a borda de
            // início. Nunca só cor: o rótulo ao lado da hora diz o que houve.
            message.sendState === "pending" && "opacity-60",
            falhou && "border-s-2 border-danger",
          )}
        >
          {/* A calha do avatar existe mesmo na continuação: é o que mantém o
              texto alinhado ao longo do grupo inteiro. */}
          <div className="relative mt-1 size-5 shrink-0">
            {message.iniciaGrupo ? (
              <>
                <div className="size-5 rounded-4 bg-surface-3" />
                {/* Presença nunca só por cor: o anel de fundo dá a forma. */}
                <PresenceDot userId={message.authorId ?? ""} />
              </>
            ) : null}
          </div>

          {/* minmax(0,1fr) do lado flex: sem isto uma URL de 400 chars estoura. */}
          <div className="min-w-0 flex-1">
            {message.iniciaGrupo ? (
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
              </div>
            ) : null}

            <p className="text-md leading-message wrap-anywhere text-text-2">
              {message.content}
            </p>

            {/*
              Estado de envio FORA do cabeçalho.

              Ele morava ao lado da hora, e o cabeçalho só existe quando a
              linha abre grupo — então mensagem enviada logo depois da sua
              anterior ficava só com a borda vermelha e nenhum texto. Cor
              sozinha não comunica nada para quem não a distingue, e o caso
              não é raro: é o mais comum que existe, duas mensagens suas
              seguidas.
            */}
            {message.sendState !== "sent" ? (
              <p className={cn("text-xs", falhou ? "text-danger" : "text-text-3")}>
                {falhou ? "não enviada" : "enviando…"}
              </p>
            ) : null}

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
      </ContextMenuTrigger>

      {/* Ícones Phosphor, weight regular, 20px — um set só, sem exceção. */}
      <ContextMenuContent>
        <ContextMenuItem>
          <ArrowBendUpLeft size={20} aria-hidden />
          Responder
        </ContextMenuItem>
        <ContextMenuItem>
          <Copy size={20} aria-hidden />
          Copiar texto
        </ContextMenuItem>
        <ContextMenuItem>
          <PencilSimple size={20} aria-hidden />
          Editar
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem perigo>
          <Trash size={20} aria-hidden />
          Apagar
        </ContextMenuItem>
      </ContextMenuContent>
      </ContextMenu>
    </>
  );
});
