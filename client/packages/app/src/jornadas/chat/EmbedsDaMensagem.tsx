import { useState, type CSSProperties } from "react";

import type { EmbedEspecial, EmbedMidia, EmbedSnapshot } from "nucleo/sdk/domain";

import { chat } from "../../textos";
import { Reproduzir } from "../../ui/icones";
import { caixaDaMidia, caixaDoPlayer, MAXIMO_DE_EMBEDS } from "./caixaDoEmbed";
import { CorpoDaMensagem } from "./CorpoDaMensagem";
import css from "./Embeds.module.css";

/** A caixa existe antes do arquivo: a proporção vem do metadata do servidor. */
function estiloDaCaixa(caixa: { largura: number; altura: number }) {
  return {
    aspectRatio: `${String(caixa.largura)} / ${String(caixa.altura)}`,
    inlineSize: `min(100%, ${String(caixa.largura)}px)`,
  };
}

function Imagem({ m, href }: { m: EmbedMidia; href: string | undefined }) {
  const img = <img src={m.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
  return (
    <div className={css.moldura} style={estiloDaCaixa(caixaDaMidia(m))} data-embed-midia="imagem">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={chat.embeds.abrirImagem}>
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  );
}

function Video({ m }: { m: EmbedMidia }) {
  return (
    <div className={css.moldura} style={estiloDaCaixa(caixaDaMidia(m))} data-embed-midia="video">
      {/* `preload="none"`: nada é buscado antes de a pessoa dar play. */}
      <video src={m.url} controls preload="none" aria-label={chat.embeds.video} />
    </div>
  );
}

/**
 * O player de um serviço (YouTube, Spotify…): miniatura com botão de play, e o
 * iframe de terceiro SÓ monta depois do clique. Antes disso não há requisição
 * nenhuma para o serviço — nem IP, nem cookie.
 */
function Player({
  especial,
  poster,
  titulo,
}: {
  especial: EmbedEspecial;
  poster: EmbedMidia | undefined;
  titulo: string;
}) {
  const [tocando, setTocando] = useState(false);
  return (
    <div className={css.moldura} style={estiloDaCaixa(caixaDoPlayer(especial))} data-player={especial.servico}>
      {tocando ? (
        <iframe
          src={especial.playerUrl}
          title={titulo}
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allow="autoplay; fullscreen; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <>
          {poster && <img src={poster.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
          <button
            type="button"
            className={css.tocar}
            aria-label={chat.embeds.reproduzir(especial.servico)}
            onClick={() => {
              setTocando(true);
            }}
          >
            <Reproduzir tamanho={20} />
          </button>
        </>
      )}
    </div>
  );
}

function Cartao({ e, servidorId }: { e: EmbedSnapshot; servidorId: string }) {
  const miniatura = e.imagem && !e.imagemGrande && !e.especial ? e.imagem : undefined;
  const grande = e.imagem && e.imagemGrande && !e.especial ? e.imagem : undefined;
  return (
    <div className={css.cartao} data-embed={e.tipo} style={e.cor ? ({ "--cor-do-embed": e.cor } as CSSProperties) : undefined}>
      <div className={css.conteudo}>
        <div className={css.texto}>
          {e.origem && <span className={css.origem}>{e.origem}</span>}
          {e.titulo &&
            (e.url ? (
              <a className={css.titulo} href={e.url} target="_blank" rel="noopener noreferrer">
                {e.titulo}
              </a>
            ) : (
              <span className={css.titulo}>{e.titulo}</span>
            ))}
          {e.descricao && <p className={css.descricao}>{e.descricao}</p>}
          {e.blocos && (
            <div className={css.markdown}>
              <CorpoDaMensagem blocos={e.blocos} servidorId={servidorId} />
            </div>
          )}
        </div>
        {miniatura && (
          <div className={css.miniatura}>
            <img src={miniatura.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </div>
        )}
      </div>
      {e.especial && <Player especial={e.especial} poster={e.imagem} titulo={e.titulo ?? e.especial.servico} />}
      {grande && <Imagem m={grande} href={undefined} />}
      {!e.especial && !grande && e.video && <Video m={e.video} />}
    </div>
  );
}

/**
 * As prévias de link de uma mensagem, abaixo do corpo e dos anexos.
 *
 * Chegam DEPOIS do envio (o servidor as resolve em segundos), então a altura
 * da linha muda sozinha: a estimativa (`alturaDeEmbeds`) e o `ResizeObserver`
 * da lista cuidam da âncora. Imagem e player reservam a caixa pelo metadata.
 */
export function EmbedsDaMensagem({ embeds, servidorId }: { embeds: readonly EmbedSnapshot[]; servidorId: string }) {
  const visiveis = embeds.slice(0, MAXIMO_DE_EMBEDS);
  const resto = embeds.length - visiveis.length;
  return (
    <div className={css.embeds} data-embeds>
      {visiveis.map((e) => {
        if (e.tipo === "imagem" && e.imagem) return <Imagem key={`${e.tipo}:${e.id}`} m={e.imagem} href={e.url} />;
        if (e.tipo === "video" && e.video) return <Video key={`${e.tipo}:${e.id}`} m={e.video} />;
        return <Cartao key={`${e.tipo}:${e.id}`} e={e} servidorId={servidorId} />;
      })}
      {resto > 0 && <p className={css.mais}>{chat.embeds.maisN(resto)}</p>}
    </div>
  );
}
