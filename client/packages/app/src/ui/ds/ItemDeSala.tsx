import { contagem } from "nucleo/lib/plural";
import { useId, type ButtonHTMLAttributes } from "react";

import { comum, ds, salas } from "../../textos";
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
  pessoas?: ReadonlyArray<{ nome: string; id?: string; tom?: number; imagem?: string | undefined }>;
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
  /**
   * A sala não aceita entrada agora, e este é o motivo (dito em texto, sem depender de cor).
   * O item segue focável e anunciado — só não age —, e o motivo vai no tooltip e na descrição.
   */
  indisponivel?: string;
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
  indisponivel,
  className,
  type = "button",
  ...resto
}: ItemDeSalaProps) {
  const ehSala = tipo === "sala";
  const vazia = ehSala && pessoas.length === 0;
  const idDoMotivo = useId();
  const bloqueada = ehSala && indisponivel !== undefined;

  return (
    <button
      {...resto}
      type={type}
      aria-disabled={bloqueada || undefined}
      aria-describedby={bloqueada ? idDoMotivo : undefined}
      title={bloqueada ? indisponivel : resto.title}
      onClick={bloqueada ? undefined : resto.onClick}
      aria-current={selecionado ? "true" : undefined}
      className={juntar(
        css.item,
        !ehSala && css.canal,
        selecionado && css.selecionado,
        conectado && css.conectado,
        vazia && css.vazia,
        bloqueada && css.indisponivel,
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

      {/*
        ⚠ O NOME tem prioridade: ele pega o que precisa e SÓ o que sobra vai para o resto.
        O resto encolhe em degraus (avatares → "+N", selo → só o ponto) pela largura
        que sobrou, e some antes de o nome virar reticências.
      */}
      {ehSala && (
        <span className={css.extras}>
          <span className={css.extrasInterno}>
            {pessoas.length > 0 && (
              <>
                <PilhaDeAvatares itens={pessoas} max={3} tamanho={20} className={css.pilhaCheia} />
                <span className={css.chipDePessoas} aria-hidden="true">
                  +{contagem(pessoas.length)}
                </span>
              </>
            )}
            {aoVivo && (
              <>
                <Pilula tipo="aoVivo" className={css.seloCheio} />
                <span role="img" aria-label={comum.sinalAoVivo} className={css.pontoVivo} />
              </>
            )}
          </span>
        </span>
      )}
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

      {bloqueada && (
        <span id={idDoMotivo} className={css.soLeitor}>
          {indisponivel}
        </span>
      )}
      {!ehSala && mencoes > 0 && <Pilula tipo="mencao" valor={mencoes} />}
      {!ehSala && mencoes === 0 && naoLida && <Pilula tipo="naoLida" />}
    </button>
  );
}
