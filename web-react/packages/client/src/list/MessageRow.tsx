import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowClockwise,
  ChatsCircle,
  Copy,
  DotsThree,
  EnvelopeSimple,
  Hammer,
  Info,
  Link,
  Note,
  PencilSimple,
  Phone,
  Plus,
  ProhibitInset,
  PushPin,
  PushPinSlash,
  SignOut,
  Smiley,
  TextB,
  TextItalic,
  Trash,
  UserCircle,
} from "@phosphor-icons/react";
import {
  memo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/ContextMenu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/ui/HoverCard";

import { ATRIBUTO_DE_COLUNA } from "../dev/alinhamento";
import { count } from "../dev/stats";
import { ItemDeId } from "../components/ui/ItemDeId";
import { copiarTexto } from "../lib/copiar";
import { assinarFila, confirmadaNaFila } from "../store/fila";
import { plural, rotuloDeReacao } from "../lib/plural";
import { cn } from "../lib/cn";
import { Avatar } from "../components/ui/Avatar";
import { BotaoDeIcone } from "../components/ui/BotaoDeIcone";
import { menuAtalho, menuLargo } from "../components/ui/menu";
import { AvatarDoAutor } from "../presenca/AvatarDoAutor";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import type {
  MessageSnapshot,
  ReacaoSnapshot,
  SistemaSnapshot,
} from "../sdk/domain";
import { descartarPendente, manterNaFila, reenviar } from "../sdk/adapter";
import { CartaoDeUpload } from "./CartaoDeUpload";
import {
  alternarFixada,
  alternarReacao,
  editarMensagem,
  usuarioLocalId,
} from "../sdk/adapter";
import {
  alvoDeMensagem,
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
import { assinarConexao, lerConexao } from "../store/conexao";
import { caminhoDe } from "../rota/rota";
import { lerLocal } from "../store/navegacao";
import { chaveDeMembro } from "../sdk/domain";
import { useMembro, useServidorAtivo } from "../store/hooks";
import { useMessage } from "../store/hooks";
import { Anexos } from "./Anexos";
import { EnqueteDaMensagem } from "../enquete/EnqueteDaMensagem";
import {
  SubmenuDeCargos,
  SubmenuDeVoz,
} from "../membros/SubmenusDeMembro";
import { canalDeVozDe } from "../sdk/adapter";
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
/**
 * As reações rápidas — as do DESIGN, e a lista é semente, não curadoria.
 *
 * O próprio design diz o que ela deve virar: *"emojis frequentes do usuário,
 * nunca curadoria do produto"*. Frequência por usuário é store que ainda não
 * existe, então o que está aqui é o ponto de partida — e a nota fica para que
 * ninguém confunda a semente com a decisão.
 */
const REACOES_RAPIDAS = ["✅", "🧠", "🔥", "👀"] as const;

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
  REACOES_RAPIDAS[2],
] as const;

/**
 * Abre o menu de contexto da lista a partir de um BOTÃO.
 *
 * O `⋯` do design faz por clique o que o botão direito já faz, e o menu é um
 * só — o `ContextMenu` do Radix montado no nível da lista. Abrir esse mesmo
 * menu por clique normalmente pediria um segundo primitivo (`DropdownMenu`)
 * com o conteúdo duplicado; dois menus com os mesmos itens divergem no dia em
 * que alguém acrescenta um item num só.
 *
 * Em vez disso, o botão despacha o evento que o `Trigger` já escuta. Ele
 * BORBULHA: passa pela captura do container (que limpa o alvo) e pelo handler
 * da linha (que escreve o alvo certo), então o alvo se resolve sozinho pelo
 * mesmo caminho do clique direito. Nada de novo para manter em sincronia.
 *
 * As coordenadas são as do próprio botão, e não as do ponteiro: o menu pousa
 * ancorado ao `⋯`, que é onde a pessoa está olhando.
 */
function abrirMenuDaLinha(botao: HTMLElement): void {
  const r = botao.getBoundingClientRect();
  botao.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(r.left),
      clientY: Math.round(r.bottom),
    }),
  );
}

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
 * os dois — a mesma lógica do ritmo de agrupamento, que é `pt-16` entre autores
 * e `pt-04` dentro de um.
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
  const campoRef = useRef<HTMLTextAreaElement>(null);

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

  /**
   * Envolve a seleção com um marcador de markdown.
   *
   * Escreve no ESTADO e devolve o cursor ao campo, em vez de mexer no valor do
   * DOM: o campo é controlado, e mexer nele por fora produziria o clássico
   * valor que aparece e some no próximo `setState`.
   *
   * Sem seleção o marcador é inserido vazio com o cursor no meio — que é o que
   * todo editor faz, e o que permite marcar antes de escrever.
   */
  function envolver(marca: string) {
    const campo = campoRef.current;
    if (!campo) return;
    const { selectionStart: a, selectionEnd: b } = campo;
    setTexto(texto.slice(0, a) + marca + texto.slice(a, b) + marca + texto.slice(b));
    /* Depois do commit do React, senão o cursor volta para o fim. */
    queueMicrotask(() => {
      campo.focus();
      campo.setSelectionRange(a + marca.length, b + marca.length);
    });
  }

  return (
    <div className={css.editor}>
      <textarea
        ref={campoRef}
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
      {/*
        A régua do editor — negrito, itálico, emoji, e a dica do outro lado.

        O design a desenha DENTRO da caixa de edição, separada por uma
        hairline, e a diferença não é decorativa: com a régua fora, a borda de
        foco do campo terminava antes dos controles que pertencem a ele.

        Negrito e itálico são REAIS, não desenho: o markdown já existe no
        caminho de leitura desde que `markdown/analisar.ts` foi construído, e
        `**` em volta da seleção é o mesmo texto que qualquer cliente Stoat
        entende. O emoji é o seletor, que é pendência.
      */}
      <div className={css.reguaDeEdicao}>
        <div className={css.reguaAcoes}>
          <button
            type="button"
            className={css.reguaBotao}
            aria-label="Negrito"
            onClick={() => envolver("**")}
          >
            <TextB aria-hidden />
          </button>
          <button
            type="button"
            className={css.reguaBotao}
            aria-label="Itálico"
            onClick={() => envolver("*")}
          >
            <TextItalic aria-hidden />
          </button>
          <button
            type="button"
            className={css.reguaBotao}
            aria-label="Emoji"
            onClick={aindaNao("emoji")}
          >
            <Smiley aria-hidden />
          </button>
        </div>
        <span className={css.dicaDeEdicao}>
          <kbd className={css.tecla}>esc</kbd> cancela ·{" "}
          <kbd className={css.tecla}>↵</kbd> salva
        </span>
      </div>
    </div>
  );
}

/**
 * O que aconteceu com uma mensagem que ainda não é do servidor.
 *
 * Três estados, os do design: **enviando**, **na fila · offline** e **falha no
 * envio**. Os dois primeiros são o MESMO `sendState` (`pending`) — o que os
 * separa é a conexão, e é a distinção que importa para quem está esperando:
 * "está indo" e "não vai enquanto você não voltar" pedem paciências
 * diferentes.
 *
 * ⚠ **Componente próprio para isolar a subscrição da conexão.** Ler o estado
 * do socket dentro da `MessageRow` faria toda linha montada acordar a cada
 * engasgo de rede — cinquenta re-renders por um evento que interessa a uma
 * linha. Aqui só as pendentes assinam, e mensagem pendente é caso raro por
 * construção: ela vira `sent` assim que o servidor responde.
 *
 * ⚠ **A barra de progresso do design ENTROU, e a ausência dela era honesta
 * até existir upload.** O comentário aqui dizia que uma barra seria "animação
 * sobre um número inventado" — verdade enquanto `anexar` era pendência. Agora
 * o número vem do `XMLHttpRequest`, que é a razão de `sdk/anexos.ts` não usar
 * `fetch`.
 *
 * Ela vive em `CartaoDeUpload`, componente próprio, e não inline: o progresso
 * dispara dezenas de vezes por segundo, e assiná-lo daqui acordaria a linha
 * inteira a cada quadro. É a mesma separação que a conexão já tem logo abaixo.
 */
function EstadoDoEnvio({ message }: { message: MessageSnapshot }) {
  const conexao = useSyncExternalStore(assinarConexao, lerConexao);
  /*
    ⚠ Assinado, e não lido: a escolha de manter na fila não muda o snapshot da
    mensagem — ele é cacheado por conteúdo e estado —, então uma leitura direta
    deixaria os dois botões na tela depois do clique. Booleano, para o React
    descartar o render quando nada mudou.
  */
  const confirmada = useSyncExternalStore(assinarFila, () =>
    confirmadaNaFila(message.id),
  );
  const falhou = message.sendState === "failed";
  const subindo = message.sendState === "subindo";
  const naFila = !falhou && !subindo && conexao !== "conectado";

  return (
    <p
      className={cn(
        css.envio,
        falhou && css.envioFalhou,
        naFila && css.envioNaFila,
      )}
    >
      {/*
        Ponto pulsante só na FILA, e é o que o design marca com ele: enviando
        é transitório e some sozinho; na fila pode durar minutos, e um estado
        parado sem movimento nenhum lê como travado.
      */}
      {naFila ? <span className={css.pontoDeFila} aria-hidden /> : null}
      {falhou
        ? "falha no envio"
        : naFila
          ? "na fila · offline"
          : "enviando…"}

      {/* O cartão só existe durante o upload, e some sozinho quando o estado
          vira `pending` — dali em diante não há mais fração a mostrar. */}
      {subindo ? <CartaoDeUpload messageId={message.id} /> : null}

      {/*
        Duas escolhas explícitas na fila, do design: *"a mensagem digitada
        offline não é perdida nem enviada silenciosamente depois"*.

        ⚠ Elas somem depois de decididas — "Enviar quando voltar" é o que
        aconteceria de qualquer jeito, e o valor do botão é DISPENSAR a
        pergunta. Deixá-las na tela para sempre transformaria uma decisão que
        se toma uma vez em ruído permanente ao lado de cada mensagem parada.
      */}
      {naFila && !confirmada ? (
        <span className={css.envioAcoes}>
          <button
            type="button"
            className={css.envioAcao}
            onClick={() => manterNaFila(message.id)}
          >
            Enviar quando voltar
          </button>
          <button
            type="button"
            className={cn(css.envioAcao, css.envioAcaoPerigo)}
            onClick={() => descartarPendente(message.id)}
          >
            Descartar
          </button>
        </span>
      ) : null}

      {/*
        Três ações no erro, como o design: tentar de novo, excluir, copiar.

        A terceira é a que salva o texto — sem ela, uma mensagem longa que
        falhou repetidamente só pode ser recuperada selecionando à mão dentro
        de uma linha que já está esmaecida.
      */}
      {falhou ? (
        <span className={css.envioAcoes}>
          <button
            type="button"
            className={css.envioAcao}
            onClick={() => reenviar(message.id)}
          >
            <ArrowClockwise aria-hidden />
            Tentar de novo
          </button>
          <button
            type="button"
            className={cn(css.envioAcao, css.envioAcaoPerigo)}
            onClick={() =>
              administrar({ tipo: "apagarMensagem", messageId: message.id })
            }
          >
            Excluir
          </button>
          <button
            type="button"
            className={css.envioAcao}
            onClick={() => void copiarTexto(message.content, "Texto")}
          >
            Copiar texto
          </button>
        </span>
      ) : null}
    </p>
  );
}

/**
 * O tooltip de quem reagiu — "7 reagiram com ✅ · Marina, Téo, Júlia, Rafa".
 *
 * `HoverCard` e não `Tooltip`: o conteúdo tem duas linhas com hierarquia
 * própria, e um tooltip é uma frase. É o primeiro consumidor do primitivo fora
 * do cartão de perfil, e ele foi construído na fase 2 justamente porque um
 * cliente de chat vive disto.
 *
 * ⚠ **Cada nome assina o próprio membro.** Ler os nomes aqui faria o chip
 * re-renderizar quando qualquer uma das quatro pessoas trocasse de apelido —
 * e chip de reação está no componente mais quente do app. É a mesma razão pela
 * qual `NomeDoAutor` existe em vez de o nome vir no snapshot da mensagem.
 *
 * O card é montado só quando ABRE (`HoverCard` do Radix não renderiza conteúdo
 * fechado), então dez mil chips não custam dez mil subscrições.
 */
function QuemReagiu({
  reacao,
  children,
}: {
  reacao: ReacaoSnapshot;
  children: ReactNode;
}) {
  const restantes = reacao.total - reacao.quem.length;

  return (
    <HoverCard openDelay={400} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className={css.quemReagiu} side="top">
        <div className={css.quemTitulo}>
          <span className={css.quemEmoji} aria-hidden>
            {reacao.emoji}
          </span>
          <span>{plural(reacao.total, "reagiu", "reagiram")}</span>
        </div>
        <p className={css.quemNomes}>
          {reacao.quem.map((userId, i) => (
            <span key={userId}>
              {i > 0 ? ", " : ""}
              <NomeDoAutor userId={userId} denso />
            </span>
          ))}
        </p>
        <p className={css.quemDica}>
          {restantes > 0 ? `e outros ${restantes} · ` : ""}
          {reacao.minha ? "clique para remover a sua" : "clique para reagir"}
        </p>
      </HoverCardContent>
    </HoverCard>
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
    () => alvoDeMensagem() === id,
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
      <article aria-hidden className="flex gap-12 px-20 py-08">
        <div className={cn(css.calha, "mt-04 rounded-12 bg-surface-2")} />
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
        <article className="flex items-baseline gap-08 px-20 pt-16 text-xs text-text-3">
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
          /*
            Dois menus, um `ContextMenu`.

            O design tem menu de mensagem E menu do usuário na timeline. A
            saída óbvia — um segundo `ContextMenu` em volta do autor — desfaria
            a economia que o store inteiro existe para garantir: em vez de uma
            árvore de menu por linha, duas.

            Aqui um handler só decide qual alvo escrever, olhando de ONDE o
            clique veio. `closest` num clique direito é barato e roda uma vez
            por gesto humano, não por evento de firehose.
          */
          onContextMenu={(e) => {
            const autor = (e.target as Element).closest?.("[data-menu-autor]");
            const userId = autor?.getAttribute("data-menu-autor");
            definirAlvoDoMenu(
              userId
                ? { tipo: "usuario", userId }
                : { tipo: "mensagem", id: message.id },
            );
          }}
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
            "relative flex flex-col px-20 hover:bg-surface-1 data-[alvo=true]:bg-surface-1",
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
            // Aqui estava `pt-12 pb-0.5` / `py-0.5`. A escala do projeto vai de
            // 1 a 6 e o `@theme` faz `--spacing-*: initial`, então
            // `--spacing-0.5` NÃO EXISTE e a utility nunca foi gerada: o ritmo
            // real era 0px dentro do grupo, contra os 4px que este comentário
            // afirmava. Não deu erro nenhum. Agora há lint contra fracionária.
            message.iniciaGrupo ? "pt-16" : "pt-04",
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
          <div className={cn(css.linhaDaMensagem, "relative flex gap-12")}>
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
          <div
            className={cn(css.calha, "relative mt-04")}
            data-menu-autor={message.authorId}
          >
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
          {/*
            Oito alvos, na ordem do design: três reações · divisa · seletor,
            responder, encaminhar, tópico, `⋯`.

            ⚠ **Fixar SAIU daqui, e é a única troca de conteúdo.** O design põe
            tópico onde estava o alfinete, e fixar continua no menu e no
            cabeçalho da linha — as duas superfícies onde ele já vivia. Um
            oitavo alvo permanente custa largura sobre o texto por baixo, que é
            a razão pela qual esta barra tem tamanho fixado no design.
          */}
          <div
            className={css.acoes}
            role="group"
            aria-label="Ações da mensagem"
            /* Ver `.acoes` no CSS: enquanto o menu desta linha está aberto o
               ponteiro já saiu, e sem isto a barra sumiria por baixo dele. */
            data-menu-aberto={ehAlvo || undefined}
          >
            {/*
              ⚠ **Sem `Tooltip` do Radix aqui, e a ausência é medida em custo.**

              A barra é MONTADA em toda linha (é `visibility: hidden`, não
              desmontada — ver o CSS), então um `Tooltip.Root` por alvo seriam
              oito árvores de primitivo por linha e ~400 com a janela cheia. É
              exatamente a conta que fez o `ContextMenu` sair da linha e ir para
              a lista, e aquele A/B mediu 1,7% → 1,2% de frames perdidos por
              QUATRO componentes a menos por linha.

              O design também não desenha tooltip nenhum nesta barra. O
              `aria-label` fica, que é o que o leitor de tela lê; a descoberta
              por ponteiro fica com o menu `⋯`, onde os mesmos alvos têm nome
              escrito.
            */}
            {pode(message.channelId, "reagir") ? (
              <>
                {REACOES_DA_BARRA.map((emoji) => (
                  <BotaoDeIcone
                    key={emoji}
                    tamanho="sm"
                    className={css.acaoEmoji}
                    rotulo={`Reagir com ${emoji}`}
                    icone={<span aria-hidden>{emoji}</span>}
                    onClick={() => alternarReacao(message.id, emoji)}
                  />
                ))}

                <span className={css.acoesDivisa} aria-hidden />

                <BotaoDeIcone
                  tamanho="sm"
                  rotulo="Adicionar reação"
                  icone={<Smiley aria-hidden />}
                  onClick={aindaNao("emoji")}
                />
              </>
            ) : null}

            {pode(message.channelId, "responder") ? (
              <BotaoDeIcone
                tamanho="sm"
                rotulo="Responder"
                icone={<ArrowBendUpLeft aria-hidden />}
                onClick={() => responderA(message.channelId, message.id)}
              />
            ) : null}

            <BotaoDeIcone
              tamanho="sm"
              rotulo="Encaminhar"
              icone={<ArrowBendUpRight aria-hidden />}
              onClick={() =>
                administrar({ tipo: "encaminhar", messageId: message.id })
              }
            />

            <BotaoDeIcone
              tamanho="sm"
              rotulo="Criar tópico"
              icone={<ChatsCircle aria-hidden />}
              onClick={aindaNao("topicoDaMensagem")}
            />

            <BotaoDeIcone
              tamanho="sm"
              className={css.acaoMais}
              rotulo="Mais ações"
              icone={<DotsThree aria-hidden />}
              aria-haspopup="menu"
              onClick={(e) => abrirMenuDaLinha(e.currentTarget)}
            />
          </div>


            {!compacto && message.iniciaGrupo ? (
              <div className="flex items-baseline gap-08">
                {message.authorId ? (
                  /* `display: contents` — a caixa não existe, só o atributo
                     que diz ao menu de contexto quem é o autor daqui. */
                  <span className="contents" data-menu-autor={message.authorId}>
                    <NomeDoAutor userId={message.authorId} />
                    {/* O crachá de cargo — "VTX", "MOD". Assina o membro
                        sozinho; ver `CrachaDeCargo`. */}
                    <CrachaDeCargo userId={message.authorId} />
                  </span>
                ) : (
                  <span className="text-lg font-semibold text-text-2">
                    desconhecido
                  </span>
                )}
                {/*
                  ⚠ **Hora sem SEGUNDOS — mostrava `01:19:07`.**

                  O design escreve `14:07`. Segundo numa conversa não responde
                  pergunta nenhuma: ninguém decide nada com ele, e ele rouba
                  três caracteres da linha de cabeçalho toda vez.

                  O valor cheio fica no `dateTime`, que é onde ele serve — o
                  leitor de tela e qualquer ferramenta leem o instante exato.
                */}
                <time
                  className="text-xs text-text-3"
                  dateTime={new Date(message.createdAt).toISOString()}
                  title={message.createdAtText}
                >
                  {message.createdAtCurto}
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
              <EstadoDoEnvio message={message} />
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
              <Anexos anexos={message.anexos} messageId={message.id} />
            ) : null}

            {/* O cartão de link vem DEPOIS do anexo e antes das reações: o
                anexo é o que a pessoa mandou, o cartão é o que o servidor
                achou sobre o que ela escreveu. */}
            {message.embeds.length > 0 ? (
              <Embeds embeds={message.embeds} />
            ) : null}

            {/*
              ⚠ **"(editada)" na CONTINUAÇÃO, e ela não aparecia.**

              A marca morava só dentro do cabeçalho — e cabeçalho só existe na
              linha que ABRE o grupo. Numa conversa agrupada a maioria das
              linhas não abre grupo nenhum, então editar quase qualquer
              mensagem não deixava rastro visível.

              Aqui ela vai no fim do corpo, que é onde o próprio design a põe
              no modo compacto (`… vortex.dev/specs/permissoes (editado)`).
              No cabeçalho continua quando há cabeçalho: é onde o design a põe
              no modo confortável.
            */}
            {message.editedAt && !message.iniciaGrupo ? (
              <span className="ms-08 text-xs text-text-3">(editada)</span>
            ) : null}

            {/*
              A enquete, entre o cartão de link e as reações.

              É conteúdo da mensagem, como o anexo — vem depois do texto; e as
              reações continuam por último, porque elas são o que os outros
              responderam, não o que foi dito.
            */}
            {message.enquete ? (
              <EnqueteDaMensagem
                messageId={message.id}
                enquete={message.enquete}
              />
            ) : null}

            {message.reactions.length > 0 ? (
              <div className={css.reacoes}>
                {message.reactions.map((r) => (
                  <QuemReagiu key={r.emoji} reacao={r}>
                  <button
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
                  </QuemReagiu>
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

  /*
    Os dois menus, escolhidos pelo TIPO do alvo.

    O componente é um só porque o `ContextMenu` é um só — ver
    `store/menuDeMensagem.ts`. `alvo === null` (clique direito no vão entre
    linhas) devolve conteúdo vazio, que é melhor que agir sobre a mensagem do
    clique anterior.
  */
  if (alvo?.tipo === "usuario") return <ItensDoUsuario userId={alvo.userId} />;
  return <ItensDaMensagem messageId={alvo?.tipo === "mensagem" ? alvo.id : ""} />;
}

/**
 * O menu da mensagem, completo — os quinze alvos do design.
 *
 * Cinco blocos separados por régua, e a ordem não é arbitrária: reagir e
 * responder (o que se faz com a mensagem dos outros), editar e fixar (o que se
 * faz com a própria), copiar (o que se leva embora), e destrutivo por último.
 * Ação destrutiva no fim é a regra que o design escreve por extenso.
 */
function ItensDaMensagem({ messageId }: { messageId: string }) {
  const message = useMessage(messageId);
  const eu = usuarioLocalId();
  const local = lerLocal();

  if (!message) return <ContextMenuContent />;

  const souOAutor = message.authorId !== undefined && message.authorId === eu;
  const gerencio = pode(message.channelId, "fixar");
  /*
    Permalink só existe onde a ROTA existe.

    `/servidor/:s/canal/:c/:m` é a única forma de caminho que carrega uma
    mensagem; conversa direta é `/dm/:c` e para por aí. Renderizar "Copiar
    link" numa DM daria um link que abre o lugar certo na posição errada — que
    é pior que não ter o item, porque quem cola não descobre.
  */
  const linkavel = local.tipo === "servidor" && local.channelId !== undefined;

  return (
    <ContextMenuContent>
      {/*
        Conjunto RÁPIDO, não picker completo.

        Reação é gesto de um clique, e um clique que abre uma grade de mil
        ícones deixa de ser gesto. Estes quatro cobrem o comum; o `+` no fim da
        fila leva ao seletor, que é a pendência `emoji`.

        `asChild` para manter o `<button>`: o alvo continua sendo um botão de
        verdade para o ponteiro, e ganha `role="menuitem"` e a navegação por
        seta do Radix por cima. Sem isso as setas passam por cima deles e
        reagir por teclado não existe.
      */}
      {pode(message.channelId, "reagir") ? (
        <>
          <div className={css.rapidas} role="group" aria-label="Reagir">
            {REACOES_RAPIDAS.map((emoji) => (
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
            <ContextMenuItem asChild onSelect={aindaNao("emoji")}>
              <button type="button" className={css.rapida} aria-label="Mais emojis">
                <Plus aria-hidden />
              </button>
            </ContextMenuItem>
          </div>

          <ContextMenuSeparator />

          <ContextMenuItem onSelect={aindaNao("emoji")}>
            <Smiley aria-hidden />
            Adicionar reação
          </ContextMenuItem>
        </>
      ) : null}

      {pode(message.channelId, "responder") ? (
        <>
          <ContextMenuItem
            onSelect={() => responderA(message.channelId, message.id)}
          >
            <ArrowBendUpLeft aria-hidden />
            Responder
            <span className={menuAtalho}>R</span>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => responderA(message.channelId, message.id, false)}
          >
            <ArrowBendUpLeft aria-hidden />
            Responder sem mencionar
          </ContextMenuItem>
        </>
      ) : null}

      <ContextMenuItem
        onSelect={() => administrar({ tipo: "encaminhar", messageId: message.id })}
      >
        <ArrowBendUpRight aria-hidden />
        Encaminhar
      </ContextMenuItem>

      <ContextMenuItem onSelect={aindaNao("topicoDaMensagem")}>
        <ChatsCircle aria-hidden />
        Criar tópico
      </ContextMenuItem>

      <ContextMenuSeparator />

      {/*
        **Editar é só do AUTOR**, e a checagem não é de permissão de servidor:
        o protocolo não deixa ninguém editar mensagem alheia, nem quem
        administra. Apagar é do autor OU de quem gerencia mensagens.
      */}
      {souOAutor ? (
        <ContextMenuItem onSelect={() => editar(message.id)}>
          <PencilSimple aria-hidden />
          Editar
          <span className={menuAtalho}>E</span>
        </ContextMenuItem>
      ) : null}

      {gerencio ? (
        <ContextMenuItem onSelect={() => alternarFixada(message.id)}>
          {message.fixada ? <PushPinSlash aria-hidden /> : <PushPin aria-hidden />}
          {message.fixada ? "Desafixar mensagem" : "Fixar mensagem"}
        </ContextMenuItem>
      ) : null}

      <ContextMenuItem onSelect={aindaNao("marcarNaoLida")}>
        <EnvelopeSimple aria-hidden />
        Marcar como não lida
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        onSelect={() => void copiarTexto(message.content, "Texto")}
        disabled={message.content.length === 0}
      >
        <Copy aria-hidden />
        Copiar texto
      </ContextMenuItem>

      {linkavel ? (
        <ContextMenuItem
          onSelect={() =>
            void copiarTexto(
              `${location.origin}${caminhoDe(local)}/${message.id}`,
              "Link",
            )
          }
        >
          <Link aria-hidden />
          Copiar link
          <span className={menuAtalho}>&#8679;&#8984;C</span>
        </ContextMenuItem>
      ) : null}

      {/*
        "Remover embed" só aparece quando HÁ embed.

        O design o desenha sempre; aqui ele segue a regra do projeto, que é
        mais forte que a composição da tela — item que não tem sobre o que agir
        é ruído permanente para o caso mais comum, porque a maioria das
        mensagens não tem cartão de link nenhum.
      */}
      {message.embeds.length > 0 && souOAutor ? (
        <ContextMenuItem onSelect={aindaNao("removerEmbed")}>
          <Info aria-hidden />
          Remover embed
        </ContextMenuItem>
      ) : null}

      <ContextMenuSeparator />

      {souOAutor || gerencio ? (
        <ContextMenuItem
          perigo
          onSelect={() =>
            administrar({ tipo: "apagarMensagem", messageId: message.id })
          }
        >
          <Trash aria-hidden />
          Excluir mensagem
          <span className={menuAtalho}>&#9003;</span>
        </ContextMenuItem>
      ) : null}

      <ItemDeId id={message.id} />
    </ContextMenuContent>
  );
}

/**
 * O menu do usuário na timeline.
 *
 * Ele existe porque o design o desenha, e porque o caminho que havia — o
 * cartão de perfil no hover do avatar — responde "quem é" e não "o que eu faço
 * com essa pessoa". São perguntas diferentes e pedem alvos diferentes.
 *
 * O que é de MODERAÇÃO segue a regra da member list e some sem permissão; o
 * resto é do dia a dia e aparece para todo mundo.
 *
 * ⚠ **"Acima da sua hierarquia" existe agora, e é a ÚNICA coisa deste menu
 * que aparece desabilitada.** A distinção com o resto é o critério, não o
 * gosto: permissão que você nunca vai ter é ruído permanente e some;
 * hierarquia muda quando alguém troca de cargo, então é informação — dizer
 * "você não pode banir esta pessoa PORQUE ela está acima de você" é diferente
 * de esconder o item e deixar a pessoa procurando.
 */
function ItensDoUsuario({ userId }: { userId: string }) {
  const serverId = useServidorAtivo();
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const souEu = userId === usuarioLocalId();
  /* Canal ativo para as permissões — moderação é resolvida por canal em todo
     o resto do app, e este menu não pode ser a exceção. */
  const local = lerLocal();
  const canalId = local.tipo === "servidor" ? (local.channelId ?? "") : "";

  /*
    As três perguntas que a fase 6 destravou.

    `abaixoDeMim` vem do snapshot — a comparação é `inferiorTo` do SDK e roda
    na escrita, não aqui: `stoat.js` só pode ser importado dentro de `src/sdk/`.
  */
  const abaixo = membro?.abaixoDeMim === true;
  const podeGerenciarCargos = !souEu && abaixo && pode(canalId, "gerenciarCargos");
  const podeGerenciarApelido = souEu || (abaixo && pode(canalId, "gerenciarApelidos"));
  const podeMover = !souEu && abaixo && pode(canalId, "moverMembros");
  /*
    ⚠ Em voz é pergunta do STORE EFÊMERO de voz, e ele é keyed por canal — não
    há "onde está fulano". Varrer os canais aqui seria trabalho a cada abertura
    de menu; o que existe é o snapshot do membro dizendo se ele está em alguma
    sala, e ele já vem do adapter.
  */
  const emVoz = canalDeVozDe(userId) !== undefined;

  /*
    ⚠ **O item desabilitado com MOTIVO — e ele só existe quando o motivo é
    hierarquia.** Sem permissão nenhuma o bloco de moderação simplesmente não
    é renderizado (regra da member list); com permissão e hierarquia contra,
    ele aparece cinza dizendo por quê. Um item cinza sem motivo ensinaria a
    pessoa a tentar de novo.
  */
  /*
    ⚠ **O aviso e os três itens de moderação são EXCLUDENTES, e a primeira
    versão os deixou coexistir.** Medido no arnês: "Moderar · acima da sua
    hierarquia" apareceu cinza logo acima de "Expulsar" e "Banir" habilitados
    — a interface contradizendo a si mesma numa linha. `abaixo` gateia os três
    agora, e o aviso ocupa o lugar deles.
  */
  const barradoPorHierarquia =
    !souEu && !abaixo && membro !== undefined && pode(canalId, "expulsar");

  return (
    <ContextMenuContent className={menuLargo}>
      <div className={css.cabecalhoDoUsuario}>
        <Avatar
          sigla={membro?.sigla ?? "?"}
          url={membro?.avatarUrl}
          tamanho="sm"
          id={userId}
        />
        <div className={css.identidade}>
          <span className={css.identidadeNome}>
            {membro?.displayName ?? "desconhecido"}
          </span>
          <span className={css.identidadeUsuario}>{membro?.username ?? "—"}</span>
        </div>
      </div>

      <ContextMenuSeparator />

      <ContextMenuItem onSelect={aindaNao("perfilCompleto")}>
        <UserCircle aria-hidden />
        Ver perfil
      </ContextMenuItem>
      {!souEu ? (
        <>
          <ContextMenuItem onSelect={aindaNao("conversaDireta")}>
            <EnvelopeSimple aria-hidden />
            Mensagem
          </ContextMenuItem>
          <ContextMenuItem onSelect={aindaNao("ligar")}>
            <Phone aria-hidden />
            Ligar
          </ContextMenuItem>
        </>
      ) : null}

      {/*
        ⚠ **A seta VOLTOU, e com submenu de verdade.**

        Ela tinha saído porque prometia o que o app não podia cumprir: cargos
        exigia a tabela RESOLVIDA (quais são os do servidor E quais são os
        desta pessoa) e `MemberSnapshot` não carregava os IDs. `cargosIds`
        entrou na fase 6, e com ele os dois submenus deste menu.

        Uma seta que não abre nada é pior que a ausência dela — é o mesmo
        defeito do item sem `onSelect` que o lint deste projeto mata.
      */}
      {podeGerenciarCargos ? (
        <SubmenuDeCargos serverId={serverId} userId={userId} />
      ) : null}

      {podeGerenciarApelido ? (
        <ContextMenuItem
          onSelect={() =>
            administrar({ tipo: "apelido", serverId, userId })
          }
        >
          <PencilSimple aria-hidden />
          Alterar apelido
        </ContextMenuItem>
      ) : null}

      <ContextMenuItem onSelect={aindaNao("notaPrivada")}>
        <Note aria-hidden />
        Nota privada
      </ContextMenuItem>

      {!souEu ? (
        <>
          <ContextMenuSeparator />
          {/*
            ⚠ **Só aparece com a pessoa JÁ em voz.** `voice_channel` MOVE, não
            convoca — o protocolo devolve 400 para quem não está em sala
            nenhuma, e um item que falha sempre é o mesmo defeito que a seta
            sem submenu era.
          */}
          {emVoz && podeMover ? (
            <SubmenuDeVoz serverId={serverId} userId={userId} />
          ) : null}
          <ContextMenuItem onSelect={aindaNao("silenciarUsuario")}>
            <ProhibitInset aria-hidden />
            Silenciar só para mim
          </ContextMenuItem>
        </>
      ) : null}

      {barradoPorHierarquia ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem disabled className={css.barrado}>
            <Hammer aria-hidden />
            Moderar · acima da sua hierarquia
          </ContextMenuItem>
        </>
      ) : null}

      {!souEu && abaixo && pode(canalId, "silenciarMembro") ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            perigo
            onSelect={() =>
              administrar({ tipo: "moderar", serverId, userId, acao: "castigo" })
            }
          >
            <ProhibitInset aria-hidden />
            Castigar (timeout)
          </ContextMenuItem>
        </>
      ) : null}
      {!souEu && abaixo && pode(canalId, "expulsar") ? (
        <ContextMenuItem
          perigo
          onSelect={() =>
            administrar({ tipo: "moderar", serverId, userId, acao: "expulsar" })
          }
        >
          <SignOut aria-hidden />
          Expulsar do servidor
        </ContextMenuItem>
      ) : null}
      {!souEu && abaixo && pode(canalId, "banir") ? (
        <ContextMenuItem
          perigo
          onSelect={() =>
            administrar({ tipo: "moderar", serverId, userId, acao: "banir" })
          }
        >
          <Hammer aria-hidden />
          Banir do servidor
        </ContextMenuItem>
      ) : null}
    </ContextMenuContent>
  );
}
