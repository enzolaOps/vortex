import { voz } from "../../textos";
import { ImagemSobreImagem } from "../icones";
import { juntar } from "../juntar";
import { Botao } from "./Botao";
import { ControlesDeVoz, IndicadorDeFala, type ControlesDeVozProps } from "./Controles";
import css from "./PainelDaChamada.module.css";

export type EstadoDaChamadaNoPainel = "conectado" | "conectando" | "reconectando";

const TEXTO_DO_ESTADO: Record<EstadoDaChamadaNoPainel, string> = {
  conectado: voz.conectado,
  conectando: voz.conectando,
  reconectando: voz.reconectando,
};

export interface PainelDaChamadaProps extends ControlesDeVozProps {
  sala: string;
  /** O servidor da sala; DM e grupo não têm. */
  servidor?: string;
  /** Tempo decorrido já formatado, ex. "12:04". Some enquanto não houver. */
  tempo?: string;
  /** Estado da conexão, dito em palavras no cabeçalho. Padrão: conectado. */
  estado?: EstadoDaChamadaNoPainel;
  /** Nome de quem fala; vazio = ninguém (e a linha inteira some). */
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
 * Os controles da chamada, no pé da coluna de salas, acima do rodapé da pessoa.
 *
 * Não é um cartão: é um bloco da própria coluna, na mesma superfície do rodapé e
 * separado dele por uma linha fina. Cabeçalho com o estado da conexão (verde-fala),
 * o tempo em mono e a sala; "quem fala" só ocupa linha enquanto alguém fala; os
 * cinco controles formam uma fileira de botões iguais. O nome da sala e do
 * servidor é o que cede (reticências); estado, tempo e botões nunca.
 */
export function PainelDaChamada({
  sala,
  servidor,
  tempo,
  estado = "conectado",
  quemFala,
  onDestacar,
  destacada = false,
  className,
  ...controles
}: PainelDaChamadaProps) {
  return (
    <section role="region" aria-label={voz.painelDaChamada} data-estado={estado} className={juntar(css.painel, className)}>
      <div className={css.cabeca}>
        <span className={css.estado} role="status">
          <span className={css.ponto} aria-hidden="true" />
          {TEXTO_DO_ESTADO[estado]}
        </span>
        {tempo && <span className={css.tempo}>{tempo}</span>}
        {onDestacar && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<ImagemSobreImagem />}
            className={css.destacar}
            aria-label={destacada ? voz.destacar.trazerDeVolta : voz.destacar.destacar}
            aria-pressed={destacada}
            onClick={onDestacar}
          />
        )}
      </div>
      <p className={css.lugar}>
        <span className={css.sala}>{sala}</span>
        {servidor && <span className={css.servidor}>{servidor}</span>}
      </p>
      {quemFala && (
        <p className={css.quemFala}>
          <IndicadorDeFala falando />
          <span className={css.quemFalaNome}>{quemFala}</span>{" "}
          <span className={css.quemFalaSufixo}>{voz.estaFalando}</span>
        </p>
      )}
      <ControlesDeVoz {...controles} className={css.controles} />
    </section>
  );
}
