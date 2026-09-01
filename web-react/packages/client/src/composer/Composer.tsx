import {
  PaperPlaneRight,
  Plus,
} from "../components/ui/icones";
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

import { FerramentasDoComposer } from "./FerramentasDoComposer";
import { Tooltip } from "../components/ui/Tooltip";
import {
  ATRIBUTO_DE_COLUNA,
  observarAlinhamentoDeColuna,
} from "../dev/alinhamento";
import { digitacao, enviarMensagem } from "../sdk/adapter";
import { temServidorDeMidia } from "../sdk/anexos";
import { LIMITE_DE_CONTEUDO } from "../sdk/domain";
import { pode } from "../sdk/permissoes";
import { cn } from "../lib/cn";
import { ouvirFocoNoComposer, pedirFimDaLista } from "../store/comandos";
import {
  alvoDeResposta,
  assinarResposta,
  cancelarResposta,
  responderA,
} from "../store/resposta";
import { useChannel, useRascunho } from "../store/hooks";
import { escreverRascunho, limparRascunho } from "../store/rascunhos";
import css from "./Composer.module.css";
import { BarraDeResposta } from "./BarraDeResposta";
import { Digitando } from "./Digitando";
import { IrParaOPresente } from "./IrParaOPresente";

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
  /*
    O canal, só pelo modo lento.

    Assinar o snapshot do canal aqui é barato de um jeito que não seria na
    linha de mensagem: o composer é UM componente, não dez mil. O snapshot
    republica a cada não-lida, e um re-render do composer por mensagem nova é
    invisível — a `textarea` não perde o cursor porque o valor mora no store.
  */
  const canal = useChannel(channelId);
  const modoLento = canal?.modoLento ?? 0;

  const excedido = valor.length > LIMITE_DE_CONTEUDO;
  /*
    A permissão entra AQUI e não num terceiro lugar.

    `podeEnviar` já era a única porta pela qual o envio passa — o atalho de
    teclado e o botão consultam os dois a mesma variável. Pendurar a permissão
    nela é o que garante que ninguém envie por um caminho que esqueceu de
    perguntar; ver `sdk/permissoes.ts`.
  */
  const temPermissao = pode(channelId, "enviar");
  const podeEnviar = valor.trim().length > 0 && !excedido && temPermissao;

  const seletorDeArquivo = useRef<HTMLInputElement>(null);
  /*
    Instância sem servidor de mídia é configuração válida, e aí o botão fica
    desabilitado em vez de abrir um seletor cujo resultado não teria para onde
    ir. Ver `temServidorDeMidia`.
  */
  const temMidia = temServidorDeMidia();

  /**
   * O composer segue a coluna de mensagem — verificado, não prometido.
   *
   * Mede depois do layout valer. É dev-only e roda uma vez na montagem: o
   * caso que interessa é alguém mexer no padding ou na calha de um dos dois
   * lados, não uma regressão que apareça só em certa largura.
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // Um frame para o layout assentar, e depois observa: a janela muda
    // depois da montagem, que é a definição de layout responsivo.
    let parar: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      parar = observarAlinhamentoDeColuna();
    });
    // Cancela o frame E desconecta o observador: sem o segundo, cada
    // remontagem do composer deixa um `ResizeObserver` vivo — erro nº 5 do
    // briefing, o vazamento que só aparece na sexta hora.
    return () => {
      cancelAnimationFrame(id);
      parar?.();
    };
  }, []);

  /**
   * "Escrever a primeira" — o convite do canal vazio termina AQUI.
   *
   * Estado vazio que diz "escreva algo" e deixa a pessoa procurar o campo é
   * decoração; o convite tem que levar o cursor. Effect é o uso correto:
   * sincronizar com um sistema externo, e a lista não conhece este componente
   * (lei nº 6) — os dois podem estar em painéis diferentes na fase 4.
   */
  /**
   * A quem esta mensagem responde.
   *
   * Assina o store de resposta, não o de rascunho: os dois descrevem "o que
   * está sendo escrito", mas o rascunho muda a cada TECLA e o alvo muda por
   * clique. Juntos, escolher uma mensagem republicaria o rascunho.
   */
  const respondendoA = useSyncExternalStore(
    (l) => assinarResposta(channelId, l),
    () => alvoDeResposta(channelId),
  );

  const entradaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(
    () => ouvirFocoNoComposer(channelId, () => entradaRef.current?.focus()),
    [channelId],
  );

  function alterar(texto: string) {
    escreverRascunho(channelId, texto);
    // Apagar tudo é parar de digitar. Sem isto, quem desiste da frase continua
    // aparecendo como digitando até o silêncio expirar.
    if (texto.length > 0) digitacao.aoDigitar(channelId);
    else digitacao.aoParar(channelId);
  }

  /**
   * Insere texto na POSIÇÃO DO CURSOR — é assim que o emoji chega ao campo.
   *
   * Concatenar no fim seria o atalho, e estaria errado no caso mais comum:
   * quem já escreveu a frase e volta para pôr um emoji no meio veria o glifo
   * saltar para o final. A `textarea` guarda a seleção mesmo enquanto o
   * seletor tem o foco, então `selectionStart` continua valendo.
   */
  function inserir(texto: string) {
    const campo = entradaRef.current;
    const a = campo?.selectionStart ?? valor.length;
    const b = campo?.selectionEnd ?? valor.length;
    alterar(valor.slice(0, a) + texto + valor.slice(b));
    /* Depois do commit, senão o cursor volta para o fim junto com o valor. */
    queueMicrotask(() => {
      campo?.focus();
      campo?.setSelectionRange(a + texto.length, a + texto.length);
    });
  }

  /**
   * Manda os arquivos escolhidos, junto com o que estiver escrito.
   *
   * ⚠ **NÃO há prévia no composer, e a ausência é do design.** A única
   * superfície de upload que ele desenha é a LINHA da mensagem otimista
   * (`enviando… · densidades.png · 62% · 178 KB/s · Cancelar`), na seção
   * "Estados de envio". Uma fileira de chips aqui seria uma segunda superfície
   * de progresso que nada pede, com a decisão de quem cancela o quê
   * duplicada em dois lugares.
   *
   * A consequência é dita: escolher o arquivo JÁ envia. É o mesmo contrato
   * de arrastar-e-soltar em qualquer cliente da categoria, e o desfazer existe
   * — "Cancelar", no cartão da própria linha.
   */
  function enviarArquivos(arquivos: readonly File[]) {
    if (!temPermissao || excedido) return;

    const id = enviarMensagem(channelId, valor, paraEnvio(), arquivos);
    if (!id) return;

    limparRascunho(channelId);
    cancelarResposta(channelId);
    pedirFimDaLista(channelId);
  }

  /**
   * O alvo no formato do envio.
   *
   * ⚠ **Montado no HANDLER e não no render.** Um objeto novo a cada render
   * passaria por props e quebraria a comparação por referência de quem o
   * recebesse; aqui ele nasce no clique e morre na chamada. A tradução de
   * nome (`messageId` → `id`) fica nesta fronteira de propósito: o store fala
   * de mensagem, o adapter fala de resposta.
   */
  function paraEnvio() {
    return respondendoA === undefined
      ? undefined
      : { id: respondendoA.messageId, mencionar: respondendoA.mencionar };
  }

  function enviar() {
    if (!podeEnviar) return;

    const id = enviarMensagem(channelId, valor, paraEnvio());
    // Não saiu (canal não carregado, sem sessão): o rascunho FICA. Limpar aqui
    // apagaria o texto da pessoa por causa de um erro que não é dela.
    if (!id) return;

    limparRascunho(channelId);
    // A resposta só é desarmada depois do envio ACEITO: se o envio falhar, o
    // alvo continua armado junto com o rascunho, e a pessoa não precisa
    // procurar a mensagem de novo.
    cancelarResposta(channelId);
    // Enviou com a lista rolada para cima? Volta para o fim. O
    // `followOnAppend` não faz isso de propósito — ele só segue quem já estava
    // lá, que é o comportamento certo para mensagem dos outros.
    pedirFimDaLista(channelId);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>) {
    // Escape desarma a resposta antes de qualquer outra coisa.
    //
    // É o gesto que a pessoa já tem no dedo, e sem ele a única saída seria
    // mirar um X de 20px — caro para desfazer algo feito por engano.
    if (evento.key === "Escape" && respondendoA) {
      evento.preventDefault();
      cancelarResposta(channelId);
      return;
    }

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
      <div className={css.coluna}>
        {/* O marcador vai no CONTEÚDO, não na faixa: é ele que a assertion
            compara com o conteúdo da linha de mensagem. */}
        <div className={css.conteudo} {...{ [ATRIBUTO_DE_COLUNA]: "composer" }}>
        {/*
          ⚠ **Digitação e "Ir para o presente" na MESMA linha — é o design, e a
          faixa não existia.** O indicador era um `<p>` solto; o botão de voltar
          ao fim não existia em lugar nenhum do app. Descoberto porque o
          `pnpm utilities` reprovou uma classe que eu inventei para ele antes de
          o botão existir: a guarda de regra sem consumidor acusou o componente
          ausente, não uma folha suja.
        */}
        <div className={css.avisos}>
          <Digitando channelId={channelId} />
          <IrParaOPresente channelId={channelId} />
        </div>

        {/*
          A barra de resposta, ACIMA do campo.

          Acima e não dentro: ela some quando a resposta é desarmada, e um
          elemento que aparece e some DENTRO do campo mudaria a altura da
          caixa de texto — que é justamente o que faz a lista reancorar.
          Fora dela, o composer cresce como um todo e o `ResizeObserver` da
          lista trata isso como qualquer outro crescimento.
        */}
        {respondendoA ? (
          <BarraDeResposta
            messageId={respondendoA.messageId}
            mencionar={respondendoA.mencionar}
            aoAlternarMencao={() =>
              responderA(
                channelId,
                respondendoA.messageId,
                !respondendoA.mencionar,
              )
            }
            aoCancelar={() => cancelarResposta(channelId)}
          />
        ) : null}

        {/*
          A CAIXA, e ela contém tudo — é a estrutura do design.

          Anexar, o campo, as ferramentas e a faixa de rodapé moram dentro da
          mesma borda. A versão anterior tinha anexar e enviar fora dela, e a
          diferença não é estética: com tudo dentro, o anel de foco de
          `:focus-within` cobre a superfície inteira que a pessoa está usando,
          em vez de acender só a caixa de texto enquanto o cursor está num
          botão vizinho.
        */}
        <div className={cn(css.campo, "flex-1")} data-excedido={String(excedido)}>
          <div className={css.linha}>
            {/*
              Anexar, na borda de INÍCIO — a posição é do design, e a razão é
              semântica: é a única ação que abre um seletor do SISTEMA. O que
              vem de fora entra por um lado; o que se compõe aqui dentro
              (emoji, GIF, figurinha) fica do outro.
            */}
            <Tooltip texto="Anexar arquivo">
              <button
                type="button"
                className={css.anexar}
                aria-label="Anexar arquivo"
                disabled={!temPermissao || !temMidia}
                onClick={() => seletorDeArquivo.current?.click()}
              >
                <Plus aria-hidden />
              </button>
            </Tooltip>

            {/*
              O `input` de arquivo, escondido e acionado pelo botão.

              ⚠ **Escondido com `display: none` num elemento PRÓPRIO, e não
              estilizado para virar o botão.** Um `<input type="file">` é
              renderizado pelo SISTEMA e não aceita o ícone, o tamanho nem os
              oito estados que o resto da régua tem — é a mesma razão pela
              qual o `<select>` do design virou dropdown aqui.

              `value = ""` depois de escolher: sem isso, escolher O MESMO
              arquivo duas vezes seguidas não dispara `change`, porque o valor
              não mudou. É o caso comum de "errei o canal, vou mandar de novo".
            */}
            <input
              ref={seletorDeArquivo}
              type="file"
              multiple
              className={css.seletorDeArquivo}
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const escolhidos = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (escolhidos.length > 0) enviarArquivos(escolhidos);
              }}
            />

            <div className={css.pilha}>
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
                ref={entradaRef}
                className={css.entrada}
                value={valor}
                onChange={(evento) => alterar(evento.target.value)}
                onKeyDown={aoTeclar}
                onBlur={() => digitacao.aoParar(channelId)}
                rows={1}
                aria-label="Mensagem"
                /*
                  Sem permissão o campo é DESLIGADO e diz por quê.

                  Deixá-lo aceitando texto que nunca vai sair seria a pior das
                  versões: a pessoa escreve, aperta Enter e nada acontece. Campo
                  desligado com um rótulo que explica é a resposta — o oitavo dos
                  oito estados, e o único que não existia nesta superfície.
                */
                disabled={!temPermissao}
                placeholder={
                  temPermissao
                    ? "Escreva uma mensagem…"
                    : "Você não pode escrever neste canal"
                }
              />
            </div>

            <FerramentasDoComposer
              desabilitado={!temPermissao}
              aoInserir={inserir}
            />

            {/*
              ⚠ **O botão de enviar NÃO está no design, e fica mesmo assim.**

              A composição do design assume Enter — a faixa de rodapé dele diz
              "shift + ↵ nova linha" e não há alvo de envio. Manter o botão é a
              única divergência 1:1 desta superfície, e é deliberada: sem ele
              não existe afordância de PONTEIRO nem de TOQUE para enviar, e
              enviar é a ação mais frequente do app inteiro.

              Diga se prefere sem — é uma linha.
            */}
            <Tooltip texto="Enviar · Enter">
              <button
                type="button"
                onClick={enviar}
                disabled={!podeEnviar}
                aria-label="Enviar mensagem"
                className={css.enviar}
              >
                <PaperPlaneRight aria-hidden />
              </button>
            </Tooltip>
          </div>

          {/*
            A faixa de rodapé, DENTRO da caixa e separada por uma régua.

            É uma das poucas separações que ainda merecem linha: os dois blocos
            correm no mesmo eixo dentro de uma superfície só, e o espaço
            sozinho não os separaria do texto acima.
          */}
          <div className={css.faixa}>
            {/*
              ESTADO à esquerda, ATALHO à direita — a divisão é do design.

              A versão anterior tinha "Enter envia · Shift+Enter quebra linha"
              aqui e o mesmo atalho do outro lado: as duas pontas dizendo a
              mesma coisa. O design põe estado do canal e do rascunho de um
              lado, e a tecla do outro.

              "Rascunho salvo" só quando há rascunho, e é verdade — o texto
              vive no store keyed por canal desde a fase 3, e sobrevive a
              trocar de canal e voltar. Um aviso permanente seria ruído; um
              aviso que aparece quando há o que perder é informação.
            */}
            {/*
              "Modo lento · 30 s" e "Rascunho salvo", nesta ordem — a do design.

              ⚠ **O modo lento é DITO, não aplicado.** Quem conta o intervalo é
              o servidor; um cliente que trave por conta própria erra nos dois
              sentidos — o relógio local diverge do de lá, e recarregar a
              página zeraria o contador. O valor da linha é a pessoa saber por
              que a segunda mensagem foi recusada, e isso ela sabe lendo.

              `<span>` vazio quando não há nada a dizer, e não ausência: a
              faixa é `space-between`, e sem o primeiro filho o atalho pularia
              para a esquerda quando o rascunho esvaziasse.
            */}
            <span className={css.estado}>
              {modoLento > 0 ? (
                <span className={css.dica}>Modo lento · {modoLento} s</span>
              ) : null}
              <span className={css.dica}>
                {valor.length > 0 ? "Rascunho salvo" : null}
              </span>
            </span>

            {/* Contagem só perto do limite: um contador permanente é ruído em
                99% das mensagens, e some justamente quando começa a importar. */}
            {valor.length >= AVISAR_A_PARTIR_DE ? (
              <span
                role="status"
                className={cn("text-xs", excedido ? "text-danger" : "text-text-3")}
              >
                {valor.length} / {LIMITE_DE_CONTEUDO}
              </span>
            ) : (
              <span className={css.atalho}>shift + ↵ nova linha</span>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
