import { useId, useRef, type CSSProperties } from "react";

import { salas, voz } from "../../textos";
import { CompartilharTela, MicrofoneDesligado, Volume } from "../icones";
import { juntar } from "../juntar";
import { Avatar } from "./Avatar";
import { Botao } from "./Botao";
import { CantosDeFixacao, type CantoVoz } from "./Controles";
import { PainelVidro } from "./PainelVidro";
import { Pilula } from "./Pilula";
import css from "./WidgetDaSala.module.css";
import { useExpansao } from "./useExpansao";

export interface PessoaDaSala {
  nome: string;
  id?: string;
  tom?: number;
  estado?: "transmitindo" | "falando" | "mudo";
}

export interface WidgetDaSalaProps {
  nome: string;
  pessoas?: readonly PessoaDaSala[];
  aoVivo?: boolean;
  /** Canto fixado; o consumidor precisa de um ancestral `position: relative`. Padrão `br`. */
  canto?: CantoVoz;
  /** Controlado. Sem ele, abre com ponteiro ou foco do teclado e fecha com Esc. */
  aberto?: boolean;
  abertoInicial?: boolean;
  onAbertoChange?: (aberto: boolean) => void;
  onEntrar?: () => void;
  onVerPalco?: () => void;
  onCanto?: (canto: CantoVoz) => void;
  /** Desliga o `position: absolute` (previews, layout próprio). */
  semPosicao?: boolean;
  className?: string;
  style?: CSSProperties;
}

const CANTO = { tl: css.tl, tr: css.tr, bl: css.bl, br: css.br } as const;

function EstadoDaPessoa({ estado }: { estado: NonNullable<PessoaDaSala["estado"]> }) {
  // Sempre ícone + texto: o estado nunca depende só de cor.
  if (estado === "falando") {
    return (
      <span className={juntar(css.estado, css.falandoEstado)}>
        <Volume tamanho={14} />
        {voz.estado.falando}
      </span>
    );
  }
  if (estado === "transmitindo") {
    return (
      <span className={juntar(css.estado, css.transmitindoEstado)}>
        <CompartilharTela tamanho={14} />
        {voz.estado.transmitindo}
      </span>
    );
  }
  return (
    <span className={juntar(css.estado, css.mudoEstado)}>
      <MicrofoneDesligado tamanho={14} />
      {voz.estado.mudo}
    </span>
  );
}

/**
 * Widget da sala de voz para quem NÃO está na chamada: pílula mínima que expande
 * em cartão com quem está lá. Para quem já entrou, use `CapsulaDeControle`.
 */
export function WidgetDaSala({
  nome,
  pessoas = [],
  aoVivo = false,
  canto = "br",
  aberto: abertoControlado,
  abertoInicial,
  onAbertoChange,
  onEntrar,
  onVerPalco,
  onCanto,
  semPosicao = false,
  className,
  style,
}: WidgetDaSalaProps) {
  const idDoCartao = useId();
  const pilula = useRef<HTMLButtonElement>(null);
  const { aberto, definir, props } = useExpansao({
    controlado: abertoControlado,
    inicial: abertoInicial,
    aoMudar: onAbertoChange,
    focoAoFechar: pilula,
  });

  return (
    <div
      {...props}
      className={juntar(css.widget, CANTO[canto], semPosicao && css.estatico, aberto && css.aberto, className)}
      style={style}
    >
      <PainelVidro raio="pill">
        <button
          ref={pilula}
          type="button"
          className={css.pilula}
          aria-expanded={aberto}
          aria-controls={idDoCartao}
          onClick={() => {
            definir(true);
          }}
        >
          <Volume tamanho={16} />
          <span className={css.nome}>{nome}</span>
          {aoVivo && <Pilula tipo="aoVivo" />}
          <Pilula tipo="contagem" valor={pessoas.length} />
        </button>
      </PainelVidro>

      <PainelVidro como="section" id={idDoCartao} aria-label={nome} className={css.card}>
        <div className={css.topo}>
          <h3 className={css.titulo}>{nome}</h3>
          {aoVivo && <Pilula tipo="aoVivo" />}
          {onCanto && <CantosDeFixacao canto={canto} onCanto={onCanto} />}
        </div>

        {pessoas.length === 0 ? (
          <p className={css.vazia}>{salas.vazia}</p>
        ) : (
          <ul className={css.lista} aria-label={salas.naSala(pessoas.length)}>
            {pessoas.map((p) => (
              <li key={p.id ?? p.nome} className={css.pessoa}>
                <Avatar
                  nome={p.nome}
                  id={p.id}
                  tom={p.tom}
                  tamanho={28}
                  falando={p.estado === "falando"}
                  transmitindo={p.estado === "transmitindo"}
                />
                <span className={css.pessoaNome}>{p.nome}</span>
                {p.estado && <EstadoDaPessoa estado={p.estado} />}
              </li>
            ))}
          </ul>
        )}

        {(onEntrar ?? onVerPalco) && (
          <div className={css.acoes}>
            {onEntrar && <Botao onClick={onEntrar}>{salas.entrarNaSala}</Botao>}
            {onVerPalco && (
              <Botao variante="fantasma" onClick={onVerPalco}>
                {voz.verPalco}
              </Botao>
            )}
          </div>
        )}
      </PainelVidro>
    </div>
  );
}
