import { ProhibitInset } from "@phosphor-icons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useMemo, useRef } from "react";

import { count } from "../dev/stats";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import { chaveDeMembro } from "../sdk/domain";
import { CartaoDePerfil } from "./CartaoDePerfil";
import {
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
  count("membrosRowRenders");

  // Nunca `null`: linha não resolvida mede 0px, o total encolhe, a janela
  // visível muda e o ciclo se realimenta. Placeholder com a mesma caixa.
  if (!membro) {
    return (
      <span className={css.membro} aria-hidden>
        <span className={css.avatar} />
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

  return (
    <CartaoDePerfil serverId={serverId} userId={id}>
    <button
      type="button"
      className={css.membro}
      data-offline={offline}
      data-silenciado={silenciado}
    >
      <span className={css.avatar} aria-hidden>
        {membro.sigla}
        {/* Rotulado aqui, ao contrário da lista de mensagens: nesta coluna a
            presença É o dado, não enfeite ao lado de um nome. */}
        <PontoDePresenca userId={id} rotular />
      </span>

      {/* A cor do cargo é dado do servidor, não token — ver `NomeDoAutor`. */}
      <span
        className={css.nome}
        style={membro.cor ? { color: membro.cor } : undefined}
      >
        {membro.displayName}
      </span>

      {/*
        Castigo nunca só por opacidade.

        Esmaecer é o que a linha offline já faz, e as duas coisas juntas ficam
        indistinguíveis. O ícone carrega o estado e o texto o nomeia — mesma
        regra da presença: cor e forma, nunca só uma.
      */}
      {silenciado ? (
        <>
          <ProhibitInset size={20} aria-hidden className={css.castigo} />
          <span className="sr-only">em castigo</span>
        </>
      ) : null}
    </button>
    </CartaoDePerfil>
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

  // Linha medindo zero é bug, não estado — a mesma assertion da lista de
  // mensagens, pelo mesmo motivo: zero realimenta a medição e trava a aba.
  if (import.meta.env.DEV) {
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
    <div ref={scrollRef} className={css.painel}>
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
              role="listitem"
            >
              {linha.tipo === "secao" ? (
                <h2
                  className={css.secao}
                  /* Cor do cargo, pelo mesmo argumento de `NomeDoAutor`: é
                     dado de quem administra o servidor, não token nosso. */
                  style={linha.cor ? { color: linha.cor } : undefined}
                >
                  {linha.rotulo}
                  <span className={css.total}>— {linha.total}</span>
                </h2>
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
    </div>
  );
}
