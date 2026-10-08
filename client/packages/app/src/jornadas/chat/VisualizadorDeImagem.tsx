import { chaveDeMembro } from "nucleo/sdk/domain";
import { useChannel, useMessage, useNomeDoMembro } from "nucleo/store/hooks";
import {
  abrirVisualizador,
  assinarVisualizador,
  fecharVisualizador,
  lerAlvoDoVisualizador,
} from "nucleo/store/visualizadorDeImagem";
import { useSyncExternalStore, type KeyboardEvent } from "react";

import { chat } from "../../textos";
import { Baixar, SetaParaDireita, SetaParaEsquerda } from "../../ui/icones";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./Visualizador.module.css";

/**
 * O visualizador de imagem: um só para o app, aberto pelo store.
 *
 * Mira a MENSAGEM: o cabeçalho diz quem enviou, onde e quando, e as setas
 * andam pelas imagens da mesma mensagem. Esc, clique fora e o foco preso e
 * devolvido ao anexo que abriu vêm do Dialog do Radix.
 */
export function VisualizadorDeImagem({ servidorId }: { servidorId: string }) {
  const alvo = useSyncExternalStore(assinarVisualizador, lerAlvoDoVisualizador);
  const m = useMessage(alvo?.messageId ?? "");
  const canal = useChannel(m?.channelId ?? "");
  const autor = useNomeDoMembro(chaveDeMembro(servidorId, m?.authorId ?? ""));

  const imagens = m?.anexos.filter((a) => a.tipo === "imagem") ?? [];
  const achada = imagens.findIndex((a) => a.id === alvo?.anexoId);
  const indice = Math.max(0, achada);
  const atual = imagens[indice];
  const aberto = alvo !== null && m !== undefined && atual !== undefined;
  const nomeDoAutor = autor ?? chat.autorDesconhecido;

  const ir = (delta: number) => {
    if (!m || imagens.length < 2) return;
    const proxima = imagens[(indice + delta + imagens.length) % imagens.length];
    if (proxima) abrirVisualizador(m.id, proxima.id);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      ir(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      ir(1);
    }
  };

  return (
    <Dialogo
      open={aberto}
      onOpenChange={(a) => {
        if (!a) fecharVisualizador();
      }}
    >
      {aberto && (
        <ConteudoDoDialogo
          titulo={chat.visualizador.titulo(nomeDoAutor)}
          tituloOculto
          className={css.painel}
          onKeyDown={aoTeclar}
          // Sem gatilho o Radix não sabe para onde voltar: o foco vai ao anexo aberto.
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            document
              .querySelector<HTMLElement>(
                `[data-menu-mensagem="${CSS.escape(m.id)}"] [data-anexo-id="${CSS.escape(atual.id)}"]`,
              )
              ?.focus();
          }}
        >
          <header className={css.cabecalho}>
            <span className={css.quem}>
              <strong className={css.autor}>{nomeDoAutor}</strong>
              <span className={css.onde}>
                {canal !== undefined && `${chat.visualizador.emCanal(canal.name)} · `}
                <time>{m.createdAtText}</time>
              </span>
            </span>
            <a
              className={css.baixar}
              href={atual.url}
              download={atual.nome}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${chat.baixar} ${atual.nome}`}
            >
              <Baixar tamanho={18} />
            </a>
          </header>

          <div className={css.palco}>
            <img className={css.imagem} src={atual.url} alt={atual.nome} />
            {imagens.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${css.seta} ${css.anterior}`}
                  aria-label={chat.visualizador.anterior}
                  onClick={() => {
                    ir(-1);
                  }}
                >
                  <SetaParaEsquerda tamanho={20} />
                </button>
                <button
                  type="button"
                  className={`${css.seta} ${css.proxima}`}
                  aria-label={chat.visualizador.proxima}
                  onClick={() => {
                    ir(1);
                  }}
                >
                  <SetaParaDireita tamanho={20} />
                </button>
              </>
            )}
          </div>

          <footer className={css.rodape}>
            <span className={css.nome}>{atual.nome}</span>
            {imagens.length > 1 && (
              <span className={css.posicao} role="status">
                {`${indice + 1} ${chat.visualizador.de} ${imagens.length}`}
              </span>
            )}
          </footer>
        </ConteudoDoDialogo>
      )}
    </Dialogo>
  );
}
