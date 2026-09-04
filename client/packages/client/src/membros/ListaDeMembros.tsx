import {
  ProhibitInset,
  
} from "../components/ui/icones";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  assinarMenuDeMensagem,
  definirAlvoDoMenu,
  lerAlvoDoMenu,
} from "../store/menuDeMensagem";
import { MenuDoUsuario } from "./MenuDoUsuario";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import { count } from "../dev/stats";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Avatar } from "../components/ui/Avatar";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";
import { chaveDeMembro } from "../sdk/domain";
import { assinarConexao, lerConexao } from "../store/conexao";
import { CartaoDePerfil } from "./CartaoDePerfil";
import {
  useCorDeCargo,
  useMembro,
  useMembrosOffline,
  useSecoesOnline,
  useServidorAtivo,
} from "../store/hooks";
import css from "./ListaDeMembros.module.css";

/**
 * Alturas estimadas, por TIPO de linha.
 *
 * A lição de estimativa da fase 0 aplicada de graça: lá, `estimateSize: () =>
 * 44` errava ~29px por linha porque mensagem tem altura variável e não havia
 * como saber. Aqui as duas alturas são conhecidas e constantes — avatar de
 * 24px com respiro, e um cabeçalho de seção — então a estimativa acerta, a
 * barra de rolagem não mente, e a remedição não tem trabalho.
 */
const ALTURA_MEMBRO = 32;
const ALTURA_SECAO = 32;

type Linha =
  | {
      tipo: "secao";
      chave: string;
      rotulo: string;
      cor: string | undefined;
      total: number;
    }
  | { tipo: "membro"; chave: string; id: string; offline: boolean };

/**
 * O cabeçalho de uma seção de cargo.
 *
 * ⚠ **Não recebe mais a COR do cargo, e o motivo está no corpo.** Ele existia
 * como componente próprio porque a cor precisava passar por um hook de clamp
 * de luminosidade, e hook não pode ser chamado dentro do `map` de render da
 * lista virtualizada. Sem a cor, essa razão sumiu — mas ele fica: extrair o
 * cabeçalho de dentro do laço de itens era o conserto certo de qualquer forma,
 * e `memo` sobre ele evita re-render por mudança em linha vizinha.
 */
const CabecalhoDeSecao = memo(function CabecalhoDeSecao({
  rotulo,
  total,
}: {
  rotulo: string;
  total: number;
}) {
  return (
    /*
      ⚠ **O cabeçalho NÃO leva a cor do cargo, e ele levava.**

      Medido no design: `NÚCLEO — 2`, `MODERAÇÃO — 1`, `ONLINE — 3` e
      `OFFLINE — 18` saem todos em `#77808E` — o mesmo `text-3` de qualquer
      rótulo de seção. A cor do cargo aparece no NOME das pessoas, que é onde
      ela responde a alguma pergunta ("quem é da moderação?").

      No cabeçalho ela não responde nada: o rótulo já diz o cargo por escrito,
      e colorir a palavra "MODERAÇÃO" de verde é repetir o mesmo fato numa
      segunda linguagem. O custo é uma coluna com quatro cores de rótulo
      competindo entre si, que foi como quem usa a descreveu.
    */
    <h2 className={css.secao}>
      {rotulo}
      <span className={css.total}>— {total}</span>
    </h2>
  );
});

/**
 * Uma linha de membro. Assina a si mesma.
 *
 * `memo` pelo mesmo motivo do `MessageRow`, e aqui a razão é literalmente a
 * mesma: o `useVirtualizer` faz o React Compiler pular este arquivo
 * (`react-hooks/incompatible-library`), e sem compilação os filhos são
 * recriados a cada render da lista.
 */
const LinhaDeMembro = memo(function LinhaDeMembro({
  serverId,
  id,
  offline,
}: {
  serverId: string;
  id: string;
  offline: boolean;
}) {
  const membro = useMembro(chaveDeMembro(serverId, id));
  // Antes do retorno antecipado do placeholder — hook não pode ficar atrás
  // de condicional.
  const corDeCargo = useCorDeCargo(membro?.cor);
  count("membrosRowRenders");

  // Nunca `null`: linha não resolvida mede 0px, o total encolhe, a janela
  // visível muda e o ciclo se realimenta. Placeholder com a mesma caixa.
  if (!membro) {
    return (
      <span className={css.membro} aria-hidden>
        <Avatar id={id} />
      </span>
    );
  }

  /*
    O castigo é a PRESENÇA do campo, não uma comparação com o relógio local.

    A primeira versão fazia `silenciadoAte > Date.now()` aqui, e o lint do
    React Compiler reprovou: "Cannot call impure function during render". Ele
    está certo, e a regra do projeto diz que compiler reclamando é código
    errado, não regra para desligar.

    A correção é melhor que o código original, e não só mais pura: quem sabe
    que um castigo acabou é o SERVIDOR, que limpa o campo e manda o evento.
    Comparar com o relógio do cliente seria uma segunda fonte de verdade,
    discordando da primeira toda vez que os relógios divergissem.
  */
  const silenciado = membro.silenciadoAte !== undefined;

  /*
    A moderação pergunta pelo primeiro canal do servidor.

    `havePermission` responde por CANAL, e expulsar/banir são direitos de
    servidor — o SDK os resolve subindo do canal para o servidor, então
    qualquer canal serve como ponto de consulta. Sem canal nenhum não há a quem
    perguntar; ver `sdk/permissoes.ts`.
  */

  const linha = (
    <button
      type="button"
      className={css.membro}
      data-offline={offline}
      data-silenciado={silenciado}
    >
      <Avatar id={id} sigla={membro.sigla} url={membro.avatarUrl}>
        {/* Rotulado aqui, ao contrário da lista de mensagens: nesta coluna a
            presença É o dado, não enfeite ao lado de um nome. */}
        <PontoDePresenca userId={id} rotular />
      </Avatar>

      {/*
        Nome e recado empilhados — é o design.

        A linha era só o nome; o design põe o status personalizado embaixo
        ("no deep work", "Spotify · Khruangbin", "Jogando Factorio"), e o dado
        já existia: `statusTexto` chega no `MemberSnapshot` desde a fase 5 e
        NUNCA tinha sido renderizado. Um campo lido, mapeado e nunca desenhado
        é a mesma família do `ehMencao` que passou três fases sem devolver
        `true`.

        ⚠ A segunda linha só aparece quando HÁ recado, e por isso a altura da
        linha varia. Isto é permitido aqui e não seria na lista de mensagens:
        esta coluna é virtualizada com `estimateSize` por tipo, e o snapshot
        que decide a altura é o mesmo que traz o recado — trocar de recado
        publica o membro, e o `ResizeObserver` remede. Na timeline a mesma
        variação moveria a âncora.
      */}
      <span className={css.textos}>
        {/* A cor do cargo é dado do servidor, não token — ver `NomeDoAutor`. */}
        <span
          className={css.nome}
          style={corDeCargo ? { color: corDeCargo } : undefined}
        >
          {membro.displayName}
        </span>

        {membro.statusTexto ? (
          <span className={css.recado}>{membro.statusTexto}</span>
        ) : null}
      </span>

      {/*
        Castigo nunca só por opacidade.

        Esmaecer é o que a linha offline já faz, e as duas coisas juntas ficam
        indistinguíveis. O ícone carrega o estado e o texto o nomeia — mesma
        regra da presença: cor e forma, nunca só uma.
      */}
      {silenciado ? (
        <>
          <ProhibitInset aria-hidden className={css.castigo} />
          <span className="sr-only">em castigo</span>
        </>
      ) : null}
    </button>
  );

  /*
    ⚠ **UM `ContextMenu` para a lista inteira, e o menu é o MESMO da timeline.**

    Antes havia um menu PRÓPRIO aqui, com três itens de moderação, e outro na
    linha de mensagem com onze. A mesma pessoa, dois menus, dependendo de onde
    se clicasse com o direito — e o `CLAUDE.md` já tinha a regra escrita desde
    o dia do `⋯`: dois menus com os mesmos itens divergem no primeiro que ganha
    um item novo. Estes já tinham divergido em sete.

    A condição `podeModerar` que existia aqui protegia o CUSTO, não a
    permissão: montar `ContextMenu` (Root, Trigger, Portal) em cada uma de
    dezenas de milhares de linhas é exatamente o que o menu no nível da lista
    veio remover da lista de mensagens. Com o Root subindo para a lista, a
    proteção deixa de ser necessária — a linha agora só ESCREVE quem ela é, e
    o menu completo passa a existir para todo mundo, com cada item gateado por
    `pode()` lá dentro como sempre esteve.
  */
  return (
    <span
      className={css.alvo}
      onContextMenu={() => {
        definirAlvoDoMenu({ tipo: "usuario", userId: id });
      }}
    >
      <CartaoDePerfil serverId={serverId} userId={id}>
        {linha}
      </CartaoDePerfil>
    </span>
  );
});

/**
 * A member list do servidor ativo.
 *
 * Virtualizada desde a primeira linha (lei nº 2), e é a única das três colunas
 * laterais que precisa: rail e lista de canais têm dezenas de itens, esta tem
 * dezenas de milhares num servidor grande.
 *
 * Os cabeçalhos de seção são LINHAS da mesma lista, não elementos fora dela —
 * exatamente como o divisor de data na lista de mensagens, e pelo mesmo
 * motivo: seção fora da virtualização significa dois sistemas de posicionamento
 * disputando o mesmo scroll.
 *
 * Sem `anchorTo: "end"`. Esta lista é normal — ancora no topo, cresce para
 * baixo. O modo chat existe para a lista de mensagens e para mais nada.
 */
/**
 * O conteúdo do menu, escolhido pelo alvo no store.
 *
 * Mesmo store da lista de mensagens (`menuDeMensagem`), porque é o mesmo
 * conceito: quem clicou com o direito escreve QUEM ele é, e um único Root lê.
 * Alvo de outro tipo (ou nenhum) devolve caixa vazia — melhor que agir sobre a
 * pessoa do clique anterior.
 */
function MenuDaMemberList() {
  const alvo = useSyncExternalStore(assinarMenuDeMensagem, lerAlvoDoMenu);
  if (alvo?.tipo !== "usuario") return <ContextMenuContent />;
  return <MenuDoUsuario userId={alvo.userId} />;
}

export function ListaDeMembros() {
  const serverId = useServidorAtivo();
  count("membrosListRenders");
  const secoes = useSecoesOnline(serverId);
  const offline = useMembrosOffline(serverId);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * A lista achatada.
   *
   * Derivação no render, e aqui é o lugar certo: depende de DOIS arrays do
   * store, e o resultado não é um snapshot de entidade que alguém assina — é
   * layout. O que a lei nº 1 proíbe é alocar dentro de `getSnapshot`, que é
   * chamado a cada render; isto roda quando um dos baldes republica.
   */
  const linhas = useMemo<Linha[]>(() => {
    const out: Linha[] = [];

    /*
      Uma seção por cargo hasteado, do lado online — e offline num balde só.

      Seccionar os ausentes por cargo dobraria o número de cabeçalhos para
      mostrar quem NÃO está lá, que é o inverso da hierarquia de atenção de uma
      coluna que fica aberta o dia inteiro.

      A ordem das seções e a de cada balde vêm prontas do adapter. Aqui não se
      ordena nada: ordenar no render seria refazer, a cada re-render da lista,
      o trabalho que a publicação já fez uma vez.
    */
    for (const secao of secoes) {
      out.push({
        tipo: "secao",
        chave: `@${secao.id}`,
        rotulo: secao.rotulo,
        cor: secao.cor,
        total: secao.ids.length,
      });
      for (const id of secao.ids) {
        out.push({ tipo: "membro", chave: id, id, offline: false });
      }
    }

    if (offline.length > 0) {
      out.push({
        tipo: "secao",
        chave: "@offline",
        rotulo: "offline",
        cor: undefined,
        total: offline.length,
      });
      for (const id of offline) {
        out.push({ tipo: "membro", chave: id, id, offline: true });
      }
    }
    return out;
  }, [secoes, offline]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual, spike
  const virtualizer = useVirtualizer({
    count: linhas.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) =>
      linhas[i]?.tipo === "secao" ? ALTURA_SECAO : ALTURA_MEMBRO,
    // ID de entidade, nunca índice — alguém ficando online insere no meio da
    // lista, e com índice a chave sob o scroll muda de significado.
    getItemKey: (i) => linhas[i]?.chave ?? i,
    overscan: 8,
  });

  /**
   * Largura do container mudou = remedir. Lei nº 6, mecanizada.
   *
   * A causa já existe hoje sem a fase 4: a janela redimensionada muda o
   * `clamp()` desta coluna, e o nome do membro passa a truncar em outro ponto.
   * Sem remedir, as alturas cacheadas ficam de uma largura que não existe mais.
   *
   * ALTURA não precisa de tratamento, ao contrário da lista de mensagens: esta
   * lista ancora no topo, e o `scrollTop` continua apontando para a mesma
   * linha quando o container encolhe.
   */
  const ultimaLargura = useRef(0);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const largura = entry?.contentRect.width ?? 0;
      if (largura === ultimaLargura.current) return;
      ultimaLargura.current = largura;
      virtualizer.measure();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [virtualizer]);

  const items = virtualizer.getVirtualItems();

  /*
    UMA subscrição para a coluna inteira — não uma por linha. O que muda por
    linha é o ponto de presença, e ele some por CSS a partir do `<html>`.
  */
  const semConexao =
    useSyncExternalStore(assinarConexao, lerConexao) !== "conectado";

  // Linha medindo zero é bug, não estado — a mesma assertion da lista de
  // mensagens, pelo mesmo motivo: zero realimenta a medição e trava a aba.
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
        `[vortex] linha de membro ${String(zero.key)} mediu 0px. ` +
          `Linha não resolvida deve renderizar placeholder com altura.`,
      );
    }
  }

  if (linhas.length === 0) {
    return (
      <div className={css.painel}>
        <EstadoVazio
          compacto
          titulo="Nenhum membro para mostrar"
          detalhe="A lista aparece quando o servidor carregar."
        />
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* Ver `MessageList`: rolável sem foco é inoperável por teclado. */}
        <div
          ref={scrollRef}
          className={css.painel}
          tabIndex={0}
          /* A captura LIMPA antes de a linha escrever: clique no vão entre
             linhas não deve agir sobre quem foi clicado por último. */
          onContextMenuCapture={() => {
            definirAlvoDoMenu(null);
          }}
        >
      <div
        className={css.pista}
        style={{ height: `${virtualizer.getTotalSize()}px` }}
        role="list"
        aria-label="Membros"
      >
        {items.map((item) => {
          const linha = linhas[item.index];
          if (!linha) return null;

          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className={css.linha}
              style={{ transform: `translateY(${item.start}px)` }}
              /*
                Cabeçalho de seção NÃO é item de lista.

                Todas as linhas levavam `role="listitem"`, inclusive as que
                envolvem um `<h2>` — e aí o leitor de tela anuncia "item 1 de
                40: fundação". O cabeçalho vira entrada da lista, e a contagem
                de membros passa a incluir os títulos.

                Sem papel, o `<h2>` volta a ser anunciado como cabeçalho, que é
                o que ele é e o que permite pular de seção em seção.
              */
              role={linha.tipo === "secao" ? undefined : "listitem"}
            >
              {linha.tipo === "secao" ? (
                <CabecalhoDeSecao rotulo={linha.rotulo} total={linha.total} />
              ) : (
                <LinhaDeMembro
                  serverId={serverId}
                  id={linha.id}
                  offline={linha.offline}
                />
              )}
            </div>
          );
        })}
      </div>

      {/*
        ⚠ **O aviso de presença congelada, e ele fica FORA da pista
        virtualizada.**

        Dentro dela ele seria mais um item com altura própria, e o
        virtualizador teria de medi-lo e reposicioná-lo a cada aparição —
        trabalho de layout numa lista de dezenas de milhares por causa de um
        parágrafo. Fora, ele empilha depois do total e some sozinho quando a
        conexão volta.

        A lista NÃO é limpa nem reordenada offline: ela fica no último estado
        conhecido, que é o que o design manda. O que sai são os pontos de
        presença (ver `PontoDePresenca.module.css`) — "todos offline" seria
        informação falsa.
      */}
      {semConexao ? (
        <p className={css.congelada}>
          Presença indisponível offline — todos aparecem sem status. Lista
          congelada no último estado conhecido.
        </p>
        ) : null}
        </div>
      </ContextMenuTrigger>

      <MenuDaMemberList />
    </ContextMenu>
  );
}
