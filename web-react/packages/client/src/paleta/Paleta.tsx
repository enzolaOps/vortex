import { Hash, SpeakerHigh, User, UsersThree } from "../components/ui/icones";
import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogContent } from "../components/ui/Dialog";
import { useServidorAtivo } from "../store/hooks";
import { selecionarCanal, selecionarServidor } from "../store/navegacao";
import css from "./Paleta.module.css";
import { combina, montarIndice, pontuar, type Entrada } from "./indice";

const ICONE = {
  servidor: UsersThree,
  canal: Hash,
  pessoa: User,
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

  // Montado uma vez por ABERTURA — o componente só existe enquanto a paleta
  // está aberta, então "montar" e "abrir" são o mesmo momento.
  const indice = useMemo(() => montarIndice(servidorAtivo), [servidorAtivo]);

  const resultados = useMemo(() => {
    const filtrados = indice.filter((e) => combina(e.rotulo, busca));
    // `sort` estável no JS moderno: entradas com a mesma pontuação mantêm a
    // ordem do índice, que é servidores → canais → pessoas.
    return filtrados
      .sort((a, b) => pontuar(a.rotulo, busca) - pontuar(b.rotulo, busca))
      .slice(0, 50);
  }, [indice, busca]);

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

    if (entrada.tipo === "servidor") selecionarServidor(entrada.id);
    else if (entrada.tipo === "canal") {
      if (entrada.serverId) selecionarServidor(entrada.serverId);
      selecionarCanal(entrada.id);
    } else if (entrada.serverId) {
      // Pessoa ainda não tem destino próprio — DM é fase 6. Abrir o servidor
      // dela é o mais próximo que existe hoje, e é honesto: leva a algum lugar
      // relacionado em vez de não fazer nada.
      selecionarServidor(entrada.serverId);
    }

    aoFechar();
  }

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
          className={css.campo}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={aoTeclar}
          placeholder="Ir para um servidor, canal ou pessoa…"
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

        {resultados.length === 0 ? (
          <p className={css.vazio}>nada com esse nome</p>
        ) : (
          <ul className={css.lista} id="paleta-resultados" role="listbox" ref={listaRef}>
            {resultados.map((entrada, i) => {
              const Icone =
                entrada.tipo === "canal" && entrada.canalDeVoz
                  ? SpeakerHigh
                  : ICONE[entrada.tipo];

              return (
                <li
                  key={`${entrada.tipo}-${entrada.id}`}
                  id={`paleta-${entrada.id}`}
                  role="option"
                  aria-selected={i === cursor}
                  data-ativo={i === cursor}
                  className={css.item}
                  // `onMouseDown` e não `onClick`: o clique tira o foco do
                  // campo antes de disparar, e o Dialog fecharia no blur.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    escolher(entrada);
                  }}
                  onMouseEnter={() => setCursor(i)}
                >
                  <Icone size={20} aria-hidden className={css.icone} />
                  <span className={css.rotulo}>{entrada.rotulo}</span>
                  {entrada.contexto ? (
                    <span className={css.contexto}>{entrada.contexto}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
