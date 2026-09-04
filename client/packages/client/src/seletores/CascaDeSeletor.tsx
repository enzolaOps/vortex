import type { ReactNode } from "react";

import { CampoDeBusca } from "../components/ui/CampoDeBusca";
import css from "./CascaDeSeletor.module.css";

/**
 * A casca compartilhada dos quatro seletores.
 *
 * O design diz por escrito o que ela é: *"os quatro compartilham a mesma casca:
 * 400×452, rail de categorias de 44 à esquerda, busca no topo, grid
 * virtualizado e rodapé de prévia. Só o soundboard é mais estreito, porque não
 * tem rail."*
 *
 * Componente e não quatro cópias, pelo motivo de sempre neste projeto: quatro
 * painéis que precisam concordar sobre altura, rail e rodapé divergem na
 * primeira mudança de token, e o que diverge é o que ninguém abriu naquela
 * semana. O `Avatar` já ensinou isso com seis cópias.
 *
 * ⚠ **Altura FIXA, e é decisão de ancoragem.** Um painel que cresce com o
 * conteúdo mudaria de altura a cada tecla digitada na busca — e ele abre
 * ANCORADO ACIMA do composer, então crescer para cima faz o conteúdo saltar
 * debaixo do ponteiro. Com altura fixa, quem varia é a rolagem interna.
 */
export function CascaDeSeletor({
  rotulo,
  rail,
  busca,
  acaoDaBusca,
  rodape,
  estreita = false,
  children,
}: {
  /** O que este seletor é, para o leitor de tela. */
  rotulo: string;
  /** A tira de categorias à esquerda. Ausente = casca sem rail (soundboard). */
  rail?: ReactNode;
  busca: {
    readonly valor: string;
    readonly aoMudar: (v: string) => void;
    readonly placeholder: string;
  };
  /** O alvo à direita da busca — o tom de pele no emoji, os favoritos no GIF. */
  acaoDaBusca?: ReactNode;
  /** A faixa de prévia do que está sob o ponteiro. */
  rodape?: ReactNode;
  /** O soundboard: 352 em vez de 400, e sem altura fixa. */
  estreita?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={css.casca}
      data-estreita={estreita || undefined}
      role="group"
      aria-label={rotulo}
    >
      {rail ? <div className={css.rail}>{rail}</div> : null}

      <div className={css.corpo}>
        <div className={css.linhaDeBusca}>
          <CampoDeBusca
            className={css.busca}
            value={busca.valor}
            onChange={(e) => busca.aoMudar(e.target.value)}
            placeholder={busca.placeholder}
            aria-label={busca.placeholder}
            /*
              Foco ao abrir: quem abre um seletor de emoji com mil ícones quase
              sempre sabe o que procura. Sem isto, o primeiro gesto é sempre
              clicar no campo.
            */
            autoFocus
          />
          {acaoDaBusca}
        </div>

        {/*
          `tabIndex={0}` no container rolável.

          Rolável sem foco é inoperável por teclado — achado da auditoria de
          acessibilidade, e vale para toda caixa com `overflow` do projeto.
        */}
        <div className={css.rolagem} tabIndex={0}>
          {children}
        </div>

        {rodape ? <div className={css.rodape}>{rodape}</div> : null}
      </div>
    </div>
  );
}

/** O cabeçalho de uma seção dentro da rolagem — "RECENTES", "Vortex Core". */
export function SecaoDeSeletor({
  titulo,
  grude = false,
  children,
}: {
  titulo: ReactNode;
  /**
   * Gruda no topo ao rolar.
   *
   * Só a PRIMEIRA seção do emoji o faz, como no design: com todas grudando,
   * uma lista de dez categorias empilharia dez cabeçalhos e comeria o grid.
   */
  grude?: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      <div className={css.secao} data-grude={grude || undefined}>
        {titulo}
      </div>
      {children}
    </>
  );
}
