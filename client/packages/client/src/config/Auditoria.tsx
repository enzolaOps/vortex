import { Fragment, useEffect, useMemo, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Escolha } from "../components/ui/Escolha";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Selo } from "../components/ui/Selo";
import {
  ACOES,
  idDeInstante,
  listarAuditoria,
  type EntradaDeAuditoria,
} from "../sdk/auditoria";
import { CampoDeBusca } from "../components/ui/CampoDeBusca";
import css from "./Auditoria.module.css";

/**
 * A janela padrão, em dias.
 *
 * ⚠ **90 é o número do design, não um palpite** — o cabeçalho dele diz
 * "Últimos 90 dias · 1.842 entradas". Uma constante nomeada porque ela aparece
 * em dois lugares: na consulta e no que o cabeçalho afirma, e os dois têm de
 * dizer a mesma coisa.
 */
const PERIODO_PADRAO = 90;

/**
 * Registro de auditoria.
 *
 * ⚠ **A única das cinco páginas que faltavam com o protocolo a favor**, e a
 * palavra "auditoria" já aparecia em outras telas do produto prometendo um
 * lugar que não existia.
 *
 * ⚠ **Três estados, e o do meio é o que importa.** `listarAuditoria` devolve
 * `undefined` para FALHA e `[]` para vazio; colapsar os dois faria a página
 * afirmar "nada aconteceu neste servidor" quando a consulta não completou —
 * numa tela de moderação, a afirmação errada mais cara que existe. É a mesma
 * correção que Convites e Banimentos já receberam.
 */
export function Auditoria({ serverId }: { serverId: string }) {
  const [res, setRes] = useState<
    | { readonly para: string; readonly dados: readonly EntradaDeAuditoria[] | "falhou" }
    | undefined
  >(undefined);
  const [autor, setAutor] = useState("");
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  /*
    O período é o único filtro que vai ao SERVIDOR, e a razão é a janela: os
    outros três reordenam o que já está na tela, este decide o que a consulta
    traz. Ele nasce em 90 dias porque é o que o cabeçalho do design anuncia —
    e o chip existe para removê-lo, não para escolhê-lo entre cinco opções que
    ninguém pediu.
  */
  const [dias, setDias] = useState<number | undefined>(PERIODO_PADRAO);

  /*
    O alvo viaja com a resposta e o "carregando" é DERIVADO dele — trocar de
    servidor não deixa a lista anterior na tela fingindo ser desta. Zerar num
    efeito seria `setState` em cascata, que o lint do projeto reprova.
  */
  const lista = res?.para === serverId ? res.dados : "carregando";

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    /*
      ⚠ **A janela vira um ID de entrada, porque a rota não conhece datas.** O
      filtro do servidor é `_id > x`, e ULID começa com o tempo em base32 —
      `idDeInstante` monta o menor id possível daquele momento. Sem isto,
      "últimos 90 dias" seria um recorte feito depois de o servidor já ter
      escolhido quais cem entradas mandar, ou seja, uma promessa que a
      consulta não cumpre.
    */
    void listarAuditoria(serverId, {
      limite: 100,
      depoisDe:
        dias === undefined
          ? undefined
          : idDeInstante(Date.now() - dias * 24 * 60 * 60 * 1000),
    }).then((l) => {
      if (vivo) setRes({ para: serverId, dados: l ?? "falhou" });
    });
    return () => {
      vivo = false;
    };
  }, [serverId, dias]);

  /*
    Os filtros são do CLIENTE e não da rota, e a escolha tem razão: a rota
    aceita `user` e `type`, mas cada troca de filtro seria uma volta ao
    servidor para reordenar o que já está na tela. Com uma página de entradas
    em mãos, filtrar aqui é instantâneo. Paginação é que exige a rota, e ela
    ainda não existe nesta tela.
  */
  const visiveis = useMemo(() => {
    if (typeof lista === "string") return [];
    /*
      ⚠ **A busca cobre AUTOR e ALVO, e é o que o design pede por extenso**
      ("Buscar por usuário ou alvo"). É também o que responde "o que já fizeram
      com esta pessoa" sem uma segunda tela: `alvo` chega resolvido para quem o
      servidor mandou junto, e o ID cru serve a quem só tem o número de um
      relato — a mesma regra da busca de Membros.
    */
    const q = busca.trim().toLowerCase();
    return lista.filter((e) => {
      if (autor !== "" && e.autor !== autor) return false;
      if (tipo !== "" && e.tipo !== tipo) return false;
      if (q === "") return true;
      return (
        e.autor.toLowerCase().includes(q) ||
        e.autorId.toLowerCase().includes(q) ||
        (e.alvo ?? "").toLowerCase().includes(q) ||
        (e.alvoId ?? "").toLowerCase().includes(q)
      );
    });
  }, [lista, autor, tipo, busca]);

  /* As opções saem do que EXISTE na resposta, não da tabela inteira: oferecer
     "apagou um webhook" num servidor que nunca teve um é um filtro que só
     produz lista vazia. */
  const autores = useMemo(
    () =>
      typeof lista === "string"
        ? []
        : [...new Set(lista.map((e) => e.autor))].sort((a, b) => a.localeCompare(b)),
    [lista],
  );
  const tipos = useMemo(
    () => (typeof lista === "string" ? [] : [...new Set(lista.map((e) => e.tipo))].sort()),
    [lista],
  );

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.tela}>
      {lista === "carregando" ? (
        <p className={css.recado}>Carregando…</p>
      ) : lista === "falhou" ? (
        <Banner tom="perigo">
          Não deu para carregar o registro. Isso não quer dizer que nada
          aconteceu — a consulta não completou.
        </Banner>
      ) : (
        <>
          {/*
            O cabeçalho do design: janela e volume, na mesma linha.

            ⚠ **Ele diz o que a CONSULTA trouxe, não "o servidor tem N
            entradas".** A rota devolve uma página com teto de 100, então
            afirmar um total seria inventar um número que ninguém contou — e
            numa tela de moderação isso faria alguém concluir que nada mais
            aconteceu. "Últimos 90 dias" é verdade porque é o filtro que foi
            mandado; a contagem é a do que chegou.
          */}
          <header className={css.topo}>
            <span className={css.janela}>
              {dias === undefined
                ? "Todo o registro"
                : `Últimos ${String(dias)} dias`}
              {" · "}
              {lista.length.toLocaleString("pt-BR")}{" "}
              {lista.length === 1 ? "entrada" : "entradas"}
            </span>
            {dias === undefined ? null : (
              /*
                O chip removível do design. Ele é um BOTÃO de verdade e não um
                rótulo com um ✕ desenhado: o que ele faz — voltar a consultar
                sem janela — é uma ação, e um ✕ que só existe para o ponteiro
                é o defeito que a auditoria de design já apontou na paleta.
              */
              <button
                type="button"
                className={css.chip}
                onClick={() => setDias(undefined)}
              >
                últimos {dias} dias
                <span aria-hidden>✕</span>
                <span className="sr-only">— remover o filtro de período</span>
              </button>
            )}
          </header>

          <div className={css.filtros}>
            {/*
              ⚠ **`CampoDeBusca` e não o `Campo` de formulário**, pela regra já
              registrada neste projeto: busca afunda em `surface-0`, campo de
              formulário mora em `surface-3`. É o mesmo primitivo do filtro de
              permissões e do de cargos.
            */}
            <CampoDeBusca
              className={css.busca}
              aria-label="Buscar por usuário ou alvo"
              placeholder="Buscar por usuário ou alvo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {/*
              ⚠ **`Escolha` e nunca `<select>` nativo**, e o lint do projeto
              reprova o segundo. A razão está registrada: nativo é renderizado
              pelo SISTEMA, e num app escuro no Windows ele abre com cromo
              claro. Eu escrevi `<select>` na primeira versão desta tela.

              O valor vazio é "sem filtro" e o rótulo dele diz isso — uma opção
              "Todos" que valha `""` é mais honesta que um `undefined` que a
              `Escolha` teria de tratar como caso especial.
            */}
            <Escolha
              rotulo="Autor"
              valor={autor}
              opcoes={["", ...autores]}
              rotuloDe={(v) => (v === "" ? "Todos os usuários" : v)}
              aoEscolher={setAutor}
              className={css.filtro}
            />
            <Escolha
              rotulo="Ação"
              valor={tipo}
              opcoes={["", ...tipos]}
              rotuloDe={(v) => (v === "" ? "Todas as ações" : (ACOES[v] ?? v))}
              aoEscolher={setTipo}
              className={css.filtro}
            />
            <span className={css.contagem}>
              {visiveis.length} de {lista.length}
            </span>
          </div>

          {/*
            ⚠ **O vazio deixou de engolir o cabeçalho, e isso era uma
            armadilha de verdade.** "Nada registrado ainda" substituía a tela
            inteira — chip incluído —, então quem abrisse um servidor sem ação
            nos últimos 90 dias veria uma afirmação sobre a HISTÓRIA toda, sem
            nenhum caminho para ampliar a janela que produziu aquele vazio. O
            cabeçalho e os filtros ficam; o que muda é o miolo.
          */}
          {lista.length === 0 ? (
            <EstadoVazio
              titulo={
                dias === undefined
                  ? "Nada registrado ainda"
                  : `Nada nos últimos ${String(dias)} dias`
              }
              detalhe={
                dias === undefined
                  ? "Ações de moderação e mudanças de estrutura aparecem aqui."
                  : "Remova o filtro de período acima para ver o registro inteiro."
              }
            />
          ) : visiveis.length === 0 ? (
            <EstadoVazio
              titulo="Nada com esses filtros"
              detalhe="Afrouxe a busca, o autor ou a ação para ver mais."
            />
          ) : (
            <ul className={css.lista}>
              {visiveis.map((e, i) => (
                <Fragment key={e.id}>
                  {/*
                    ⚠ **A régua de DIA, e ela faltava.** O design põe um
                    divisor com a data quando o dia muda — "10 de agosto" —, e
                    sem ele noventa dias de registro viram uma coluna contínua
                    onde a única pista de tempo é o carimbo à direita de cada
                    linha. Auditoria é lida por PERÍODO ("o que aconteceu na
                    quinta?"), e a régua é o que torna isso uma varredura em
                    vez de uma leitura.

                    Não aparece antes do primeiro grupo: ali ela separaria o
                    conteúdo do cabeçalho, e não um dia do outro.
                  */}
                  {i > 0 && diaDe(e.quandoMs) !== diaDe(visiveis[i - 1]!.quandoMs) ? (
                    <li className={css.dia} aria-hidden>
                      {DIA.format(new Date(e.quandoMs))}
                    </li>
                  ) : null}
                  {/*
                    ⚠ **Só a PRIMEIRA vem expandida, e é instrução da
                    referência.** Um registro com quarenta diffs abertos é uma
                    parede de mono; um com todos fechados esconde o que a tela
                    serve para mostrar. A primeira aberta ensina o gesto sem
                    cobrar a rolagem.
                  */}
                  <Entrada entrada={e} abertaPorPadrao={i === 0} />
                </Fragment>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/**
 * O dia de um instante, como chave de agrupamento.
 *
 * Data local e não UTC: quem lê o registro está num fuso, e um evento das 22h
 * não pertence ao dia seguinte porque o servidor guardou em UTC.
 */
function diaDe(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getFullYear())}-${String(d.getMonth())}-${String(d.getDate())}`;
}

/** "10 de agosto" — o rótulo da régua de dia. */
const DIA = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

function Entrada({
  entrada,
  abertaPorPadrao,
}: {
  entrada: EntradaDeAuditoria;
  abertaPorPadrao: boolean;
}) {
  const temDiff = entrada.mudancas.length > 0;

  return (
    <li className={css.entrada}>
      <div className={css.cabecalho}>
        <span className={css.autor}>{entrada.autor}</span>
        <span className={css.frase}>{entrada.frase}</span>
        {/*
          O alvo, em peso próprio — "Ana Ribeiro · atribuiu Design · a Téo".

          ⚠ **Fora da frase de propósito.** `fraseDaAcao` não embute nome
          nenhum, pela mesma razão que não embute o sujeito: a tela desenha
          autor e alvo em hierarquias diferentes, e um texto pronto não se
          quebra em duas. Sem nome resolvido o alvo some em vez de virar um
          ULID cru pendurado numa preposição.
        */}
        {entrada.alvo === undefined ? null : (
          <span className={css.alvo}>a {entrada.alvo}</span>
        )}
        <Selo tom="neutro">{entrada.tipo}</Selo>
        <span className={css.quando}>{entrada.quandoTexto}</span>
      </div>

      {entrada.razao === undefined ? null : (
        <p className={css.razao}>· motivo: {entrada.razao}</p>
      )}

      {temDiff ? (
        /*
          `<details>` nativo: abrir e fechar um bloco é exatamente o que ele
          faz, com teclado e leitor de tela de graça. Um botão com estado
          reescreveria isso para ganhar nada — a mesma regra que mantém o
          `<audio>` da mensagem de voz sem `controls` mas nativo por dentro.
        */
        <details className={css.diff} open={abertaPorPadrao}>
          <summary className={css.diffResumo}>
            {entrada.mudancas.length} campo
            {entrada.mudancas.length === 1 ? "" : "s"}
          </summary>
          <dl className={css.diffLista}>
            {entrada.mudancas.map((m) => (
              <div key={m.campo} className={css.diffLinha}>
                <dt className={css.diffCampo}>{m.campo}</dt>
                <dd className={css.diffValores}>
                  <span className={css.antes}>− {m.antes}</span>
                  <span className={css.depois}>+ {m.depois}</span>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </li>
  );
}
