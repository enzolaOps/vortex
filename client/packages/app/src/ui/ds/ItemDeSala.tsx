import { contagem } from "nucleo/lib/plural";
import {
  useId,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
} from "react";

import { comum, ds, salas } from "../../textos";
import { Cadeado, ModoLento, Volume } from "../icones";
import { juntar } from "../juntar";
import { PilhaDeAvatares } from "./Avatar";
import css from "./ItemDeSala.module.css";
import { Pilula } from "./Pilula";

export interface ItemDeSalaProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Nome da sala ou do canal (sem o "#", que o canal desenha). */
  nome: string;
  /** sala = sala de voz com pessoas; canal = canal de texto. Padrão sala. */
  tipo?: "sala" | "canal";
  /** Pessoas na sala; a contagem aparece sempre, inclusive 0. */
  pessoas?: ReadonlyArray<{
    nome: string;
    id?: string;
    tom?: number;
    imagem?: string | undefined;
  }>;
  /** A lista de nomes mora fora da linha. A pilha de fotos some; a contagem fica. */
  semPilha?: boolean;
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
  /** Canal com acesso limitado: cadeado discreto depois do nome (só canal). */
  restrito?: boolean;
  /** Segundos entre mensagens; 0 ou ausente = sem modo lento (só canal). */
  modoLentoSegundos?: number;
  /**
   * A sala não aceita entrada agora, e este é o motivo (dito em texto, sem depender de cor).
   * O item segue focável e anunciado — só não age —, e o motivo vai no tooltip e na descrição.
   */
  indisponivel?: string;
}

/**
 * Os degraus do que vem depois do nome, do mais cheio ao mais enxuto:
 * 0 avatares + selo · 1 avatares + ponto · 2 "+N" + ponto · 3 só o ponto · 4 nada.
 * O grau é o primeiro cuja largura NATURAL cabe na sobra — medida, não suposta.
 */
export function grauDosExtras(
  sobra: number,
  larguras: { pilha: number; selo: number; ponto: number; chip: number },
  vivo: boolean,
  gente: boolean,
  vao: number,
): number {
  const soma = (...p: number[]) =>
    p.filter((x) => x > 0).reduce((a, b, i) => a + b + (i > 0 ? vao : 0), 0);
  const { pilha, selo, ponto, chip } = larguras;
  const graus = [
    soma(gente ? pilha : 0, vivo ? selo : 0),
    soma(gente ? pilha : 0, vivo ? ponto : 0),
    soma(gente ? chip : 0, vivo ? ponto : 0),
    soma(vivo ? ponto : 0),
  ];
  const g = graus.findIndex((w) => w <= sobra + 0.5);
  return g === -1 ? 4 : g;
}

export function ItemDeSala({
  nome,
  tipo = "sala",
  pessoas = [],
  semPilha = false,
  selecionado = false,
  conectado = false,
  desatualizada = false,
  aoVivo = false,
  naoLida = false,
  mencoes = 0,
  restrito = false,
  modoLentoSegundos = 0,
  indisponivel,
  className,
  type = "button",
  ...resto
}: ItemDeSalaProps) {
  const ehSala = tipo === "sala";
  const vazia = ehSala && pessoas.length === 0;
  const idDoMotivo = useId();
  const bloqueada = ehSala && indisponivel !== undefined;
  const extras = useRef<HTMLSpanElement>(null);
  const vivo = aoVivo;
  const gente = pessoas.length > 0;

  /* Mede a sobra de verdade (container) contra a largura natural de cada peça. */
  useLayoutEffect(() => {
    const el = extras.current;
    if (!el) return;
    const medir = () => {
      const w = (peca: string) =>
        el.querySelector<HTMLElement>(`[data-peca="${peca}"]`)?.offsetWidth ??
        0;
      const vao =
        Number.parseFloat(getComputedStyle(el.firstElementChild!).columnGap) ||
        0;
      const grau = grauDosExtras(
        el.clientWidth,
        {
          pilha: w("pilha"),
          selo: w("selo"),
          ponto: w("ponto"),
          chip: w("chip"),
        },
        vivo,
        gente,
        vao,
      );
      if (el.dataset.grau !== String(grau)) el.dataset.grau = String(grau);
    };
    medir();
    // Adiado para o próximo quadro: mexer no layout dentro do callback do RO dá "loop" no console.
    let quadro = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(medir);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(quadro);
      ro.disconnect();
    };
  }, [vivo, gente, pessoas.length]);

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
      {!ehSala && (restrito || modoLentoSegundos > 0) && (
        <span className={css.marcas}>
          {restrito && (
            <span role="img" aria-label={ds.canalRestrito} title={ds.canalRestrito} data-testid="canal-restrito">
              <Cadeado tamanho={14} />
            </span>
          )}
          {modoLentoSegundos > 0 && (
            <span
              role="img"
              aria-label={ds.modoLento(modoLentoSegundos)}
              title={ds.modoLento(modoLentoSegundos)}
              data-testid="canal-modo-lento"
            >
              <ModoLento tamanho={14} />
            </span>
          )}
        </span>
      )}

      {/*
        ⚠ O NOME tem prioridade: ele pega o que precisa e SÓ o que sobra vai para o resto.
        O resto encolhe em degraus (avatares → "+N", selo → só o ponto) pela largura
        que sobrou, e some antes de o nome virar reticências.
      */}
      {ehSala && (
        <span className={css.extras} ref={extras} data-grau="0">
          <span className={css.extrasInterno}>
            {gente && !semPilha && (
              <>
                <span data-peca="pilha" className={css.peca}>
                  <PilhaDeAvatares itens={pessoas} max={3} tamanho={20} />
                </span>
                <span
                  data-peca="chip"
                  className={juntar(css.peca, css.chipDePessoas)}
                  aria-hidden="true"
                >
                  +{contagem(pessoas.length)}
                </span>
              </>
            )}
            {aoVivo && (
              <>
                <span data-peca="selo" className={css.peca}>
                  <Pilula tipo="aoVivo" />
                </span>
                <span
                  data-peca="ponto"
                  className={juntar(css.peca, css.pontoVivo)}
                  role="img"
                  aria-label={comum.sinalAoVivo}
                />
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
