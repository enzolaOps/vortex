import {
  ICONE,
  MagnifyingGlass,
} from "../components/ui/icones";
import { useEffect, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Escolha } from "../components/ui/Escolha";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { cn } from "../lib/cn";
import { listarBanidos, perdoar, type Banido } from "../sdk/servidores";
import {
  autoriaDosBanimentos,
  type InformacaoDeBanimento,
} from "../sdk/auditoria";
import css from "./Banimentos.module.css";
import tab from "./Tabela.module.css";

/** O ID cortado no meio, como o design escreve: `912…4471`. */
function idCurto(id: string): string {
  return id.length <= 9 ? id : `${id.slice(0, 3)}…${id.slice(-4)}`;
}

/**
 * Uma célula que vem da auditoria, com os três estados dela.
 *
 * ⚠ **Componente e não um ternário repetido duas vezes.** As duas colunas
 * têm a mesma lógica de ausência, e a segunda cópia é onde a divergência
 * começa — é a mesma conta que extraiu `CartaoDeOpcao` e o `Avatar`.
 */
function ColunaDaAuditoria({
  info,
  carregando,
  campo,
}: {
  info: InformacaoDeBanimento | undefined;
  carregando: boolean;
  campo: "porNome" | "quandoTexto";
}) {
  if (info) return <span className={tab.meta}>{info[campo]}</span>;
  return (
    <span className={css.semMotivo}>
      {carregando ? "—" : "sem registro"}
    </span>
  );
}

/**
 * Quem está banido, e o botão de desfazer.
 *
 * ⚠ **Virou a MESMA tabela de Membros e Convites**, e essa foi a razão de
 * `Tabela.module.css` nascer compartilhado: as três são moldura, cabeçalho
 * afundado e linha dividida, e só as colunas mudam. Era uma lista de linhas
 * soltas, que numa tela de 37 banimentos lê como um bloco de texto.
 *
 * ⚠ **"Banido por" e "Data" voltaram, e vêm de OUTRA fonte.** `ServerBan`
 * carrega `_id`, `reason` e a conta — nada mais —, e o comentário aqui dizia
 * que por isso as duas colunas ficavam de fora. A informação existe: está na
 * auditoria, na entrada `BanCreate`, que é exatamente onde o rodapé desta
 * página já apontava. `autoriaDosBanimentos` faz a ponte.
 *
 * ⚠ **A segunda consulta não bloqueia a primeira.** A tabela aparece com a
 * lista de banidos assim que ela chega; as duas colunas preenchem quando a
 * auditoria responde. Esperar as duas para desenhar faria a página inteira
 * depender da permissão `ViewAuditLogs`, que nem todo moderador tem — e quem
 * não a tem continua vendo conta, motivo e o botão de desbanir.
 *
 * ⚠ **Ausência de registro é DITA, e não deixada em branco.** A auditoria
 * guarda as últimas entradas, não a história inteira: banimento antigo pode
 * estar fora da janela, e uma célula vazia ali seria indistinguível de "ninguém
 * assinou". É a mesma disciplina de "Sem motivo registrado" ao lado.
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
  const [moderador, setModerador] = useState("");
  const [ocupado, setOcupado] = useState(false);
  /* A autoria viaja com o alvo pela mesma razão da lista: trocar de servidor
     não pode deixar os nomes do anterior ao lado das contas deste. */
  const [autoria, setAutoria] = useState<
    | {
        readonly para: string;
        readonly mapa: ReadonlyMap<string, InformacaoDeBanimento> | undefined;
      }
    | undefined
  >(undefined);

  const lista = res?.para === serverId ? res.dados : "carregando";
  const quemBaniu = autoria?.para === serverId ? autoria.mapa : undefined;

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarBanidos(serverId).then((l) => {
      if (vivo) setRes({ para: serverId, dados: l ?? "falhou" });
    });
    /*
      ⚠ **Segundo efeito e não `Promise.all`.** A auditoria exige
      `ViewAuditLogs`, que é permissão separada de `BanMembers`; encadeá-las
      faria quem só pode desbanir ver a página inteira falhar por causa de
      duas colunas. Aqui a tabela chega com a primeira resposta e as colunas
      preenchem com a segunda — ou dizem que não souberam.
    */
    void autoriaDosBanimentos(serverId).then((m) => {
      if (vivo) setAutoria({ para: serverId, mapa: m });
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
      : lista.filter((b) => {
          if (moderador !== "" && quemBaniu?.get(b.userId)?.porNome !== moderador) {
            return false;
          }
          return (
            q === "" ||
            b.nome.toLowerCase().includes(q) ||
            b.userId.toLowerCase().includes(q) ||
            (b.razao ?? "").toLowerCase().includes(q)
          );
        });

  /* As opções saem de quem APARECE, não de uma lista de moderadores do
     servidor: oferecer alguém que nunca baniu produziria só lista vazia. É a
     mesma regra do filtro de autor da tela de auditoria. */
  const moderadores = [
    ...new Set([...(quemBaniu?.values() ?? [])].map((i) => i.porNome)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <div className={css.pagina}>
      <div className={css.controles}>
        <div className={css.campo}>
          <MagnifyingGlass size={ICONE.controle} aria-hidden />
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
          ⚠ **O filtro do design entrou junto das colunas**, e o comentário
          aqui dizia por que ele não podia existir: "sem saber quem baniu, o
          filtro não teria por onde filtrar". Agora tem — e ele só aparece
          quando a auditoria devolveu mais de um moderador, porque um `select`
          com uma opção só continua sendo pior que nenhum.
        */}
        {moderadores.length > 1 ? (
          <Escolha
            rotulo="Moderador"
            valor={moderador}
            opcoes={["", ...moderadores]}
            rotuloDe={(v) => (v === "" ? "Todos os moderadores" : v)}
            aoEscolher={setModerador}
          />
        ) : null}

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
          <span>Banido por</span>
          <span>Data</span>
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

              {/*
                As duas colunas da auditoria, em três estados: esperando, sem
                registro, e o dado. "—" sozinho não distingue os dois primeiros,
                e numa tela de moderação a diferença entre "ainda não sei" e
                "ninguém assinou" é a diferença entre esperar e agir.
              */}
              <ColunaDaAuditoria
                info={quemBaniu?.get(b.userId)}
                carregando={autoria?.para !== serverId}
                campo="porNome"
              />
              <ColunaDaAuditoria
                info={quemBaniu?.get(b.userId)}
                carregando={autoria?.para !== serverId}
                campo="quandoTexto"
              />

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
        Desbanir não devolve a pessoa ao servidor — só remove o bloqueio.{" "}
        <strong>Quem baniu</strong> e <strong>quando</strong> não estão no objeto
        de banimento do Stoat, que guarda só a conta e o motivo: as duas colunas
        vêm do <strong>Registro de auditoria</strong>, da entrada{" "}
        <code>BanCreate</code>. Banimento anterior à janela que o registro
        guarda, ou feito sem que você tenha permissão de ler a auditoria,
        aparece como <em>sem registro</em>.
      </p>
    </div>
  );
}
