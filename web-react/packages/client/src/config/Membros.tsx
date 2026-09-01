import { DotsThree, MagnifyingGlass } from "../components/ui/icones";
import { memo, useEffect, useMemo, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { cn } from "../lib/cn";
import { Caixa } from "../components/ui/Marcador";
import { Escolha } from "../components/ui/Escolha";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { PilulasDeCargo } from "../membros/PilulasDeCargo";
import { cargosDoServidor } from "../sdk/cargos";
import { chaveDeMembro } from "../sdk/domain";
import { members } from "../sdk/adapter";
import { carregarMembros } from "../sdk/servidores";
import { administrar } from "../store/administracao";
import { useMembro, useMembrosDoServidor } from "../store/hooks";
import { CabecalhoDeSecao } from "./Pagina";
import css from "./Membros.module.css";
import tab from "./Tabela.module.css";

/** As três ordens do design. */
const ORDENS = [
  "Entrada · mais recente",
  "Entrada · mais antiga",
  "Nome A–Z",
] as const;
type Ordem = (typeof ORDENS)[number];

const SEM_CARGO = "Sem cargo";
const TODOS = "Todos os cargos";

/**
 * Uma linha. Assina o próprio membro — lei nº 1.
 *
 * ⚠ `memo` e subscrição por linha pela razão de sempre: numa tabela de 1.204
 * pessoas, alguém trocar de apelido não pode re-renderizar as outras 1.203.
 */
const Linha = memo(function Linha({
  serverId,
  userId,
  marcado,
  aoMarcar,
}: {
  serverId: string;
  userId: string;
  marcado: boolean;
  aoMarcar: () => void;
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));

  // Nunca `null`: encolher e crescer faria a tabela pular durante a hidratação.
  if (!membro) return <div className={tab.linha} aria-hidden />;

  return (
    <div className={tab.linha} role="row">
      <Caixa
        marcado={marcado}
        rotulo={`Selecionar ${membro.displayName}`}
        aoAlternar={aoMarcar}
      />

      <span className={tab.pessoa}>
        <Avatar
          id={userId}
          sigla={membro.sigla}
          url={membro.avatarUrl}
          tamanho="xs"
        />
        <span className={tab.nomes}>
          <span className={tab.nome}>{membro.displayName}</span>
          <span className={tab.handle}>{membro.username}</span>
        </span>
      </span>

      {/*
        As pílulas em modo DENSO — 11px e sem o ponto. O design usa a mesma
        peça em duas densidades: com ponto no cartão de perfil, sem ponto na
        tabela, onde há uma por linha e o ponto viraria ruído repetido.
      */}
      <span className={css.cargos}>
        <PilulasDeCargo
          serverId={serverId}
          cargosIds={membro.cargosIds}
          denso
        />
      </span>

      {/*
        ⚠ **"Entrou em" e "última atividade" NÃO existem no protocolo.** O
        `ServerMember` carrega `joined_at`; atividade nenhuma. Em vez de duas
        colunas — uma verdadeira e outra inventada — fica a que existe, e a
        outra some. Ver o recado no rodapé da página.
      */}
      <span className={tab.meta}>{membro.entrouEm ?? "—"}</span>

      <span className={tab.acao}>
        <button
          type="button"
          className={css.maisAcoes}
          aria-label={`Ações para ${membro.displayName}`}
          onClick={() =>
            administrar({
              tipo: "moderar",
              serverId,
              userId,
              acao: "castigo",
            })
          }
        >
          <DotsThree size={20} aria-hidden />
        </button>
      </span>
    </div>
  );
});

/**
 * A página de Membros.
 *
 * ⚠ **Era a maior ausência das onze páginas de servidor, e a única
 * construível sem fork.** `Server.fetchMembers()` existe, e a atribuição de
 * cargo em lote é o `edit({ roles })` que a fase 6 ligou.
 *
 * ⚠ **Não é a member list da coluna lateral, e a diferença é o propósito.**
 * Aquela responde "quem está aqui agora" — ordenada por presença, agrupada por
 * cargo hasteado, virtualizada porque rola o tempo todo. Esta responde "quem
 * são as 1.204 pessoas" — filtrável, ordenável, com seleção múltipla e ações
 * de moderação. Unificá-las daria uma coluna com barra de busca e caixas de
 * seleção ao lado da conversa.
 */
export function Membros({ serverId }: { serverId: string }) {
  const ids = useMembrosDoServidor(serverId);
  const [busca, setBusca] = useState("");
  const [cargo, setCargo] = useState(TODOS);
  const [ordem, setOrdem] = useState<Ordem>(ORDENS[0]);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());

  /*
    ⚠ **Carrega a lista COMPLETA ao abrir, e é o que separa esta tela da
    coluna.** O cliente só conhece quem falou ou quem está online; a página
    promete "1.204 membros", e cumprir isso é uma chamada de rede. A member
    list nunca a faz porque não promete.
  */
  useEffect(() => {
    if (serverId) void carregarMembros(serverId);
  }, [serverId]);

  const cargos = useMemo(() => cargosDoServidor(serverId), [serverId]);

  /*
    ⚠ **`peek` e não `useMembro`, e é a única forma de ordenar sem quebrar a
    lei nº 1.** Ordenar exige ler as 1.204 pessoas; assiná-las aqui faria uma
    troca de apelido re-renderizar a tabela inteira, que é justamente o que a
    subscrição por linha existe para impedir.

    A consequência é dita: um apelido que muda só reordena no próximo render
    do pai — trocar de filtro, de ordem ou de busca. Numa tabela de
    configuração isso é o comportamento certo, e não uma limitação: reordenar
    debaixo do ponteiro enquanto alguém mira uma linha é pior.

    ⚠ **Ordena pelo INSTANTE de entrada, e a primeira versão não ordenava.**
    Ela invertia o array, com a justificativa de que o protocolo entrega por
    ULID — verdade para `fetchMembers`, e falsa AQUI: a lista desta página vem
    dos baldes de presença concatenados, então "entrada mais recente"
    entregava a ordem de quem está online. Passou por typecheck, lint e olho;
    só apareceu com datas de verdade na coluna, fora de ordem.

    Ausência vai para o FIM nas duas direções: quem não tem data não é "o mais
    antigo" — é desconhecido, e um desconhecido no topo de "mais recente"
    afirma algo que ninguém sabe.
  */
  const ordenados = useMemo(() => {
    const snap = (id: string) => members.peek(chaveDeMembro(serverId, id));

    if (ordem === "Nome A–Z") {
      return [...ids].sort((a, b) =>
        (snap(a)?.displayName ?? "").localeCompare(
          snap(b)?.displayName ?? "",
          "pt-BR",
        ),
      );
    }

    const sentido = ordem === "Entrada · mais recente" ? -1 : 1;
    return [...ids].sort((a, b) => {
      const ta = snap(a)?.entrouEmMs;
      const tb = snap(b)?.entrouEmMs;
      if (ta === undefined) return tb === undefined ? 0 : 1;
      if (tb === undefined) return -1;
      return (ta - tb) * sentido;
    });
  }, [ids, ordem, serverId]);

  /* ANTES do retorno antecipado: hook depois de saída muda a ordem entre
     renders, e o lint das Rules of React reprova com razão. */
  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  /*
    ⚠ **A seleção é limpa no HANDLER e não num efeito.** O design diz que ela
    "sobrevive à paginação", e ele está certo sobre paginação: rolar mais não
    muda quem você escolheu. Trocar o FILTRO é outra coisa — banir "os 12
    selecionados" quando metade sumiu da tela é a ação destrutiva mais fácil
    de errar que esta página tem.

    No handler porque `setState` síncrono dentro de um efeito dispara render em
    cascata, e o lint do projeto reprova com razão: a limpeza é consequência
    do CLIQUE, não de o filtro ter mudado por outro caminho.
  */
  function limparSelecao() {
    setMarcados((atual) => (atual.size === 0 ? atual : new Set()));
  }

  function alternar(id: string) {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      if (!proximo.delete(id)) proximo.add(id);
      return proximo;
    });
  }

  const cargoId =
    cargo === TODOS || cargo === SEM_CARGO
      ? undefined
      : cargos.find((c) => c.nome === cargo)?.id;

  return (
    <div className={css.pagina}>
      <div className={css.controles}>
        <div className={css.campo}>
          <MagnifyingGlass size={16} aria-hidden />
          <input
            type="search"
            className={css.entrada}
            placeholder="Buscar por nome, username ou ID"
            aria-label="Buscar membros"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              limparSelecao();
            }}
          />
        </div>

        <Escolha
          rotulo="Filtrar por cargo"
          rotuloOculto
          valor={cargo}
          opcoes={[TODOS, ...cargos.map((c) => c.nome), SEM_CARGO]}
          aoEscolher={(v) => {
            setCargo(v);
            limparSelecao();
          }}
        />

        <Escolha
          rotulo="Ordenar"
          rotuloOculto
          valor={ordem}
          opcoes={ORDENS}
          aoEscolher={(v) => setOrdem(v as Ordem)}
        />

        <span className={css.espaco} />
        <span className={css.contagem}>
          {ids.length === 1
            ? "1 carregado"
            : `${ids.length.toLocaleString("pt-BR")} carregados`}
        </span>
      </div>

      <div className={cn(tab.tabela, css.tabela)} role="table">
        <div className={tab.cabecalho} role="row">
          <span />
          <span>Membro</span>
          <span>Cargos</span>
          <span>Entrou em</span>
          <span />
        </div>

        {ordenados.length === 0 ? (
          <div className={tab.vazio}>
            <EstadoVazio
              compacto
              titulo="Nenhum membro para mostrar"
              detalhe="A lista aparece quando o servidor carregar."
            />
          </div>
        ) : (
          ordenados.map((id: string) => (
            <Filtrada
              key={id}
              serverId={serverId}
              userId={id}
              busca={busca}
              cargoId={cargoId}
              semCargo={cargo === SEM_CARGO}
            >
              <Linha
                serverId={serverId}
                userId={id}
                marcado={marcados.has(id)}
                aoMarcar={() => alternar(id)}
              />
            </Filtrada>
          ))
        )}
      </div>

      {/*
        ⚠ **A barra de lote só existe com alguém selecionado**, e ela FLUTUA
        sobre o fim da página em vez de ocupar espaço: uma faixa permanente
        embaixo de uma tabela de mil linhas rouba altura o tempo todo para uma
        ação que acontece uma vez por mês.
      */}
      {marcados.size > 0 ? (
        <div className={css.lote} role="status">
          <span className={css.loteContagem}>
            {marcados.size === 1
              ? "1 selecionado"
              : `${String(marcados.size)} selecionados`}
          </span>
          <span className={css.divisa} aria-hidden />
          <BotaoDeLote rotulo="Castigar" tom="aviso" ids={marcados} serverId={serverId} acao="castigo" />
          <BotaoDeLote rotulo="Expulsar" tom="perigo" ids={marcados} serverId={serverId} acao="expulsar" />
          <BotaoDeLote rotulo="Banir" tom="perigo" ids={marcados} serverId={serverId} acao="banir" />
        </div>
      ) : null}

      <CabecalhoDeSecao titulo="O que o protocolo não conta" />
      <p className={css.recado}>
        O design mostra também <strong>última atividade</strong> por membro, e
        o Stoat não a registra — não há campo, rota nem evento. A contagem de
        online que ele exibe no topo também não: o cliente sabe a presença de
        quem já viu, não a do servidor inteiro. Ficou de fora em vez de virar
        número inventado.
      </p>
    </div>
  );
}

/**
 * Esconde a linha que não casa com busca e filtro.
 *
 * ⚠ Componente e não `filter` na lista de cima — lei nº 1: o nome e os cargos
 * moram no snapshot do MEMBRO, e filtrar no pai o obrigaria a assinar as 1.204
 * pessoas para ler os nomes. É a mesma forma do filtro do `NovoGrupo`.
 */
function Filtrada({
  serverId,
  userId,
  busca,
  cargoId,
  semCargo,
  children,
}: {
  serverId: string;
  userId: string;
  busca: string;
  cargoId: string | undefined;
  semCargo: boolean;
  children: React.ReactNode;
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  if (!membro) return null;

  const q = busca.trim().toLowerCase();
  if (q.length > 0) {
    const casa =
      membro.displayName.toLowerCase().includes(q) ||
      membro.username.toLowerCase().includes(q) ||
      /* Buscar por ID é do design, e é o que salva quem só tem o número de um
         relato de abuso — o nome já pode ter sido trocado. */
      userId.toLowerCase().includes(q);
    if (!casa) return null;
  }

  if (semCargo && membro.cargosIds.length > 0) return null;
  if (cargoId !== undefined && !membro.cargosIds.includes(cargoId)) return null;

  return <>{children}</>;
}

/**
 * Uma ação em lote.
 *
 * ⚠ **Abre o modal de moderação UMA vez, com o primeiro alvo** — e não dispara
 * a ação nos N selecionados. O modal existe justamente para dizer a
 * consequência antes de ela acontecer, e um lote que pula a confirmação é
 * banir doze pessoas com um clique. A execução em lote entra quando o modal
 * souber receber uma lista; até lá, o botão faz o que promete para um.
 */
function BotaoDeLote({
  rotulo,
  tom,
  ids,
  serverId,
  acao,
}: {
  rotulo: string;
  tom: "aviso" | "perigo";
  ids: ReadonlySet<string>;
  serverId: string;
  acao: "castigo" | "expulsar" | "banir";
}) {
  const primeiro = [...ids][0];
  return (
    <button
      type="button"
      className={tom === "perigo" ? css.loteAcaoPerigo : css.loteAcaoAviso}
      disabled={primeiro === undefined}
      onClick={() => {
        if (primeiro === undefined) return;
        administrar({ tipo: "moderar", serverId, userId: primeiro, acao });
      }}
    >
      {rotulo}
    </button>
  );
}
