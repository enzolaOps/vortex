import { DownloadSimple, FileArrowDown } from "../components/ui/icones";
import type { CSSProperties } from "react";

import type { AnexoSnapshot } from "../sdk/domain";
import { administrar } from "../store/administracao";
import { aindaNao } from "../pendente/pendencias";
import { ReprodutorDeVoz } from "./ReprodutorDeVoz";
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
export function Anexos({
  anexos,
  /*
    De QUAL mensagem — o lightbox precisa dela para saber o autor, o canal e
    quais são os outros anexos. Antes ele recebia a URL solta e não tinha como
    derivar nenhum dos três.
  */
  messageId,
}: {
  anexos: readonly AnexoSnapshot[];
  messageId: string;
}) {
  return (
    <div className={css.anexos}>
      {anexos.map((a) => (
        <Anexo key={a.id} anexo={a} messageId={messageId} />
      ))}
    </div>
  );
}

/**
 * O rodapé do anexo: nome, tamanho e as duas ações.
 *
 * ⚠ **Era invisível.** A imagem aparecia sem nome e sem peso, e o design põe
 * `densidades.png · 284 KB` embaixo de toda mídia — que é a informação que
 * decide se vale a pena abrir em tela cheia ou baixar numa conexão ruim.
 *
 * O nome em monoespaçada porque é NOME DE ARQUIVO: o alinhamento de extensão
 * ajuda a varrer uma conversa cheia de anexos, e é o mesmo argumento que põe
 * ID e atalho em mono no resto do app.
 */
function RodapeDoAnexo({ anexo }: { anexo: AnexoSnapshot }) {
  return (
    <div className={css.rodape}>
      <span className={css.identificacao}>
        {anexo.nome}
        {anexo.tamanhoTexto ? ` · ${anexo.tamanhoTexto}` : null}
      </span>

      <span className={css.acoes}>
        {/* Desenhado sem implementação — ver `pendente/pendencias.ts`. O
            protocolo tem `description` no anexo; ler e escrever ainda não. */}
        <button
          type="button"
          className={css.acao}
          onClick={aindaNao("textoAlternativo")}
        >
          alt
        </button>

        {/* Baixar é REAL: o anexo tem URL, e `download` com o nome do arquivo
            é tudo o que o navegador precisa. */}
        <a
          className={css.acao}
          href={anexo.url}
          download={anexo.nome}
          aria-label={`Baixar ${anexo.nome}`}
        >
          <DownloadSimple size={20} aria-hidden />
        </a>
      </span>
    </div>
  );
}

function Anexo({
  anexo,
  messageId,
}: {
  anexo: AnexoSnapshot;
  messageId: string;
}) {
  /*
    Áudio vira PLAYER, e é a primeira coisa que o componente pergunta.

    Antes desta linha ele caía no ramo de `arquivo` — um link com nome e ícone
    de download, que é a resposta certa para um PDF e a errada para uma
    mensagem de voz: ninguém baixa um áudio de oito segundos para ouvi-lo.
  */
  if (anexo.tipo === "audio") return <ReprodutorDeVoz anexo={anexo} />;

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
      A mídia e o rodapé numa CAIXA só.

      O rodapé precisa da mesma largura da mídia, e a mídia tem a largura
      calculada a partir da proporção — envolver os dois é o que faz o rodapé
      acompanhar sem repetir a conta.

      `figure` e não `div`: é conteúdo com legenda, que é exatamente o que o
      elemento nomeia.
    */
    <figure className={css.pacote}>
      {/*
      A caixa vem do `aspect-ratio` E de uma largura definida.

      `max-inline-size` sozinho não bastava, e a primeira versão errou nisso:
      teto não é tamanho, então sem largura definida a caixa media 0×0 enquanto
      a imagem não chegava — a reserva de espaço não reservava nada. Ver o
      comentário no CSS.

      `--proporcao` vai junto porque é ela que permite calcular a largura em
      que a altura bate no teto, sem classificar imagem por formato.
      */}
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
        /*
          `button` e não a `img` com `onClick`.

          Imagem clicável sem botão em volta não recebe foco, não responde a
          Enter e não é anunciada como acionável — clicar num anexo passaria a
          existir só para quem usa mouse. O botão não tem caixa própria
          (`display: contents` no CSS), então a reserva de espaço acima
          continua sendo a mesma.
        */
        <button
          type="button"
          className={css.alvoDaImagem}
          aria-label={`Ver ${anexo.nome} em tamanho grande`}
          onClick={() =>
            administrar({
              tipo: "verImagem",
              messageId,
              anexoId: anexo.id,
            })
          }
        >
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
        </button>
      )}
      </div>

      <RodapeDoAnexo anexo={anexo} />
    </figure>
  );
}
