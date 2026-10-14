import { carregarAteMensagem, members } from "nucleo/sdk/adapter";
import { chaveDeMembro } from "nucleo/sdk/domain";
import {
  aplicarConsulta,
  carregarMais,
  digitar,
  lerBusca,
  refazerBusca,
  selecionarResultado,
} from "nucleo/store/busca";
import { useConexao, useNomeDoMembro } from "nucleo/store/hooks";
import type { ResultadoDeBusca } from "nucleo/sdk/busca";
import {
  analisarConsulta,
  definirFiltro,
  tipoDoFiltro,
  tirarFiltro,
  valorDoFiltro,
  type Filtro,
  type TipoDeConteudo,
} from "nucleo/ui-logica/busca/filtros";
import {
  recortarComDestaque,
  termosDaConsulta,
  textoDaPrevia,
} from "nucleo/ui-logica/busca/trecho";
import { toast } from "nucleo/ui-logica/toastStore";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { busca, chat } from "../../textos";
import { Botao, PainelVidro } from "../../ui/ds";
import { Buscar, Fechar } from "../../ui/icones";
import { pedirSalto } from "../chat/saltos";
import { aoPedirFocoNoCampo, atalhoDaBusca } from "./foco";
import { fecharBuscaDevolvendoFoco, useBusca } from "./hooks";
import css from "./PainelDeBusca.module.css";

/** Os tipos de conteúdo que o painel oferece, na ordem em que aparecem. */
const TIPOS: readonly { chave: string; tipo: TipoDeConteudo; rotulo: string }[] = [
  { chave: "link", tipo: "link", rotulo: busca.filtros.link },
  { chave: "anexo", tipo: "arquivo", rotulo: busca.filtros.anexo },
  { chave: "imagem", tipo: "imagem", rotulo: busca.filtros.imagem },
  { chave: "video", tipo: "video", rotulo: busca.filtros.video },
  { chave: "audio", tipo: "audio", rotulo: busca.filtros.audio },
];

/** "2026-10-03" → "03/10/2026", sem passar por Date (fuso não tem o que fazer aqui). */
function dataLegivel(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(valor);
  return m ? `${m[3] ?? ""}/${m[2] ?? ""}/${m[1] ?? ""}` : valor;
}

function rotuloDaFicha(f: Filtro): string {
  if (!f.valido) return busca.ficha.invalida(f.bruto);
  switch (f.chave) {
    case "de":
      return busca.ficha.de(f.valor);
    case "antes":
      return busca.ficha.antes(dataLegivel(f.valor));
    case "depois":
      return busca.ficha.depois(dataLegivel(f.valor));
    case "durante":
      return busca.ficha.durante(dataLegivel(f.valor));
    case "tem": {
      const tipo = tipoDoFiltro(f.valor);
      return tipo ? busca.ficha.tem[tipo] : busca.ficha.invalida(f.bruto);
    }
  }
}

function Esqueleto() {
  return (
    <div className={css.esqueleto} role="status" aria-busy="true" aria-label={busca.estados.buscando}>
      {["a", "b", "c", "d"].map((id) => (
        <div key={id} className={css.esqueletoLinha} aria-hidden="true">
          <span className={css.esqueletoNome} />
          <span className={css.esqueletoTexto} />
          <span className={css.esqueletoTexto} data-curto="" />
        </div>
      ))}
    </div>
  );
}

function Resultado({
  r,
  servidorId,
  termos,
  ativo,
  indo,
  aoAbrir,
}: {
  r: ResultadoDeBusca;
  servidorId: string;
  termos: readonly string[];
  ativo: boolean;
  indo: boolean;
  aoAbrir: () => void;
}) {
  const nome = useNomeDoMembro(chaveDeMembro(servidorId, r.autorId ?? "")) ?? chat.autorDesconhecido;
  const texto = textoDaPrevia(
    r.conteudo,
    (id) => members.peek(chaveDeMembro(servidorId, id))?.displayName ?? chat.autorDesconhecido,
  );
  const pedacos = recortarComDestaque(texto, termos);
  return (
    <div
      id={`busca-resultado-${r.id}`}
      role="option"
      aria-selected={ativo}
      aria-label={busca.resultados.abrir(nome)}
      aria-busy={indo || undefined}
      data-ativo={ativo || undefined}
      className={css.resultado}
      onClick={aoAbrir}
    >
      <span className={css.cabecaDoResultado} aria-hidden="true">
        <span className={css.autor}>{nome}</span>
        <span className={css.hora}>{r.quando}</span>
      </span>
      <span className={css.trecho} aria-hidden="true">
        {pedacos.length === 0 ? (
          <span className={css.semTexto}>{busca.resultados.semTexto}</span>
        ) : (
          pedacos.map((p, i) =>
            p.destaque ? (
              <mark key={`${String(i)}-${p.texto}`} className={css.marca}>
                {p.texto}
              </mark>
            ) : (
              <span key={`${String(i)}-${p.texto}`}>{p.texto}</span>
            ),
          )
        )}
      </span>
      {r.anexo !== undefined && (
        <span className={css.anexo} aria-hidden="true">
          {busca.resultados.anexo(r.anexo)}
        </span>
      )}
      {indo && <span className={css.indo}>{busca.resultados.indo}</span>}
    </div>
  );
}

/**
 * O painel de busca do canal, na área da gaveta de membros (que ele substitui
 * enquanto aberto).
 *
 * O campo é a fonte da verdade: filtros (`de:`, `antes:`, `tem:`…) moram no
 * texto dele, e as fichas e os controles de filtro são projeção e atalho desse
 * mesmo texto. Resultados vêm do store de busca (`nucleo/store/busca`), que
 * espera a pausa da digitação e descarta a resposta de uma busca antiga.
 *
 * ⚠ **A lista de resultados NÃO é virtualizada, de propósito:** ela cresce de 25
 * em 25, por um botão (o design recusa o scroll infinito), a partir de uma
 * busca que a pessoa refina — não é histórico de dez mil linhas. Se um dia o
 * "carregar mais" passar de algumas centenas, é aqui que o virtualizador entra.
 */
export function PainelDeBusca({ canalId, servidorId }: { canalId: string; servidorId: string }) {
  const estado = useBusca();
  const conexao = useConexao();
  const campo = useRef<HTMLInputElement | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [pediuMais, setPediuMais] = useState(false);
  const [indo, setIndo] = useState<string | undefined>(undefined);
  // O resultado ativo (setas) vale para ESTA lista: lista nova, sem ativo. Derivado
  // pela identidade do array, em vez de um efeito que zera o estado.
  const [navegacao, setNavegacao] = useState<{ lista: readonly ResultadoDeBusca[]; indice: number }>({
    lista: estado.resultados,
    indice: -1,
  });
  const indiceAtivo = navegacao.lista === estado.resultados ? navegacao.indice : -1;
  const ativar = (indice: number) => {
    setNavegacao({ lista: estado.resultados, indice });
    const alvo = estado.resultados[indice];
    if (alvo) {
      document
        .getElementById(`busca-resultado-${alvo.id}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  };

  // O foco entra no campo ao abrir, e Ctrl+F de novo o traz de volta.
  useEffect(() => {
    campo.current?.focus();
    return aoPedirFocoNoCampo(() => {
      campo.current?.focus();
      campo.current?.select();
    });
  }, []);

  // A conexão VOLTOU e a busca tinha falhado: refaz sozinho, sem a pessoa pedir. Só na
  // transição — reagir a "conectado e falhou" refaria sem parar uma busca que o servidor recusa.
  const conexaoAnterior = useRef(conexao);
  useEffect(() => {
    const voltou = conexaoAnterior.current !== "conectado" && conexao === "conectado";
    conexaoAnterior.current = conexao;
    if (voltou && lerBusca().falhou) refazerBusca();
  }, [conexao]);

  const { texto, filtros } = analisarConsulta(estado.consulta);
  const termos = termosDaConsulta(texto);
  const semConexao = conexao === "sem-conexao";

  const abrirResultado = async (r: ResultadoDeBusca) => {
    selecionarResultado(r.id);
    setIndo(r.id);
    const chegada = await carregarAteMensagem(canalId, r.id);
    setIndo(undefined);
    if (chegada.estado === "pronta") pedirSalto(canalId, chegada.chave);
    else if (chegada.estado === "ausente") toast({ tipo: "info", titulo: busca.salto.ausente });
    else toast({ tipo: "erro", titulo: busca.salto.falhou });
  };

  const aoTeclar = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fecharBuscaDevolvendoFoco();
    }
  };

  const aoTeclarNoCampo = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = estado.resultados.length;
    if (e.key === "ArrowDown" && n > 0) {
      e.preventDefault();
      ativar(Math.min(indiceAtivo + 1, n - 1));
    } else if (e.key === "ArrowUp" && n > 0) {
      e.preventDefault();
      ativar(Math.max(indiceAtivo - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const alvo = estado.resultados[indiceAtivo >= 0 ? indiceAtivo : 0];
      if (alvo && !estado.buscando) void abrirResultado(alvo);
      else {
        setPediuMais(false);
        aplicarConsulta(estado.consulta);
      }
    }
  };

  const mudarTexto = (valor: string) => {
    setPediuMais(false);
    digitar(valor);
  };
  const aplicarFiltro = (consulta: string) => {
    setPediuMais(false);
    aplicarConsulta(consulta);
  };

  const temAtual = valorDoFiltro(estado.consulta, "tem");
  const temAtualTipo = temAtual === undefined ? undefined : tipoDoFiltro(temAtual);

  const mostrandoEsqueleto = estado.buscando && !pediuMais && !semConexao;
  const aberturaPendente = indo !== undefined;

  let corpo: ReactNode;
  if (semConexao) {
    corpo = (
      <p className={css.aviso} role="status">
        {busca.estados.semConexao}
      </p>
    );
  } else if (mostrandoEsqueleto) {
    corpo = <Esqueleto />;
  } else if (estado.problema !== undefined) {
    corpo = (
      <div className={css.estado} role="status">
        <p className={css.estadoTitulo}>
          {estado.problema.tipo === "filtroInvalido"
            ? busca.estados.filtroInvalido(estado.problema.bruto)
            : busca.estados.autorDesconhecido(estado.problema.nome)}
        </p>
        <p className={css.estadoDica}>
          {estado.problema.tipo === "filtroInvalido"
            ? busca.estados.filtroInvalidoDica
            : busca.estados.autorDesconhecidoDica}
        </p>
      </div>
    );
  } else if (estado.falhou) {
    corpo = (
      <div className={css.estado} role="alert">
        <p className={css.estadoTitulo}>{busca.estados.erro}</p>
        <Botao variante="secundario" tamanho="sm" onClick={refazerBusca}>
          {busca.estados.tentarDeNovo}
        </Botao>
      </div>
    );
  } else if (estado.total === undefined) {
    corpo = (
      <div className={css.estado}>
        <p className={css.estadoTitulo}>{busca.estados.convite}</p>
        <p className={css.estadoDica}>{busca.estados.conviteDica}</p>
      </div>
    );
  } else if (estado.total === 0) {
    corpo = (
      <div className={css.estado} role="status">
        <p className={css.estadoTitulo}>{busca.estados.vazio(estado.consulta.trim())}</p>
        <p className={css.estadoDica}>{busca.estados.vazioDica}</p>
      </div>
    );
  } else {
    corpo = (
      <>
        <p className={css.contagem} role="status">
          {estado.temMais
            ? busca.resultados.contagemTemMais(estado.total)
            : busca.resultados.contagem(estado.total)}
        </p>
        <div
          id="busca-resultados"
          role="listbox"
          aria-label={busca.resultados.rotulo}
          className={css.lista}
        >
          {estado.resultados.map((r, i) => (
            <Resultado
              key={r.id}
              r={r}
              servidorId={servidorId}
              termos={termos}
              ativo={i === indiceAtivo || estado.selecionado === r.id}
              indo={indo === r.id}
              aoAbrir={() => {
                if (!aberturaPendente) void abrirResultado(r);
              }}
            />
          ))}
        </div>
        {estado.temMais && (
          <div className={css.rodape}>
            <Botao
              variante="secundario"
              tamanho="sm"
              carregando={estado.buscando}
              onClick={() => {
                setPediuMais(true);
                carregarMais();
              }}
            >
              {estado.buscando ? busca.resultados.carregandoMais : busca.resultados.carregarMais}
            </Botao>
          </div>
        )}
      </>
    );
  }

  const ativoId =
    indiceAtivo >= 0 && estado.resultados[indiceAtivo] !== undefined
      ? `busca-resultado-${estado.resultados[indiceAtivo].id}`
      : undefined;
  const listaVisivel = estado.total !== undefined && estado.total > 0 && !mostrandoEsqueleto && !semConexao;

  return (
    <PainelVidro
      como="aside"
      raio="xl"
      aria-label={busca.painel}
      className={css.painel}
      onKeyDown={aoTeclar}
      data-testid="painel-de-busca"
    >
      <div className={css.cabeca}>
        <h2 className={css.titulo}>{busca.titulo}</h2>
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<Fechar />}
          aria-label={busca.fechar}
          title={busca.fecharComAtalho}
          onClick={fecharBuscaDevolvendoFoco}
        />
      </div>

      <div className={css.campoCaixa}>
        <Buscar tamanho={16} className={css.lupa} />
        <input
          ref={campo}
          type="text"
          role="combobox"
          aria-label={busca.campo}
          aria-expanded={listaVisivel}
          aria-controls="busca-resultados"
          aria-autocomplete="list"
          aria-activedescendant={ativoId}
          autoComplete="off"
          spellCheck={false}
          placeholder={busca.placeholder}
          title={busca.dicaDoAtalho(atalhoDaBusca())}
          className={css.campo}
          value={estado.consulta}
          onChange={(e) => {
            mudarTexto(e.target.value);
          }}
          onKeyDown={aoTeclarNoCampo}
        />
      </div>

      <div className={css.barraDeFiltros}>
        <Botao
          variante="fantasma"
          tamanho="sm"
          aria-expanded={filtrosAbertos}
          aria-controls="busca-filtros"
          onClick={() => {
            setFiltrosAbertos((v) => !v);
          }}
        >
          {busca.filtros.mostrar}
        </Botao>
        {filtros.length > 0 && (
          <ul className={css.fichas} aria-label={busca.ficha.rotulo}>
            {filtros.map((f) => {
              const rotulo = rotuloDaFicha(f);
              return (
                <li key={f.bruto} className={css.ficha} data-invalida={f.valido ? undefined : ""}>
                  <span className={css.fichaTexto}>{rotulo}</span>
                  <button
                    type="button"
                    className={css.fichaRemover}
                    aria-label={busca.ficha.remover(rotulo)}
                    onClick={() => {
                      aplicarFiltro(tirarFiltro(estado.consulta, f.bruto));
                    }}
                  >
                    <Fechar tamanho={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {filtrosAbertos && (
        <div id="busca-filtros" className={css.filtros}>
          <label className={css.rotuloDeFiltro}>
            <span>{busca.filtros.de}</span>
            <input
              type="text"
              className={css.entrada}
              placeholder={busca.filtros.dePlaceholder}
              autoComplete="off"
              value={valorDoFiltro(estado.consulta, "de") ?? ""}
              onChange={(e) => {
                mudarTexto(definirFiltro(estado.consulta, "de", e.target.value));
              }}
            />
          </label>
          <label className={css.rotuloDeFiltro}>
            <span>{busca.filtros.depoisDe}</span>
            <input
              type="date"
              className={css.entrada}
              value={valorDoFiltro(estado.consulta, "depois") ?? ""}
              onChange={(e) => {
                aplicarFiltro(definirFiltro(estado.consulta, "depois", e.target.value));
              }}
            />
          </label>
          <label className={css.rotuloDeFiltro}>
            <span>{busca.filtros.antesDe}</span>
            <input
              type="date"
              className={css.entrada}
              value={valorDoFiltro(estado.consulta, "antes") ?? ""}
              onChange={(e) => {
                aplicarFiltro(definirFiltro(estado.consulta, "antes", e.target.value));
              }}
            />
          </label>
          <div className={css.tem} role="group" aria-label={busca.filtros.tem}>
            <span className={css.rotuloDoGrupo}>{busca.filtros.tem}</span>
            {TIPOS.map((t) => {
              const ligado = temAtualTipo === t.tipo;
              return (
                <button
                  key={t.chave}
                  type="button"
                  className={css.tipo}
                  aria-pressed={ligado}
                  onClick={() => {
                    aplicarFiltro(definirFiltro(estado.consulta, "tem", ligado ? undefined : t.chave));
                  }}
                >
                  {t.rotulo}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={css.corpo}>{corpo}</div>
    </PainelVidro>
  );
}
