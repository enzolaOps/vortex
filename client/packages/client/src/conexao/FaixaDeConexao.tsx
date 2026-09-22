import { useEffect, useSyncExternalStore } from "react";

import { Girador } from "../components/ui/Girador";
import { pausarReconexao, reconectarAgora } from "../sdk/client";
import {
  assinarConexao,
  lerDetalheDaConexao,
  pausarConexao,
} from "../store/conexao";
import css from "./FaixaDeConexao.module.css";

/**
 * A faixa que diz em que pé está a conexão.
 *
 * Montada na raiz e FLUTUANDO, nunca no fluxo. Uma faixa que empurra o layout
 * muda a altura do container da lista virtualizada — e mudar a altura do
 * container é a âncora se movendo por causa de um aviso, que é o inverso do
 * que um aviso deve fazer. Vale a mesma regra da barra de ações da linha, e
 * pelo mesmo motivo técnico.
 *
 * ⚠ **Divergência 1:1 registrada:** o design manda a faixa empurrar o conteúdo
 * em 34px e nunca sobrepor o cabeçalho do canal. Aqui ela flutua acima do
 * cabeçalho pela razão do parágrafo anterior. Tudo o mais — os tons, o ponto
 * que pulsa, o meta em mono e o botão de borda — é o do design.
 *
 * ⚠ **O tom "instável" do design NÃO existe aqui, e é falta de DADO.** Ele
 * mostra "perda 8% · 240 ms", e o websocket não reporta nem perda nem
 * latência: `EventClient` conhece aberto, fechado e tentando. Derivar os dois
 * de um estado seria a mesma invenção que a faixa de voz recusou quando quis
 * milissegundos a partir de uma classificação — e um tom de aviso que nunca
 * acende é pior que a ausência, porque aparece no código como se existisse.
 */
export function FaixaDeConexao() {
  const detalhe = useSyncExternalStore(assinarConexao, lerDetalheDaConexao);
  const { estado, tentativa, ultimaSincroniaTexto, pausada } = detalhe;

  /*
    ⚠ **`data-offline` no `<html>`, e é o que DEGRADA o app inteiro.**

    Sem conexão o cliente não sabe quem está online — sabe o que sabia quando
    caiu — e boa parte da interface depende do servidor: busca, painéis, criar
    servidor, presença. O rail dessatura, as ações do cabeçalho somem, a
    timeline avisa que é cache e o composer diz que o que for escrito entra na
    fila. Tudo por CSS a partir daqui.

    Mora aqui porque este já é o único assinante da conexão na raiz. Um
    atributo no documento é UMA subscrição para o app inteiro; a alternativa —
    cada superfície assinando — faria um engasgo de rede acordar o rail, as
    duas colunas, o cabeçalho e as dezenas de pontos de presença montados.

    ⚠ **O atributo carrega o ESTADO como valor, e não é enfeite.** Presença
    está velha nos dois estados (`html[data-offline]` casa com os dois, que é o
    que a regra do ponto sempre quis), mas dessaturar o rail e esconder as
    ações do cabeçalho durante um engasgo de três segundos seria a interface
    piscando inteira por causa de um túnel — isso é só de
    `html[data-offline="sem-conexao"]`.
  */
  useEffect(() => {
    const raiz = document.documentElement;
    if (estado === "conectado") delete raiz.dataset.offline;
    else raiz.dataset.offline = estado;
    return () => {
      delete raiz.dataset.offline;
    };
  }, [estado]);

  if (estado === "conectado") return null;

  const reconectando = estado === "reconectando" && !pausada;

  /*
    O meta do design: "tentativa 3" e "última sincronia 14:31".

    ⚠ **"de 10" não entra**, e o motivo é o mesmo do tom "instável": o SDK não
    tem teto de tentativas — o backoff é infinito. Escrever "de 10" prometeria
    que na décima algo acontece, e não acontece.

    ⚠ Ausente quando não há o que dizer, em vez de "última sincronia —": uma
    sessão que nunca conectou não tem instante, e um travessão ali é ruído
    ocupando a linha inteira.

    ⚠ **O horário vem PRONTO do store**, e não é preferência: `quando` precisa
    do agora, e ler o relógio aqui é chamada impura — o lint do compiler
    reprova, porque dois renders idênticos produziriam textos diferentes.
  */
  const meta = reconectando
    ? tentativa > 0
      ? `tentativa ${String(tentativa)}`
      : undefined
    : ultimaSincroniaTexto !== undefined
      ? `última sincronia ${ultimaSincroniaTexto}`
      : undefined;

  return (
    /*
      `role="status"` e não `alert`: `alert` interrompe o leitor de tela no
      meio da frase, e queda de conexão não é uma emergência que justifique
      cortar o que a pessoa está lendo. `status` anuncia na primeira pausa.
    */
    <div
      className={css.faixa}
      role="status"
      data-estado={reconectando ? "reconectando" : "sem-conexao"}
    >
      {/*
        O ponto de 7px do design, e ele é o que carrega o tom.

        No estado que ESPERA ele ganha o anel indeterminado ao lado: "está
        acontecendo" é a informação que separa "aguarde" de "parou". No estado
        que parou, o ponto pulsa em 1,4s — a duração escrita no design.
      */}
      <span className={css.ponto} aria-hidden />
      {reconectando ? <Girador tamanho={12} rotulo="" /> : null}

      <span className={css.titulo}>
        {reconectando ? "Reconectando" : "Sem conexão"}
      </span>
      <span className={css.descricao}>
        {reconectando
          ? "Tentando restabelecer a sessão."
          : "Você está vendo conteúdo em cache."}
      </span>
      {meta !== undefined ? <span className={css.meta}>{meta}</span> : null}

      {/*
        ⚠ **Os dois botões fazem trabalho de VERDADE, e o comentário anterior
        deste arquivo dizia que não havia o que fazer.**

        Ele dizia: "o SDK religa sozinho, e um botão que apenas repete o que já
        está acontecendo ensina que os botões deste app não fazem nada". A
        primeira metade continua certa e a segunda envelheceu — o backoff do
        SDK cresce a cada falha, então depois de alguns minutos "tentar agora"
        é a diferença entre voltar agora e voltar daqui a um tempo. E o
        backoff é INFINITO, o que torna "cancelar" a única forma de o app
        parar de abrir socket num avião.
      */}
      {reconectando ? (
        <button
          type="button"
          className={css.acao}
          onClick={() => {
            pausarReconexao();
            pausarConexao();
          }}
        >
          Cancelar
        </button>
      ) : (
        <button type="button" className={css.acao} onClick={reconectarAgora}>
          Tentar agora
        </button>
      )}
    </div>
  );
}
