import { useVirtualizer } from "@tanstack/react-virtual";
import { ACOES, listarAuditoria, type EntradaDeAuditoria } from "nucleo/sdk/auditoria";
import { podeNoServidor } from "nucleo/sdk/permissoes";
import { useEffect, useRef, useState } from "react";

import { admin } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import css from "./admin.module.css";
import { Carregando, Falhou, Vazio } from "./Estados";

/** Quantas entradas cada volta ao servidor traz. O teto dele é 100. */
export const TAMANHO_DA_PAGINA = 50;

type Pagina = {
  /** De quem é esta resposta: servidor e filtros. Resposta de outra chave não vale. */
  readonly chave: string;
  readonly itens: readonly EntradaDeAuditoria[] | undefined;
  /** A última volta trouxe menos que a página: não há mais o que pedir. */
  readonly fim: boolean;
};

/**
 * Registro de atividade (PRD 4.7): o que a equipe fez no servidor.
 *
 * A lista é VIRTUALIZADA (lei nº 2): o registro de um servidor movimentado
 * passa de milhares de entradas. A paginação é pelo id da última entrada, que
 * é o que a rota conhece. Os dois filtros vão ao servidor.
 */
export function Auditoria({ serverId }: { serverId: string }) {
  const t = admin.auditoriaPagina;
  const pode = podeNoServidor(serverId, "verAuditoria");
  const [tipo, setTipo] = useState("");
  const [autorId, setAutorId] = useState("");
  const [revisao, setRevisao] = useState(0);
  const [resposta, setResposta] = useState<Pagina | undefined>();
  const [autores, setAutores] = useState<ReadonlyMap<string, string>>(new Map());
  const [buscandoMais, setBuscandoMais] = useState(false);
  const [falhouMais, setFalhouMais] = useState(false);

  const chave = `${serverId}|${tipo}|${autorId}|${revisao}`;

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    void listarAuditoria(serverId, {
      tipo: tipo === "" ? undefined : tipo,
      autorId: autorId === "" ? undefined : autorId,
      limite: TAMANHO_DA_PAGINA,
    }).then((itens) => {
      if (!vivo) return;
      setResposta({ chave, itens, fim: itens === undefined || itens.length < TAMANHO_DA_PAGINA });
      setFalhouMais(false);
      if (itens) {
        // As opções de autor acumulam: filtrar por uma pessoa não pode esvaziar o seletor.
        setAutores((antes) => {
          const novo = new Map(antes);
          for (const e of itens) novo.set(e.autorId, e.autor);
          return novo;
        });
      }
    });
    return () => {
      vivo = false;
    };
  }, [serverId, tipo, autorId, chave, pode]);

  const atual = resposta?.chave === chave ? resposta : undefined;

  const carregarMais = async () => {
    const itens = atual?.itens;
    const ultima = itens?.[itens.length - 1];
    if (!itens || !ultima) return;
    setBuscandoMais(true);
    setFalhouMais(false);
    const mais = await listarAuditoria(serverId, {
      tipo: tipo === "" ? undefined : tipo,
      autorId: autorId === "" ? undefined : autorId,
      antesDe: ultima.id,
      limite: TAMANHO_DA_PAGINA,
    });
    setBuscandoMais(false);
    if (mais === undefined) {
      setFalhouMais(true);
      return;
    }
    setResposta((r) =>
      r?.chave === chave && r.itens
        ? { chave, itens: [...r.itens, ...mais], fim: mais.length < TAMANHO_DA_PAGINA }
        : r,
    );
  };

  if (!pode) {
    return (
      <div className={css.pagina}>
        <Vazio titulo={t.semPermissao} texto={t.semPermissaoDica} />
      </div>
    );
  }

  const filtrando = tipo !== "" || autorId !== "";

  return (
    <div className={css.pagina}>
      <div className={css.barra}>
        <div className={css.barraEsquerda}>
          <select
            className={css.busca}
            aria-label={t.filtroAcao}
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
            }}
          >
            <option value="">{t.todasAsAcoes}</option>
            {Object.entries(ACOES).map(([id, frase]) => (
              <option key={id} value={id}>
                {frase}
              </option>
            ))}
          </select>
          <select
            className={css.busca}
            aria-label={t.filtroAutor}
            value={autorId}
            onChange={(e) => {
              setAutorId(e.target.value);
            }}
          >
            <option value="">{t.todosOsAutores}</option>
            {[...autores].map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </div>
        {atual?.itens && (
          <span className={css.meta} data-testid="total-de-entradas">
            {t.total(atual.itens.length)}
            {atual.fim ? "" : "+"}
          </span>
        )}
      </div>

      {atual === undefined ? (
        <Carregando texto={t.carregando} />
      ) : atual.itens === undefined ? (
        <Falhou
          texto={t.erro}
          aoTentar={() => {
            setRevisao((r) => r + 1);
          }}
        />
      ) : atual.itens.length === 0 ? (
        <Vazio
          titulo={filtrando ? t.vazioComFiltro : t.vazio}
          texto={filtrando ? t.vazioComFiltroDica : t.vazioDica}
        />
      ) : (
        <>
          <ListaVirtual itens={atual.itens} />
          <div className={css.rodapeDaLista}>
            {falhouMais && (
              <p className={css.erro} role="alert">
                {t.erroAoCarregarMais}
              </p>
            )}
            {atual.fim ? (
              <p className={css.dica}>{t.fim}</p>
            ) : (
              <Botao
                variante="secundario"
                tamanho="sm"
                carregando={buscandoMais}
                onClick={() => {
                  void carregarMais();
                }}
              >
                {t.carregarMais}
              </Botao>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ListaVirtual({ itens }: { itens: readonly EntradaDeAuditoria[] }) {
  const rolagem = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual: o compiler pula este componente
  const virtualizer = useVirtualizer({
    count: itens.length,
    getScrollElement: () => rolagem.current,
    estimateSize: () => 64,
    getItemKey: (i) => itens[i]?.id ?? i,
    overscan: 6,
  });

  return (
    <div
      ref={rolagem}
      className={css.rolagemDaAuditoria}
      data-testid="lista-de-auditoria"
      data-total={itens.length}
      tabIndex={0}
      role="list"
      aria-label={admin.auditoriaPagina.lista}
    >
      <div className={css.trilhoDaAuditoria} style={{ blockSize: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const e = itens[item.index];
          if (!e) return null;
          return (
            <div
              key={e.id}
              ref={virtualizer.measureElement}
              data-index={item.index}
              role="listitem"
              className={css.itemDaAuditoria}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <Entrada entrada={e} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Entrada({ entrada: e }: { entrada: EntradaDeAuditoria }) {
  const t = admin.auditoriaPagina;
  return (
    <div className={css.entradaDeAuditoria} data-testid="entrada-de-auditoria" data-tipo={e.tipo}>
      <Avatar nome={e.autor} id={e.autorId} tamanho={28} />
      <div className={css.entradaTextos}>
        <p className={css.texto}>
          <strong className={css.pessoaNome}>{e.autor}</strong> {e.frase}
          {e.alvo !== undefined && <> {t.alvo(e.alvo)}</>}
        </p>
        {e.razao !== undefined && <p className={css.dica}>{t.motivo(e.razao)}</p>}
        {e.mudancas.slice(0, 3).map((m) => (
          <p key={m.campo} className={`${css.dica} ${css.mono}`}>
            {m.campo}: {m.antes} → {m.depois}
          </p>
        ))}
      </div>
      <span className={css.meta}>{e.quandoTexto}</span>
    </div>
  );
}
