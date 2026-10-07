import { contagem } from "nucleo/lib/plural";
import type { ButtonHTMLAttributes } from "react";

import { ds, salas } from "../../textos";
import { Volume } from "../icones";
import { juntar } from "../juntar";
import { PilhaDeAvatares } from "./Avatar";
import css from "./ItemDeSala.module.css";
import { Pilula } from "./Pilula";

export interface ItemDeSalaProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Nome da sala ou do canal (sem o "#", que o canal desenha). */
  nome: string;
  /** sala = sala de voz com pessoas; canal = canal de texto. Padrão sala. */
  tipo?: "sala" | "canal";
  /** Pessoas na sala; a contagem aparece sempre, inclusive 0. */
  pessoas?: ReadonlyArray<{ nome: string; id?: string; tom?: number }>;
  /** Item ativo da coluna. Um por coluna. */
  selecionado?: boolean;
  /** Você está conectado nesta sala. */
  conectado?: boolean;
  /**
   * A conexão caiu: o que se mostra é a última presença conhecida, esmaecida e
   * dita como desatualizada, sem afirmar quem está onde.
   */
  desatualizada?: boolean;
  /** Mostra a Pilula "AO VIVO" (só sala). */
  aoVivo?: boolean;
  /** Canal com mensagens não lidas: texto mais forte e ponto de não lida. */
  naoLida?: boolean;
  /** Canal com menções: Pilula de menção no lugar do ponto. */
  mencoes?: number;
}

export function ItemDeSala({
  nome,
  tipo = "sala",
  pessoas = [],
  selecionado = false,
  conectado = false,
  desatualizada = false,
  aoVivo = false,
  naoLida = false,
  mencoes = 0,
  className,
  type = "button",
  ...resto
}: ItemDeSalaProps) {
  const ehSala = tipo === "sala";
  const vazia = ehSala && pessoas.length === 0;

  return (
    <button
      {...resto}
      type={type}
      aria-current={selecionado ? "true" : undefined}
      className={juntar(
        css.item,
        !ehSala && css.canal,
        selecionado && css.selecionado,
        conectado && css.conectado,
        vazia && css.vazia,
        ehSala && desatualizada && css.desatualizada,
        !ehSala && naoLida && css.naoLidaTexto,
        className,
      )}
    >
      {!ehSala && (
        <span className={css.hash} aria-hidden="true">
          #
        </span>
      )}
      <span className={css.nome}>{nome}</span>

      {ehSala && pessoas.length > 0 && <PilhaDeAvatares itens={pessoas} max={3} tamanho={20} />}
      {ehSala && aoVivo && <Pilula tipo="aoVivo" />}
      {ehSala && conectado && (
        <span role="img" aria-label={ds.voceEstaAqui} className={css.aqui}>
          <Volume tamanho={16} />
        </span>
      )}
      {ehSala && (
        <span
          className={css.contagem}
          role="img"
          aria-label={
            desatualizada
              ? `${salas.naSala(pessoas.length)}, ${salas.presencaDesatualizada.toLowerCase()}`
              : salas.naSala(pessoas.length)
          }
        >
          <span aria-hidden="true">{contagem(pessoas.length)}</span>
        </span>
      )}

      {!ehSala && mencoes > 0 && <Pilula tipo="mencao" valor={mencoes} />}
      {!ehSala && mencoes === 0 && naoLida && <Pilula tipo="naoLida" />}
    </button>
  );
}
