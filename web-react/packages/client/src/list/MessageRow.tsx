import {
  ArrowBendUpLeft,
  Copy,
  Info,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
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
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import type { SistemaSnapshot } from "../sdk/domain";
import { reenviar } from "../sdk/adapter";
import { responderA } from "../store/resposta";
import { useMessage } from "../store/hooks";
import { Citacao } from "./Citacao";
import css from "./MessageRow.module.css";

/**
 * A frase da linha de sistema, montada AQUI e não no snapshot.
 *
 * Guardar a frase pronta no domínio congelaria o idioma no instante em que o
 * evento chegou: quem trocasse de idioma veria o histórico antigo na língua
 * antiga, e o `i18n` não teria onde encostar. O domínio guarda o FATO —
 * `{ tipo: "entrou", userId }` —, a frase é apresentação.
 *
 * `NomeDoAutor` assina o membro por conta própria, então trocar o apelido de
 * alguém atualiza a frase sem a linha inteira re-renderizar.
 */
function FraseDeSistema({ sistema }: { sistema: SistemaSnapshot }) {
  switch (sistema.tipo) {
    case "entrou":
      return (
        <>
          <NomeDoAutor userId={sistema.userId} /> entrou no canal
        </>
      );
    case "saiu":
      return (
        <>
          <NomeDoAutor userId={sistema.userId} /> saiu do canal
        </>
      );
    case "adicionou":
      return (
        <>
          <NomeDoAutor userId={sistema.porId} /> adicionou{" "}
          <NomeDoAutor userId={sistema.userId} />
        </>
      );
    case "removeu":
      return (
        <>
          <NomeDoAutor userId={sistema.porId} /> removeu{" "}
          <NomeDoAutor userId={sistema.userId} />
        </>
      );
    case "renomeou":
      return (
        <>
          <NomeDoAutor userId={sistema.porId} /> renomeou o canal para{" "}
          {sistema.nome}
        </>
      );
    case "texto":
      return <>{sistema.texto}</>;
  }
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
        <div className={cn(css.calha, "mt-1 rounded-4 bg-surface-2")} />
        <div className="min-w-0 flex-1 text-md leading-message">&nbsp;</div>
      </article>
    );
  }

  /*
    Linha de sistema: outro papel, não uma mensagem esmaecida.

    Sem avatar, sem cabeçalho de autor, sem menu de contexto — não há o que
    responder nem o que apagar. Antes desta mudança ela renderizava como fala:
    avatar, nome e conteúdo VAZIO, porque o protocolo põe o texto em `system`
    e não em `content`. Uma linha em branco com foto, que ninguém identificava
    como bug porque parecia mensagem apagada.

    A hora fica: é o dado que faz "entrou" ser útil quando se rola histórico.
  */
  if (message.sistema) {
    return (
      <>
        {message.dia ? <DivisorDeDia rotulo={message.dia} /> : null}
        <article className="flex items-baseline gap-2 px-4 pt-4 text-xs text-text-3">
          <Info size={20} aria-hidden className="shrink-0 self-center" />
          <p className="min-w-0 flex-1 wrap-anywhere">
            <FraseDeSistema sistema={message.sistema} />
          </p>
          <time className="shrink-0">{message.createdAtText}</time>
        </article>
      </>
    );
  }

  const falhou = message.sendState === "failed";

  const linha = (
    <article
          className={cn(
            // Hover na linha, e ele custa ZERO de layout — só cor.
            //
            // Não é preferência: qualquer tratamento de hover que mude a
            // ALTURA da linha destrói a âncora do virtualizador. É por isso
            // que o Discord flutua a barra de ações sobrepondo para cima em
            // vez de reservar espaço, e é a razão técnica por trás do que
            // parecia escolha estética.
            //
            // A auditoria dos oito estados achou a linha de mensagem sem
            // hover NENHUM — a superfície mais usada do app inteiro, sem
            // resposta ao ponteiro.
            "flex gap-3 px-4 hover:bg-surface-1 data-[state=open]:bg-surface-1",
            // O ritmo de agrupamento: 4px dentro do grupo, 16px entre grupos.
            // Três níveis de separação no total (o terceiro é o divisor), cada
            // um pelo menos 2× o anterior — é o que os faz lerem como distintos
            // em rolagem rápida, e é o que faz a lista parecer conversa em vez
            // de log.
            //
            // Só `padding-block-start`, nunca simétrico: com 4px em cima e
            // embaixo o espaço entre duas linhas agrupadas somaria 8px, e o
            // degrau de 4px não existe na escala para ser dividido. O espaço
            // pertence à linha que vem depois — que é também por que o realce
            // de hover/menu cobre esse espaço, e não termina rente ao texto.
            //
            // Aqui estava `pt-3 pb-0.5` / `py-0.5`. A escala do projeto vai de
            // 1 a 6 e o `@theme` faz `--spacing-*: initial`, então
            // `--spacing-0.5` NÃO EXISTE e a utility nunca foi gerada: o ritmo
            // real era 0px dentro do grupo, contra os 4px que este comentário
            // afirmava. Não deu erro nenhum. Agora há lint contra fracionária.
            message.iniciaGrupo ? "pt-4" : "pt-1",
            // Envio pendente esmaece a linha inteira; falha marca a borda de
            // início. Nunca só cor: o rótulo ao lado da hora diz o que houve.
            message.sendState === "pending" && "opacity-60",
            falhou && "border-s-2 border-danger",
          )}
        >
          {/* A calha do avatar existe mesmo na continuação: é o que mantém o
              texto alinhado ao longo do grupo inteiro. */}
          <div className={cn(css.calha, "relative mt-1")}>
            {message.iniciaGrupo ? (
              <>
                <div className={cn(css.calha, "rounded-4 bg-surface-3")} />
                {/* Presença nunca só por cor — a silhueta do ponto muda com
                    o estado. Sem rótulo aqui: o nome já está escrito ao lado,
                    e anunciar presença a cada linha seria ruído no leitor. */}
                <PontoDePresenca userId={message.authorId ?? ""} />
              </>
            ) : null}
          </div>

          {/* minmax(0,1fr) do lado flex: sem isto uma URL de 400 chars estoura. */}
          <div className="min-w-0 flex-1">
            {/* A citação abre a linha, acima do cabeçalho: é o contexto que
                torna a mensagem legível, e lê-la depois do texto seria ler a
                resposta antes da pergunta. Alinhada à coluna de conteúdo e
                não à calha — ela pertence ao que foi escrito, não ao avatar. */}
            {message.respostas.map((alvo) => (
              <Citacao key={alvo} channelId={message.channelId} messageId={alvo} />
            ))}

            {message.iniciaGrupo ? (
              <div className="flex items-baseline gap-2">
                {message.authorId ? (
                  <NomeDoAutor userId={message.authorId} />
                ) : (
                  <span className="text-md font-medium text-text-1">
                    desconhecido
                  </span>
                )}
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
              /*
                Erro diz o que houve E como resolver.

                "não enviada" era só a primeira metade, e a segunda não
                existia no app inteiro: a linha ficava vermelha para sempre.
                O botão é o resto da frase, e fica na mesma linha do rótulo
                para não acrescentar altura — a âncora do virtualizador não
                perdoa hover nem estado que muda a caixa.
              */
              <p
                className={cn(
                  "flex items-center gap-2 text-xs",
                  falhou ? "text-danger" : "text-text-3",
                )}
              >
                {falhou ? "não enviada" : "enviando…"}
                {falhou ? (
                  <button
                    type="button"
                    className="rounded-1 underline underline-offset-2 hover:text-text-1"
                    onClick={() => reenviar(message.id)}
                  >
                    Tentar de novo
                  </button>
                ) : null}
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
  );

  return (
    <>
      {message.dia ? <DivisorDeDia rotulo={message.dia} /> : null}

      {/*
        O menu é montado POR LINHA, e isso é pendência medida, não descuido.

        Um A/B com a mesma `<article>` nos dois lados mostrou o custo: p99 de
        24,9ms para 18,9ms e frames perdidos de 6,0% para 5,4% ao desligá-lo.
        Real, e não é o que reprova o gate. O conserto é menu no nível da
        LISTA, posicionado no ponteiro, com o id da linha alvo no store — e aí
        é um Root para a lista inteira em vez de um por linha montada.
      */}
      <ContextMenu>
          <ContextMenuTrigger asChild>{linha}</ContextMenuTrigger>

          {/* Ícones Phosphor, weight regular, 20px — um set só, sem exceção. */}
          <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => responderA(message.channelId, message.id)}
        >
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
