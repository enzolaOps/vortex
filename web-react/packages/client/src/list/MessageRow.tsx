import {
  ArrowBendUpLeft,
  Copy,
  Info,
  PushPin,
  PushPinSlash,
} from "@phosphor-icons/react";
import { memo, useSyncExternalStore } from "react";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/ContextMenu";

import { count } from "../dev/stats";
import { copiarTexto } from "../lib/copiar";
import { rotuloDeReacao } from "../lib/plural";
import { cn } from "../lib/cn";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import type { SistemaSnapshot } from "../sdk/domain";
import { reenviar } from "../sdk/adapter";
import { alternarFixada, alternarReacao } from "../sdk/adapter";
import {
  assinarMenuDeMensagem,
  definirAlvoDoMenu,
  lerAlvoDoMenu,
} from "../store/menuDeMensagem";
import { pode } from "../sdk/permissoes";
import { responderA } from "../store/resposta";
import { useMessage } from "../store/hooks";
import { Citacao } from "./Citacao";
import { TextoDaMensagem } from "./TextoDaMensagem";
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
/**
 * As seis do conjunto rápido.
 *
 * Escolhidas por FUNÇÃO, não por gosto: concordar, celebrar, discordar, achar
 * graça, registrar que leu, e marcar o que precisa de atenção. Uma lista de
 * favoritos pessoais entraria como preferência do usuário, não como default do
 * produto.
 */
const REACOES_RAPIDAS = ["👍", "🎉", "👎", "😄", "👀", "🔥"] as const;

/**
 * As três da barra de hover — um subconjunto, não uma segunda lista.
 *
 * A barra flutua sobre a linha e cada alvo a mais é largura que ela rouba do
 * texto por baixo. Três é o que cabe sem cobrir palavra, e são as três de
 * função mais comum: concordar, celebrar, achar graça. O conjunto inteiro
 * continua a um clique direito de distância.
 *
 * Derivado do array acima em vez de escrito de novo: duas listas de emoji que
 * precisam concordar acabam divergindo, e a que diverge é sempre a menor.
 */
const REACOES_DA_BARRA = [
  REACOES_RAPIDAS[0],
  REACOES_RAPIDAS[1],
  REACOES_RAPIDAS[3],
] as const;

/**
 * "Novas mensagens" — onde a leitura parou.
 *
 * Diferente do divisor de data em tudo o que importa: ele é sobre O QUE
 * aconteceu, este é sobre VOCÊ. Por isso usa o acento em vez de borda
 * discreta, e por isso o rótulo fica à direita — a linha atravessa a coluna e
 * o olho a encontra rolando, sem precisar ler nada.
 *
 * Sobrevive à sessão porque o cursor sobrevive: ele só avança quando a pessoa
 * SAI do canal. Avançar na entrada faria o divisor sumir no mesmo frame em que
 * apareceu.
 */
function DivisorDeNovas() {
  return (
    <div className={css.novas} role="separator">
      <span className={css.novasLinha} />
      <span className={css.novasRotulo}>novas mensagens</span>
    </div>
  );
}

/**
 * Divisor de dia — separação por ESPAÇO, não por régua.
 *
 * Tinha duas hairlines ladeando o rótulo, que é o desenho genérico. Saíram, e
 * o item T0 da fase 5 já dizia por quê: numa coluna densa, régua horizontal é
 * o recurso mais caro que existe — ela corta a varredura vertical do olho e
 * cobra esse preço uma vez por dia de histórico, para cada dia.
 *
 * O espaço faz o mesmo trabalho sem cortar nada. `space-6` acima e `space-1`
 * abaixo prende o rótulo ao dia que ele ABRE em vez de deixá-lo boiando entre
 * os dois — a mesma lógica do ritmo de agrupamento, que é `pt-4` entre autores
 * e `pt-1` dentro de um.
 *
 * E há um efeito de segunda ordem que vale mais que a limpeza: com estas
 * saindo, a linha de acento do "novas mensagens" passa a ser a ÚNICA régua
 * horizontal da coluna inteira. Ela existe para ser encontrada rolando sem
 * ler, e agora nada mais compete com ela por esse papel.
 */
function DivisorDeDia({ rotulo }: { rotulo: string }) {
  return (
    <div className={css.dia} role="separator">
      {/* A caixa carrega a medida; o rótulo centraliza dentro dela. Duas
          camadas porque centralizar e limitar são coisas diferentes. */}
      <div className={cn(css.diaRotuloCaixa, "flex flex-1 justify-center")}>
        <span className={css.diaRotulo}>{rotulo}</span>
      </div>
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
  /*
    Booleano, e é o que torna esta subscrição barata.

    Toda linha montada assina o alvo do menu, mas `useSyncExternalStore` compara
    por `Object.is` — então mudar o alvo acorda exatamente DUAS linhas: a que
    deixou de ser e a que passou a ser. É o mesmo padrão do `useColapso`, e o
    motivo pelo qual dar um valor derivado ao getter é seguro aqui.
  */
  const ehAlvo = useSyncExternalStore(
    assinarMenuDeMensagem,
    () => lerAlvoDoMenu() === id,
  );
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
        <div className={cn(css.minZero, "flex-1 text-md leading-message")}>&nbsp;</div>
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
        {message.primeiraNaoLida ? <DivisorDeNovas /> : null}
        {message.dia ? <DivisorDeDia rotulo={message.dia} /> : null}
        <article className="flex items-baseline gap-2 px-4 pt-4 text-xs text-text-3">
          <Info size={20} aria-hidden className="shrink-0 self-center" />
          <p className={cn(css.minZero, "flex-1 wrap-anywhere")}>
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
          /*
            A linha só DIZ quem ela é; quem abre o menu é a lista.

            Sem `preventDefault`: o `Trigger` do Radix está no container e
            precisa receber o mesmo evento para abrir no ponteiro. Aqui só se
            escreve o alvo, e a ordem faz o resto — o container limpa na
            captura, a linha escreve na bolha.
          */
          onContextMenu={() => definirAlvoDoMenu(message.id)}
          data-alvo={ehAlvo}
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
            "relative flex gap-3 px-4 hover:bg-surface-1 data-[alvo=true]:bg-surface-1",
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
            /*
              Menção a VOCÊ destaca a linha inteira.

              A menção dentro do texto marca a palavra; isto marca a LINHA, que
              é o que faz a mensagem ser encontrada rolando sem ler. As duas
              coisas respondem perguntas diferentes — "onde no texto" e "qual
              das cinquenta linhas" — e é a segunda que o botão de próxima
              menção existe para automatizar.

              Fundo tingido e não borda: borda competiria com a marca de envio
              falhado, que já usa a borda de início.
            */
            message.mencionaVoce && css.mencionaVoce,
          )}
        >
          {/*
            A barra de ações, flutuando.

            Reagir era só pelo botão direito, num menu de onze alvos — e reagir
            é o gesto mais frequente que existe num cliente de chat. Gesto
            frequente atrás de menu é a definição de "lembrar em vez de
            reconhecer", e foi a nota mais baixa da auditoria.

            Ela SOBREPÕE em vez de reservar espaço, e isso não é estética: o
            comentário do `article` acima já diz por quê — qualquer tratamento
            de hover que mude a ALTURA da linha destrói a âncora do
            virtualizador. `translateY(-50%)` a põe montada na borda de cima,
            no espaço que o ritmo de agrupamento já deixa.

            `visibility` e não `opacity` para esconder: elemento com
            `visibility: hidden` sai da ordem de tabulação E da árvore de
            acessibilidade. Com opacidade zero, cada linha da lista somaria
            cinco paradas de tabulação invisíveis — dez mil linhas, cinquenta
            mil paradas.

            É afordância de PONTEIRO, dita assim de propósito. O caminho
            completo por teclado continua sendo o menu de contexto, que o
            Radix abre com Shift+F10 e tem tudo. Uma barra alcançável por
            teclado sem poluir a tabulação exige roving tabindex gerenciado
            pela lista — trabalho real, e está listado.
          */}
          {/*
            Cada alvo pergunta ANTES de existir, não depois de ser clicado.

            É a regra do briefing: nunca renderizar ação que a pessoa não pode
            executar. Hoje `pode()` responde sempre `true` — não há sessão —, e
            o valor está na FORMA: a fase 6 liga `havePermission` num lugar só e
            estes alvos somem sozinhos. Adotada depois, seria uma passada por
            cada botão do app com a garantia de esquecer um.
          */}
          <div className={css.acoes} role="group" aria-label="Ações da mensagem">
            {pode(message.channelId, "reagir")
              ? REACOES_DA_BARRA.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={css.acao}
                    aria-label={`Reagir com ${emoji}`}
                    onClick={() => alternarReacao(message.id, emoji)}
                  >
                    <span aria-hidden>{emoji}</span>
                  </button>
                ))
              : null}

            <span className={css.acoesDivisa} aria-hidden />

            {pode(message.channelId, "responder") ? (
              <button
                type="button"
                className={css.acao}
                aria-label="Responder"
                onClick={() => responderA(message.channelId, message.id)}
              >
                <ArrowBendUpLeft size={20} aria-hidden />
              </button>
            ) : null}
            {pode(message.channelId, "fixar") ? (
              <button
                type="button"
                className={css.acao}
                aria-label={message.fixada ? "Desafixar" : "Fixar no canal"}
                onClick={() => alternarFixada(message.id)}
              >
                {message.fixada ? (
                  <PushPinSlash size={20} aria-hidden />
                ) : (
                  <PushPin size={20} aria-hidden />
                )}
              </button>
            ) : null}
          </div>

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
          <div className={cn(css.minZero, "flex-1")}>
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
                  <span className="text-md font-medium text-text-2">
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

            {/*
              O CONTEÚDO é `text-1`; o autor é `text-2`. Era o contrário.

              A hierarquia estava invertida, e num app que fica aberto o dia
              inteiro isso custa caro: o texto mais claro da interface era o
              RÓTULO, e a coisa que se lê por oito horas vinha um degrau
              apagada. Você lê a mensagem e RELANCEIA o nome — tanto que o
              agrupamento existe exatamente para não repetir o nome.

              O nome não se perde por isso: `font-medium` continua separando, e
              cargo colorido sobrescreve a cor de qualquer forma. O que muda é
              qual dos dois ganha a atenção quando os dois estão na tela, que é
              sempre.
            */}
            <p className={cn(css.corpo, "text-md leading-message wrap-anywhere text-text-1")}>
              <TextoDaMensagem partes={message.partes} />
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

            {/*
              Os chips eram `<span>`: reação renderizada, não usável. Agora
              são botões de dois estados — clicar no chip aceso remove a minha,
              no apagado acrescenta. É o gesto mais barato que existe, e é por
              isso que reagir precisa custar um clique e não um menu.
            */}
            {message.reactions.length > 0 ? (
              <div className={css.reacoes}>
                {message.reactions.map((r) => (
                  <button
                    key={r.emoji}
                    type="button"
                    className={css.chip}
                    data-minha={r.minha}
                    onClick={() => alternarReacao(message.id, r.emoji)}
                    /*
                      Chip existente NÃO some sem permissão — ele vira leitura.

                      A reação de outra pessoa é conteúdo, não ação: escondê-la
                      apagaria informação da conversa. O que a permissão tira é
                      o poder de MEXER nela, e `disabled` é como se diz isso —
                      a contagem continua legível.
                    */
                    disabled={!pode(message.channelId, "reagir")}
                    aria-pressed={r.minha}
                    aria-label={rotuloDeReacao(r)}
                  >
                    <span aria-hidden>{r.emoji}</span>
                    <span className={css.total} aria-hidden>
                      {r.total}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
    </article>
  );

  return (
    <>
      {/* Antes do divisor de data: "parei aqui" vem antes de "e este é outro
          dia", porque o primeiro é sobre a pessoa e o segundo sobre o
          histórico. */}
      {message.primeiraNaoLida ? <DivisorDeNovas /> : null}
      {message.dia ? <DivisorDeDia rotulo={message.dia} /> : null}

      {linha}
    </>
  );
});

/**
 * O corpo do menu — montado UMA vez pela lista, nunca por linha.
 *
 * Antes cada `MessageRow` montava um `ContextMenu` do Radix inteiro: Root,
 * Trigger, Portal e Content. Linha monta e desmonta na velocidade do scroll,
 * então eram dezenas de árvores de menu criadas e destruídas por segundo
 * enquanto ninguém tinha aberto menu nenhum.
 *
 * Ele assina o alvo e a mensagem do alvo. Quando não há alvo — clique direito
 * no vão entre linhas — não renderiza item nenhum: menu vazio é melhor que
 * menu agindo sobre a mensagem do clique anterior.
 */
export function MenuDaMensagem() {
  const alvo = useSyncExternalStore(assinarMenuDeMensagem, lerAlvoDoMenu);
  const message = useMessage(alvo ?? "");

  if (!message) return <ContextMenuContent />;

  return (
    <ContextMenuContent>
        {/*
          Conjunto RÁPIDO, não picker completo.

          Picker de emoji é dependência pesada e decisão própria — e a cauda
          longa de emojis é minoria do uso real: reação é gesto de um clique, e
          um clique que abre uma grade de mil ícones deixa de ser gesto. Estes
          seis cobrem o comum; o picker completo fica listado.

          `onSelect` sem `preventDefault`: fechar o menu depois de reagir é o
          certo, porque reagir é a ação inteira.
        */}
        <div className={css.rapidas} role="group" aria-label="Reagir">
          {pode(message.channelId, "reagir") &&
            REACOES_RAPIDAS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={css.rapida}
                aria-label={`Reagir com ${emoji}`}
                onClick={() => alternarReacao(message.id, emoji)}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
        </div>

        <ContextMenuSeparator />

        {pode(message.channelId, "responder") ? (
          <ContextMenuItem
            onSelect={() => responderA(message.channelId, message.id)}
          >
            <ArrowBendUpLeft size={20} aria-hidden />
            Responder
          </ContextMenuItem>
        ) : null}
        {pode(message.channelId, "fixar") ? (
          <ContextMenuItem onSelect={() => alternarFixada(message.id)}>
            {message.fixada ? (
              <PushPinSlash size={20} aria-hidden />
            ) : (
              <PushPin size={20} aria-hidden />
            )}
            {message.fixada ? "Desafixar" : "Fixar no canal"}
          </ContextMenuItem>
        ) : null}

        {/*
          Copiar é a única das três que não escreve no protocolo — e por isso
          é a única que existe hoje.

          `Editar` e `Apagar` estavam aqui como itens INERTES: apareciam no
          menu, recebiam foco, fechavam ao serem escolhidos e não faziam nada.
          Item que não faz nada é pior que item ausente, porque ensina a pessoa
          a não confiar no menu inteiro. Saíram, e voltam na fase 6 com
          `Message.edit()` e `Message.delete()` por trás — a mesma razão pela
          qual reordenar canal arrastando ficou de fora.
        */}
        <ContextMenuItem
          onSelect={() => void copiarTexto(message.content, "Texto")}
          disabled={message.content.length === 0}
        >
          <Copy size={20} aria-hidden />
          Copiar texto
        </ContextMenuItem>
          </ContextMenuContent>
  );
}
