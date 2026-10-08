import { voz } from "../../textos";
import { ImagemSobreImagem, Volume } from "../icones";
import { juntar } from "../juntar";
import { Botao } from "./Botao";
import { ControlesDeVoz, QuemFala, type ControlesDeVozProps } from "./Controles";
import css from "./PainelDaChamada.module.css";

export interface PainelDaChamadaProps extends ControlesDeVozProps {
  sala: string;
  /** Tempo decorrido já formatado, ex. "12:04". */
  tempo?: string;
  /** Estado da conexão em palavras ("Conectando…"), no lugar do tempo enquanto não há tempo. */
  status?: string;
  /** Nome de quem fala; vazio = ninguém. */
  quemFala?: string;
  /**
   * Destacar a chamada para uma janela própria (o overlay sobre o jogo). Só existe com
   * tratador: onde o ambiente não sabe abrir a janela, o consumidor não passa.
   */
  onDestacar?: () => void;
  /** A chamada já está destacada: o mesmo botão traz de volta. */
  destacada?: boolean;
  className?: string;
}

/**
 * Os controles da chamada fixados na coluna de salas, acima do rodapé da pessoa.
 *
 * Um painel só, que vale em qualquer tela enquanto houver chamada: nome da sala,
 * tempo, quem fala e os cinco controles. O nome da sala é o que cede (reticências);
 * o tempo, a bolinha e os botões nunca.
 */
export function PainelDaChamada({ sala, tempo, status, quemFala, onDestacar, destacada = false, className, ...controles }: PainelDaChamadaProps) {
  return (
    <section role="region" aria-label={voz.painelDaChamada} className={juntar(css.painel, className)}>
      <div className={css.linha}>
        <span className={css.icone} aria-hidden="true">
          <Volume tamanho={16} />
        </span>
        <span className={css.sala}>{sala}</span>
        {tempo ? <span className={css.tempo}>{tempo}</span> : status ? <span className={css.status}>{status}</span> : null}
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
      </div>
      <QuemFala nome={quemFala} className={css.quemFala} />
      <div className={css.controles}>
        <ControlesDeVoz {...controles} />
      </div>
    </section>
  );
}
