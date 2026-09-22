import { useCallback, type KeyboardEvent, type ReactNode } from "react";

import { CampoDeBusca } from "../components/ui/CampoDeBusca";
import { ehTeclaDeGrade, proximaCelula, type Celula } from "./navegacaoDeGrade";
import css from "./CascaDeSeletor.module.css";

/** O atributo que marca um alvo navegável por seta. */
const CELULA = "data-celula";

/**
 * Espalhe no botão da grade: `<button {...CELULA_DA_GRADE}>`.
 *
 * Objeto e não a string solta nos quatro seletores — o handler mora aqui e o
 * alvo mora lá, e um erro de digitação num dos lados daria uma grade que
 * simplesmente não responde ao teclado, sem erro nenhum.
 */
export const CELULA_DA_GRADE = { [CELULA]: "" } as const;

/**
 * Só o que está na TELA.
 *
 * `offsetParent` e não uma lista guardada: a seta não pode pular para dentro
 * de uma seção que o filtro da busca escondeu, e `display:none` é como as
 * seções somem aqui. É o mesmo teste que a assertion de linha em 0px usa para
 * distinguir "não renderizado" de "renderizado com zero".
 *
 * ⚠ **Item indisponível CONTINUA na navegação.** O design é explícito: emoji,
 * figurinha e som sem permissão *"aparecem esmaecidos e clicáveis (com
 * tooltip do motivo), não removidos — assim o usuário entende que existe"*.
 * Eles usam `aria-disabled` e não `disabled` justamente para continuar
 * recebendo foco; pulá-los com a seta refaria pelo teclado a remoção que a
 * regra proíbe na tela.
 */
function celulasDe(container: HTMLElement): readonly HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(`[${CELULA}]`)].filter(
    (el) => el.offsetParent !== null,
  );
}

function caixaDe(el: HTMLElement): Celula {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, largura: r.width, altura: r.height };
}

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
  cabecalho,
  busca,
  acaoDaBusca,
  rodape,
  estreita = false,
  desabilitarBusca = false,
  children,
}: {
  /** O que este seletor é, para o leitor de tela. */
  rotulo: string;
  /** A tira de categorias à esquerda. Ausente = casca sem rail (soundboard). */
  rail?: ReactNode;
  /**
   * A faixa ACIMA da busca — só o soundboard a tem ("Painel de sons · sala ·
   * servidor · EM VOZ"). Nos outros três o contexto é o canal do composer e
   * não precisa ser dito.
   */
  cabecalho?: ReactNode;
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
  /**
   * Busca sem nada para buscar — o seletor de GIF numa instância que não
   * configurou GIFs. O campo fica (a casca é a mesma dos outros três) e diz
   * pelo estado desligado que não aceita texto.
   */
  desabilitarBusca?: boolean;
  children: ReactNode;
}) {
  /*
    ⚠ **O handler mora no CONTAINER, não em cada célula.**

    Numa grade de 170 emoji — e de 3.800 no dia em que `emojiCompleto` sair da
    pendência — um `onKeyDown` por botão seriam 170 closures montadas a cada
    render do painel. É a mesma conta que tirou o `ContextMenu` da linha de
    mensagem, e aqui ela é de graça: a tecla borbulha da célula focada até
    aqui, e quem estava focado o `event.target` já diz.

    Ele também é o que faz a seta funcionar com o foco no PRÓPRIO container
    (`tabIndex={0}`, abaixo): quem chega por Tab aperta uma seta e entra na
    primeira célula, em vez de rolar a caixa.
  */
  const aoTeclar = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!ehTeclaDeGrade(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    const container = e.currentTarget;
    const celulas = celulasDe(container);
    if (celulas.length === 0) return;

    const foco = document.activeElement;
    const atual =
      foco instanceof HTMLElement ? celulas.indexOf(foco) : -1;
    const destino = proximaCelula(celulas.map(caixaDe), atual, e.key);
    /*
      Sem destino a tecla PASSA: na borda de baixo da grade `ArrowDown` volta a
      ser rolagem, que é o que se espera. Engolir sempre deixaria o painel sem
      como rolar por teclado a partir da última fileira.
    */
    if (destino === undefined) return;

    e.preventDefault();
    const alvo = celulas[destino];
    alvo?.focus();
    alvo?.scrollIntoView({ block: "nearest" });
  }, []);

  return (
    <div
      className={css.casca}
      data-estreita={estreita || undefined}
      role="group"
      aria-label={rotulo}
    >
      {rail ? <div className={css.rail}>{rail}</div> : null}

      <div className={css.corpo}>
        {cabecalho ? <div className={css.cabecalho}>{cabecalho}</div> : null}
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
            autoFocus={!desabilitarBusca}
            disabled={desabilitarBusca}
          />
          {acaoDaBusca}
        </div>

        {/*
          `tabIndex={0}` no container rolável.

          Rolável sem foco é inoperável por teclado — achado da auditoria de
          acessibilidade, e vale para toda caixa com `overflow` do projeto.
        */}
        <div className={css.rolagem} tabIndex={0} onKeyDown={aoTeclar}>
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
