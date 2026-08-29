import {
  ArrowBendUpLeft,
  Copy,
  Info,
  PencilSimple,
  Plus,
  PushPin,
  PushPinSlash,
  Trash,
} from "@phosphor-icons/react";
import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/ContextMenu";

import { ATRIBUTO_DE_COLUNA } from "../dev/alinhamento";
import { count } from "../dev/stats";
import { copiarTexto } from "../lib/copiar";
import { rotuloDeReacao } from "../lib/plural";
import { cn } from "../lib/cn";
import { AvatarDoAutor } from "../presenca/AvatarDoAutor";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import type { SistemaSnapshot } from "../sdk/domain";
import { reenviar } from "../sdk/adapter";
import {
  alternarFixada,
  alternarReacao,
  editarMensagem,
  usuarioLocalId,
} from "../sdk/adapter";
import {
  assinarMenuDeMensagem,
  definirAlvoDoMenu,
  lerAlvoDoMenu,
} from "../store/menuDeMensagem";
import {
  adotarFocoDeMensagem,
  assinarFocoDeMensagem,
  consumirPedidoDeFoco,
  lerSinalDeFoco,
} from "../store/focoDeMensagem";
import { pode } from "../sdk/permissoes";
import { administrar } from "../store/administracao";
import {
  assinarEdicaoDeMensagem,
  editar,
  lerEdicaoDeMensagem,
  pararDeEditar,
} from "../store/edicaoDeMensagem";
import { responderA } from "../store/resposta";
import { useMessage } from "../store/hooks";
import { Anexos } from "./Anexos";
import { aindaNao } from "../pendente/pendencias";
import { assinarDensidade, lerDensidade } from "../store/densidade";
import { Citacao } from "./Citacao";
import { Embeds } from "./Embeds";
import { CrachaDeCargo } from "../presenca/NomeDoAutor";
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
    /*
      `role="separator"` só aceita nome do AUTOR: o texto dentro dele não é
      anunciado. Sem `aria-label` a régua de novas mensagens — que é a única
      régua horizontal da coluna, e existe para marcar onde a pessoa parou —
      não existia para quem usa leitor de tela.
    */
    <div className={css.novas} role="separator" aria-label="novas mensagens">
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
    /*
      Idem: "domingo, 23 de agosto" estava na tela e nunca era anunciado,
      porque `separator` ignora o conteúdo e lê só o nome.
    */
    <div className={css.dia} role="separator" aria-label={rotulo}>
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
/**
 * Editar sem sair da linha.
 *
 * In-line e não modal, e a razão é a mesma pela qual a barra de ações sobrepõe
 * em vez de reservar espaço: a mensagem editada precisa continuar no CONTEXTO
 * — o que veio antes e o que veio depois é metade do sentido do que se está
 * corrigindo.
 *
 * O rascunho é estado local desta vez, e não do store: ele nasce e morre com a
 * edição, e o store já guarda QUAL mensagem está sendo editada — que é o que
 * sobrevive à desmontagem da linha pelo virtualizador.
 */
/** Quantas linhas o texto ocupa — o campo cresce até um teto. */
function linhasDe(texto: string): number {
  let n = 1;
  for (let i = 0; i < texto.length; i++) {
    if (texto.charCodeAt(i) === 10) n++;
  }
  return n;
}

function EditorDaLinha({
  messageId,
  inicial,
}: {
  messageId: string;
  inicial: string;
}) {
  const [texto, setTexto] = useState(inicial);
  const [salvando, setSalvando] = useState(false);

  function salvar() {
    const limpo = texto.trim();
    if (!limpo || limpo === inicial) {
      pararDeEditar();
      return;
    }
    setSalvando(true);
    void editarMensagem(messageId, limpo).finally(() => {
      setSalvando(false);
      pararDeEditar();
    });
  }

  return (
    <div className={css.editor}>
      <textarea
        className={css.campoDeEdicao}
        autoFocus
        rows={Math.min(8, linhasDe(texto))}
        disabled={salvando}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          /*
            Enter salva, Shift+Enter quebra linha — o mesmo contrato do
            composer. Duas convenções diferentes para o mesmo gesto no mesmo app
            é o tipo de coisa que faz a pessoa mandar o texto pela metade.
          */
          if (e.key === "Escape") {
            e.preventDefault();
            pararDeEditar();
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            salvar();
          }
        }}
        /*
          Sair do campo NÃO cancela nem salva.

          Clicar fora para copiar algo e perder a edição é punição por um gesto
          inocente. Sair é `Esc`, salvar é Enter — os dois explícitos.
        */
        aria-label="Editar mensagem"
      />
      <span className={css.dicaDeEdicao}>
        Enter salva · Esc cancela · Shift+Enter quebra linha
      </span>
    </div>
  );
}

export const MessageRow = memo(function MessageRow({ id }: { id: string }) {
  const message = useMessage(id);
  /*
    Booleano, e é o que torna esta subscrição barata.

    Toda linha montada assina o alvo do menu, mas `useSyncExternalStore` compara
    por `Object.is` — então mudar o alvo acorda exatamente DUAS linhas: a que
    deixou de ser e a que passou a ser. É o mesmo padrão do `useColapso`, e o
    motivo pelo qual dar um valor derivado ao getter é seguro aqui.
  */
  /*
    A densidade, assinada pela própria linha.

    ⚠ **Não vem por prop da lista de propósito.** Uma prop faria a `MessageList`
    assinar e repassar, e `memo` compararia a prop em toda linha montada — o
    mesmo custo, com um acoplamento a mais. Aqui é o mesmo padrão de `ehAlvo`
    logo abaixo: `useSyncExternalStore` compara por `Object.is` sobre uma
    string estável, então trocar de densidade acorda exatamente as ~50 linhas
    montadas, e nada mais.

    E é APRESENTAÇÃO: o adapter continua calculando `iniciaGrupo` do mesmo
    jeito, e o modo compacto simplesmente o ignora. Agrupar diferente no store
    faria trocar de densidade republicar dez mil snapshots.
  */
  const compacto =
    useSyncExternalStore(assinarDensidade, lerDensidade) === "compacto";

  const ehAlvo = useSyncExternalStore(
    assinarMenuDeMensagem,
    () => lerAlvoDoMenu() === id,
  );
  count("rowRenders");
  /*
    Booleano, como `ehAlvo` acima e pela mesma razão: toda linha montada assina
    o store de edição, mas `Object.is` sobre um booleano faz a troca acordar
    exatamente DUAS linhas — a que saiu e a que entrou.
  */
  const emEdicao = useSyncExternalStore(
    assinarEdicaoDeMensagem,
    () => lerEdicaoDeMensagem() === id,
  );
  /*
    O sinal do roving tabindex. Zero = esta linha não é a parada de tabulação.

    Número e não booleano, e o motivo está no store: sair da lista e voltar pela
    MESMA linha precisa devolver o cursor, e `true → true` não notifica ninguém.
    O `Object.is` continua fazendo o trabalho barato — mover o foco acorda duas
    linhas, não dez mil.
  */
  const sinalDeFoco = useSyncExternalStore(assinarFocoDeMensagem, () =>
    lerSinalDeFoco(id),
  );
  const elemento = useRef<HTMLElement>(null);

  /*
    Só um pedido de TECLADO move o cursor de verdade.

    `consumirPedidoDeFoco` é global de propósito: a linha remonta a cada
    reciclagem do virtualizador, e um efeito que chamasse `.focus()` toda vez
    que ela monta arrancaria o cursor de quem estivesse digitando, a cada
    rolagem. A remontagem vê um pedido já consumido e não faz nada.
  */
  useEffect(() => {
    if (sinalDeFoco === 0) return;
    if (!consumirPedidoDeFoco(sinalDeFoco)) return;
    elemento.current?.focus();
  }, [sinalDeFoco]);

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
        <div className={cn(css.minZero, "flex-1 text-lg leading-message")}>&nbsp;</div>
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
          ref={elemento}
          /*
            Roving tabindex: UMA linha por vez é parada de tabulação.

            É o que torna teclado possível sem o custo que a barra de ações
            evitou. Dez mil linhas com `tabIndex=0` seriam dez mil paradas;
            assim a lista inteira custa uma, e as setas fazem o resto.
          */
          tabIndex={sinalDeFoco > 0 ? 0 : -1}
          /*
            Clique ou Tab vindo de fora: a parada acompanha, sem `.focus()` de
            volta. `onFocus` do React é `focusin`, então focar um botão da barra
            de ações também passa por aqui — e a linha certa é a mesma.
          */
          onFocus={() => adotarFocoDeMensagem(message.id)}
          data-alvo={ehAlvo}
          className={cn(
            css.linha,
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
            /*
              ⚠ **COLUNA, e era uma linha só — a prévia de resposta precisava
              ser IRMÃ da mensagem, não filha do corpo.**

              A razão está no próprio design, e é a mesma que ele dá: com a
              prévia dentro do corpo, a barra de ações do hover pousa em cima
              dela (ela ancora na borda de cima e sobe metade da própria
              altura), e o alvo de "pular para a mensagem citada" fica coberto
              justamente quando o ponteiro está na linha — ou seja, sempre que
              alguém iria clicar nele.

              Agora a barra ancora na LINHA DE MENSAGEM, que é filha, e a
              prévia fica acima dela, fora do alcance.
            */
            "relative flex flex-col px-4 hover:bg-surface-1 data-[alvo=true]:bg-surface-1",
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
            completo por teclado é o menu de contexto, aberto com `Enter` na
            linha focada — e ele SÓ PASSOU A EXISTIR agora.

            Esta frase dizia "o Radix abre com Shift+F10 e tem tudo", e era
            falsa em duas pontas: sem `tabIndex` no `article` não havia o que
            focar, então o navegador não tinha em quem disparar `contextmenu`,
            e o alvo do menu teria sido `null` de qualquer forma. O roving
            tabindex torna as duas verdadeiras, e o `Enter` da lista não deixa
            o único caminho depender de uma tradução de tecla do navegador.
          */}
          {/*
            A citação abre a linha, acima do cabeçalho: é o contexto que torna
            a mensagem legível, e lê-la depois do texto seria ler a resposta
            antes da pergunta.

            Recuada pela calha (`.citacaoRecuada`) para alinhar com a coluna de
            conteúdo, e não com o avatar: ela pertence ao que foi ESCRITO. O
            recuo agora é dela porque ela deixou de morar dentro da coluna.
          */}
          {message.respostas.length > 0 ? (
            <div className={css.citacaoRecuada}>
              {message.respostas.map((alvo) => (
                <Citacao key={alvo} channelId={message.channelId} messageId={alvo} />
              ))}
            </div>
          ) : null}

          {/*
            A LINHA de mensagem: calha e conteúdo.

            `relative` aqui e não só no `article` porque a barra de ações
            ancora NELA — ver o comentário de `flex-col` acima.
          */}
          <div className={cn(css.linhaDaMensagem, "relative flex gap-3")}>
          {/* A calha do avatar existe mesmo na continuação: é o que mantém o
              texto alinhado ao longo do grupo inteiro. */}
          {/*
            A calha muda de PAPEL com a densidade, e é isto que o design quer
            dizer com "compacto não é o confortável com padding menor".

            Confortável: avatar de 40px, vazio na continuação do grupo — a
            calha existe para manter o texto alinhado ao longo do grupo.

            Compacto: a MESMA largura vira a coluna de hora, em mono e alinhada
            à direita. O espaço não é economizado, é reaproveitado: em vez de
            40px de identidade visual, 40px de endereço temporal, e toda
            mensagem passa a ter o seu — que é o que faz cada linha ser
            endereçável, e por que o agrupamento some junto.
          */}
          <div className={cn(css.calha, "relative mt-1")}>
            {compacto ? (
              <time className={css.horaCompacta}>{message.createdAtCurto}</time>
            ) : message.iniciaGrupo ? (
              <AvatarDoAutor userId={message.authorId ?? ""} />
            ) : null}
          </div>

          {/* minmax(0,1fr) do lado flex: sem isto uma URL de 400 chars estoura. */}
          {/* O marcador do alinhamento com o composer. Vive aqui e não na
              faixa: é esta caixa que precisa casar com a do campo. */}
          <div
            className={cn(css.minZero, css.conteudo, "flex-1")}
            {...{ [ATRIBUTO_DE_COLUNA]: "mensagem" }}
          >
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


            {!compacto && message.iniciaGrupo ? (
              <div className="flex items-baseline gap-2">
                {message.authorId ? (
                  <>
                    <NomeDoAutor userId={message.authorId} />
                    {/* O crachá de cargo — "VTX", "MOD". Assina o membro
                        sozinho; ver `CrachaDeCargo`. */}
                    <CrachaDeCargo userId={message.authorId} />
                  </>
                ) : (
                  <span className="text-lg font-semibold text-text-2">
                    desconhecido
                  </span>
                )}
                <time className="text-xs text-text-3">
                  {message.createdAtText}
                </time>
                {message.editedAt ? (
                  <span className="text-xs text-text-3">(editada)</span>
                ) : null}

                {/*
                  "📌 fixada" na linha de cabeçalho, como o design.

                  ⚠ **Fixar já existia e era INVISÍVEL na linha.** O estado
                  vivia no menu de contexto e na barra de hover — dois lugares
                  que só respondem a quem já foi procurar. Uma mensagem fixada
                  passava por fixada em lugar nenhum, e o painel de fixados era
                  a única prova de que a ação tinha funcionado.

                  Só no cabeçalho do GRUPO, que é onde o design a põe: numa
                  sequência da mesma pessoa, uma linha continuada fixada é caso
                  raro o bastante para o painel resolver.
                */}
                {message.fixada ? (
                  <span className={css.fixada}>
                    <PushPin size={20} aria-hidden />
                    fixada
                  </span>
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
            {/*
              `div` e não `p`, desde que o markdown existe.

              O conteúdo agora traz os próprios blocos — parágrafo, bloco de
              código, citação, lista — e `<p>` dentro de `<p>` é inválido: o
              navegador fecha o de fora sozinho, sem erro, e o resto da
              mensagem vaza para fora da caixa que tinha a medida de leitura.
            */}
            {emEdicao ? (
              <EditorDaLinha
                messageId={message.id}
                inicial={message.content}
              />
            ) : (
              <div
                className={cn(
                  css.corpo,
                  "text-lg leading-message wrap-anywhere text-text-1",
                )}
              >
                <TextoDaMensagem
                  blocos={message.blocos}
                  /*
                    No compacto o nome entra DENTRO do primeiro parágrafo — o
                    design o desenha inline com o texto, e um `<span>` antes do
                    corpo cairia em linha própria porque o corpo abre com `<p>`.
                    Ver a prop `prefixo` em `TextoDaMensagem`.

                    O crachá de cargo vem junto: ele é parte da identidade de
                    quem escreveu, não do cabeçalho que deixou de existir.
                  */
                  prefixo={
                    compacto && message.authorId ? (
                      <>
                        <NomeDoAutor userId={message.authorId} denso />
                        <CrachaDeCargo userId={message.authorId} />
                      </>
                    ) : undefined
                  }
                />
              </div>
            )}

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
            {/* Depois do texto e ANTES das reações: o anexo faz parte do que
                foi dito; a reação é o que os outros responderam. */}
            {message.anexos.length > 0 ? (
              <Anexos anexos={message.anexos} />
            ) : null}

            {/* O cartão de link vem DEPOIS do anexo e antes das reações: o
                anexo é o que a pessoa mandou, o cartão é o que o servidor
                achou sobre o que ela escreveu. */}
            {message.embeds.length > 0 ? (
              <Embeds embeds={message.embeds} />
            ) : null}

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

                {/*
                  O "＋" do design, no fim da fileira.

                  Desenhado sem implementação — o seletor de emoji é a
                  pendência `emoji`. Sob a mesma permissão dos chips: quem não
                  pode reagir não ganha um botão que abre um seletor inútil.
                */}
                {pode(message.channelId, "reagir") ? (
                  <button
                    type="button"
                    className={css.adicionarReacao}
                    aria-label="Adicionar reação"
                    onClick={aindaNao("emoji")}
                  >
                    <Plus size={20} aria-hidden />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
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
  const eu = usuarioLocalId();

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

          ⚠ **E `onSelect` só existe aqui a partir de agora.** Estes seis eram
          `<button onClick>` crus dentro do menu — sem `role`, e portanto
          invisíveis para o Radix, que navega só entre `menuitem`. O menu
          abria, as setas passavam por cima deles e o Tab fechava o menu:
          reagir por teclado não existia, mesmo com o menu alcançável. Este
          comentário já dizia "onSelect" quando não havia nenhum.

          `asChild` para manter o `<button>`: o alvo continua sendo um botão de
          verdade para o ponteiro, e ganha `role="menuitem"` e a navegação por
          seta do Radix por cima.
        */}
        <div className={css.rapidas} role="group" aria-label="Reagir">
          {pode(message.channelId, "reagir") &&
            REACOES_RAPIDAS.map((emoji) => (
              <ContextMenuItem
                key={emoji}
                asChild
                onSelect={() => alternarReacao(message.id, emoji)}
              >
                <button
                  type="button"
                  className={css.rapida}
                  aria-label={`Reagir com ${emoji}`}
                >
                  <span aria-hidden>{emoji}</span>
                </button>
              </ContextMenuItem>
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

        <ContextMenuItem
          onSelect={() => void copiarTexto(message.content, "Texto")}
          disabled={message.content.length === 0}
        >
          <Copy size={20} aria-hidden />
          Copiar texto
        </ContextMenuItem>

        {/*
          `Editar` e `Apagar` VOLTARAM.

          Eles estiveram aqui como itens INERTES por três fases: apareciam,
          recebiam foco, fechavam o menu e não faziam nada. Saíram por isso —
          item que não faz nada ensina a não confiar no menu inteiro — e o
          `no-restricted-syntax` que exige `onSelect` foi instalado no mesmo
          passo. Voltam com `Message.edit()` e `Message.delete()` por trás.

          **Editar é só do AUTOR**, e a checagem não é de permissão de servidor:
          o protocolo não deixa ninguém editar mensagem alheia, nem quem
          administra. Apagar é do autor OU de quem gerencia mensagens.
        */}
        {message.authorId !== undefined && message.authorId === eu ? (
          <ContextMenuItem onSelect={() => editar(message.id)}>
            <PencilSimple size={20} aria-hidden />
            Editar
          </ContextMenuItem>
        ) : null}

        {(message.authorId !== undefined && message.authorId === eu) ||
        pode(message.channelId, "fixar") ? (
          <ContextMenuItem
            perigo
            onSelect={() =>
              administrar({ tipo: "apagarMensagem", messageId: message.id })
            }
          >
            <Trash size={20} aria-hidden />
            Apagar
          </ContextMenuItem>
        ) : null}
          </ContextMenuContent>
  );
}
