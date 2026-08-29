import { Check, PaperPlaneRight, X } from "@phosphor-icons/react";
import { useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { enviarMensagem, marcarCanalLido } from "../sdk/adapter";
import { aindaNao } from "../pendente/pendencias";
import { contagem } from "../lib/plural";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { irPara } from "../store/navegacao";
import {
  useCanaisDeTexto,
  useChannel,
  useMessage,
  useServer,
  useServerIds,
  useTotaisNaoLidos,
} from "../store/hooks";
import css from "./CaixaDeEntrada.module.css";

type Aba = "mencoes" | "naoLidos" | "topicos";

/**
 * A caixa de entrada — menções, não lidos e tópicos num painel só.
 *
 * ⚠ **Ela era pendência de cabeçalho e virou PAINEL de verdade**, porque o
 * dado já existia: `ChannelSnapshot` carrega `naoLidas` e `mencoes` desde que
 * a semeadura no `Ready` foi construída, e a varredura é sobre canais — dezenas
 * — e não sobre mensagens.
 *
 * O que ela responde é a pergunta que a coluna de canais NÃO responde: "o que
 * me espera fora daqui". A coluna mostra um servidor de cada vez; esta olha
 * todos.
 *
 * ⚠ **A aba de tópicos fica vazia com o motivo escrito**, e não escondida. O
 * design desenha as três, e tópico não existe no protocolo (pendência
 * `topicos`) — esconder a aba faria parecer que não há tópicos, que é uma
 * afirmação diferente de "isto ainda não existe".
 */
export function CaixaDeEntrada({ aoFechar }: { aoFechar?: () => void }) {
  const [aba, setAba] = useState<Aba>("mencoes");
  const servidores = useServerIds();
  const totais = useTotaisNaoLidos();

  return (
    <div className={css.painel}>
      <header className={css.cabecalho}>
        <div className={css.linhaDoTitulo}>
          <span className={css.titulo}>Caixa de entrada</span>
          <div className={css.acoesDoTitulo}>
            <button
              type="button"
              className={css.marcarTudo}
              onClick={aindaNao("marcarTudoLido")}
            >
              Marcar tudo como lido
            </button>
            {aoFechar ? (
              <button
                type="button"
                className={css.fechar}
                aria-label="Fechar caixa de entrada"
                onClick={aoFechar}
              >
                <X aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {/*
          As abas COM contagem, como o design.

          Sem o número, "Menções" e "Não lidos" prometem a mesma coisa, e a
          pessoa precisa abrir as duas para descobrir onde está o que importa —
          num painel cuja única função é dizer onde está o que importa.

          O total vem do adapter (`totaisNaoLidos`) e não de uma soma daqui: a
          contagem vive por servidor, o número de servidores varia, e somar no
          componente exigiria hooks em laço.
        */}
        <div className={css.abas} role="tablist" aria-label="Filtro da caixa">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "mencoes"}
            className={css.aba}
            onClick={() => setAba("mencoes")}
          >
            Menções
            {totais.mencoes > 0 ? (
              <span className={css.abaBadge}>{contagem(totais.mencoes)}</span>
            ) : null}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={aba === "naoLidos"}
            className={css.aba}
            onClick={() => setAba("naoLidos")}
          >
            Não lidos
            {totais.naoLidas > 0 ? (
              <span className={css.abaContagem}>
                {contagem(totais.naoLidas)}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={aba === "topicos"}
            className={css.aba}
            onClick={() => setAba("topicos")}
          >
            Tópicos
          </button>
        </div>
      </header>

      <div className={css.lista} tabIndex={0} role="tabpanel">
        {aba === "topicos" ? (
          <EstadoVazio
            compacto
            titulo="Tópicos ainda não existem"
            detalhe="Depende de threads no protocolo — ver o registro de pendências."
          />
        ) : (
          servidores.map((id) => (
            <GrupoDeServidor key={id} serverId={id} aba={aba} />
          ))
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- a lista */

function GrupoDeServidor({ serverId, aba }: { serverId: string; aba: Aba }) {
  const servidor = useServer(serverId);
  const canais = useCanaisDeTexto(serverId);

  if (!servidor) return null;

  return (
    <>
      {canais.map((id) => (
        <LinhaDaCaixa
          key={id}
          serverId={serverId}
          channelId={id}
          servidor={servidor.name}
          sigla={servidor.sigla}
          aba={aba}
        />
      ))}
    </>
  );
}

/**
 * Uma linha da caixa. Assina o PRÓPRIO canal.
 *
 * É o mesmo padrão de `NomeDoAutor` e da linha de destino do encaminhar: sem
 * ele, uma mensagem nova em qualquer canal re-renderizaria o painel inteiro.
 *
 * O filtro mora aqui pela mesma razão: a contagem vive no snapshot do canal, e
 * filtrar lá fora obrigaria o pai a ler todos.
 */
function LinhaDaCaixa({
  serverId,
  channelId,
  servidor,
  sigla,
  aba,
}: {
  serverId: string;
  channelId: string;
  servidor: string;
  sigla: string;
  aba: Aba;
}) {
  const canal = useChannel(channelId);
  /*
    A última mensagem, assinada por ID.

    String vazia quando o canal não tem nenhuma — `useMessage("")` devolve
    `undefined` e não assina coisa alguma, então a linha custa o mesmo de
    antes nos canais sem histórico.
  */
  const ultima = useMessage(canal?.ultimaMensagemId ?? "");

  if (!canal) return null;

  const relevante = aba === "mencoes" ? canal.mencoes > 0 : canal.naoLidas > 0;
  if (!relevante) return null;

  return (
    <div className={css.item} data-destaque={aba === "mencoes" || undefined}>
      <button
        type="button"
        className={css.abrir}
        onClick={() => irPara(serverId, channelId)}
      >
        {/*
          A linha de CONTEXTO — servidor, canal, contagem e hora.

          É o que o design põe em cima e a coluna de canais não tem: "isto é de
          outro lugar". A hora vem da última MENSAGEM e não do canal:
          `ultimaEm` é o instante decodificado do ID, e formatá-lo aqui
          duplicaria o formatador que o snapshot da mensagem já traz pronto.
        */}
        <span className={css.contexto}>
          <Avatar id={serverId} sigla={sigla} tamanho="xxs" />
          <span className={css.servidor}>{servidor}</span>
          <span className={css.canal}>#{canal.name}</span>
          <span className={css.espaco} />
          {canal.mencoes > 0 ? (
            <span className={css.badge}>{contagem(canal.mencoes)}</span>
          ) : null}
          <span className={css.hora}>
            {ultima?.createdAtCurto ?? `${contagem(canal.naoLidas)} sem ler`}
          </span>
        </span>

        {/*
          A MENSAGEM, que era o que faltava.

          Sem ela a caixa dizia "há 4 menções em #produto" e obrigava a abrir o
          canal para descobrir o que foi dito — ou seja, custava exatamente o
          gesto que ela existe para poupar.

          ⚠ Ela pode não existir, e isso é esperado: o store só materializa
          mensagem que alguém assinou, então um canal que a sessão nunca abriu
          cai no fallback da contagem, ali em cima. Degradação honesta, e não
          um esqueleto que promete um texto que nunca vem.
        */}
        {ultima ? (
          <span className={css.mensagem}>
            <Avatar id={ultima.authorId ?? ""} tamanho="xs" />
            <span className={css.mensagemTexto}>
              {ultima.authorId ? (
                <span className={css.mensagemAutor}>
                  <NomeDoAutor userId={ultima.authorId} denso />
                </span>
              ) : null}
              <span className={css.mensagemCorpo}>{ultima.content}</span>
            </span>
          </span>
        ) : null}
      </button>

      {/*
        A resposta rápida só na aba de MENÇÕES, e sempre visível ali.

        O design a desenha num cartão só, e a escolha de qual é a que importa:
        menção é o que pede resposta; não-lida é o que pede leitura. Mostrá-la
        nas duas abas encheria o painel de campos de texto, e escondê-la atrás
        do hover daria um campo que some quando o ponteiro sai — inutilizável
        justamente enquanto se digita.
      */}
      {aba === "mencoes" ? <RespostaRapida channelId={channelId} /> : null}

      <button
        type="button"
        className={css.marcar}
        aria-label={`Marcar #${canal.name} como lido`}
        onClick={() => marcarCanalLido(channelId)}
      >
        <Check aria-hidden />
      </button>
    </div>
  );
}

/**
 * Responder sem entrar no canal.
 *
 * ⚠ **Ela ficou de fora na primeira versão, e a razão que eu dei era grande
 * demais.** Escrevi que dependia de "decidir de quem é o rascunho, o alvo de
 * resposta e a digitação", e nenhuma das três se aplica: o texto é ESTADO
 * LOCAL (some ao fechar, que é o que se espera de uma resposta rápida), não há
 * alvo de resposta (é uma mensagem nova no canal) e não há indicador de
 * digitação, porque ninguém está olhando aquele canal.
 *
 * O que sobra é `enviarMensagem(channelId, texto)`, que já existe.
 */
function RespostaRapida({ channelId }: { channelId: string }) {
  const [texto, setTexto] = useState("");
  const vazio = texto.trim().length === 0;

  function enviar() {
    if (vazio) return;
    // Não saiu (canal não carregado, sem sessão): o texto FICA. Limpar aqui
    // apagaria o que a pessoa escreveu por causa de um erro que não é dela.
    if (!enviarMensagem(channelId, texto.trim())) return;
    setTexto("");
    /* Marcar lido junto: quem respondeu leu. Deixar a linha acesa depois de
       responder é a caixa de entrada discordando do que a pessoa acabou de
       fazer. */
    marcarCanalLido(channelId);
  }

  return (
    <div className={css.resposta}>
      <input
        className={css.respostaCampo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviar();
          }
        }}
        placeholder="Responder rápido…"
        aria-label="Responder rápido"
      />
      <button
        type="button"
        className={css.respostaEnviar}
        aria-label="Enviar"
        disabled={vazio}
        onClick={enviar}
      >
        <PaperPlaneRight aria-hidden />
      </button>
    </div>
  );
}
