import {
  CaretRight,
  ChatCircle,
  Hash,
  ICONE,
  SpeakerHigh,
  User,
  UsersThree,
} from "../components/ui/icones";
import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogContent } from "../components/ui/Dialog";
import { useServidorAtivo } from "../store/hooks";
import {
  abrirConversa,
  selecionarCanal,
  selecionarServidor,
} from "../store/navegacao";
import { administrar } from "../store/administracao";
import { abrirConversaCom } from "../sdk/social";
import { plural } from "../lib/plural";
import css from "./Paleta.module.css";
import {
  alternarPrefixo,
  analisarBusca,
  CHIPS,
  combina,
  montarIndice,
  pontuar,
  type Entrada,
} from "./indice";
import { lerRecentes, visitar } from "./recentes";

/*
  ⚠ Era `ICONE`, e colidiu com a escala de tamanho do ponto único quando ela
  passou a existir. Os dois conceitos são diferentes — um escolhe QUAL ícone
  pelo tipo do resultado, o outro diz QUÃO GRANDE —, e o nome genérico ficou
  com a escala, que é a de alcance global.
*/
const GLIFO_DO_TIPO = {
  servidor: UsersThree,
  canal: Hash,
  pessoa: User,
  topico: ChatCircle,
  acao: CaretRight,
} as const;

/**
 * A paleta de comandos.
 *
 * Num app denso a sidebar serve para ORIENTAÇÃO e a paleta serve para
 * MOVIMENTO. É a peça de maior relação valor/custo da análise de concorrentes:
 * não precisa de rede, não precisa de backend, e é o que faz um cliente denso
 * parecer *rápido* em vez de *cheio*.
 *
 * O índice é montado na ABERTURA e guardado enquanto ela está aberta. Não é
 * memoização preventiva: o índice depende de `servidorAtivo`, e recalculá-lo a
 * cada tecla varreria todos os canais de todos os servidores por caractere.
 */
export function Paleta({ aoFechar }: { aoFechar: () => void }) {
  const servidorAtivo = useServidorAtivo();
  const [busca, setBusca] = useState("");
  const [cursor, setCursor] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  // Montado uma vez por ABERTURA — o componente só existe enquanto a paleta
  // está aberta, então "montar" e "abrir" são o mesmo momento.
  const indice = useMemo(() => montarIndice(servidorAtivo), [servidorAtivo]);

  /*
    O filtro sai da STRING, e é só isso que existe de estado.

    O design promete que "quem digita e quem clica chega ao mesmo estado"; um
    `useState` para o chip ao lado do campo seria um segundo dono do mesmo
    fato, e os dois divergiriam na primeira vez que alguém apagasse o prefixo
    com Backspace. Ver `analisarBusca`.
  */
  const { tipo, termo } = analisarBusca(busca);

  /**
   * Com o campo vazio: os VISITADOS RECENTEMENTE.
   *
   * ⚠ **Nunca uma lista vazia com busca vazia** — é regra do design, e a
   * alternativa que estava no ar era pior de outro jeito: ela abria com o
   * índice INTEIRO, ordenado por servidor, o que obriga a digitar mesmo para
   * chegar ao lugar de sempre. Sem histórico ainda (primeira sessão), o índice
   * volta a ser o fallback, porque uma paleta que abre vazia não ensina nada.
   */
  const recentes = useMemo(() => {
    const porChave = new Map(indice.map((e) => [`${e.tipo}:${e.id}`, e]));
    return lerRecentes().flatMap((v) => {
      const e = porChave.get(`${v.tipo}:${v.id}`);
      return e ? [e] : [];
    });
  }, [indice]);

  const semTermo = termo.length === 0;
  const mostrandoRecentes = semTermo && tipo === undefined && recentes.length > 0;

  const resultados = useMemo(() => {
    if (mostrandoRecentes) return recentes;

    const filtrados = indice.filter(
      (e) => (tipo === undefined || e.tipo === tipo) && combina(e.rotulo, termo),
    );
    // `sort` estável no JS moderno: entradas com a mesma pontuação mantêm a
    // ordem do índice, que é servidores → canais → pessoas.
    return filtrados
      .sort((a, b) => pontuar(a.rotulo, termo) - pontuar(b.rotulo, termo))
      .slice(0, 50);
  }, [indice, termo, tipo, mostrandoRecentes, recentes]);

  /**
   * Digitou = começa de novo do topo.
   *
   * Ajuste DURANTE o render, não num efeito. O lint do React Compiler reprova
   * `setState` síncrono dentro de `useEffect` — "cascading renders" — e a
   * regra do projeto já dizia a mesma coisa: efeito não é para estado
   * derivado. Este é o padrão documentado do React para "resetar quando uma
   * prop/estado muda": o React descarta o render em curso e refaz, sem
   * commit intermediário.
   *
   * Sem isto o cursor fica na 7ª linha de um resultado que já não existe, e
   * Enter abre algo que a pessoa não viu.
   */
  const [buscaAnterior, setBuscaAnterior] = useState(busca);
  if (busca !== buscaAnterior) {
    setBuscaAnterior(busca);
    setCursor(0);
  }

  function escolher(entrada: Entrada | undefined) {
    if (!entrada) return;

    visitar(entrada.tipo, entrada.id);

    if (entrada.tipo === "acao") {
      /* Fecha ANTES de executar: metade das ações mexe em painel, drawer ou
         navegação, e um modal aberto por cima do que acabou de mudar esconde
         justamente o efeito que a pessoa pediu. */
      aoFechar();
      entrada.executar?.();
      return;
    }

    if (entrada.tipo === "servidor") selecionarServidor(entrada.id);
    else if (entrada.tipo === "canal" || entrada.tipo === "topico") {
      /* Conversa não tem servidor — `serverId` ausente é o que distingue as
         duas, e não um tipo à parte. */
      if (entrada.serverId) {
        selecionarServidor(entrada.serverId);
        selecionarCanal(entrada.id);
      } else {
        abrirConversa(entrada.id);
      }
    } else {
      /*
        Pessoa ABRE A CONVERSA, e não o servidor dela.

        ⚠ **Era "seleciona o servidor", com um comentário dizendo que DM é
        fase 6** — e a fase 6 chegou: `openDM` é idempotente no protocolo e
        `abrirConversaCom` já é o caminho que o menu do usuário e o cartão de
        perfil usam. Escolher uma pessoa numa paleta e cair num servidor é o
        resultado errado com a aparência de certo.
      */
      void abrirConversaCom(entrada.id).then((channelId) => {
        if (channelId) abrirConversa(channelId);
      });
    }

    aoFechar();
  }

  /**
   * O que ⇧↵ abre — e `undefined` quando aquele resultado não tem painel.
   *
   * ⚠ **Divergência 1:1 medida, e ela está dita.** O rodapé do design anuncia
   * "⇧↵ abrir em painel" para toda linha; aqui só PESSOA tem painel próprio (o
   * cartão de perfil). Não existe "canal num painel" neste shell — os slots
   * abrigam membros, fixados, busca, tópicos e caixa de entrada, e nenhum
   * deles é uma conversa. Anunciar a tecla nas linhas que não a cumprem seria
   * o mesmo defeito que a página de atalhos tinha: atalho exibido sem handler.
   * Por isso a dica do rodapé aparece só quando a linha sob o cursor a
   * suporta.
   */
  function painelDe(entrada: Entrada | undefined): (() => void) | undefined {
    if (entrada?.tipo !== "pessoa" || !entrada.serverId) return undefined;
    const { id, serverId } = entrada;
    return () => administrar({ tipo: "perfil", serverId, userId: id });
  }

  const abrirEmPainel = painelDe(resultados[cursor]);

  function aoTeclar(evento: React.KeyboardEvent) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      // Circular: quem chega no fim e continua apertando volta ao começo, em
      // vez de bater numa parede silenciosa.
      const total = resultados.length;
      if (total > 0) setCursor((c) => (c + passo + total) % total);
      return;
    }

    if (evento.key === "Enter") {
      evento.preventDefault();
      if (evento.shiftKey) {
        const alvo = resultados[cursor];
        if (abrirEmPainel && alvo) {
          visitar(alvo.tipo, alvo.id);
          aoFechar();
          abrirEmPainel();
        }
        return;
      }
      escolher(resultados[cursor]);
    }
  }

  // O item ativo acompanha as setas mesmo fora da vista.
  useEffect(() => {
    listaRef.current
      ?.querySelector('[data-ativo="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    // `open` fixo: o componente só existe enquanto a paleta está aberta.
    // Desmontar em vez de esconder é o que faz a busca nascer limpa a cada
    // abertura — sem efeito de limpeza, sem estado velho por um frame.
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent titulo="Buscar" tituloOculto className={css.painel}>
        <input
          ref={campoRef}
          className={css.campo}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={aoTeclar}
          placeholder="Ir para um servidor, canal, conversa ou pessoa…"
          aria-label="Buscar"
          /*
            Combobox, não campo de texto solto.

            `aria-activedescendant` é o que faz o leitor de tela anunciar o
            item sob o cursor sem tirar o foco do campo — sem ele, as setas
            movem um destaque que só existe para quem enxerga.
          */
          role="combobox"
          aria-expanded={resultados.length > 0}
          aria-controls="paleta-resultados"
          aria-activedescendant={
            resultados[cursor] ? `paleta-${resultados[cursor].id}` : undefined
          }
          autoFocus
        />

        {/*
          Os chips ESCREVEM no campo, e é isso que os mantém em sincronia com
          o que foi digitado. `aria-pressed` porque eles são alternadores, e o
          foco volta ao campo: clicar num filtro e ter de voltar ao campo com
          o mouse desfaria a economia do gesto.
        */}
        <div className={css.chips} role="group" aria-label="Filtrar por tipo">
          {CHIPS.map((c) => (
            <button
              key={c.prefixo}
              type="button"
              className={css.chip}
              aria-pressed={tipo === c.tipo}
              data-ativo={tipo === c.tipo}
              onClick={() => {
                setBusca(alternarPrefixo(busca, c.prefixo));
                campoRef.current?.focus();
              }}
            >
              <span className={css.prefixo}>{c.prefixo}</span>
              {c.rotulo}
            </button>
          ))}
        </div>

        {resultados.length === 0 ? (
          <p className={css.vazio}>nada com esse nome</p>
        ) : (
          <div className={css.rolagem}>
            <p className={css.rotuloDoGrupo}>
              {mostrandoRecentes ? "Visitados recentemente" : "Resultados"}
            </p>
            <ul
              className={css.lista}
              id="paleta-resultados"
              role="listbox"
              ref={listaRef}
            >
              {resultados.map((entrada, i) => {
                const Icone =
                  entrada.tipo === "canal" && entrada.canalDeVoz
                    ? SpeakerHigh
                    : GLIFO_DO_TIPO[entrada.tipo];

                return (
                  <li
                    key={`${entrada.tipo}-${entrada.id}`}
                    id={`paleta-${entrada.id}`}
                    role="option"
                    aria-selected={i === cursor}
                    data-ativo={i === cursor}
                    className={css.item}
                    /*
                      `onMouseDown` e não `onClick`: o clique tira o foco do
                      campo antes de disparar, e o Dialog fecharia no blur.

                      ⚠ **`button !== 0` sai, e sem essa linha o botão DIREITO e
                      o do MEIO executavam o item.** `mousedown` dispara para os
                      três botões; `click` só para o principal, então trocar
                      `click` por `mousedown` trouxe junto dois gatilhos que
                      ninguém quis. Clicar com o direito num resultado NAVEGAVA
                      para ele — a paleta é a superfície de "ir para", e ir para
                      o lugar errado por um gesto que não é de ativação é o pior
                      caso possível dela.
                    */
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      escolher(entrada);
                    }}
                    onMouseEnter={() => setCursor(i)}
                  >
                    <Icone size={ICONE.calha} aria-hidden className={css.icone} />
                    <span className={css.rotulo}>{entrada.rotulo}</span>
                    <Selo entrada={entrada} />
                    {entrada.contexto ? (
                      <span className={css.contexto}>{entrada.contexto}</span>
                    ) : null}
                    {entrada.tipo === "acao" ? (
                      <span className={css.dica}>↵</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/*
          O rodapé do design: teclas à esquerda, contagem à direita.

          ⚠ **A contagem conta os RESULTADOS, não o índice** — é o que responde
          "vale a pena continuar digitando?". `plural` porque "1 resultados" é
          o tipo de detalhe que faz a tela parecer feita por outra pessoa.
        */}
        <div className={css.rodape}>
          <span>
            <kbd className={css.tecla}>↑↓</kbd> navegar
          </span>
          <span>
            <kbd className={css.tecla}>↵</kbd> abrir
          </span>
          {abrirEmPainel ? (
            <span>
              <kbd className={css.tecla}>⇧↵</kbd> abrir em painel
            </span>
          ) : null}
          <span className={css.contagem}>
            {plural(resultados.length, "resultado", "resultados")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * O selo da linha: não lidas (danger) ou gente na chamada (success).
 *
 * ⚠ **Menção ganha de não lida**, e é a mesma disciplina da coluna de canais:
 * dois selos na mesma linha disputariam a leitura, e o que decide se você vai
 * agora é a menção. Silenciado não some da lista — ele perde o selo e ganha o
 * estado no subtítulo, exatamente como o realce da coluna.
 */
function Selo({ entrada }: { entrada: Entrada }) {
  if (entrada.naSala !== undefined && entrada.naSala > 0) {
    return (
      <span className={css.selo} data-tom="voz">
        {entrada.naSala} na chamada
      </span>
    );
  }

  if (entrada.silenciado) {
    return (
      <span className={css.selo} data-tom="mudo">
        silenciado
      </span>
    );
  }

  const mencoes = entrada.mencoes ?? 0;
  if (mencoes > 0) {
    return (
      <span className={css.selo} data-tom="mencao">
        {mencoes}
      </span>
    );
  }

  const naoLidas = entrada.naoLidas ?? 0;
  if (naoLidas > 0) {
    return (
      <span className={css.selo} data-tom="naoLida">
        não lidas
      </span>
    );
  }

  return null;
}
