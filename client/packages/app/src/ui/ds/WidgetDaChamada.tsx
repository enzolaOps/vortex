import type { CSSProperties } from "react";

import { voz } from "../../textos";
import { SetaEsquerda } from "../icones";
import { juntar } from "../juntar";
import { Botao } from "./Botao";
import { CantosDeFixacao, ControlesDeVoz, IndicadorDeFala, type CantoVoz, type ControlesDeVozProps } from "./Controles";
import { PainelVidro } from "./PainelVidro";
import { Pilula } from "./Pilula";
import css from "./WidgetDaChamada.module.css";
import { useExpansao } from "./useExpansao";

export interface WidgetDaChamadaProps extends ControlesDeVozProps {
  sala?: string;
  /** Tempo decorrido já formatado, ex. "12:04". */
  tempo?: string;
  /** Rótulo do que se transmite, ex. "Tela da Ana". Sem ele não há selo nem rótulo. */
  transmissao?: string;
  /** Nome de quem fala; vazio = ninguém. */
  quemFala?: string;
  canto?: CantoVoz;
  onCanto?: (canto: CantoVoz) => void;
  onVoltar?: () => void;
  semPosicao?: boolean;
  className?: string;
  style?: CSSProperties;
}

const CANTO = { tl: css.tl, tr: css.tr, bl: css.bl, br: css.br } as const;

/**
 * Widget PiP da chamada, para quem lê um canal de texto com a chamada ativa.
 *
 * O consumidor o posiciona ACIMA do compositor (contêiner `position: relative`
 * que termina na borda de cima dele): o widget nunca cobre onde se escreve. Ao
 * ampliar, cresce a partir do canto, para dentro da área de leitura.
 */
export function WidgetDaChamada({
  sala,
  tempo,
  transmissao,
  quemFala,
  canto = "br",
  onCanto,
  onVoltar,
  semPosicao = false,
  className,
  style,
  ...controles
}: WidgetDaChamadaProps) {
  const { aberto, props } = useExpansao({});
  const faixa = [sala, tempo].filter(Boolean).join(" · ");

  return (
    <PainelVidro
      {...props}
      como="section"
      elevacao={3}
      role="region"
      aria-label={voz.chamada}
      tabIndex={0}
      className={juntar(css.widget, CANTO[canto], semPosicao && css.estatico, aberto && css.ampliado, className)}
      style={style}
    >
      <div className={css.palco}>
        {transmissao && (
          <>
            <span className={css.vivo}>
              <Pilula tipo="aoVivo" />
            </span>
            <span className={css.rotulo}>{transmissao}</span>
          </>
        )}
        {(onVoltar ?? onCanto) && (
          <div className={css.sobre}>
            {onCanto && <CantosDeFixacao canto={canto} onCanto={onCanto} />}
            {onVoltar && (
              <Botao variante="secundario" tamanho="sm" icone={<SetaEsquerda />} onClick={onVoltar}>
                {voz.voltarAoPalco}
              </Botao>
            )}
          </div>
        )}
      </div>

      <div className={css.faixa}>
        {faixa && <span className={css.sala}>{faixa}</span>}
        <span className={css.quemFala}>
          <IndicadorDeFala falando={Boolean(quemFala)} />
          {quemFala ? voz.falando(quemFala) : null}
        </span>
      </div>

      <div className={css.controles}>
        <ControlesDeVoz {...controles} />
      </div>
    </PainelVidro>
  );
}
