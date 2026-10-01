import { useSyncExternalStore } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import {
  ArrowLeft,
  BellSimple,
  BellSimpleSlash,
  ChatsCircle,
  DotsThree,
  X,
} from "../components/ui/icones";
import { Tooltip } from "../components/ui/Tooltip";
import { cn } from "../lib/cn";
import { plural } from "../lib/plural";
import { pode } from "../sdk/permissoes";
import { arquivarTopico, fixarPost, marcarEmAnalise, seguirTopico } from "../sdk/topicos";
import { usuarioLocalId } from "../sdk/adapter";
import { pedirIrParaMensagem } from "../store/comandos";
import { useChannel, useForum, useTopico } from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import { alternarSilencio, assinarSilencio, estaSilenciado } from "../store/silencio";
import { ID_DO_NOME_DO_CANAL } from "../canais/CabecalhoDeCanal";
import css from "./CabecalhoDeTopico.module.css";

/**
 * O cabeçalho de um tópico aberto — `‹ 🧵 nome · em #pai · N mensagens`.
 *
 * Linha do shell como o de canal, e com a mesma altura de 50px: os dois
 * cabeçalhos se sucedem ao entrar e sair de um tópico, e um degrau ali faria a
 * lista inteira saltar.
 *
 * `‹` e `✕` fazem a mesma coisa — voltar ao canal pai — e os dois ficam, como
 * no design: `‹` é onde o olho procura "voltar", `✕` é onde a mão procura
 * "fechar" quando o tópico é lido como painel.
 */
export function CabecalhoDeTopico({
  channelId,
  gatilho,
}: {
  channelId: string;
  /** O botão de mostrar canais em janela estreita — o mesmo do cabeçalho de canal. */
  gatilho: React.ReactNode;
}) {
  const t = useTopico(channelId);
  const pai = useChannel(t?.paiId ?? "");
  const forumDoPai = useForum(t?.paiId ?? "");
  const silenciado = useSyncExternalStore(assinarSilencio, () => estaSilenciado(channelId));

  // Caixa com altura, nunca `null`: o grid do shell reserva esta linha.
  if (!t) return <header className={css.cabecalho}>{gatilho}</header>;

  const voltar = () => selecionarCanal(t.paiId);
  const partes = [pai ? `em #${pai.name}` : undefined];
  if (t.respostas !== undefined) partes.push(plural(t.respostas, "mensagem", "mensagens"));
  partes.push(plural(t.seguidores.length, "participante", "participantes"));
  // Arquivar é do dono do tópico, ou de quem gerencia o canal — a regra do servidor.
  const podeArquivar = t.donoId === usuarioLocalId() || pode(channelId, "gerenciarCanais");
  /*
    Fixar é só de POST (pai com fórum), e
    é moderação do fórum: a permissão é a de fixar mensagem, no PAI. Ter
    aberto o post não basta, e o item some em vez de ficar cinza.
  */
  const podeFixar = forumDoPai !== null && pode(t.paiId, "fixar");

  return (
    <header className={css.cabecalho}>
      {gatilho}
      <Tooltip texto="Voltar ao canal">
        <button type="button" className={css.voltar} aria-label="Voltar ao canal" onClick={voltar}>
          <ArrowLeft aria-hidden />
        </button>
      </Tooltip>
      <ChatsCircle aria-hidden className={css.glifo} />
      <div className={css.textos}>
        <h1 id={ID_DO_NOME_DO_CANAL} className={css.nome}>
          {t.nome}
        </h1>
        <p className={css.sub}>{partes.filter(Boolean).join(" · ")}</p>
      </div>

      <div className={css.fim}>
        {t.arquivado ? <span className={css.arquivado}>Arquivado</span> : null}
        {/*
          Nome ESTÁVEL e estado no `aria-pressed` — "Seguindo" com
          `aria-pressed=false` seria a pílula anunciando o contrário. O rótulo
          visível muda porque é o que o design desenha, e a ação vai no tooltip.
        */}
        <Tooltip texto={t.seguindo ? "Deixar de seguir" : "Seguir o tópico"}>
          <button
            type="button"
            className={cn(css.seguir, t.seguindo && css.seguindo)}
            aria-pressed={t.seguindo}
            aria-label="Seguir tópico"
            onClick={() => void seguirTopico(channelId, !t.seguindo)}
          >
            {t.seguindo ? "Seguindo" : "Seguir"}
          </button>
        </Tooltip>

        <div className={css.acoes}>
          <Tooltip texto={silenciado ? "Voltar a notificar" : "Silenciar tópico"}>
            <button
              type="button"
              className={cn(css.acao, silenciado && css.acaoAtiva)}
              aria-pressed={silenciado}
              aria-label="Notificações do tópico"
              onClick={() => alternarSilencio(channelId)}
            >
              {silenciado ? <BellSimpleSlash weight="fill" aria-hidden /> : <BellSimple aria-hidden />}
            </button>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={css.acao} aria-label="Mais ações do tópico">
                <DotsThree aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {t.abertura && !t.abertura.noTopico ? (
                <DropdownMenuItem onSelect={() => {
                    const origem = t.abertura!.id;
                    selecionarCanal(t.paiId);
                    pedirIrParaMensagem(t.paiId, origem);
                  }}>
                  Ir para a mensagem de origem
                </DropdownMenuItem>
              ) : null}
              {podeFixar ? (
                <DropdownMenuItem onSelect={() => void fixarPost(channelId, !t.fixado)}>
                  {t.fixado ? "Desafixar post" : "Fixar post"}
                </DropdownMenuItem>
              ) : null}
              {/* "Em análise" tem a régua de fixar no servidor — `thread_edit.rs`. */}
              {podeFixar ? (
                <DropdownMenuItem onSelect={() => void marcarEmAnalise(channelId, !t.emAnalise)}>
                  {t.emAnalise ? "Tirar de análise" : "Marcar em análise"}
                </DropdownMenuItem>
              ) : null}
              {podeArquivar ? (
                <DropdownMenuItem onSelect={() => void arquivarTopico(channelId, !t.arquivado)}>
                  {t.arquivado ? "Reabrir tópico" : "Arquivar tópico"}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={voltar}>Voltar ao canal</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip texto="Fechar tópico">
            <button type="button" className={css.acao} aria-label="Fechar tópico" onClick={voltar}>
              <X aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
