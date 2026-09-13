import { useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { CampoDeBusca } from "../components/ui/CampoDeBusca";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Caixa } from "../components/ui/Marcador";
import type { FalhaDeLote } from "../lib/lote";
import {
  aplicarCargoEmLote,
  meuAlcance,
  pessoasDoServidor,
  type Cargo,
  type PessoaParaCargo,
} from "../sdk/cargos";
import { chaveDeMembro } from "../sdk/domain";
import { useMembro, useMembrosDoServidor } from "../store/hooks";
import {
  cargoAoAlcance,
  filtrarPessoas,
  marcavel,
  selecaoValida,
} from "./selecaoDeCargo";
import css from "./MembrosDoCargo.module.css";

type Operacao = {
  readonly dar: boolean;
  readonly terminados: number;
  readonly total: number;
};

type Falhas = {
  readonly dar: boolean;
  readonly lista: readonly FalhaDeLote<string>[];
};

/**
 * "Gerenciar membros" — quem tem o cargo, e dar ou tirar de várias pessoas.
 *
 * O design desenha o cabeçalho com "Adicionar membros", a busca e as linhas
 * com "Remover". O que ele não desenha é o LOTE, e o lote é a razão de a aba
 * existir: dar e tirar de UMA pessoa já funciona pelo menu da member list.
 *
 * ⚠ **Divergência deliberada: caixa de seleção em cada linha**, que o design
 * não tem. Sem ela "várias de uma vez" não é representável — e a alternativa
 * de um modo de seleção escondido atrás de um botão seria um estado que só
 * existe para quem o descobre.
 *
 * ⚠ **"Adicionar membros" abre um painel NA aba, e não um modal.** A lista de
 * candidatos é a mesma forma da de quem tem o cargo (busca + caixas), e
 * vê-las uma sobre a outra deixa a pessoa conferir quem entra sem perder de
 * vista quem já está. Um modal esconderia a segunda.
 */
export function MembrosDoCargo({
  serverId,
  cargo,
  aoMudar,
}: {
  serverId: string;
  cargo: Cargo;
  /** Avisa a coluna de cargos com a leitura nova: a contagem mudou. */
  aoMudar: (pessoas: readonly PessoaParaCargo[]) => void;
}) {
  /*
    ⚠ **Estado, e não leitura a cada render.** `pessoasDoServidor` varre todos
    os membros do servidor — num de dez mil é trabalho que não se repete por
    tecla digitada na busca. Relido quando uma operação termina, que é quando
    a resposta muda por causa DESTA tela.
  */
  const ids = useMembrosDoServidor(serverId);
  const [pessoas, setPessoas] = useState(() => pessoasDoServidor(serverId, ids));
  const [busca, setBusca] = useState("");
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set());
  const [adicionando, setAdicionando] = useState(false);
  const [buscaNova, setBuscaNova] = useState("");
  const [novas, setNovas] = useState<ReadonlySet<string>>(new Set());
  const [operacao, setOperacao] = useState<Operacao | undefined>(undefined);
  const [falhas, setFalhas] = useState<Falhas | undefined>(undefined);

  const alcance = meuAlcance(serverId);
  const aoAlcance = cargoAoAlcance(cargo.rank, alcance);
  const ocupada = operacao !== undefined;

  const com = filtrarPessoas(pessoas, { roleId: cargo.id, comCargo: true, termo: busca });
  const sem = filtrarPessoas(pessoas, { roleId: cargo.id, comCargo: false, termo: buscaNova });
  const totalComCargo = pessoas.filter((p) => p.cargosIds.includes(cargo.id)).length;
  const nomes = new Map(pessoas.map((p) => [p.id, p.nome]));

  const paraRemover = selecaoValida(marcadas, com.visiveis, cargo.rank, alcance);
  const paraAdicionar = selecaoValida(novas, sem.visiveis, cargo.rank, alcance);

  function executar(ids: readonly string[], dar: boolean) {
    if (ids.length === 0 || ocupada) return;
    setFalhas(undefined);
    setOperacao({ dar, terminados: 0, total: ids.length });
    void aplicarCargoEmLote(serverId, cargo.id, ids, dar, (terminados, total) => {
      setOperacao({ dar, terminados, total });
    }).then((r) => {
      setOperacao(undefined);
      const relidas = pessoasDoServidor(serverId, ids);
      setPessoas(relidas);
      /*
        Tira da seleção só quem DEU CERTO. Quem falhou continua marcado, e é
        isso que faz "Tentar de novo" ser um clique: a seleção já é exatamente
        o conjunto que falta.
      */
      const feitos = new Set(r.feitos);
      const tirar = (s: ReadonlySet<string>) => new Set([...s].filter((id) => !feitos.has(id)));
      if (dar) setNovas(tirar);
      else setMarcadas(tirar);
      setFalhas(r.falhas.length > 0 ? { dar, lista: r.falhas } : undefined);
      if (dar && r.falhas.length === 0) setAdicionando(false);
      if (r.feitos.length > 0) aoMudar(relidas);
    });
  }

  function alternarEm(
    set: (f: (s: ReadonlySet<string>) => ReadonlySet<string>) => void,
    id: string,
  ) {
    set((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className={css.aba}>
      <div className={css.topo}>
        <span className={css.titulo}>
          Membros com o cargo <span className={css.contagem}>{totalComCargo}</span>
        </span>
        {/*
          Só aparece para quem pode dar ESTE cargo. Cargo acima do meu mais
          alto não é meu para dar — o aviso abaixo diz por quê, em vez de um
          botão que abriria um painel inteiro de caixas travadas.
        */}
        {aoAlcance && !adicionando ? (
          <Botao
            variante="primario"
            tamanho="pequeno"
            disabled={ocupada}
            onClick={() => {
              setAdicionando(true);
            }}
          >
            Adicionar membros
          </Botao>
        ) : null}
      </div>

      {!aoAlcance ? (
        <Banner tom="info">
          {alcance.podeAtribuir
            ? "Este cargo está no mesmo nível ou acima do seu cargo mais alto. Você vê quem o tem, mas não pode dar nem tirar."
            : "Você não tem permissão para dar cargos neste servidor."}
        </Banner>
      ) : null}

      {operacao !== undefined ? <Progresso operacao={operacao} /> : null}

      {falhas !== undefined ? (
        <Banner
          tom="perigo"
          titulo={
            falhas.lista.length === 1
              ? "1 pessoa não foi alterada."
              : `${String(falhas.lista.length)} pessoas não foram alteradas.`
          }
          acoes={
            <Botao
              variante="neutro"
              tamanho="pequeno"
              disabled={ocupada}
              onClick={() => {
                executar(
                  falhas.lista.map((f) => f.item),
                  falhas.dar,
                );
              }}
            >
              Tentar de novo
            </Botao>
          }
        >
          <ul className={css.falhas}>
            {falhas.lista.map((f) => (
              <li key={f.item}>
                <strong>{nomes.get(f.item) ?? f.item}</strong> — {f.motivo}
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}

      {adicionando ? (
        <section className={css.painel} aria-label="Adicionar membros ao cargo">
          <div className={css.painelTopo}>
            <span className={css.painelTitulo}>Adicionar a {cargo.nome}</span>
            <span className={css.dica}>
              {sem.total === 0 ? "" : `${String(sem.total)} sem o cargo`}
            </span>
          </div>
          <CampoDeBusca
            className={css.campo}
            aria-label="Buscar pessoa para adicionar"
            placeholder="Buscar pessoa para adicionar"
            autoFocus
            value={buscaNova}
            onChange={(e) => {
              setBuscaNova(e.currentTarget.value);
            }}
          />
          <Lista
            serverId={serverId}
            pessoas={sem.visiveis}
            total={sem.total}
            selecionavel
            marcadas={novas}
            desabilitada={ocupada}
            podeMarcar={(p) => marcavel(p, cargo.rank, alcance)}
            aoMarcar={(id) => {
              alternarEm(setNovas, id);
            }}
            vazio={
              buscaNova.trim() === ""
                ? { titulo: "Todo mundo já tem este cargo", detalhe: undefined }
                : { titulo: "Ninguém sem o cargo com esse nome", detalhe: "Afrouxe a busca." }
            }
          />
          <div className={css.painelRodape}>
            <Botao
              variante="sutil"
              disabled={ocupada}
              onClick={() => {
                setAdicionando(false);
                setNovas(new Set());
                setBuscaNova("");
              }}
            >
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              disabled={paraAdicionar.length === 0 || ocupada}
              onClick={() => {
                executar(paraAdicionar, true);
              }}
            >
              {paraAdicionar.length === 0
                ? "Adicionar"
                : paraAdicionar.length === 1
                  ? "Adicionar 1 pessoa"
                  : `Adicionar ${String(paraAdicionar.length)} pessoas`}
            </Botao>
          </div>
        </section>
      ) : null}

      <CampoDeBusca
        className={css.campo}
        aria-label="Buscar membro"
        placeholder="Buscar membro"
        value={busca}
        onChange={(e) => {
          setBusca(e.currentTarget.value);
        }}
      />

      {/*
        A barra de lote só existe com alguém marcado, como a da página de
        Membros — permanente, ela seria uma faixa ocupando altura para uma ação
        de uma vez por semana.
      */}
      {paraRemover.length > 0 ? (
        <div className={css.lote} role="status">
          <span className={css.loteContagem}>
            {paraRemover.length === 1
              ? "1 selecionada"
              : `${String(paraRemover.length)} selecionadas`}
          </span>
          <Botao
            variante="sutil"
            tamanho="pequeno"
            disabled={ocupada}
            onClick={() => {
              setMarcadas(new Set());
            }}
          >
            Limpar
          </Botao>
          <Botao
            variante="perigoSutil"
            tamanho="pequeno"
            disabled={ocupada}
            onClick={() => {
              executar(paraRemover, false);
            }}
          >
            Remover do cargo
          </Botao>
        </div>
      ) : null}

      <Lista
        serverId={serverId}
        pessoas={com.visiveis}
        total={com.total}
        selecionavel={aoAlcance}
        marcadas={marcadas}
        desabilitada={ocupada}
        podeMarcar={(p) => marcavel(p, cargo.rank, alcance)}
        aoMarcar={(id) => {
          alternarEm(setMarcadas, id);
        }}
        aoRemover={
          aoAlcance
            ? (id) => {
                executar([id], false);
              }
            : undefined
        }
        vazio={
          busca.trim() === ""
            ? {
                titulo: "Ninguém tem este cargo",
                detalhe: aoAlcance ? "Adicione membros para começar." : undefined,
              }
            : { titulo: "Ninguém com o cargo e esse nome", detalhe: "Afrouxe a busca." }
        }
      />
    </div>
  );
}

/**
 * "Removendo 3 de 12…", com a barra.
 *
 * `role="progressbar"` com o valor de verdade — o leitor de tela anuncia o
 * avanço, e é a única pista de que o lote não travou para quem não vê a barra.
 */
function Progresso({ operacao }: { operacao: Operacao }) {
  const { dar, terminados, total } = operacao;
  const fracao = total === 0 ? 0 : terminados / total;
  return (
    <div className={css.progresso}>
      <span className={css.progressoTexto}>
        {dar ? "Adicionando" : "Removendo"} {terminados} de {total}…
      </span>
      <span
        className={css.trilho}
        role="progressbar"
        aria-label={dar ? "Adicionando ao cargo" : "Removendo do cargo"}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={terminados}
      >
        <span
          className={css.preenchido}
          style={{ transform: `scaleX(${String(fracao)})` }}
        />
      </span>
    </div>
  );
}

function Lista({
  serverId,
  pessoas,
  total,
  selecionavel,
  marcadas,
  desabilitada,
  podeMarcar,
  aoMarcar,
  aoRemover,
  vazio,
}: {
  serverId: string;
  pessoas: readonly PessoaParaCargo[];
  total: number;
  /**
   * Há caixas? Sem o cargo ao meu alcance, NÃO — a regra de nunca renderizar
   * ação que a pessoa não pode executar. Uma coluna de caixas todas cinzas
   * seria ruído permanente para quem só veio ver quem tem o cargo.
   */
  selecionavel: boolean;
  marcadas: ReadonlySet<string>;
  desabilitada: boolean;
  podeMarcar: (p: PessoaParaCargo) => boolean;
  aoMarcar: (id: string) => void;
  aoRemover?: (id: string) => void;
  vazio: { titulo: string; detalhe: string | undefined };
}) {
  if (pessoas.length === 0) {
    return <EstadoVazio compacto titulo={vazio.titulo} detalhe={vazio.detalhe} />;
  }

  return (
    <>
      <ul className={css.lista}>
        {pessoas.map((p) => (
          <li key={p.id}>
            <Linha
              serverId={serverId}
              pessoa={p}
              selecionavel={selecionavel}
              marcada={marcadas.has(p.id)}
              marcavel={podeMarcar(p) && !desabilitada}
              travada={!p.editavel}
              aoMarcar={() => {
                aoMarcar(p.id);
              }}
              aoRemover={
                aoRemover && podeMarcar(p) && !desabilitada
                  ? () => {
                      aoRemover(p.id);
                    }
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
      {/*
        Sem virtualização, e o teto é o que torna isso honesto: a lista para em
        cem e diz quantas ficaram de fora. Um servidor de dez mil com um cargo
        de cinco mil não monta cinco mil linhas — pede uma busca.
      */}
      {total > pessoas.length ? (
        <p className={css.teto}>
          Mostrando {pessoas.length} de {total}. Busque pelo nome para achar as outras.
        </p>
      ) : null}
    </>
  );
}

/**
 * Uma pessoa. Componente próprio porque ASSINA o membro — avatar e data de
 * entrada vêm do snapshot, e hook dentro do `.map()` do pai não é hook.
 */
function Linha({
  serverId,
  pessoa,
  selecionavel,
  marcada,
  marcavel,
  travada,
  aoMarcar,
  aoRemover,
}: {
  serverId: string;
  pessoa: PessoaParaCargo;
  selecionavel: boolean;
  marcada: boolean;
  marcavel: boolean;
  travada: boolean;
  aoMarcar: () => void;
  aoRemover: (() => void) | undefined;
}) {
  const membro = useMembro(chaveDeMembro(serverId, pessoa.id));
  const nome = membro?.displayName ?? pessoa.nome;

  return (
    <div className={css.linha} data-marcada={marcada}>
      {selecionavel ? (
        <Caixa
          rotulo={`Selecionar ${nome}`}
          marcado={marcada}
          disabled={!marcavel}
          aoAlternar={aoMarcar}
        />
      ) : null}
      <Avatar id={pessoa.id} sigla={membro?.sigla} url={membro?.avatarUrl} />
      <span className={css.textos}>
        <span className={css.nome}>{nome}</span>
        <span className={css.sub}>
          {[
            pessoa.username || undefined,
            membro?.entrouEm ? `entrou em ${membro.entrouEm}` : undefined,
            /* O motivo da caixa travada, escrito na linha — e só quando há
               caixa: sem ela não há o que explicar. */
            selecionavel && travada ? "acima da sua hierarquia" : undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {aoRemover ? (
        <button type="button" className={css.remover} onClick={aoRemover}>
          Remover
        </button>
      ) : null}
    </div>
  );
}
