import type { AnexoSnapshot } from "nucleo/sdk/domain";
import { abrirVisualizador } from "nucleo/store/visualizadorDeImagem";

import { chat } from "../../textos";
import { Arquivo, Baixar } from "../../ui/icones";
import { caixaDoAnexo } from "./caixaDoAnexo";
import css from "./Anexos.module.css";
import { PlayerDeAudio } from "./PlayerDeAudio";

function Midia({ a, mensagemId }: { a: AnexoSnapshot; mensagemId: string }) {
  const caixa = caixaDoAnexo(a);
  // A caixa existe antes do arquivo: aspect-ratio + largura calculada do metadata.
  const estilo = { aspectRatio: caixa.proporcao, inlineSize: `min(100%, ${caixa.largura}px)` };
  return (
    <div className={css.moldura} style={estilo}>
      {a.tipo === "imagem" ? (
        // `button` e não link: recebe foco, responde a Enter e é anunciado como botão.
        // A imagem continua preenchendo a moldura, então a caixa reservada não muda.
        <button
          type="button"
          className={css.abrir}
          data-anexo-id={a.id}
          aria-label={chat.abrirAnexo(a.nome)}
          onClick={() => {
            abrirVisualizador(mensagemId, a.id);
          }}
        >
          <img src={a.url} alt="" loading="lazy" decoding="async" />
        </button>
      ) : (
        <video src={a.url} controls preload="metadata" aria-label={a.nome} />
      )}
    </div>
  );
}

function CartaoDeArquivo({ a }: { a: AnexoSnapshot }) {
  return (
    <a className={css.arquivo} href={a.url} target="_blank" rel="noopener noreferrer" download={a.nome}>
      <Arquivo tamanho={20} />
      <span className={css.nomeDoArquivo}>{a.nome}</span>
      {a.tamanhoTexto !== undefined && <span className={css.peso}>{a.tamanhoTexto}</span>}
      <Baixar tamanho={16} aria-label={chat.baixar} />
    </a>
  );
}

/** Os anexos de uma mensagem. Cada um já nasce com a altura que vai ter. */
export function AnexosDaMensagem({ anexos, mensagemId }: { anexos: readonly AnexoSnapshot[]; mensagemId: string }) {
  return (
    <div className={css.anexos}>
      {anexos.map((a) =>
        a.tipo === "audio" ? (
          <PlayerDeAudio key={a.id} a={a} />
        ) : a.tipo === "arquivo" ? (
          <CartaoDeArquivo key={a.id} a={a} />
        ) : (
          <Midia key={a.id} a={a} mensagemId={mensagemId} />
        ),
      )}
    </div>
  );
}
