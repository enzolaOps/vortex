import { PaperPlaneRight } from "@phosphor-icons/react";
import { useEffect, type KeyboardEvent } from "react";

import { Tooltip } from "../components/ui/Tooltip";
import {
  ATRIBUTO_DE_COLUNA,
  verificarAlinhamentoDeColuna,
} from "../dev/alinhamento";
import { digitacao, enviarMensagem } from "../sdk/adapter";
import { LIMITE_DE_CONTEUDO } from "../sdk/domain";
import { cn } from "../lib/cn";
import { pedirFimDaLista } from "../store/comandos";
import { useRascunho } from "../store/hooks";
import { escreverRascunho, limparRascunho } from "../store/rascunhos";
import css from "./Composer.module.css";
import { Digitando } from "./Digitando";

/** Mostra a contagem só quando ela passa a importar. */
const AVISAR_A_PARTIR_DE = LIMITE_DE_CONTEUDO * 0.9;

/**
 * O composer.
 *
 * O texto NÃO mora aqui. Mora no store de rascunhos, keyed por canal, e por
 * dois motivos que se somam: trocar de canal e voltar precisa devolver o texto
 * onde estava (estado de componente desmonta junto com a tela), e é o que
 * mantém o valor mais quente do app — uma escrita por tecla — acordando um
 * componente só. A lista de mensagens não fica sabendo que alguém digita.
 *
 * O editor é uma textarea, e isso é decisão, não etapa pulada. ProseMirror se
 * paga quando existem ÁTOMOS no texto: menção que é uma coisa só, emoji
 * customizado, bloco de código com linguagem. Nada disso existe ainda, e
 * trazê-lo agora seria schema, plugins e wrapper antes de haver o que editar.
 *
 * O que é caro de retrofitar não é o editor — é o que está em volta dele:
 * rascunho por canal, envio otimista, digitação com throttle, o campo que
 * cresce sem empurrar a lista. Isso está escrito aqui, e continua valendo
 * quando o miolo trocar. O rascunho segue `string` inclusive depois disso: o
 * protocolo carrega texto, documento rico é representação de edição.
 */
export function Composer({ channelId }: { channelId: string }) {
  const valor = useRascunho(channelId);

  const excedido = valor.length > LIMITE_DE_CONTEUDO;
  const podeEnviar = valor.trim().length > 0 && !excedido;

  /**
   * O composer segue a coluna de mensagem — verificado, não prometido.
   *
   * Mede depois do layout valer. É dev-only e roda uma vez na montagem: o
   * caso que interessa é alguém mexer no padding ou na calha de um dos dois
   * lados, não uma regressão que apareça só em certa largura.
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const id = requestAnimationFrame(verificarAlinhamentoDeColuna);
    return () => cancelAnimationFrame(id);
  }, []);

  function alterar(texto: string) {
    escreverRascunho(channelId, texto);
    // Apagar tudo é parar de digitar. Sem isto, quem desiste da frase continua
    // aparecendo como digitando até o silêncio expirar.
    if (texto.length > 0) digitacao.aoDigitar(channelId);
    else digitacao.aoParar(channelId);
  }

  function enviar() {
    if (!podeEnviar) return;

    const id = enviarMensagem(channelId, valor);
    // Não saiu (canal não carregado, sem sessão): o rascunho FICA. Limpar aqui
    // apagaria o texto da pessoa por causa de um erro que não é dela.
    if (!id) return;

    limparRascunho(channelId);
    // Enviou com a lista rolada para cima? Volta para o fim. O
    // `followOnAppend` não faz isso de propósito — ele só segue quem já estava
    // lá, que é o comportamento certo para mensagem dos outros.
    pedirFimDaLista(channelId);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key !== "Enter" || evento.shiftKey) return;

    // Enter durante composição de IME é "aceitar o candidato", não "enviar".
    // Sem esta guarda, quem escreve em japonês, chinês ou coreano envia a
    // mensagem no meio de cada palavra. `keyCode === 229` é o fallback para
    // navegadores que não populam `isComposing`.
    if (evento.nativeEvent.isComposing || evento.nativeEvent.keyCode === 229) {
      return;
    }

    evento.preventDefault();
    enviar();
  }

  return (
    <div className={css.rodape}>
      <div className={css.coluna} {...{ [ATRIBUTO_DE_COLUNA]: "composer" }}>
        <Digitando channelId={channelId} />

        <div className="flex items-end gap-2">
          <div
            className={cn(css.campo, "flex-1")}
            data-excedido={String(excedido)}
          >
            {/*
              A réplica invisível é quem dita a altura da célula do grid. Fica
              antes da textarea na ordem do DOM porque é conteúdo de layout,
              não de leitura — e `aria-hidden` a mantém fora da árvore de
              acessibilidade.

              O espaço no fim não é sobra: sem ele, um texto terminado em
              quebra de linha não gera a última linha, e o campo fica uma
              linha atrás do cursor.
            */}
            <div aria-hidden className={css.replica}>
              {valor + " "}
            </div>

            <textarea
              className={css.entrada}
              value={valor}
              onChange={(evento) => alterar(evento.target.value)}
              onKeyDown={aoTeclar}
              onBlur={() => digitacao.aoParar(channelId)}
              rows={1}
              aria-label="Mensagem"
              placeholder="Escreva uma mensagem…"
            />
          </div>

          <Tooltip texto="Enviar · Enter">
            <button
              type="button"
              onClick={enviar}
              disabled={!podeEnviar}
              aria-label="Enviar mensagem"
              className={cn(
                "flex items-center gap-2 rounded-2 px-3 py-2 anim-fast",
                "bg-accent text-on-accent hover:bg-accent-hover",
                "disabled:bg-surface-3 disabled:text-text-3",
              )}
            >
              <PaperPlaneRight size={20} aria-hidden />
            </button>
          </Tooltip>
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <span className={css.dica}>
            Enter envia · Shift+Enter quebra linha
          </span>

          {/* Contagem só perto do limite: um contador permanente é ruído em
              99% das mensagens, e some justamente quando começa a importar. */}
          {valor.length >= AVISAR_A_PARTIR_DE ? (
            <span
              role="status"
              className={cn(
                "text-xs",
                excedido ? "text-danger" : "text-text-3",
              )}
            >
              {valor.length} / {LIMITE_DE_CONTEUDO}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
