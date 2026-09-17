import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { remedir } from "../lib/remedir";
import { linhasDaGrade, type GrupoDaGrade } from "./linhas";
import css from "./GradeVirtual.module.css";

/**
 * Uma grade virtualizada POR LINHA — a lista de posts e a galeria.
 *
 * ⚠ **Linhas, e não `lanes`.** O TanStack Virtual sabe distribuir itens em
 * colunas, mas cada coluna cresce sozinha: é masonry. O design proíbe
 * masonry na galeria — "a varredura por data exige linhas alinhadas" —, e o
 * card de post em grade tem altura de conteúdo. Virtualizar a LINHA inteira e
 * deixar um CSS grid dentro dela alinha as duas coisas de graça.
 *
 * `colunaMinima` é o `minmax(Npx, 1fr)` do design. Lista é a mesma grade com
 * uma coluna só — o post em lista e em grade é o MESMO card, e a mesma
 * virtualização.
 *
 * Remede ao mudar de largura (lei nº 6): a quantidade de colunas muda, e com
 * ela todas as linhas.
 */
export function GradeVirtual({
  ids,
  grupos,
  rotuloDeGrupo,
  colunaMinima,
  gap,
  estimarLinha,
  rotulo,
  cabecalho,
  rodape,
  className,
  children,
}: {
  /** O respiro do scroller — o `padding` de cada tela do design. */
  className?: string;
  /** Uma lista só, sem rótulo — o fórum. */
  ids?: readonly string[];
  /** Grupos com rótulo rolando junto — a galeria, um por dia. Vence `ids`. */
  grupos?: readonly GrupoDaGrade[];
  /** Como desenhar o rótulo de um grupo. */
  rotuloDeGrupo?: (rotulo: string) => ReactNode;
  /** `undefined` = uma coluna (modo lista). */
  colunaMinima: number | undefined;
  /** O espaço entre colunas E entre linhas, em px — o `gap` do design. */
  gap: number;
  /** Altura estimada de uma linha, dada a largura de uma coluna. */
  estimarLinha: (larguraDaColuna: number) => number;
  rotulo: string;
  /** Rola junto, antes das linhas — o rótulo de grupo do design. */
  cabecalho?: ReactNode;
  rodape?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trilhoRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const el = trilhoRef.current;
    if (!el) return;
    // `setState` no callback do observador, nunca no corpo do efeito.
    const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e?.contentRect.width ?? 0)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const colunas =
    colunaMinima === undefined || largura === 0
      ? 1
      : Math.max(1, Math.floor((largura + gap) / (colunaMinima + gap)));
  const larguraDaColuna = largura === 0 ? 0 : (largura - gap * (colunas - 1)) / colunas;
  const linhas = linhasDaGrade(grupos ?? [{ chave: "", rotulo: undefined, ids: ids ?? [] }], colunas);

  const [alturaDoCabecalho, setAlturaDoCabecalho] = useState(0);
  const cabecalhoRef = useRef<HTMLDivElement>(null);
  const temCabecalho = cabecalho !== undefined;
  useEffect(() => {
    const el = cabecalhoRef.current;
    if (!temCabecalho || !el) return;
    const obs = new ResizeObserver(() => setAlturaDoCabecalho(el.offsetHeight));
    obs.observe(el);
    return () => obs.disconnect();
  }, [temCabecalho]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual, spike
  const virtualizer = useVirtualizer({
    count: linhas.length,
    getScrollElement: () => scrollRef.current,
    // O rótulo é medido de verdade logo que monta; a estimativa só posiciona
    // o que ainda não montou, e 26 é o "Hoje" do design (11px + margem 10).
    estimateSize: (i) =>
      linhas[i]?.tipo === "rotulo" ? 26 : estimarLinha(larguraDaColuna) + gap,
    getItemKey: (i) => linhas[i]?.chave ?? i,
    scrollMargin: alturaDoCabecalho,
    overscan: 4,
  });

  useEffect(() => {
    remedir(virtualizer);
  }, [virtualizer, colunas, larguraDaColuna]);

  return (
    <div ref={scrollRef} className={cn(css.scroll, className)} tabIndex={0} aria-label={rotulo}>
      {cabecalho !== undefined ? <div ref={cabecalhoRef}>{cabecalho}</div> : null}
      <div ref={trilhoRef} className={css.trilho} style={{ blockSize: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const linha = linhas[item.index];
          if (!linha) return null;
          if (linha.tipo === "rotulo") {
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className={css.linha}
                style={{ transform: `translateY(${item.start - alturaDoCabecalho}px)` }}
              >
                {rotuloDeGrupo ? rotuloDeGrupo(linha.rotulo) : linha.rotulo}
              </div>
            );
          }
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className={css.linha}
              style={{
                transform: `translateY(${item.start - alturaDoCabecalho}px)`,
                gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`,
                columnGap: gap,
                paddingBlockEnd: gap,
              }}
            >
              {linha.ids.map((id) => (
                <div key={id} className={css.celula}>
                  {children(id)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {rodape}
    </div>
  );
}
