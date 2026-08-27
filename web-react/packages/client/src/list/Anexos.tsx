import { FileArrowDown } from "@phosphor-icons/react";
import type { CSSProperties } from "react";

import type { AnexoSnapshot } from "../sdk/domain";
import css from "./Anexos.module.css";

/**
 * Os anexos de uma mensagem.
 *
 * **A única coisa que importa aqui é o espaço estar reservado ANTES.** Uma
 * imagem que chega sem caixa faz a linha crescer depois de o virtualizador já
 * a ter medido — e numa lista ancorada uma linha que cresce acima da âncora
 * empurra exatamente o que a pessoa está lendo. É o layout shift clássico
 * cobrando um preço a mais do que cobra num site.
 *
 * O protocolo entrega `width` e `height` para imagem e vídeo, então a caixa é
 * conhecida antes do primeiro byte do arquivo. Arquivo e áudio não têm
 * dimensão e não precisam: são uma linha de altura fixa.
 */
export function Anexos({ anexos }: { anexos: readonly AnexoSnapshot[] }) {
  return (
    <div className={css.anexos}>
      {anexos.map((a) => (
        <Anexo key={a.id} anexo={a} />
      ))}
    </div>
  );
}

function Anexo({ anexo }: { anexo: AnexoSnapshot }) {
  if (anexo.tipo === "arquivo" || !anexo.largura || !anexo.altura) {
    return (
      <a className={css.arquivo} href={anexo.url} download={anexo.nome}>
        <FileArrowDown size={20} aria-hidden />
        <span className={css.nome}>{anexo.nome}</span>
      </a>
    );
  }

  return (
    /*
      A caixa vem do `aspect-ratio` E de uma largura definida.

      `max-inline-size` sozinho não bastava, e a primeira versão errou nisso:
      teto não é tamanho, então sem largura definida a caixa media 0×0 enquanto
      a imagem não chegava — a reserva de espaço não reservava nada. Ver o
      comentário no CSS.

      `--proporcao` vai junto porque é ela que permite calcular a largura em
      que a altura bate no teto, sem classificar imagem por formato.
    */
    <div
      className={css.midia}
      style={
        {
          aspectRatio: `${anexo.largura} / ${anexo.altura}`,
          "--proporcao": anexo.largura / anexo.altura,
        } as CSSProperties
      }
    >
      {anexo.tipo === "video" ? (
        <video className={css.arquivoDeMidia} src={anexo.url} controls />
      ) : (
        <img
          className={css.arquivoDeMidia}
          src={anexo.url}
          alt={anexo.nome}
          /*
            `loading="lazy"` numa lista virtualizada é redundante — o
            virtualizador já não monta o que está fora da tela — mas custa
            nada e cobre o caso em que a imagem entra na janela por rolagem
            rápida, quando o overscan monta antes de aparecer.

            `decoding="async"` é o que importa: decodificar uma imagem grande
            no thread principal é uma long task, e long task é reprovação
            direta no gate.
          */
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}
