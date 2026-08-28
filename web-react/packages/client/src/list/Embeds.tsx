import { memo } from "react";

import type { EmbedSnapshot } from "../sdk/domain";
import { useCorDeCargo } from "../store/hooks";
import css from "./Embeds.module.css";

/**
 * O cartão de link sob a mensagem — o embed que o design desenha.
 *
 * ⚠ **Quem gera o cartão é o SERVIDOR, não este componente.** O cliente não
 * busca a página, não lê `<meta>` e não sabe nada sobre o destino: ele recebe
 * título, resumo e miniatura já resolvidos no snapshot da mensagem. Por isso o
 * cartão não tem estado de carregamento — ou veio, ou não existe.
 *
 * `memo` porque a lista é a superfície mais quente do app e o cartão é a coisa
 * mais alta que uma linha pode carregar depois de um anexo.
 */
export const Embeds = memo(function Embeds({
  embeds,
}: {
  embeds: readonly EmbedSnapshot[];
}) {
  return (
    <div className={css.cartoes}>
      {embeds.map((e) => (
        <Cartao key={e.id} embed={e} />
      ))}
    </div>
  );
});

/**
 * Um cartão.
 *
 * ⚠ **A barra colorida passa pelo MESMO clamp do cargo colorido.** A cor vem
 * de quem publicou a página, é crua, e a garantia de contraste deste projeto
 * não a alcança de outra forma — `useCorDeCargo` é o lugar onde matiz e croma
 * de terceiro são aceitos e a luminosidade é do app. Sem cor, a barra fica em
 * acento, que é o que o design desenha.
 *
 * ⚠ **`<a>` e não `onClick`.** O cartão é um link: copiar endereço, abrir em
 * outra aba e o meio-clique precisam funcionar, e nenhum funciona num `div`
 * com handler. `rel="noopener noreferrer"` pela mesma razão do link de
 * markdown — `window.opener` é acesso à aba de origem.
 *
 * ⚠ **NÃO passa pelo `AvisoDeLink`.** Aquele aviso existe porque markdown
 * deixa o texto do link mentir sobre o destino; aqui o texto do cartão é
 * exatamente o título que o servidor leu DA página de destino, e a origem
 * está escrita em cima. O cartão diz para onde vai por construção.
 */
function Cartao({ embed }: { embed: EmbedSnapshot }) {
  const cor = useCorDeCargo(embed.cor);

  const miolo = (
    <>
      <div className={css.texto}>
        {embed.origem ? <div className={css.origem}>{embed.origem}</div> : null}
        {embed.titulo ? <div className={css.titulo}>{embed.titulo}</div> : null}
        {embed.descricao ? (
          <div className={css.descricao}>{embed.descricao}</div>
        ) : null}
      </div>

      {/*
        A miniatura, com espaço RESERVADO pelo CSS e não pela imagem.

        Mesma regra do anexo: `max-inline-size` é teto e não tamanho, e uma
        caixa que mede 0×0 até a imagem chegar é pior que não reservar nada —
        a linha muda de altura quando ela carrega, e altura mudando debaixo do
        virtualizador desloca a âncora. Aqui a caixa é FIXA (72×56 no design),
        então a reserva é exata sem depender de metadata.

        `alt` vazio e `aria-hidden`: a miniatura não acrescenta nada ao que o
        título e a descrição já dizem, e um texto alternativo inventado a
        partir do domínio seria pior que silêncio.
      */}
      {embed.imagemUrl ? (
        <img
          className={css.miniatura}
          src={embed.imagemUrl}
          alt=""
          aria-hidden
          loading="lazy"
        />
      ) : null}
    </>
  );

  const estilo = cor ? { borderInlineStartColor: cor } : undefined;

  if (!embed.url) {
    return (
      <div className={css.cartao} style={estilo}>
        {miolo}
      </div>
    );
  }

  return (
    <a
      className={css.cartao}
      style={estilo}
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {miolo}
    </a>
  );
}
