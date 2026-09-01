import { MagnifyingGlass, Plus, X } from "../components/ui/icones";
import { memo, useEffect, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Girador } from "../components/ui/Girador";
import { Selo } from "../components/ui/Selo";
import { toast } from "../components/ui/toastStore";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { aindaNao } from "../pendente/pendencias";
import type { ResultadoDeBusca } from "../sdk/busca";
import {
  apontarBuscaPara,
  assinarBusca,
  definirConsulta,
  definirOrdem,
  executar,
  lerBusca,
  paginasConhecidas,
  selecionarResultado,
} from "../store/busca";
import { pedirIrParaMensagem } from "../store/comandos";
import { fecharDrawer } from "../store/drawer";
import { useCanalAtivo } from "../store/hooks";
import css from "./PainelDeBusca.module.css";

/**
 * Os filtros que o design desenha.
 *
 * ⚠ **Nenhum dos dois existe no protocolo.** `POST /channels/{id}/search`
 * aceita `query`, `sort`, `limit` e cursor — e nada mais. Eles ficam na tela
 * porque a regra deste projeto é construir 1:1 e registrar o que não funciona;
 * tirar o `✕` deles seria pior, porque aí eles pareceriam filtros ATIVOS que
 * não fazem nada.
 */
const FILTROS = ["de:marina", "tem:arquivo"] as const;

/**
 * Um resultado. Assina o próprio autor pelo `NomeDoAutor`.
 *
 * `memo` pela mesma razão do painel de fixadas: trocar de página troca a lista
 * inteira, mas mudar a SELEÇÃO toca dois cartões — o que saiu e o que entrou.
 */
const Resultado = memo(function Resultado({
  r,
  selecionado,
}: {
  r: ResultadoDeBusca;
  selecionado: boolean;
}) {
  function abrir() {
    selecionarResultado(r.id);
    pedirIrParaMensagem(r.channelId, r.id);
  }

  return (
    <li className={css.item}>
      {/*
        ⚠ As ações são IRMÃS do cartão e não filhas: botão dentro de botão é
        HTML inválido — o navegador reestrutura a árvore e o clique interno
        aciona os dois. O mesmo erro que a linha de canal e o painel de fixadas
        já registraram.
      */}
      <button
        type="button"
        className={css.cartao}
        aria-current={selecionado}
        onClick={abrir}
      >
        <span className={css.origem}>
          <span className={css.canal}>#{r.nomeDoCanal}</span>
          <span className={css.quando}>{r.quando}</span>
          {selecionado ? (
            <Selo forma="etiqueta" tom="acento">
              atual
            </Selo>
          ) : null}
        </span>

        <span className={css.corpo}>
          {r.autorId !== undefined ? (
            <Avatar id={r.autorId} tamanho="xs" />
          ) : null}
          <span className={css.textos}>
            {r.autorId !== undefined ? (
              <NomeDoAutor userId={r.autorId} denso />
            ) : null}
            <span className={css.previa}>{r.conteudo}</span>
            {r.anexo !== undefined ? (
              <span className={css.anexo}>{r.anexo}</span>
            ) : null}
          </span>
        </span>
      </button>

      <div className={css.acoes}>
        <button type="button" className={css.acao} onClick={abrir}>
          Pular para mensagem
        </button>
        <button
          type="button"
          className={css.acaoNeutra}
          onClick={() => {
            /*
              O permalink já existe e é rota de verdade desde a etapa 3 — este
              botão só o escreve na área de transferência.
            */
            const url = `${location.origin}/servidor/-/canal/${r.channelId}/${r.id}`;
            void navigator.clipboard
              .writeText(url)
              .then(() => {
                toast({ tipo: "info", titulo: "Link copiado." });
              })
              .catch(() => {
                toast({
                  tipo: "erro",
                  titulo: "Não deu para copiar.",
                  descricao: url,
                });
              });
          }}
        >
          Copiar link
        </button>
      </div>
    </li>
  );
});

/**
 * Painel de busca.
 *
 * ⚠ **É `PainelId`, e ocupa o lugar da lista de membros — nunca os dois ao
 * mesmo tempo.** Quem resolve isso é `store/drawer.ts`, que já resolvia para
 * fixados e caixa de entrada: painel COM slot alterna o slot, painel SEM slot
 * flutua. Sem isso, abrir a busca faria a lista de membros sumir sem aviso, que
 * é o defeito que aquele store foi escrito para matar.
 *
 * A busca é REAL — `Channel.search` do protocolo, com ordem e cursor. O que
 * não é real está dito na tela e no registro: filtro por autor ou por anexo, e
 * busca em todos os canais do servidor.
 */
export function PainelDeBusca() {
  const b = useSyncExternalStore(assinarBusca, lerBusca);
  const canal = useCanalAtivo();

  /*
    Trocar de canal REAPONTA e limpa. Os resultados carregam o canal de origem
    e o salto acontece nele; manter a lista ao mudar de canal daria um painel
    que pula para outro lugar.
  */
  useEffect(() => {
    apontarBuscaPara(canal);
  }, [canal]);

  const paginas = paginasConhecidas();

  return (
    <aside className={css.painel} aria-label="Busca no canal">
      <div className={css.cabecalho}>
        <div className={css.titulo}>
          <h2 className={css.nome}>Resultados</h2>
          {b.total !== undefined ? (
            <span className={css.contagem}>
              {b.total === 1 ? "1 nesta página" : `${String(b.total)} nesta página`}
            </span>
          ) : null}
          <button
            type="button"
            className={css.fechar}
            aria-label="Fechar busca"
            onClick={fecharDrawer}
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        {/*
          `form` e não um `onKeyDown`: buscar a cada tecla dispararia uma
          chamada de rede por caractere num campo cuja resposta é uma varredura
          de texto completo no servidor. Enter é o gatilho, e o `form` dá isso
          de graça — com o teclado do celular mostrando "buscar".
        */}
        <form
          className={css.campo}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void executar(1);
          }}
        >
          <MagnifyingGlass size={16} aria-hidden />
          <input
            type="search"
            className={css.entrada}
            placeholder="Buscar neste canal"
            aria-label="Buscar neste canal"
            value={b.consulta}
            onChange={(e) => definirConsulta(e.target.value)}
          />
        </form>

        <div className={css.filtros}>
          {FILTROS.map((f) => (
            <span key={f} className={css.filtro}>
              {f}
              <button
                type="button"
                className={css.tirarFiltro}
                aria-label={`Tirar o filtro ${f}`}
                onClick={aindaNao("filtroDeBusca")}
              >
                <X size={10} aria-hidden />
              </button>
            </span>
          ))}
          <button
            type="button"
            className={css.maisFiltro}
            onClick={aindaNao("filtroDeBusca")}
          >
            <Plus size={10} aria-hidden />
            filtro
          </button>
        </div>

        <div className={css.ordem}>
          <div className={css.abas} role="tablist" aria-label="Ordem">
            <button
              type="button"
              role="tab"
              className={css.aba}
              aria-selected={b.ordem === "recentes"}
              onClick={() => definirOrdem("recentes")}
            >
              Recentes
            </button>
            <button
              type="button"
              role="tab"
              className={css.aba}
              aria-selected={b.ordem === "relevantes"}
              onClick={() => definirOrdem("relevantes")}
            >
              Relevantes
            </button>
          </div>
          <span className={css.espaco} />
          <button
            type="button"
            className={css.noServidor}
            onClick={aindaNao("buscaNoServidor")}
          >
            Buscar em todo o servidor
          </button>
        </div>
      </div>

      {b.buscando ? (
        <div className={css.vazio}>
          <Girador tamanho={20} rotulo="Buscando" />
        </div>
      ) : b.resultados.length > 0 ? (
        <ul className={css.lista} tabIndex={0}>
          {b.resultados.map((r) => (
            <Resultado key={r.id} r={r} selecionado={r.id === b.selecionado} />
          ))}
        </ul>
      ) : (
        <div className={css.vazio}>
          {/*
            Dois vazios diferentes, e a distinção importa: "ainda não buscou" é
            um convite, "não achou" é um resultado. O mesmo texto para os dois
            faria a pessoa achar que a busca falhou antes de tê-la feito.
          */}
          <EstadoVazio
            titulo={
              b.total === undefined ? "Busque neste canal" : "Nada encontrado"
            }
            detalhe={
              b.total === undefined
                ? "Digite e aperte Enter. A busca é do canal aberto."
                : "Tente outras palavras, ou troque a ordem para Relevantes."
            }
          />
        </div>
      )}

      {/*
        ⚠ Os números só aparecem quando há mais de uma página CONHECIDA, e a
        pilha de cursores é quem sabe: o protocolo pagina por cursor, então não
        existe "página 7" antes de passar pela 6. Mostrar 1·2·3 fixos como no
        desenho daria dois números que às vezes não levam a lugar nenhum.
      */}
      {paginas > 1 ? (
        <nav className={css.paginas} aria-label="Páginas de resultado">
          {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={css.pagina}
              aria-current={n === b.pagina}
              aria-label={`Página ${String(n)}`}
              onClick={() => void executar(n)}
            >
              {n}
            </button>
          ))}
        </nav>
      ) : null}
    </aside>
  );
}
