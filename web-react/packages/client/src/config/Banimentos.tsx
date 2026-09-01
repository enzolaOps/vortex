import { MagnifyingGlass } from "../components/ui/icones";
import { useEffect, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { cn } from "../lib/cn";
import { listarBanidos, perdoar, type Banido } from "../sdk/servidores";
import css from "./Banimentos.module.css";
import tab from "./Tabela.module.css";

/** O ID cortado no meio, como o design escreve: `912…4471`. */
function idCurto(id: string): string {
  return id.length <= 9 ? id : `${id.slice(0, 3)}…${id.slice(-4)}`;
}

/**
 * Quem está banido, e o botão de desfazer.
 *
 * ⚠ **Virou a MESMA tabela de Membros e Convites**, e essa foi a razão de
 * `Tabela.module.css` nascer compartilhado: as três são moldura, cabeçalho
 * afundado e linha dividida, e só as colunas mudam. Era uma lista de linhas
 * soltas, que numa tela de 37 banimentos lê como um bloco de texto.
 *
 * ⚠ **Duas colunas do design ficaram de fora, e não por escolha de layout:**
 * `ServerBan` carrega `_id`, `reason` e o usuário. "Banido por" e "Data" não
 * são campos. Ver o recado no rodapé — e `sdk/servidores.ts`, que registra
 * onde essa informação realmente mora.
 *
 * O motivo aparece quando existe, e é ele que torna a lista revisável meses
 * depois: sem ele, perdoar vira adivinhação.
 */
export function Banimentos({ serverId }: { serverId: string }) {
  /* Três estados, como as duas telas de convite: "não deu para saber" não pode
     virar "ninguém banido". Numa tela de moderação é o pior dos dois erros. */
  const [res, setRes] = useState<
    { readonly para: string; readonly dados: readonly Banido[] | "falhou" }
    | undefined
  >(undefined);
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const lista = res?.para === serverId ? res.dados : "carregando";

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarBanidos(serverId).then((l) => {
      if (vivo) setRes({ para: serverId, dados: l ?? "falhou" });
    });
    return () => {
      vivo = false;
    };
  }, [serverId]);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  /*
    O filtro roda AQUI e não num componente por linha, ao contrário de Membros.
    A diferença é a fonte: lá o nome mora no snapshot do membro e filtrar no pai
    obrigaria a assinar 1.204 pessoas; aqui a lista já está inteira nesta mão,
    veio de uma chamada só e ninguém a atualiza por evento.
  */
  const q = busca.trim().toLowerCase();
  const mostrados =
    typeof lista === "string"
      ? []
      : lista.filter(
          (b) =>
            q === "" ||
            b.nome.toLowerCase().includes(q) ||
            b.userId.toLowerCase().includes(q) ||
            (b.razao ?? "").toLowerCase().includes(q),
        );

  return (
    <div className={css.pagina}>
      <div className={css.controles}>
        <div className={css.campo}>
          <MagnifyingGlass size={16} aria-hidden />
          <input
            type="search"
            className={css.entrada}
            placeholder="Buscar por username, ID ou motivo"
            aria-label="Buscar banimentos"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/*
          ⚠ **O filtro "Todos os moderadores" do design NÃO entrou**, e é a
          mesma ausência das duas colunas: sem saber quem baniu, o filtro não
          teria por onde filtrar. Um `select` com uma opção só é pior que
          nenhum.
        */}
        <span className={css.espaco} />
        <span className={css.contagem}>
          {typeof lista === "string"
            ? ""
            : lista.length === 1
              ? "1 conta banida"
              : `${lista.length.toLocaleString("pt-BR")} contas banidas`}
        </span>
      </div>

      <div className={cn(tab.tabela, css.tabela)} role="table">
        <div className={tab.cabecalho} role="row">
          <span>Conta</span>
          <span>Motivo</span>
          <span />
        </div>

        {lista === "carregando" ? (
          <div className={tab.vazio}>
            <EstadoVazio compacto titulo="Carregando…" />
          </div>
        ) : lista === "falhou" ? (
          <div className={tab.vazio}>
            <EstadoVazio
              compacto
              titulo="Não deu para ler os banimentos"
              detalhe="O servidor não respondeu. Pode haver contas banidas que não estão aqui."
            />
          </div>
        ) : mostrados.length === 0 ? (
          <div className={tab.vazio}>
            <EstadoVazio
              compacto
              titulo={
                lista.length === 0 ? "Ninguém banido" : "Nada com esse termo"
              }
              detalhe={
                lista.length === 0
                  ? "Banimentos aparecem aqui, com o motivo que quem baniu escreveu."
                  : "Tente outro username, ID ou palavra do motivo."
              }
            />
          </div>
        ) : (
          mostrados.map((b) => (
            <div key={b.userId} className={tab.linha} role="row">
              <span className={tab.pessoa}>
                <Avatar id={b.userId} sigla={b.nome.slice(0, 2)} tamanho="xs" />
                <span className={tab.nomes}>
                  <span className={tab.nome}>{b.nome}</span>
                  <span className={tab.handle}>{idCurto(b.userId)}</span>
                </span>
              </span>

              {b.razao === undefined ? (
                <span className={css.semMotivo}>Sem motivo registrado</span>
              ) : (
                <span className={tab.meta}>{b.razao}</span>
              )}

              <span className={tab.acao}>
                <button
                  type="button"
                  className={css.desbanir}
                  disabled={ocupado}
                  /* O nome no rótulo: numa tabela de 37, "Desbanir" repetido
                     37 vezes deixa quem navega por lista de controles sem
                     saber qual conta está desbanindo. */
                  aria-label={`Desbanir ${b.nome}`}
                  onClick={() => {
                    setOcupado(true);
                    void perdoar(serverId, b.userId)
                      .then((ok) => {
                        if (!ok) return;
                        setRes((r) =>
                          r === undefined || typeof r.dados === "string"
                            ? r
                            : {
                                ...r,
                                dados: r.dados.filter(
                                  (x) => x.userId !== b.userId,
                                ),
                              },
                        );
                      })
                      .finally(() => setOcupado(false));
                  }}
                >
                  Desbanir
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <p className={css.recado}>
        Desbanir não devolve a pessoa ao servidor — só remove o bloqueio. O
        design mostra ainda <strong>quem baniu</strong> e <strong>quando</strong>
        ; nenhum dos dois está no objeto de banimento do Stoat, que guarda só a
        conta e o motivo. Os dois existem no registro de auditoria, que ainda
        não tem tela.
      </p>
    </div>
  );
}
