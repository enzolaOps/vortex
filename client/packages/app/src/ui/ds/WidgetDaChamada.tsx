import type { CSSProperties, ReactNode } from "react";

import { voz } from "../../textos";
import { ImagemSobreImagem, SetaEsquerda } from "../icones";
import { juntar } from "../juntar";
import { Botao } from "./Botao";
import { CantosDeFixacao, ControlesDeVoz, IndicadorDeFala, type CantoVoz, type ControlesDeVozProps } from "./Controles";
import { PainelVidro } from "./PainelVidro";
import { Pilula } from "./Pilula";
import css from "./WidgetDaChamada.module.css";
import { useArrastoParaCanto } from "./useArrastoParaCanto";
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
  /**
   * O vídeo em foco (transmissão ou quem fala). Sem ele, o palco do widget fica
   * vazio, como antes. O consumidor monta o `<video>` e a assinatura dele.
   */
  video?: ReactNode;
  /**
   * Destacar a chamada para uma janela própria. Só existe com tratador: onde o
   * ambiente não sabe abrir a janela, o consumidor não passa e o botão não aparece.
   */
  onDestacar?: () => void;
  /** A chamada já está destacada: o mesmo botão traz de volta. */
  destacada?: boolean;
  semPosicao?: boolean;
  className?: string;
  style?: CSSProperties;
}

const CANTO = { tl: css.tl, tr: css.tr, bl: css.bl, br: css.br } as const;

/**
 * Widget PiP da chamada, para quem lê um canal de texto com a chamada ativa.
 *
 * Arrastável: solto, ele se prende ao canto mais próximo (o mesmo que os quatro
 * botões de canto escolhem, para quem não usa ponteiro).
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
  video,
  onDestacar,
  destacada = false,
  semPosicao = false,
  className,
  style,
  ...controles
}: WidgetDaChamadaProps) {
  const { aberto, props } = useExpansao({});
  const arrasto = useArrastoParaCanto(onCanto);
  const faixa = [sala, tempo].filter(Boolean).join(" · ");

  return (
    <PainelVidro
      {...props}
      {...arrasto}
      como="section"
      elevacao={3}
      role="region"
      aria-label={voz.chamada}
      tabIndex={0}
      className={juntar(css.widget, CANTO[canto], semPosicao && css.estatico, aberto && css.ampliado, className)}
      style={style}
    >
      <div className={css.palco}>
        {video}
        {transmissao && (
          <>
            <span className={css.vivo}>
              <Pilula tipo="aoVivo" />
            </span>
            <span className={css.rotulo}>{transmissao}</span>
          </>
        )}
        {(onVoltar ?? onCanto ?? onDestacar) && (
          <div className={css.sobre}>
            <div className={css.linhaDeCima}>
              {onDestacar && (
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<ImagemSobreImagem />}
                  aria-label={destacada ? voz.destacar.trazerDeVolta : voz.destacar.destacar}
                  aria-pressed={destacada}
                  onClick={onDestacar}
                />
              )}
              {onCanto && <CantosDeFixacao canto={canto} onCanto={onCanto} />}
            </div>
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
