import { useEffect, useMemo, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Escolha } from "../components/ui/Escolha";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Selo } from "../components/ui/Selo";
import {
  ACOES,
  listarAuditoria,
  type EntradaDeAuditoria,
} from "../sdk/auditoria";
import css from "./Auditoria.module.css";

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

  /*
    O alvo viaja com a resposta e o "carregando" é DERIVADO dele — trocar de
    servidor não deixa a lista anterior na tela fingindo ser desta. Zerar num
    efeito seria `setState` em cascata, que o lint do projeto reprova.
  */
  const lista = res?.para === serverId ? res.dados : "carregando";

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarAuditoria(serverId).then((l) => {
      if (vivo) setRes({ para: serverId, dados: l ?? "falhou" });
    });
    return () => {
      vivo = false;
    };
  }, [serverId]);

  /*
    Os filtros são do CLIENTE e não da rota, e a escolha tem razão: a rota
    aceita `user` e `type`, mas cada troca de filtro seria uma volta ao
    servidor para reordenar o que já está na tela. Com uma página de entradas
    em mãos, filtrar aqui é instantâneo. Paginação é que exige a rota, e ela
    ainda não existe nesta tela.
  */
  const visiveis = useMemo(() => {
    if (typeof lista === "string") return [];
    return lista.filter(
      (e) =>
        (autor === "" || e.autor === autor) && (tipo === "" || e.tipo === tipo),
    );
  }, [lista, autor, tipo]);

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
      ) : lista.length === 0 ? (
        <EstadoVazio
          titulo="Nada registrado ainda"
          detalhe="Ações de moderação e mudanças de estrutura aparecem aqui."
        />
      ) : (
        <>
          {/*
            ⚠ **`Escolha` e nunca `<select>` nativo**, e o lint do projeto
            reprova o segundo. A razão está registrada: nativo é renderizado
            pelo SISTEMA, e num app escuro no Windows ele abre com cromo claro.
            Eu escrevi `<select>` na primeira versão desta tela.

            O valor vazio é "sem filtro" e o rótulo dele diz isso — uma opção
            "Todos" que valha `""` é mais honesta que um `undefined` que a
            `Escolha` teria de tratar como caso especial.
          */}
          <div className={css.filtros}>
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

          {visiveis.length === 0 ? (
            <EstadoVazio
              titulo="Nada com esses filtros"
              detalhe="Afrouxe o autor ou a ação para ver mais."
            />
          ) : (
            <ul className={css.lista}>
              {visiveis.map((e, i) => (
                /*
                  ⚠ **Só a PRIMEIRA vem expandida, e é instrução da
                  referência.** Um registro com quarenta diffs abertos é uma
                  parede de mono; um com todos fechados esconde o que a tela
                  serve para mostrar. A primeira aberta ensina o gesto sem
                  cobrar a rolagem.
                */
                <Entrada key={e.id} entrada={e} abertaPorPadrao={i === 0} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

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
