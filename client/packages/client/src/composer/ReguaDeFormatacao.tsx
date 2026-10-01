import { useState, type ReactNode, type RefObject } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/Popover";
import { SeletorDeEmoji } from "../seletores/SeletorDeEmoji";
import { envolverSelecao, inserirNoCursor, type Edicao } from "./formatacao";
import css from "./ReguaDeFormatacao.module.css";

/** Os botões que uma régua PODE ter, na ordem em que o design os põe. */
export type BotaoDeFormatacao =
  | "negrito"
  | "italico"
  | "sublinhado"
  | "riscado"
  | "spoiler"
  | "emoji";

/*
  As marcas são as que o caminho de leitura já entende desde
  `markdown/analisar.ts`, e as que qualquer cliente Stoat lê. O spoiler de TEXTO
  escreve `!!…!!` — outra coisa que o "Canal de spoiler", que cobre a MÍDIA.
*/
const FORMATOS: Record<
  Exclude<BotaoDeFormatacao, "emoji">,
  { rotulo: string; marca: string; glifo: string }
> = {
  negrito: { rotulo: "Negrito", marca: "**", glifo: "B" },
  italico: { rotulo: "Itálico", marca: "*", glifo: "I" },
  sublinhado: { rotulo: "Sublinhado", marca: "__", glifo: "U" },
  riscado: { rotulo: "Riscado", marca: "~~", glifo: "S" },
  spoiler: { rotulo: "Spoiler", marca: "!!", glifo: "spoiler" },
};

const ORDEM: readonly BotaoDeFormatacao[] = [
  "negrito",
  "italico",
  "sublinhado",
  "riscado",
  "spoiler",
  "emoji",
];

/**
 * A régua de formatação — a MESMA do editor de mensagem e do assunto do canal,
 * com o conjunto de botões escolhido por prop (D-CCANAL-04).
 *
 * ⚠ **Havia duas, e a do canal envolvia o texto INTEIRO.** O comentário dela
 * justificava: "sem uma referência ao `textarea` não há seleção para ler". A
 * referência é o que esta recebe — quem é dono do campo passa o `ref`, e a
 * régua lê a seleção na hora do clique. Negrito numa frase de assunto agora
 * marca a palavra selecionada, como no editor.
 *
 * O campo é controlado, então a régua ESCREVE pelo `aoMudar` e devolve o
 * cursor depois do commit — mexer no `value` do DOM por fora produziria o
 * valor que aparece e some no próximo `setState`.
 *
 * Os glifos são LETRAS (B · I · U · S), nos dois consumidores: é o que o
 * design desenha nas duas réguas. O editor usava ícones, e era a divergência
 * que tornava as duas réguas coisas diferentes.
 */
export function ReguaDeFormatacao({
  campo,
  valor,
  aoMudar,
  botoes,
  limite,
  compacta = false,
  ladoDoEmoji = "bottom",
  dica,
  className,
}: {
  campo: RefObject<HTMLTextAreaElement | null>;
  valor: string;
  aoMudar: (v: string) => void;
  /** Quais botões, filtrados na ordem fixa do design — a ordem não é do chamador. */
  botoes: readonly BotaoDeFormatacao[];
  /** O `maxLength` do campo: edição que passaria dele não acontece. */
  limite?: number;
  /** 26px e corpo 12, a régua do editor de mensagem; sem ela, 28px e corpo 13. */
  compacta?: boolean;
  ladoDoEmoji?: "top" | "bottom";
  /** O que fica na outra ponta — "markdown ok", "esc cancela · ↵ salva". */
  dica?: ReactNode;
  className?: string;
}) {
  const [emojiAberto, setEmojiAberto] = useState(false);

  function aplicar(edicao: Edicao | undefined) {
    const el = campo.current;
    if (!edicao) return;
    aoMudar(edicao.texto);
    if (!el) return;
    /* Depois do commit do React, senão o cursor volta para o fim. */
    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(edicao.inicio, edicao.fim);
    });
  }

  /* Sem campo montado, a posição é o fim — o único ponto que não mente. */
  const selecao = (): [number, number] => {
    const el = campo.current;
    return el ? [el.selectionStart, el.selectionEnd] : [valor.length, valor.length];
  };

  const visiveis = ORDEM.filter((b) => botoes.includes(b));

  return (
    <div
      className={`${css.regua} ${className ?? ""}`}
      data-compacta={compacta || undefined}
      role="toolbar"
      aria-label="Formatação"
    >
      {visiveis.map((b, i) => {
        if (b === "emoji") {
          /* Um `Popover.Root` por CAMPO em edição, não por linha de lista —
             a conta que criou `store/seletorDeReacao.ts` não se aplica. */
          return (
            <Popover key={b} open={emojiAberto} onOpenChange={setEmojiAberto}>
              <PopoverTrigger asChild>
                <button type="button" className={css.botao} aria-label="Emoji">
                  🙂
                </button>
              </PopoverTrigger>
              <PopoverContent side={ladoDoEmoji} align="start" sideOffset={6}>
                <SeletorDeEmoji
                  aoEscolher={(glifo) => {
                    const [a, z] = selecao();
                    aplicar(inserirNoCursor(valor, a, z, glifo, limite));
                    setEmojiAberto(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          );
        }
        const f = FORMATOS[b];
        /* A divisa separa o spoiler dos quatro de estilo — só quando há o
           que separar. */
        const divisa = b === "spoiler" && i > 0;
        return (
          <span key={b} className={css.grupo}>
            {divisa ? <span className={css.divisa} aria-hidden /> : null}
            <button
              type="button"
              className={css.botao}
              data-formato={b}
              aria-label={f.rotulo}
              onClick={() => {
                const [a, z] = selecao();
                aplicar(envolverSelecao(valor, a, z, f.marca, limite));
              }}
            >
              {f.glifo}
            </button>
          </span>
        );
      })}
      {dica !== undefined ? <span className={css.dica}>{dica}</span> : null}
    </div>
  );
}
