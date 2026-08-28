import { At, ChatCircleDots } from "@phosphor-icons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

import { aoTerminarArraste, estaArrastando } from "../store/arraste";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";
import { ID_DO_NOME_DO_CANAL } from "../canais/CabecalhoDeCanal";
import { definirAlvoDoMenu } from "../store/menuDeMensagem";
import {
  lerFocoDeMensagem,
  limparFocoDeMensagem,
  moverFocoDeMensagem,
} from "../store/focoDeMensagem";
import { count, readCounters } from "../dev/stats";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import {
  definirLongeDoFim,
  esquecerLongeDoFim,
  ouvirFimDaLista,
  ouvirIrParaMensagem,
  pedirFocoNoComposer,
} from "../store/comandos";
import {
  messages,
  primeiraNaoLida,
  proximaMencao,
  temMencao,
} from "../sdk/adapter";
import type {
  AnexoSnapshot,
  BlocoDeMensagem,
  EmbedSnapshot,
} from "../sdk/domain";
import { useChannelMessageIds } from "../store/hooks";
import css from "./MessageList.module.css";
import { MenuDaMensagem, MessageRow } from "./MessageRow";

/**
 * Quão longe do fim ainda conta como "no fim".
 *
 * Um número só, usado nos dois lugares que precisam concordar: o
 * `followOnAppend` do virtualizador e a nossa própria noção de estar colado.
 * Divergirem significaria a lista se achar colada enquanto o virtualizador já
 * desistiu de seguir — o estado exato que aprovou uma corrida de firehose
 * contra um app parado, na fase 0.
 */
const LIMIAR_DE_FIM = 80;

/**
 * A partir de quantos pixels do fim o "Ir para o presente" aparece.
 *
 * Uma tela inteira, aproximadamente. É a distância a partir da qual voltar ao
 * fim deixa de ser um gesto de rolagem e passa a valer um atalho — abaixo
 * disso o botão seria ruído que aparece e some a cada movimento do dedo.
 *
 * Deliberadamente MUITO maior que `LIMIAR_DE_FIM`: os dois respondem perguntas
 * diferentes, e usar o mesmo número faria o botão piscar junto do
 * `followOnAppend`.
 */
const LIMIAR_DE_LONGE = 800;

/**
 * Altura estimada de linha — MEDIDA, não chutada.
 *
 * Os 44px da fase 0 nunca foram medidos: foram estimados antes de existir
 * linha com agrupamento, divisor de data e estado de envio. O arnês mede a
 * altura real das linhas visíveis e reporta ao lado da estimada; deu 72,6px e
 * 72,7px em corridas distintas.
 *
 * Errar a estimativa não quebra nada — a compensação do virtualizador absorve
 * —, mas faz a barra de rolagem mentir sobre o tamanho do histórico e dá
 * trabalho de compensação a cada rolagem. Trocar 44 por 73 NÃO mudou o gate;
 * está aqui por correção, não por performance, e o relatório do arnês existe
 * para que o dia em que a linha mudar de forma isso apareça.
 *
 * **E apareceu, que é o ponto de o relatório existir.** O conserto do ritmo de
 * agrupamento (`py-0.5` era classe morta: a escala vai de 1 a 6 e
 * `--spacing-0.5` não existe, então a lista rodava com 0px dentro do grupo)
 * acrescentou 4px por linha, e o arnês passou a medir 75,6px em duas janelas
 * seguidas. 73 → 76.
 *
 * **E de novo com as reações.** Os chips deixaram de ser `<span>` e viraram
 * botões com borda e respiro; a média subiu para 78,3px. 76 → 78. É a terceira
 * vez que este número se move por mudança de forma da linha, e as três foram
 * pegas pelo mesmo relatório — a estimativa errada não quebra nada, mas faz a
 * barra de rolagem mentir sobre o tamanho do histórico.
 *
 * **78 → 99**, com a remoção da medida de leitura: o arnês mede 98,7px de média
 * agora. Este número é só o piso de quem ainda não resolveu — a estimativa que
 * vale para linha resolvida é a por TIPO, logo abaixo —, mas ele estava 27%
 * errado e é o que a barra de rolagem usa enquanto o histórico não chegou.
 */
export const ALTURA_ESTIMADA = 99;

/**
 * A estimativa por TIPO de linha.
 *
 * A média única de 78px era um compromisso entre coisas que não se parecem:
 * uma linha de sistema é uma frase de uma linha com ícone, e uma linha que
 * abre grupo carrega nome, hora e o respiro de 16px que a continuação não tem.
 * Estimar as três pelo mesmo número faz a barra de rolagem errar na proporção
 * da frequência de cada tipo — e essa frequência muda com a conversa.
 *
 * **Os três números foram medidos, não escolhidos.** O arnês passou a reportar
 * a altura real partida por tipo justamente para isto: a ordem inversa —
 * escrever a constante e conferir depois — é como o `estimateSize: 44`
 * sobreviveu três fases errando 34px por linha.
 *
 * Medido no arnês, com o mesmo build e a mesma janela do gate: **92,4px abre
 * grupo · 59,7px continua · 37,1px sistema**.
 *
 * **Sexta vez que estes números se movem, e a segunda seguida por causa da
 * largura do TEXTO — que é o que este comentário já avisava.** A medida de
 * leitura foi removida da linha a pedido de quem usa (o texto de 520px numa
 * trilha de 2000 lia como alinhamento quebrado), o texto voltou a ocupar a
 * coluna, e a linha voltou a quebrar em menos linhas. Os valores caíram de
 * volta para praticamente os de antes da medida: 119,4 → 92,4 e 90,0 → 59,7,
 * contra os 92,5 · 60,6 originais.
 *
 * Que eles tenham voltado ao ponto de partida é a confirmação de que o driver
 * é mesmo a largura do texto, e não outra coisa que mudou no meio.
 *
 * ⚠ E o preço da remoção está aqui, em número: sem a medida, a altura da linha
 * volta a DEPENDER DO TAMANHO DA JANELA. Enquanto havia teto de 520px, o texto
 * tinha largura fixa em qualquer tela; agora estas três constantes descrevem a
 * janela do gate e erram em telas muito mais estreitas ou mais largas. O que as
 * mantém aceitáveis é o que elas servem — a barra de rolagem antes de o
 * histórico ser visto —, e a assertion abaixo avisa quando a forma mudar.
 *
 * A constante única de 78px
 * superestimava a linha de continuação em quase 30% e a de sistema em mais do
 * DOBRO — e linha de sistema é a que mais aparece em servidor movimentado,
 * onde entra e sai gente o tempo todo.
 *
 * ⚠ **Estes números dependem da LARGURA da coluna**, e é honesto dizer isso:
 * a mesma medição no painel estreito do navegador embutido, com a coluna em
 * 538px em vez do teto de 1100px, deu 143px e 83px — o texto quebra em mais
 * linhas. A constante única tinha o mesmo problema e ninguém o havia
 * escrito. O que a torna aceitável é o que ela serve: a barra de rolagem
 * enquanto o histórico ainda não foi visto. Assim que a linha aparece, o
 * virtualizador mede a real. Um erro por largura é pequeno; a diferença entre
 * 37 e 78 numa linha de sistema não era.
 *
 * O que NÃO entra aqui: reações, citação e divisores. Todos mudam a altura, e
 * todos são condicionais que o virtualizador remede de qualquer jeito assim
 * que a linha aparece. Encher a fórmula de casos raros troca um erro pequeno e
 * constante por um erro pequeno e imprevisível.
 */
const ALTURA_POR_TIPO = {
  sistema: 37,
  /*
    ⚠ **Sétima vez que estes números se movem, e desta vez a defasagem tinha
    CONSEQUÊNCIA MEDIDA — não era só a barra de rolagem mentindo.**

    O gate reprovou três corridas seguidas com `CORRIDA INVÁLIDA — lista a
    ~54.000px do fim, followOnAppend desligado`, e o relatório trazia a causa
    na mesma linha: `altura real 125,3px (estimando 99px)`.

    O mecanismo: com `anchorTo: "end"`, cada linha que MEDE mais do que
    estimava empurra o conteúdo para baixo, e a compensação do virtualizador
    tem um frame de atraso. A 26px de erro por linha e ~80 mensagens/s, isso é
    ~2.000px/s. Medido no navegador, com o firehose rodando e a lista partindo
    de zero: 0 · 0 · 1.816 · 6.211 · 10.800 · 15.013px em 11 segundos — uma
    reta. Passado o limiar de 80px, `followOnAppend` desliga e não volta: a
    lista para de seguir e o gate mede um app PARADO, que é exatamente o modo
    de falha que aprovou uma bateria inteira na fase 0.

    Os números vieram do próprio relatório do gate, medindo a linha atual:
    **125,1px abre grupo · 85,9px continua**. Cresceram porque a linha
    cresceu — crachá de cargo, indicador de fixada e o nome em peso maior.

    Isto NÃO é otimização, é correção: a estimativa descreve a linha que
    existe, e quando ela para de descrever, quem quebra é a âncora.
  */
  abreGrupo: 125,
  continua: 86,
};

/**
 * A estimativa ainda descreve a linha que existe?
 *
 * Este número já se moveu quatro vezes — 44 → 73 → 76 → 78 — e nas quatro
 * quem percebeu foi uma pessoa lendo o relatório do arnês e reparando na
 * diferença. Relatório depende de alguém olhar; assertion não.
 *
 * Sobe um degrau na ordem do `enforcement.md`, de "checklist" para "assertion
 * em dev", e o custo é uma divisão por frame com 30 linhas na tela. Some em
 * produção.
 *
 * 15% é frouxo de propósito: mensagem longa e mensagem curta variam muito
 * dentro do mesmo tipo, e o alvo aqui é mudança de FORMA da linha — um chip
 * que ganhou borda, um respiro que apareceu —, não a variação natural de
 * conteúdo. Uma vez por tipo por sessão, senão vira ruído a 150fps.
 */
/**
 * A altura que os anexos acrescentam — CALCULADA, não estimada.
 *
 * É o caso raro em que a estimativa pode ser exata: a caixa da mídia não
 * depende do arquivo, depende do metadata que o protocolo já mandou. Os mesmos
 * três termos do `min` do CSS, em número.
 *
 * Sem isto, uma linha com imagem é subestimada em algumas centenas de pixels.
 * Com anexo em uma mensagem a cada dezessete, a barra de rolagem passaria a
 * mentir sobre o histórico inteiro na proporção dessa frequência — que é
 * exatamente o problema que a estimativa existe para não ter.
 */
const TETO_DE_LARGURA = 400;
const TETO_DE_ALTURA = 340;
const ALTURA_DE_ARQUIVO = 41;
const RESPIRO_DE_ANEXO = 8;

function alturaDeAnexos(anexos: readonly AnexoSnapshot[]): number {
  if (anexos.length === 0) return 0;

  let total = RESPIRO_DE_ANEXO;
  for (const a of anexos) {
    if (!a.largura || !a.altura) {
      total += ALTURA_DE_ARQUIVO;
      continue;
    }
    const proporcao = a.largura / a.altura;
    // A mesma conta do CSS: a largura é o menor dos três limites, e a altura
    // sai dela pela proporção.
    const largura = Math.min(TETO_DE_LARGURA, TETO_DE_ALTURA * proporcao);
    total += largura / proporcao;
  }
  return Math.round(total);
}

/**
 * A altura que um cartão de link acrescenta.
 *
 * ⚠ **CÁLCULO exato, não estimativa — e é o que faz o embed caber na lista
 * virtualizada sem mover a âncora.** A caixa do cartão é fixa por construção:
 * a miniatura é 72×56, a descrição é cortada em duas linhas, e o padding é da
 * escala. Nada aqui depende de um byte chegar da rede, ao contrário da imagem
 * de anexo — que também é exata, mas a partir do metadata do protocolo.
 *
 * ⚠ **O número foi MEDIDO, e a conta a priori errou por 21px.** Somando o que
 * o CSS declara — 12px de padding nos dois lados, mais origem (16) + título
 * (21) + duas linhas de descrição (2 × 19) e os respiros — dava 84. A régua no
 * navegador deu **105px**, com e sem miniatura (o texto é mais alto que os
 * 56px dela nos dois casos).
 *
 * Escrever a constante e conferir depois é exatamente como o `estimateSize: 44`
 * sobreviveu três fases errando 34px por linha, e a diferença é que aqui o erro
 * era para BAIXO: subestimar faz a linha crescer depois de medida, e altura
 * crescendo debaixo do virtualizador desloca a âncora. Superestimar só erra a
 * barra de rolagem.
 *
 * Cartão sem título ou sem descrição é menor, e a conta não desce por isso —
 * pelo mesmo motivo: o erro seguro é para cima.
 */
const ALTURA_DE_CARTAO = 105;
const RESPIRO_DE_CARTAO = 8;

function alturaDeEmbeds(embeds: readonly EmbedSnapshot[]): number {
  if (embeds.length === 0) return 0;
  return (
    RESPIRO_DE_CARTAO +
    embeds.length * ALTURA_DE_CARTAO +
    // O `gap` entre cartões, quando há mais de um: `--vx-space-1`.
    (embeds.length - 1) * 4
  );
}

/**
 * A altura que os blocos de markdown acrescentam.
 *
 * **Só bloco de código e lista entram, e a escolha segue a política que já
 * estava escrita acima:** casos raros ficam de fora da fórmula porque o
 * virtualizador remede assim que a linha aparece, e encher a conta troca um
 * erro pequeno e constante por um erro pequeno e imprevisível. Título,
 * citação, régua e parágrafo extra são deltas de uma linha — ficam de fora,
 * como reação e citação já ficavam.
 *
 * Estes dois entram pelo mesmo critério que fez o anexo entrar, que é
 * MAGNITUDE e não frequência: um bloco de vinte linhas mede ~440px contra uma
 * linha de 119px. Errar isso é a barra de rolagem mentir na proporção da
 * frequência de código no canal — e num canal de quem programa ela não é
 * pequena.
 *
 * A conta é aproximada de propósito e não tenta ser o CSS: quebra de linha
 * longa dentro do bloco não é contada porque o bloco NÃO quebra linha (ele
 * rola na horizontal), então contar `\n` é exato para a altura.
 */
const LINHA_DE_CODIGO = 18;
/** Recheio (12×2), borda (1×2) e margem (8×2) do `pre`. */
const MOLDURA_DE_BLOCO = 42;
const LINHA_DE_LISTA = 23;
/** Margem de bloco (8×2) da lista. */
const MOLDURA_DE_LISTA = 16;

function alturaDeBlocos(blocos: readonly BlocoDeMensagem[]): number {
  let extra = 0;
  for (const b of blocos) {
    if (b.tipo === "blocoDeCodigo") {
      // `split` alocaria um array por linha por chamada, e isto roda para
      // índices fora da tela a cada rolagem.
      let linhas = 1;
      for (let i = 0; i < b.valor.length; i++) {
        if (b.valor.charCodeAt(i) === 10) linhas++;
      }
      extra += linhas * LINHA_DE_CODIGO + MOLDURA_DE_BLOCO;
    } else if (b.tipo === "lista") {
      extra += b.itens.length * LINHA_DE_LISTA + MOLDURA_DE_LISTA;
    }
  }
  return extra;
}

/** A linha tem bloco que a fórmula estima? Decide a amostra por tipo. */
function temBlocoPesado(blocos: readonly BlocoDeMensagem[]): boolean {
  return blocos.some((b) => b.tipo === "blocoDeCodigo" || b.tipo === "lista");
}

const AVISADO = new Set<string>();

function conferirEstimativa(tipo: keyof typeof ALTURA_POR_TIPO, media: number) {
  if (AVISADO.has(tipo)) return;
  const esperada = ALTURA_POR_TIPO[tipo];
  if (esperada <= 0) return;
  const erro = Math.abs(media - esperada) / esperada;
  if (erro < 0.15) return;

  AVISADO.add(tipo);
  console.error(
    `[vortex] a estimativa de altura da linha "${tipo}" está a ` +
      `${(erro * 100).toFixed(0)}% do real: estima ${esperada}px, mede ` +
      `${media.toFixed(1)}px. A linha mudou de forma. Estimativa errada não ` +
      `quebra nada — só faz a barra de rolagem mentir sobre o tamanho do ` +
      `histórico, a cada rolagem, para sempre.`,
  );
}

/**
 * Lista de mensagens virtualizada, em modo chat.
 *
 * Ordem normal e container de scroll normal — nada de `column-reverse`,
 * transform invertido ou compensação manual de `scrollTop`. Essas gambiarras
 * clássicas de chat deixaram de ser necessárias, e cada uma quebra seleção de
 * texto ou acessibilidade.
 */
export function MessageList({ channelId }: { channelId: string }) {
  const ids = useChannelMessageIds(channelId);
  count("listRenders");
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    /*
      Lê o snapshot direto do store, e isso é seguro: `getSnapshot` de um
      `EntityStore` é uma leitura de `Map`, não um hook. O virtualizador chama
      isto fora do render, para índices que ainda não estão na tela — é
      exatamente o caso onde não há componente para perguntar.
    */
    estimateSize: (i) => {
      const m = messages.getSnapshot(ids[i] ?? "");
      if (!m) return ALTURA_ESTIMADA;
      const porTipo = m.sistema
        ? ALTURA_POR_TIPO.sistema
        : m.iniciaGrupo
          ? ALTURA_POR_TIPO.abreGrupo
          : ALTURA_POR_TIPO.continua;

      // Anexo é exato, não estimado: a caixa vem do metadata, não do arquivo.
      // Bloco de código e lista entram pelo mesmo critério de magnitude.
      const comAnexos =
        porTipo > 0
          ? porTipo +
            alturaDeAnexos(m.anexos) +
            alturaDeBlocos(m.blocos) +
            alturaDeEmbeds(m.embeds)
          : 0;

      /*
        Nunca zero, e isto não é paranoia: `estimateSize` devolvendo 0 é a
        MESMA armadilha da linha que mede 0px — o total encolhe, a janela
        visível muda e o ciclo se realimenta. Uma constante ainda não medida
        cai na média única, que é o valor que existia antes.
      */
      return comAnexos > 0 ? comAnexos : ALTURA_ESTIMADA;
    },
    // ID de entidade, nunca índice: índice corrompe o estado da linha a cada
    // inserção no topo.
    getItemKey: (i) => ids[i] ?? i,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: LIMIAR_DE_FIM,
    overscan: 6,
    // NÃO passar `useFlushSync: false`. Medido no spike: sem o flush
    // síncrono a compensação estimativa→real não segura a âncora — o
    // scrollToEnd inicial fica ~1000px atrás do fim, o followOnAppend nunca
    // engata (threshold 80px) e a lista deriva ~880px/s. Com o default, a
    // distância oscila 1–23px. O preço são warnings "flushSync was called
    // from inside a lifecycle method" no console em dev — o adapter React
    // do TanStack chama flushSync no ciclo de vida e o React cai no
    // fallback assíncrono. Barulhento, funcional.
  });

  /**
   * Estava colado no fim ANTES da mudança?
   *
   * Precisa ser lido no scroll e guardado, não perguntado depois: quando o
   * ResizeObserver dispara, o layout novo já valeu e a distância até o fim já
   * é a de depois. Perguntar tarde responde sempre a pergunta errada — é a
   * mesma armadilha da medição do prepend, onde a linha de base tinha que ser
   * a intenção e não o resultado observado.
   */
  const colado = useRef(true);

  /** O `div` cuja altura é `getTotalSize()` — cresce quando o conteúdo cresce. */
  const medidaRef = useRef<HTMLDivElement | null>(null);

  /**
   * A pessoa está dirigindo a rolagem AGORA?
   *
   * ⚠ **Sem esta distinção, `colado` não é intenção — é posição, e posição
   * mente.** A lista se afasta do fim por duas razões completamente
   * diferentes: alguém rolou para ler o histórico, ou o conteúdo cresceu
   * embaixo (linha nova medindo mais que a estimativa). Um `scroll` listener
   * vê as duas do mesmo jeito.
   *
   * Marcado por gesto — roda, toque, tecla — e apagado no quadro seguinte.
   * Não existe forma de perguntar ao evento `scroll` quem o causou.
   */
  const dirigindo = useRef(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    /*
      O valor mais recente e o quadro agendado.

      `let` de closure e não `useRef`: eles vivem exatamente o tempo deste
      efeito, e um ref sobreviveria à troca de canal carregando o quadro do
      canal anterior.
    */
    let pendente = false;
    let quadro = 0;

    /*
      Gesto humano: marca por um quadro. Passivo, e só isso — não decide nada
      sozinho, apenas autoriza o `scroll` seguinte a DESCOLAR.
    */
    let limpeza = 0;
    const aoDirigir = () => {
      dirigindo.current = true;
      if (limpeza !== 0) clearTimeout(limpeza);
      // 150ms: uma roda de mouse emite uma rajada de eventos com o `scroll`
      // vindo atrás. Zerar no mesmo quadro perderia o fim da rajada.
      limpeza = window.setTimeout(() => {
        dirigindo.current = false;
      }, 150);
    };

    const TECLAS_DE_ROLAGEM = new Set([
      "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ",
    ]);
    const aoTeclar = (evento: KeyboardEvent) => {
      if (TECLAS_DE_ROLAGEM.has(evento.key)) aoDirigir();
    };

    const aoRolar = () => {
      const noFim =
        element.scrollHeight - element.clientHeight - element.scrollTop <=
        LIMIAR_DE_FIM;

      /*
        ⚠ **DESCOLAR exige gesto; COLAR não.**

        Era `colado = noFim` puro, e era o mesmo limiar de 80px que o
        `followOnAppend` do virtualizador usa. Quando ele desistia, a nossa
        rede de segurança já tinha desistido junto — as duas medindo posição,
        nenhuma medindo intenção. Chegar ao fim sempre significa "quero
        seguir"; afastar-se dele só significa isso quando foi a PESSOA que
        se afastou.
      */
      if (noFim) colado.current = true;
      else if (dirigindo.current) colado.current = false;

      /*
        Conta ao composer se estamos longe do fim — o "Ir para o presente".

        ⚠ **`LIMIAR_DE_LONGE` e não `LIMIAR_DE_FIM`, e os dois limiares são
        perguntas diferentes.** `colado` decide se a lista SEGUE mensagem nova,
        e 80px é o certo para isso: quem rolou um dedo ainda quer seguir. O
        botão responde outra coisa — "você está longe o bastante para precisar
        de um atalho de volta" —, e aparecer a 80px do fim seria um botão
        piscando a cada rolagem pequena.

        ⚠ **Coalescido em `requestAnimationFrame`, e a primeira versão NÃO
        era — ela travou a aba.** Publicar aqui dentro é publicar no meio do
        `flushSync` do virtualizador: o React entra em render enquanto já está
        renderizando, o console enche de `flushSync was called from inside a
        lifecycle method`, e o renderizador para de responder. Não deu erro
        nenhum — deu uma aba morta, que é o modo de falha que este projeto
        documenta como o mais caro.

        Isto não é caso especial: distância-até-o-fim muda dezenas de vezes por
        segundo e é exatamente a família que a lei nº 1 nomeia — presença,
        digitação, quem está falando. Todas coalescem na fronteira. O padrão é
        o mesmo do `flushPublications` do adapter.
      */
      pendente = element.scrollHeight - element.clientHeight - element.scrollTop >
        LIMIAR_DE_LONGE;
      if (quadro === 0) {
        quadro = requestAnimationFrame(() => {
          quadro = 0;
          definirLongeDoFim(channelId, pendente);
        });
      }
    };

    element.addEventListener("scroll", aoRolar, { passive: true });
    element.addEventListener("wheel", aoDirigir, { passive: true });
    element.addEventListener("touchstart", aoDirigir, { passive: true });
    element.addEventListener("keydown", aoTeclar);
    return () => {
      element.removeEventListener("scroll", aoRolar);
      element.removeEventListener("wheel", aoDirigir);
      element.removeEventListener("touchstart", aoDirigir);
      element.removeEventListener("keydown", aoTeclar);
      if (limpeza !== 0) clearTimeout(limpeza);
      // Erro nº 5 do briefing: quadro agendado sem cancelamento publica num
      // canal que já saiu da tela.
      if (quadro !== 0) cancelAnimationFrame(quadro);
      /*
        Quem escreve é quem esquece.

        A lista está saindo da tela — trocou de canal, ou o painel fechou. Sem
        isto, voltar ao canal mostraria "Ir para o presente" sobre uma lista
        que já está no fim, porque a última resposta ficaria guardada.
      */
      esquecerLongeDoFim(channelId);
    };
  }, [channelId]);

  /**
   * O CONTEÚDO cresceu — reancora, mesmo que o virtualizador já tenha desistido.
   *
   * ⚠ **Esta é a metade que faltava, e a falta reprovava o gate.** O
   * `followOnAppend` do TanStack só engata se, no instante em que `setOptions`
   * roda, a lista estiver a menos de `scrollEndThreshold` do fim. Passou disso
   * uma vez, ele não volta — e a lista só precisa passar UMA vez.
   *
   * Como ela passa: linha nova nasce com a altura ESTIMADA, é medida logo
   * depois, e a diferença cresce o conteúdo embaixo sem mover o `scrollTop`.
   * Sob carga alta chegam várias por quadro, e o erro soma. Medido no
   * navegador, com o firehose e a lista partindo de zero: 0 · 0 · 1.816 ·
   * 6.211 · 10.800 · 15.013px em 11 segundos — uma reta de ~2.000px/s. O gate
   * reprovava com `lista a 54.173px do fim, followOnAppend desligado`, e o
   * mesmo número em corridas diferentes porque o firehose é determinístico.
   *
   * ⚠ **Melhorar a estimativa NÃO resolve — só adia.** Ela corrige o tamanho
   * do erro por linha, não o fato de o engate ser irreversível; basta um pico
   * de carga para cruzar o limiar de novo. Foi por isso que a correção das
   * constantes (92→125, 60→86), que era devida por outros motivos, não moveu o
   * veredito.
   *
   * ⚠ **A/B de uma linha, mesma máquina e mesma condição (2x, vazão 497/500).**
   * Desligando só a chamada abaixo, o gate volta a reprovar com
   * `INVÁLIDA — lista a 55.361px do fim`, e a trilha mostra o mecanismo cru:
   *
   * ```
   * 3,0s d=0     st=998367 sh=998851
   * 4,0s d=974   st=999651 sh=1001109   ← cruzou o limiar
   * 5,0s d=2937  st=999673 sh=1003094
   * 6,0s d=5001  st=999704 sh=1005189
   * ```
   *
   * O `scrollTop` CONGELA em ~999.700 enquanto o conteúdo segue crescendo.
   * Não é lentidão: é o engate desligado. Com a chamada ligada, a mesma
   * corrida diz `âncora ok` e a distância fica em zero as 30 janelas inteiras.
   *
   * O `ResizeObserver` é sobre o elemento MEDIDOR — o `div` cuja altura é
   * `getTotalSize()` —, não sobre o container. São eventos diferentes: o
   * container muda quando a JANELA muda, o medidor muda quando o CONTEÚDO
   * muda. O de container já existia logo abaixo e nunca dispararia aqui.
   */
  useEffect(() => {
    const medidor = medidaRef.current;
    const rolagem = scrollRef.current;
    if (!medidor || !rolagem) return;

    let ultimaAltura = medidor.getBoundingClientRect().height;

    const observador = new ResizeObserver(() => {
      const altura = medidor.getBoundingClientRect().height;
      const cresceu = altura > ultimaAltura;
      ultimaAltura = altura;

      /*
        Só quando CRESCE e só quem quer estar no fim.

        Encolher é caso de mensagem apagada, e ali a posição de leitura de quem
        está no histórico é mais importante que a âncora. E sem o `colado`
        isto arrastaria para o fim alguém que está lendo o histórico enquanto o
        canal recebe mensagem — que é o pior defeito que uma lista de chat tem.
      */
      if (!cresceu || !colado.current) return;

      /*
        `scrollToEnd` do virtualizador e não `scrollTop = scrollHeight`.

        O virtualizador mantém um offset próprio e ajustes pendentes; escrever
        no DOM por fora deixa os dois discordando, e a discordância aparece
        como um salto no próximo quadro em que ele reconcilia.
      */
      virtualizer.scrollToEnd();
    });

    observador.observe(medidor);
    return () => observador.disconnect();
  }, [virtualizer]);

  /**
   * Lei nº 6, antecipada para a fase 0 — e agora nas duas dimensões.
   *
   * LARGURA mudou = remedir. Na fase 4 a causa será o usuário arrastando a
   * borda de um slot, mas as causas já existem: janela redimensionada, sidebar
   * colapsando, popout, painel de thread abrindo.
   *
   * ALTURA mudou = reancorar. Esta causa nasceu com o composer, que cresce
   * enquanto a pessoa escreve.
   *
   * As assertions existem para o dia em que alguém mexer aqui e esquecer uma
   * das duas — falham alto em dev, custam zero em produção.
   */
  const ultimaLargura = useRef(0);
  const ultimaAltura = useRef(0);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    let ativo = true;

    const observer = new ResizeObserver(([entry]) => {
      const largura = entry?.contentRect.width ?? 0;
      const altura = entry?.contentRect.height ?? 0;

      if (largura !== ultimaLargura.current) {
        ultimaLargura.current = largura;

        /**
         * Durante o arraste de um slot, NÃO remede.
         *
         * A regra vem da referência da fase 4 — "remedir e reancorar após o
         * commit, nunca durante o arraste" — e o motivo é o custo: a coluna
         * muda de largura a cada frame do arraste, e este callback remede
         * todas as linhas. Somados, viram uma remedição completa por frame
         * enquanto alguém segura o mouse.
         *
         * O trabalho não é descartado, é adiado: `aoTerminarArraste` abaixo
         * faz a mesma coisa uma vez só, quando o commit acontece.
         */
        if (estaArrastando()) return;

        virtualizer.measure();

        if (import.meta.env.DEV && virtualizer.getVirtualItems().length > 0) {
          const medidas = virtualizer.measurementsCache.length;
          const total = virtualizer.options.count;
          if (medidas !== total) {
            console.warn(
              "[vortex] largura do container mudou e a remedição não cobriu " +
                `todas as linhas (${medidas}/${total}). A âncora vai saltar.`,
            );
          }
        }
      }

      /**
       * ALTURA mudou — e o navegador não devolve a âncora sozinho.
       *
       * O composer crescendo uma linha encolhe este container. O `scrollTop`
       * continua válido e é preservado, então a distância até o fim AUMENTA
       * pela altura que sumiu. Duas ou três linhas digitadas bastam para
       * passar do `LIMIAR_DE_FIM`, e aí `followOnAppend` desliga em silêncio:
       * a pessoa digita e as mensagens dos outros param de aparecer.
       *
       * É o mesmo modo de falha que fez uma bateria de PASS medir uma lista
       * parada na fase 0, por outra causa. Por isso a defesa é a mesma: quem
       * estava no fim, volta ao fim.
       */
      if (altura !== ultimaAltura.current) {
        const encolheu = altura < ultimaAltura.current;
        ultimaAltura.current = altura;

        if (colado.current) {
          virtualizer.scrollToEnd();

          if (import.meta.env.DEV && encolheu) {
            // Dois frames: um para o scroll valer, outro para a remedição.
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                if (!ativo) return;
                const distancia =
                  element.scrollHeight -
                  element.clientHeight -
                  element.scrollTop;
                if (distancia > LIMIAR_DE_FIM) {
                  console.warn(
                    "[vortex] a altura do container encolheu, a lista estava " +
                      `no fim e terminou a ${Math.round(distancia)}px dele. ` +
                      "followOnAppend vai desligar em silêncio.",
                  );
                }
              }),
            );
          }
        }
      }
    });

    observer.observe(element);
    return () => {
      ativo = false;
      observer.disconnect();
    };
    // `ids.length` NÃO entra aqui: durante o firehose isso desconectaria e
    // reconectaria o observer a cada frame. A contagem vem do virtualizador,
    // que já a conhece.
  }, [virtualizer]);

  /**
   * Fim do arraste de slot: remede agora, uma vez.
   *
   * Precisa de evento próprio porque o commit no store não muda tamanho
   * nenhum — a largura já foi escrita no DOM durante o arraste, então o
   * `ResizeObserver` não dispara de novo. Sem isto, a remedição adiada
   * simplesmente nunca aconteceria, e a lista ficaria com alturas medidas
   * numa largura que não existe mais.
   */
  useEffect(
    () =>
      aoTerminarArraste(() => {
        virtualizer.measure();
        if (colado.current) virtualizer.scrollToEnd();
      }),
    [virtualizer],
  );

  /**
   * "Enviei — me leva para o fim."
   *
   * Effect é o uso correto aqui: sincronizar com um sistema externo. O
   * composer não conhece esta lista, e continua não conhecendo quando os dois
   * estiverem em painéis diferentes.
   */
  useEffect(
    () => ouvirFimDaLista(channelId, () => virtualizer.scrollToEnd()),
    [channelId, virtualizer],
  );

  /**
   * "Me leva até a mensagem citada."
   *
   * O índice é procurado NA HORA, não guardado: a lista muda de tamanho o
   * tempo todo, e um índice memoizado apontaria para a linha errada depois do
   * primeiro prepend. `indexOf` num array de 10 mil é microssegundos, e isto
   * roda por clique humano.
   *
   * `align: "center"` e não `"start"`: quem salta quer LER o contexto em volta
   * da mensagem, e encostá-la no topo esconde justamente o que veio antes
   * dela — que é metade da razão de ter clicado.
   */
  useEffect(
    () =>
      ouvirIrParaMensagem(channelId, (messageId) => {
        const indice = ids.indexOf(messageId);
        // Fora do histórico carregado: silêncio é a resposta certa por ora.
        // Buscar o trecho anterior é caminho de rede, e é fase 6.
        if (indice === -1) return;
        virtualizer.scrollToIndex(indice, { align: "center" });
      }),
    [channelId, ids, virtualizer],
  );

  /**
   * `scrollToEnd()` após a carga inicial — a regra de component-primitives.md
   * que eu tinha pulado, e o custo de pulá-la é traiçoeiro: o drift entre
   * altura estimada e real acumula ~1000px em 10k linhas, a lista fica além
   * do `scrollEndThreshold`, e `followOnAppend` desliga silenciosamente.
   *
   * O sintoma não é visual — é o firehose medindo uma lista PARADA e
   * aprovando um app que não estava fazendo nada.
   */
  const ancorou = useRef(false);
  useEffect(() => {
    if (ancorou.current || ids.length === 0) return;
    ancorou.current = true;
    virtualizer.scrollToEnd();
  }, [ids.length, virtualizer]);

  /**
   * A barra de "ir para a primeira não lida".
   *
   * Sem ela o divisor existe e ninguém o alcança: num canal com dez mil
   * mensagens, "você parou aqui" a quatro mil linhas de distância é a mesma
   * coisa que não saber. A barra é o que transforma posição em NAVEGAÇÃO — e
   * é a metade que o Discord tem e quase todo clone não.
   *
   * Lido a cada render e não assinado: o cursor muda ao SAIR do canal, e a
   * lista é remontada por `key` quando o canal troca. Não há atualização a
   * perder enquanto ela está montada.
   */
  const alvoNaoLida = primeiraNaoLida(channelId);
  const indiceNaoLida = alvoNaoLida ? ids.indexOf(alvoNaoLida) : -1;

  /**
   * A última menção para a qual pulamos, para "próxima" significar próxima.
   *
   * `useRef` e não estado: mudar de menção não muda nada na tela — a rolagem é
   * imperativa e o botão continua idêntico. Estado aqui seria um re-render da
   * lista inteira por clique, e a lista é o componente mais caro do app.
   */
  const ultimaMencao = useRef<string | undefined>(undefined);
  // O(1): a lista de menções tem cache pela identidade do array de IDs.
  // Perguntar isto com uma varredura custou 18,6% de frames perdidos.
  const há = temMencao(channelId);

  /*
    Trocou de canal: a lista é outra, e o id guardado não existe nela.

    Sem isto, voltar para um canal deixaria a parada de tabulação num id de
    outro — nenhuma linha montada teria `tabIndex=0`, e o Tab atravessaria a
    lista inteira como se ela não fosse focável. Falha silenciosa, que é a
    única forma que este bug tem de aparecer.
  */
  useEffect(() => {
    limparFocoDeMensagem();
    return limparFocoDeMensagem;
  }, [channelId]);

  /**
   * As setas dentro da lista.
   *
   * Delegado no container e não por linha: um `onKeyDown` em cada `article`
   * seria trabalho por linha no componente mais quente do app, e o evento sobe
   * de graça. Quem decide é o alvo — `article` significa "estou numa linha",
   * o próprio container significa "estou na lista, ainda fora das linhas".
   *
   * Qualquer outro alvo (um botão da barra de ações, um link do texto) não é
   * tratado: ali as setas pertencem ao controle, não à navegação.
   */
  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    // Atalho de sistema passa direto. `Alt+Seta` é voltar no histórico.
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return;

    const alvo = evento.target as HTMLElement;
    const noContainer = alvo === evento.currentTarget;
    const naLinha = alvo.tagName === "ARTICLE";
    if (!noContainer && !naLinha) return;

    /*
      Sair da lista devolve o cursor ao container.

      Sem uma saída, quem entrou nas linhas por seta só sai tabulando para
      frente — e a lei do controle e liberdade não admite recurso sem porta de
      saída. `Esc` é a tecla que a pessoa já tenta.
    */
    if (evento.key === "Escape" && naLinha) {
      evento.preventDefault();
      scrollRef.current?.focus();
      return;
    }

    /*
      Abrir o menu da linha focada, sem depender do navegador.

      `Shift+F10` e a tecla de menu JÁ funcionam pelo caminho nativo: com o
      `article` focável, o navegador dispara `contextmenu` nele, a linha escreve
      o alvo e o `Trigger` abre. Mas isso é comportamento do navegador, e eu não
      consegui exercitá-lo por automação — dispatch de tecla por CDP não passa
      pela tradução que gera o evento.

      Então o caminho garantido é este: `Enter` sintetiza o mesmo `contextmenu`
      que o clique direito envia, no mesmo elemento. Nada de segundo menu e nada
      de segunda lista de itens para manter em sincronia — é o mesmo evento pelo
      mesmo caminho, e por isso não pode divergir do que o ponteiro faz.

      As coordenadas são as da linha, não zero: o Radix ancora o menu no ponto
      do evento, e `(0,0)` o jogaria no canto da janela, longe da mensagem que
      ele age sobre.
    */
    if (naLinha && (evento.key === "Enter" || evento.key === "ContextMenu")) {
      evento.preventDefault();
      const caixa = alvo.getBoundingClientRect();
      alvo.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: Math.round(caixa.left + 8),
          clientY: Math.round(caixa.top + 8),
        }),
      );
      return;
    }

    if (ids.length === 0) return;

    const atual = lerFocoDeMensagem();
    const i = atual === null ? -1 : ids.indexOf(atual);
    let destino: number;

    if (noContainer) {
      /*
        Entrar na lista. As setas deixam de rolar o container e passam a andar
        entre mensagens — é o que todo cliente de chat faz, e o que torna o
        recurso descobrível sem tecla inventada. Page Up/Down, espaço e a barra
        de rolagem continuam rolando, então nada se perde.
      */
      if (evento.key !== "ArrowUp" && evento.key !== "ArrowDown") return;
      destino = i === -1 ? ids.length - 1 : i;
    } else if (evento.key === "ArrowUp") {
      destino = i <= 0 ? 0 : i - 1;
    } else if (evento.key === "ArrowDown") {
      destino = i === -1 || i >= ids.length - 1 ? ids.length - 1 : i + 1;
    } else if (evento.key === "Home") {
      destino = 0;
    } else if (evento.key === "End") {
      destino = ids.length - 1;
    } else {
      return;
    }

    evento.preventDefault();
    moverFocoDeMensagem(ids[destino]!);
    /*
      `auto` e não `center`: a linha vizinha quase sempre já está na tela, e
      recentralizar a cada seta faria a lista saltar sob quem está lendo.

      A ordem não importa para o cursor. A linha pode nem estar montada ainda —
      `scrollToIndex` rola agora e o virtualizador monta no quadro seguinte —, e
      é por isso que o pedido de foco é um contador no store em vez de um
      `.focus()` daqui: quem chama é a linha, quando ela existir.
    */
    virtualizer.scrollToIndex(destino, { align: "auto" });
  }

  const items = virtualizer.getVirtualItems();

  /*
    Altura real das linhas na tela, para o relatório dizer se a estimativa está
    perto. Chutar 73 e não conferir seria repetir o erro dos 44.

    Partida por TIPO desde agora, e é o que permite estimar por tipo em vez de
    por média: uma média só esconde que linha de sistema é uma fração de uma
    linha de fala. Os números vêm da tela antes de virarem constante — a ordem
    inversa é como o `estimateSize: 44` sobreviveu três fases.
  */
  for (const item of items) {
    if (item.size <= 0) continue;
    count("alturaSoma", item.size);
    count("alturaAmostras");

    const m = messages.getSnapshot(String(item.key));
    if (!m) continue;
    /*
      Linha com anexo fica FORA da amostra por tipo.

      As constantes descrevem a linha sem anexo — a parte que precisa ser
      estimada. Misturar as duas faria a média saltar com a frequência de
      imagens no canal, e a assertion de deriva acusaria mudança de forma que
      não houve. Foi o que o gate mostrou no minuto em que anexo passou a
      existir: 139px de média contra uma constante de 93 que continuava certa.
    */
    if (m.anexos.length > 0) continue;
    // Mesma razão, para os blocos que a fórmula estima: uma linha com bloco de
    // código de vinte linhas na amostra faria a média saltar com a frequência
    // de código no canal, e a assertion acusaria mudança de forma que não
    // houve.
    if (temBlocoPesado(m.blocos)) continue;
    if (m.sistema) {
      count("alturaSistemaSoma", item.size);
      count("alturaSistemaAmostras");
    } else if (m.iniciaGrupo) {
      count("alturaGrupoSoma", item.size);
      count("alturaGrupoAmostras");
    } else {
      count("alturaContinuaSoma", item.size);
      count("alturaContinuaAmostras");
    }
  }

  if (import.meta.env.DEV) {
    // Precisa de amostra o bastante para a média significar algo: com dez
    // linhas, uma mensagem longa sozinha desloca o número.
    const c = readCounters();
    if (c.alturaGrupoAmostras > 200) {
      conferirEstimativa("abreGrupo", c.alturaGrupoSoma / c.alturaGrupoAmostras);
    }
    if (c.alturaContinuaAmostras > 200) {
      conferirEstimativa("continua", c.alturaContinuaSoma / c.alturaContinuaAmostras);
    }
    if (c.alturaSistemaAmostras > 200) {
      conferirEstimativa("sistema", c.alturaSistemaSoma / c.alturaSistemaAmostras);
    }
  }

  /**
   * Linha medindo zero é bug, não estado.
   *
   * É o que realimenta o virtualizador e termina em "Maximum update depth
   * exceeded" — sem que o `getSnapshot` tenha alocado nada. Falha alto em dev;
   * some em produção.
   */
  /*
    Painel NÃO EXIBIDO não é linha quebrada.

    A coluna colapsa a `display: none` por container query — em 768px a de
    membros some inteira — e a lista continua MONTADA ali dentro. Sem caixa,
    tudo mede 0, e a assertion acusava dezenas de linhas quebradas num painel
    que ninguém está vendo.

    Guarda que grita à toa é guarda que alguém desliga, e essa é a única que
    protege a invariante que trava a aba. `offsetParent === null` é o teste
    certo e não "tamanho zero": ele distingue NÃO RENDERIZADO de renderizado
    com zero, e é o segundo que é bug.
  */
  if (import.meta.env.DEV && scrollRef.current?.offsetParent) {
    const zero = items.find((item) => item.size === 0);
    if (zero) {
      console.error(
        `[vortex] linha ${String(zero.key)} mediu 0px. Linha não resolvida deve ` +
          `renderizar placeholder com altura, nunca null — zero realimenta a ` +
          `medição e trava a aba.`,
      );
    }
  }

  /*
    Canal sem histórico: o vazio É o começo do canal.

    Antes, renderizava NADA — uma coluna em branco, indistinguível de "ainda
    carregando" e de "quebrou". É o melhor padrão da categoria, e a razão de
    ele ser o melhor é que não trata a ausência como falta: o canal começou
    aqui, e essa é uma informação verdadeira e útil, não um consolo.

    A ação leva de fato ao composer — `pedirFocoNoComposer` atravessa o mesmo
    barramento de `pedirFimDaLista`, porque a lista não alcança o composer pelo
    nome (lei nº 6) e na fase 4 os dois podem estar em painéis diferentes.

    FORA do container de scroll virtualizado, de propósito: dentro, ele viraria
    conteúdo com altura que o virtualizador não mede e a `getTotalSize` passaria
    a mentir.
  */
  if (ids.length === 0) {
    return (
      /*
        O começo do canal encosta no COMPOSER, não flutua no terço de cima.

        Numa lista que cresce de baixo para cima, a primeira mensagem vai nascer
        rente ao campo — e o estado vazio é onde ela vai aparecer. Ele estava a
        250px dali, com preto no meio, o que fazia o convite ("escreva a
        primeira") apontar para um lugar diferente de onde a coisa acontece.
      */
      <div className={`${css.scroll} flex flex-col justify-end`}>
        <div className={css.coluna}>
          <EstadoVazio
            icone={<ChatCircleDots size={20} />}
            titulo="Este é o começo do canal."
            detalhe="Ainda não há nada aqui — o que você escrever será a primeira mensagem."
            acao={{
              rotulo: "Escrever a primeira",
              aoClicar: () => pedirFocoNoComposer(channelId),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    /*
      UM `ContextMenu` para a lista inteira.

      Ele estava em cada `MessageRow` — Root, Trigger, Portal e Content por
      linha — e linha monta e desmonta na velocidade do scroll. Eram dezenas de
      árvores de menu do Radix criadas e destruídas por segundo enquanto
      ninguém tinha aberto menu nenhum.

      O `Trigger` envolve o container rolável, então o clique direito abre no
      ponteiro como antes. Quem é o alvo vem do store, escrito pela linha.
    */
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div
      ref={scrollRef}
      role="log"
      /*
        A região mais importante do app tinha nome nenhum: o leitor anunciava
        "log" e pronto. `aria-labelledby` e não `aria-label` porque o nome do
        canal mora no cabeçalho e a lista não pode assinar o snapshot do canal
        para lê-lo — esse snapshot muda a cada não-lida, e sob o firehose isso
        seria re-renderizar dez mil linhas 500 vezes por segundo.
      */
      aria-labelledby={ID_DO_NOME_DO_CANAL}
      aria-live="polite"
      aria-relevant="additions"
      /*
        Limpa o alvo na CAPTURA, antes de a linha escrever o seu na bolha.

        Sem isto, clique direito no vão entre linhas abriria o menu com o alvo
        do clique anterior, e "Copiar texto" copiaria outra mensagem. Bug que
        não dá erro e só aparece quando alguém repara que colou coisa errada.

        E fora de uma linha o menu não abre. Isto é decidível AQUI, na captura,
        porque a pergunta é sobre o alvo do evento e não sobre o que a bolha
        vai escrever — sem `preventDefault` o Radix abriria uma caixa vazia,
        que é pior que nenhuma resposta.
      */
      onContextMenuCapture={(evento) => {
        definirAlvoDoMenu(null);
        if (!(evento.target as Element).closest("article")) {
          evento.preventDefault();
        }
      }}
      // Região que rola e não recebe foco é inoperável por teclado: setas e
      // Page Down agem sobre o que está focado. Zero e não menos um — a
      // parada de tabulação É o recurso.
      tabIndex={0}
      onKeyDown={aoTeclar}
      className={css.scroll}
    >
      {/* Fora do container rolável não dá: ela precisa flutuar SOBRE a lista,
          e uma barra no fluxo empurraria a primeira linha para baixo — numa
          lista ancorada, isso é a âncora se movendo por causa de um aviso. */}
      {indiceNaoLida !== -1 ? (
        <button
          type="button"
          className={css.barraNaoLidas}
          onClick={() =>
            virtualizer.scrollToIndex(indiceNaoLida, { align: "start" })
          }
        >
          novas mensagens · ir para a primeira
        </button>
      ) : null}

      {/*
        Ir para a próxima menção.

        É a terceira perna de "leitura como posição", e a que faltava. As outras
        duas — primeira não lida e linha de novas mensagens — respondem "onde eu
        parei"; esta responde "onde falaram comigo", que é a pergunta que faz
        alguém abrir um canal de 10 mil mensagens.

        O badge de menção continua sendo CONTAGEM, e é a divisão certa: número
        responde "quantas", posição responde "onde", e o número nunca vai
        conseguir responder a segunda por mais que cresça.

        Flutua no canto em vez de ocupar a largura como a barra de não lidas: a
        barra é sobre o canal inteiro e aparece uma vez; este é um controle que
        se usa repetidamente, e um alvo que atravessa a coluna toda a cada uso
        seria ruído. As duas podem coexistir na tela.
      */}
      {há ? (
        <button
          type="button"
          className={css.irParaMencao}
          onClick={() => {
            const alvo = proximaMencao(channelId, ultimaMencao.current);
            if (!alvo) return;
            ultimaMencao.current = alvo;
            const i = ids.indexOf(alvo);
            if (i !== -1) virtualizer.scrollToIndex(i, { align: "center" });
          }}
        >
          <At size={20} aria-hidden />
          próxima menção
        </button>
      ) : null}
      {/* Teto de linha legível. Sem isto o texto estica até 3000px em
          ultrawide, que é o bug de layout que motivou o redesign.

          O marcador do alinhamento NÃO fica aqui: esta faixa cobre a trilha
          inteira, e o composer também. O que precisa concordar é o CONTEÚDO
          das duas — o texto da linha e o campo —, e é lá que o marcador
          mora. Comparar as faixas passaria sempre e não guardaria nada. */}
      <div className={css.coluna}>
        <div
          ref={medidaRef}
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {items.map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              data-mid={String(item.key)}
              ref={virtualizer.measureElement}
              className={css.linhaVirtual}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <MessageRow id={String(item.key)} />
            </div>
          ))}
        </div>
      </div>
    </div>
      </ContextMenuTrigger>

      <MenuDaMensagem />
    </ContextMenu>
  );
}
