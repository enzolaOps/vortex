import type { ReactNode } from "react";

import { FundoVidro, PainelVidro } from "../../ui/ds";
import css from "./Entrada.module.css";
import { Marca } from "./Marca";

/**
 * A moldura das telas de fora do app: fundo de vidro e um cartão central. É o
 * `main` da página (não há shell por trás), e o cartão não depende de a janela ser
 * larga: 400px no máximo, a largura toda quando falta espaço.
 */
export function MoldeDaEntrada({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <FundoVidro className={css.pagina} data-testid="tela-de-entrada">
      <PainelVidro como="main" variante="sobreposto" raio="lg" elevacao={3} className={css.cartao}>
        <div className={css.cabecalho}>
          <Marca tamanho={52} />
          <div className={css.titulos}>
            <h1 className={css.titulo}>{titulo}</h1>
            {subtitulo && <p className={css.subtitulo}>{subtitulo}</p>}
          </div>
        </div>
        {children}
      </PainelVidro>
    </FundoVidro>
  );
}
