import type { CSSProperties } from "react";

import { voz } from "../../textos";
import { MicrofoneDesligado } from "../icones";
import { juntar } from "../juntar";
import { Avatar } from "./Avatar";
import css from "./CapsulaDeControle.module.css";
import { ControlesDeVoz, IndicadorDeFala, type ControlesDeVozProps } from "./Controles";
import { PainelVidro } from "./PainelVidro";
import { useExpansao } from "./useExpansao";

export interface CapsulaDeControleProps extends ControlesDeVozProps {
  sala: string;
  /** Tempo decorrido já formatado, ex. "12:04". */
  tempo?: string;
  /** Alguém falando agora (acende o indicador). */
  falando?: boolean;
  pessoas?: ReadonlyArray<{ nome: string; id?: string; tom?: number; falando?: boolean; mudo?: boolean }>;
  /** Chip de qualidade da transmissão, ex. "1080p60". */
  qualidade?: string;
  /** Controlado. Sem ele, expande para cima com ponteiro ou foco e recolhe com Esc. */
  expandido?: boolean;
  onExpandidoChange?: (expandido: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Cápsula de controle de voz para quem ESTÁ na chamada. Surdo implica mudo: com
 * `surdo` o microfone aparece desligado mesmo com `mudo` falso; manter o estado
 * coerente em `onSurdo` é do consumidor.
 */
export function CapsulaDeControle({
  sala,
  tempo,
  falando = false,
  pessoas = [],
  qualidade,
  expandido,
  onExpandidoChange,
  className,
  style,
  ...controles
}: CapsulaDeControleProps) {
  const { aberto, props } = useExpansao({ controlado: expandido, aoMudar: onExpandidoChange });
  const temExtra = pessoas.length > 0 || qualidade !== undefined;

  return (
    <div {...props} className={juntar(css.capsula, aberto && css.expandida, className)} style={style}>
      <PainelVidro raio="pill" className={css.barra}>
        <IndicadorDeFala falando={falando} />
        <span className={css.info}>
          <span className={css.sala}>{sala}</span>
          {tempo && <span className={css.tempo}>{tempo}</span>}
        </span>
        <ControlesDeVoz {...controles} />
      </PainelVidro>

      {temExtra && (
        <PainelVidro className={css.extra} role="group" aria-label={voz.pessoasNaChamada}>
          {pessoas.length > 0 && (
            <ul className={css.lista}>
              {pessoas.map((p) => (
                <li key={p.id ?? p.nome} className={css.pessoa}>
                  <Avatar nome={p.nome} id={p.id} tom={p.tom} tamanho={20} falando={p.falando} />
                  <span className={css.pessoaNome}>{p.nome}</span>
                  {p.mudo && (
                    <span className={css.mudo} role="img" aria-label={voz.estado.mudo}>
                      <MicrofoneDesligado tamanho={14} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {qualidade && (
            <div className={css.rodape}>
              <span className={css.qualidade} aria-label={voz.qualidadeDaTransmissao}>
                {qualidade}
              </span>
            </div>
          )}
        </PainelVidro>
      )}
    </div>
  );
}
