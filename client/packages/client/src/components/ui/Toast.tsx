import * as Primitivo from "@radix-ui/react-toast";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { cn } from "../../lib/cn";
import { Check, Envelope, WarningOctagon } from "./icones";
import css from "./Toast.module.css";
import {
  assinarToasts,
  dispensarToast,
  DURACAO_DO_TOAST_MS,
  lerToasts,
  naoExpira,
  type IconeDeToast,
  type RespostaDeToast,
} from "./toastStore";

export { toast, dispensarToast } from "./toastStore";

/**
 * Toast — notificação in-app, erro de envio, reconexão.
 *
 * Terceiro dos primitivos que o Base UI ainda não tem, e o que mais depende de
 * acessibilidade correta: o Radix cuida da região `aria-live`, do swipe para
 * dispensar, e da ordem de foco pelo atalho do sistema (F6 no Windows) —
 * detalhes que ninguém escreve à mão sem esquecer metade.
 *
 * Montado uma vez na raiz. Os toasts vêm do store, não de props.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(assinarToasts, lerToasts);

  return (
    <Primitivo.Provider duration={DURACAO_DO_TOAST_MS} swipeDirection="right">
      {toasts.map((t) => (
        <Primitivo.Root
          key={t.id}
          open
          /*
            Erro NÃO some sozinho.

            Seis segundos é tempo de confirmar algo que deu certo, e é o tempo
            errado para relatar algo que deu errado: quem estava lendo outra
            coisa perde o aviso inteiro, e a mensagem já passou.

            Aqui a diferença é literal, não filosófica. O toast de falha ao
            copiar carrega o TEXTO que a pessoa precisa selecionar à mão — é a
            saída que o erro oferece. Um aviso que expira antes de ser lido
            leva a saída junto.

            ⚠ **Divergência decidida do design (D-NOTIF-25)**, que faz tudo
            sumir em 6 s menos a chamada. A exceção é por TOAST (`expira`): o
            erro cuja saída mora em outro lugar — a falha de envio, que fica na
            linha — expira como o design pede. A chamada recebida não passa por
            aqui: é o cartão próprio de `store/chamadaRecebida`, que toca até
            alguém atender ou o toque acabar.
          */
          duration={naoExpira(t) ? Infinity : DURACAO_DO_TOAST_MS}
          onOpenChange={(aberto) => {
            if (!aberto) dispensarToast(t.id);
          }}
          /*
            Erro leva borda semântica; o resto fica no neutro. Cor sozinha não
            carrega o significado — o título diz o que aconteceu. A borda de
            erro e a entrada moram no módulo, lidas de `data-tipo`/`data-state`.
          */
          data-tipo={t.tipo}
          className={cn(
            `flex gap-11 rounded-12 border border-hairline-10 bg-surface-4 px-14 py-13 shadow-e3 ${css.caixa}`,
            // Centrado quando o conteúdo é uma linha só, como no design; com
            // ação ou resposta embaixo, o ladrilho fica no topo.
            !t.acao && !t.resposta && "items-center",
          )}
        >
          {t.icone ? <Ladrilho icone={t.icone} /> : null}
          <div className={css.conteudo}>
            <Primitivo.Title className="text-md font-medium text-text-1">
              {t.titulo}
              {/*
                ⚠ **A contagem fica no TÍTULO e não num selo próprio.** Ela é
                parte da frase — "isto aconteceu 5 vezes" —, e um selo ao lado
                viraria mais um alvo num aviso que já tem fechar e, às vezes,
                ação. Só aparece a partir da segunda: "1×" seria ruído em todo
                toast do app.
              */}
              {t.repeticoes !== undefined && t.repeticoes > 1 ? (
                <span className="ms-06 text-sm font-normal text-text-3">
                  {t.repeticoes}×
                </span>
              ) : null}
            </Primitivo.Title>

            {t.descricao ? (
              <Primitivo.Description className="mt-04 text-sm text-text-2">
                {t.descricao}
              </Primitivo.Description>
            ) : null}

            {t.acao ? (
              /*
                A ação fica ANTES do `Close` na ordem do DOM: quem chega por
                teclado encontra a saída útil antes do botão de descartar o aviso.

                `altText` é obrigatório no Radix e não é burocracia — o toast
                expira, e quem usa leitor de tela precisa saber como fazer a mesma
                coisa quando ele já tiver sumido.
              */
              <div className="mt-08 flex gap-06">
                {t.acaoSecundaria ? (
                  <Primitivo.Action
                    altText={t.acaoSecundaria.descricaoAlternativa}
                    onClick={t.acaoSecundaria.aoAtivar}
                    className="rounded-06 border border-border-strong px-08 py-04 text-sm text-text-1 hover:bg-state-hover"
                  >
                    {t.acaoSecundaria.rotulo}
                  </Primitivo.Action>
                ) : null}
                <Primitivo.Action
                  altText={t.acao.descricaoAlternativa}
                  onClick={t.acao.aoAtivar}
                  className="rounded-06 border border-border-strong px-08 py-04 text-sm text-text-1 hover:bg-state-hover"
                >
                  {t.acao.rotulo}
                </Primitivo.Action>
              </div>
            ) : null}

            {t.resposta ? (
              <CampoDeResposta
                resposta={t.resposta}
                aoEnviar={() => dispensarToast(t.id)}
              />
            ) : null}
          </div>

          {/*
            No fluxo e não `absolute`: é o ✕ do design, `flex: none` na ponta
            da linha. Absoluto, ele passava por cima do fim do título.
          */}
          <Primitivo.Close
            aria-label="Dispensar"
            className="flex-none self-start rounded-04 px-04 text-sm text-text-3 hover:text-text-1"
          >
            ×
          </Primitivo.Close>
        </Primitivo.Root>
      ))}

      {/*
        A viewport é a região que o leitor de tela anuncia. Fica fixa e fora do
        fluxo, e por isso é o único lugar do app onde `fixed` é o certo.
      */}
      <Primitivo.Viewport
        /*
          O rótulo da região, em português.

          O default do Radix é `"Notifications ({hotkey})"`, e ele estava no ar:
          a região anunciava em inglês num app inteiro em português. String que
          só leitor de tela lê não aparece em revisão de tela nenhuma — foi
          preciso ler os atributos no DOM para vê-la.

          `{hotkey}` é obrigatório: o Radix substitui pela tecla que move o foco
          para os toasts, e sem isso a região perde o único jeito de ser
          alcançada por teclado.
        */
        label="Notificações ({hotkey})"
        className={cn(
          css.viewport,
          "fixed end-16 bottom-16 z-flutuante flex flex-col gap-08 outline-none",
        )}
      />
    </Primitivo.Provider>
  );
}

const ICONE_DO_LADRILHO: Record<IconeDeToast, typeof Envelope> = {
  mensagens: Envelope,
  alerta: WarningOctagon,
};

/** O ladrilho de 36px do design — ✉ no agregado, △ no erro. */
function Ladrilho({ icone }: { icone: IconeDeToast }) {
  const Icone = ICONE_DO_LADRILHO[icone];
  return (
    <span className={css.ladrilho} data-icone={icone} aria-hidden>
      <Icone />
    </span>
  );
}

/**
 * "Responder…" dentro do toast de menção (D-NOTIF-20).
 *
 * Formulário de verdade: Enter envia, e o ✓ é `submit`. Enviar dispensa o
 * toast — a resposta foi o que ele pedia, e deixá-lo na tela convidaria a
 * responder duas vezes. Vazio não envia (o ✓ fica desabilitado), senão um
 * Enter acidental mandaria uma mensagem em branco.
 *
 * Enquanto o foco estiver aqui o Radix pausa o relógio do toast, então quem
 * está digitando não perde o campo no meio da frase.
 */
function CampoDeResposta({
  resposta,
  aoEnviar,
}: {
  resposta: RespostaDeToast;
  aoEnviar: () => void;
}) {
  const [texto, definirTexto] = useState("");
  const vazio = texto.trim() === "";

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (vazio) return;
    resposta.aoEnviar(texto.trim());
    aoEnviar();
  }

  return (
    <form className={css.resposta} onSubmit={enviar}>
      <input
        className={css.campo}
        value={texto}
        onChange={(e) => definirTexto(e.target.value)}
        placeholder={resposta.rotulo}
        aria-label={resposta.rotulo}
      />
      <button
        type="submit"
        className={css.enviar}
        disabled={vazio}
        aria-label="Enviar resposta"
      >
        <Check aria-hidden />
      </button>
    </form>
  );
}
