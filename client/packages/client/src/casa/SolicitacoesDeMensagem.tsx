import { memo, useEffect, useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Selo } from "../components/ui/Selo";
import {
  bloquear,
  buscarEmComum,
  buscarPreviaDaConversa,
  denunciarPessoa,
} from "../sdk/social";
import { abrirConfig } from "../store/config";
import { useChannel, usePessoa, useSolicitacoesDeMensagem } from "../store/hooks";
import { abrirConversa } from "../store/navegacao";
import { assinarPrivacidade, lerPrivacidade } from "../store/privacidade";
import {
  aceitarSolicitacao,
  recusarSolicitacao,
  sinalDeSuspeita,
} from "../store/solicitacoes";
import css from "./SolicitacoesDeMensagem.module.css";

/**
 * Solicitações de mensagem — a DM de quem não é seu amigo, antes de ler.
 *
 * 1:1 com `components/directs/MessageRequestsPanel.tsx` da referência e com a
 * seção "Solicitações de desconhecidos" de `Vortex DMs e Navegação.dc.html`.
 *
 * ⚠ **O protocolo não tem o conceito** — ver `store/solicitacoes.ts`. O que é
 * REAL aqui é o que cada botão faz: aceitar move a conversa para a coluna,
 * ignorar a tira da fila até a pessoa escrever de novo, bloquear e denunciar
 * são escritas no servidor.
 */
export function SolicitacoesDeMensagem() {
  const ids = useSolicitacoesDeMensagem();
  const privacidade = useSyncExternalStore(assinarPrivacidade, lerPrivacidade);

  /*
    Filtro desligado não é "zero solicitações": é "não há fila". Dizer "nenhuma
    solicitação" com o filtro desligado afirmaria que ninguém escreveu, quando
    o que aconteceu é que as mensagens entraram direto nas conversas.
  */
  if (!privacidade.filtrarDesconhecidos) {
    return (
      <EstadoVazio
        titulo="O filtro de desconhecidos está desligado"
        detalhe="Mensagens de quem não é seu amigo entram direto nas conversas."
        acao={{
          rotulo: "Abrir privacidade",
          aoClicar: () => abrirConfig("privacidade"),
        }}
      />
    );
  }

  if (ids.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma solicitação"
        detalhe="Quem não é seu amigo e te escrever aparece aqui antes das conversas."
      />
    );
  }

  return (
    <section className={css.painel} aria-labelledby="titulo-solicitacoes">
      <header className={css.cabecalho}>
        <div>
          <h2 id="titulo-solicitacoes" className={css.titulo}>
            Solicitações de mensagem
          </h2>
          <p className={css.subtitulo}>
            {ids.length === 1
              ? "1 pessoa que não é sua amiga"
              : `${String(ids.length)} pessoas que não são suas amigas`}
          </p>
        </div>
        <Selo tom="aviso" className={css.filtro}>
          filtro ativo
        </Selo>
      </header>

      <ul className={css.lista}>
        {ids.map((id) => (
          <Solicitacao key={id} channelId={id} />
        ))}
      </ul>
    </section>
  );
}

/** A prévia e o contexto de UMA conversa, buscados na montagem. */
type Detalhe = {
  readonly para: string;
  /** `undefined` = não deu para buscar; string vazia = mensagem sem texto. */
  readonly texto: string | undefined;
  /** `undefined` = não deu para saber; não é o mesmo que zero em comum. */
  readonly servidoresEmComum: number | undefined;
};

/** Uma linha. Assina a própria conversa e a pessoa do outro lado — lei nº 1. */
const Solicitacao = memo(function Solicitacao({
  channelId,
}: {
  channelId: string;
}) {
  const canal = useChannel(channelId);
  const pessoaId = canal?.destinatarioId ?? "";
  const pessoa = usePessoa(pessoaId);
  const ultimaMensagemId = canal?.ultimaMensagemId;

  /*
    ⚠ **Guarda PARA QUEM a resposta é, e deriva daí** — o arranjo das telas de
    convites e do seletor de emoji. Zerar o detalhe num efeito ao chegar
    mensagem nova seria `setState` em efeito, que o lint reprova com razão.
    A chave inclui a última mensagem: quando a pessoa escreve de novo, a prévia
    antiga simplesmente deixa de ser lida.
  */
  const chave = `${channelId}:${ultimaMensagemId ?? ""}`;
  const [detalhe, setDetalhe] = useState<Detalhe | undefined>(undefined);
  const [revelada, setRevelada] = useState(false);
  const [ocupada, setOcupada] = useState(false);

  useEffect(() => {
    let vivo = true;
    void Promise.all([
      buscarPreviaDaConversa(channelId),
      pessoaId ? buscarEmComum(pessoaId) : Promise.resolve(undefined),
    ]).then(([texto, emComum]) => {
      if (!vivo) return;
      setDetalhe({
        para: chave,
        texto,
        servidoresEmComum: emComum?.servidores.length,
      });
    });
    return () => {
      vivo = false;
    };
  }, [chave, channelId, pessoaId]);

  if (!canal) return null;

  const atual = detalhe?.para === chave ? detalhe : undefined;
  const texto = atual?.texto;
  const suspeita = texto === undefined ? undefined : sinalDeSuspeita(texto);
  const nome = pessoa?.displayName ?? canal.name;

  function correr(p: Promise<unknown>) {
    setOcupada(true);
    void p.finally(() => setOcupada(false));
  }

  /*
    A prévia tem QUATRO estados, e cada um diz uma coisa diferente. Buscando é
    buscando; falha não é "mensagem vazia"; suspeita esconde até pedirem.
  */
  const previa =
    atual === undefined
      ? "carregando a mensagem…"
      : texto === undefined
        ? "não deu para carregar a mensagem"
        : suspeita !== undefined && !revelada
          ? `conteúdo oculto · ${suspeita}`
          : texto.trim() === ""
            ? "mensagem sem texto"
            : texto;

  const contexto =
    atual?.servidoresEmComum === undefined
      ? undefined
      : atual.servidoresEmComum === 0
        ? "sem servidores em comum"
        : atual.servidoresEmComum === 1
          ? "1 servidor em comum"
          : `${String(atual.servidoresEmComum)} servidores em comum`;

  return (
    <li className={css.solicitacao}>
      <div className={css.linha} data-suspeita={suspeita !== undefined}>
        <Avatar
          id={pessoaId}
          sigla={pessoa?.sigla}
          url={pessoa?.avatarUrl}
          tamanho="sm"
          /* Sem ponto de presença, como a referência: a presença de um
             desconhecido não ajuda a decidir, e é dado que ele não escolheu
             mostrar a você. */
        />
        <div className={css.texto}>
          <div className={css.linhaDoNome}>
            <span className={css.nome}>{nome}</span>
            {suspeita !== undefined ? (
              <Selo tom="perigoSuave">SUSPEITO</Selo>
            ) : contexto !== undefined ? (
              <Selo tom="neutro">{contexto}</Selo>
            ) : null}
          </div>
          <p
            className={css.previa}
            data-tom={
              atual === undefined ||
              texto === undefined ||
              (suspeita !== undefined && !revelada)
                ? "apagado"
                : "normal"
            }
          >
            {previa}
          </p>
        </div>
      </div>

      <div className={css.acoes}>
        {suspeita !== undefined ? (
          <>
            {!revelada ? (
              <Botao
                tamanho="pequeno"
                variante="neutro"
                onClick={() => setRevelada(true)}
              >
                Mostrar mensagem
              </Botao>
            ) : (
              <Botao
                tamanho="pequeno"
                variante="primario"
                disabled={ocupada}
                onClick={() => {
                  aceitarSolicitacao(channelId);
                  abrirConversa(channelId);
                }}
              >
                Aceitar
              </Botao>
            )}
            <Botao
              tamanho="pequeno"
              variante="perigoSutil"
              disabled={ocupada || !pessoaId}
              onClick={() => {
                recusarSolicitacao(channelId, ultimaMensagemId);
                correr(bloquear(pessoaId));
              }}
            >
              Bloquear
            </Botao>
          </>
        ) : (
          <>
            {/*
              Aceitar ABRE a conversa. A pessoa acabou de decidir ler — deixá-la
              na aba de pessoas obrigaria a procurar a conversa na coluna.
            */}
            <Botao
              tamanho="pequeno"
              variante="primario"
              disabled={ocupada}
              onClick={() => {
                aceitarSolicitacao(channelId);
                abrirConversa(channelId);
              }}
            >
              Aceitar
            </Botao>
            <Botao
              tamanho="pequeno"
              variante="neutro"
              disabled={ocupada}
              onClick={() => recusarSolicitacao(channelId, ultimaMensagemId)}
            >
              Ignorar
            </Botao>
            {/*
              ⚠ **Recusa ANTES das duas escritas**, e não depois: se a denúncia
              falhar, a pessoa já pediu para não ver mais esta conversa, e o
              toast de erro diz o que não foi feito. Esperar a rede para tirar
              da fila faria a linha ficar na tela depois do clique.
            */}
            <Botao
              tamanho="pequeno"
              variante="sutil"
              className={css.perigoTexto}
              disabled={ocupada || !pessoaId}
              onClick={() => {
                recusarSolicitacao(channelId, ultimaMensagemId);
                correr(
                  Promise.all([
                    bloquear(pessoaId),
                    denunciarPessoa(pessoaId, ultimaMensagemId),
                  ]),
                );
              }}
            >
              Bloquear e denunciar
            </Botao>
          </>
        )}
      </div>
    </li>
  );
});
