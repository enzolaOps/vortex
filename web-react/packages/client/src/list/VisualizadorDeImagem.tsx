import { useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import css from "./VisualizadorDeImagem.module.css";

/**
 * A imagem em tamanho grande.
 *
 * Clicar num anexo não fazia nada até agora — a miniatura era o fim da linha.
 *
 * ⚠ **A caixa é reservada a partir do metadata, como na linha.** É a mesma
 * lição que a reserva de espaço do anexo ensinou: `max-inline-size` é TETO e
 * não tamanho, e sem dimensão declarada o diálogo abre com 0×0 e cresce quando
 * o arquivo chega — piscando na cara de quem clicou.
 *
 * Sem zoom nem pan. O upstream usa `@panzoom/panzoom`; aqui a imagem cabe na
 * janela e isso resolve o caso real. Zoom entra quando houver quem peça.
 */
export function VisualizadorDeImagem({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const img = alvo?.tipo === "verImagem" ? alvo : undefined;

  if (!img) return null;

  const proporcao =
    img.largura && img.altura ? img.largura / img.altura : undefined;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo={img.nome}
        tituloOculto
        className={css.painel}
      >
        <figure className={css.figura}>
          <img
            className={css.imagem}
            src={img.url}
            alt={img.nome}
            /*
              `width`/`height` como ATRIBUTOS, não só CSS: é o que dá ao
              navegador a proporção antes do primeiro byte, e o que impede o
              diálogo de saltar quando a imagem chega.
            */
            width={img.largura}
            height={img.altura}
            style={
              proporcao !== undefined
                ? { aspectRatio: String(proporcao) }
                : undefined
            }
          />
          <figcaption className={css.legenda}>{img.nome}</figcaption>
        </figure>

        <div className={css.acoes}>
          {/*
            "Abrir em nova aba" e não "baixar": um `<a download>` de origem
            cruzada é ignorado pelo navegador e vira uma navegação silenciosa —
            um botão que promete uma coisa e faz outra.
          */}
          <Botao
            variante="neutro"
            onClick={() => window.open(img.url, "_blank", "noopener,noreferrer")}
          >
            Abrir em nova aba
          </Botao>
          <Botao variante="sutil" onClick={aoFechar}>
            Fechar
          </Botao>
        </div>
      </DialogContent>
    </Dialog>
  );
}
