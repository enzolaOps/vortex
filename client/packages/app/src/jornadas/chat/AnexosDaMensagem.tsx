import type { AnexoSnapshot } from "nucleo/sdk/domain";

import { chat } from "../../textos";
import { Arquivo, Baixar } from "../../ui/icones";
import { caixaDoAnexo } from "./caixaDoAnexo";
import css from "./Anexos.module.css";

function Midia({ a }: { a: AnexoSnapshot }) {
  const caixa = caixaDoAnexo(a);
  // A caixa existe antes do arquivo: aspect-ratio + largura calculada do metadata.
  const estilo = { aspectRatio: caixa.proporcao, inlineSize: `min(100%, ${caixa.largura}px)` };
  return (
    <div className={css.moldura} style={estilo}>
      {a.tipo === "imagem" ? (
        <a
          className={css.abrir}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={chat.abrirAnexo(a.nome)}
        >
          <img src={a.url} alt={a.nome} loading="lazy" decoding="async" />
        </a>
      ) : (
        <video src={a.url} controls preload="metadata" aria-label={a.nome} />
      )}
    </div>
  );
}

function AnexoDeAudio({ a }: { a: AnexoSnapshot }) {
  return <audio className={css.audio} src={a.url} controls preload="none" aria-label={a.nome} />;
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
export function AnexosDaMensagem({ anexos }: { anexos: readonly AnexoSnapshot[] }) {
  return (
    <div className={css.anexos}>
      {anexos.map((a) =>
        a.tipo === "audio" ? (
          <AnexoDeAudio key={a.id} a={a} />
        ) : a.tipo === "arquivo" ? (
          <CartaoDeArquivo key={a.id} a={a} />
        ) : (
          <Midia key={a.id} a={a} />
        ),
      )}
    </div>
  );
}
