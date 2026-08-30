import { Check } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";
import css from "./Marcador.module.css";

type Comum = {
  marcado: boolean;
  /**
   * Nomeia o RECURSO, nunca a ação — "Canal privado", não "Tornar privado".
   *
   * ⚠ Quando há `children`, ele é OPCIONAL e normalmente deve ficar de fora: o
   * nome acessível sai do texto ao lado, e passar os dois faz o `aria-label`
   * VENCER o conteúdo, então o leitor anuncia uma coisa e a tela mostra outra.
   * Use só quando o texto visível não bastar sozinho.
   */
  rotulo?: string;
  /** O texto ao lado. Sem ele, o controle é só o quadrado. */
  children?: ReactNode;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-checked" | "aria-label" | "role" | "onClick" | "children"
>;

function corpo(
  tipo: "caixa" | "ponto",
  marcado: boolean,
  children: ReactNode,
  rotulo: string | undefined,
  className: string | undefined,
) {
  const quadrado = (
    <span className={cn(css.marcador, css[tipo])} aria-hidden>
      {tipo === "caixa" ? (
        <Check weight="bold" aria-hidden />
      ) : (
        <span className={css.miolo} aria-hidden />
      )}
    </span>
  );

  return {
    /* Sem rótulo visível o `aria-label` é a única fonte de nome, então ele
       passa a ser obrigatório na prática — quem esquecer entrega um controle
       sem nome nenhum. */
    "aria-label": children === undefined ? rotulo : rotulo,
    "aria-checked": marcado,
    className:
      children === undefined
        ? cn(css.marcador, css[tipo], className)
        : cn(css.linha, tipo === "caixa" && css.linhaCaixa, className),
    filhos:
      children === undefined ? (
        tipo === "caixa" ? (
          <Check weight="bold" aria-hidden />
        ) : (
          <span className={css.miolo} aria-hidden />
        )
      ) : (
        <>
          {quadrado}
          <span>{children}</span>
        </>
      ),
  };
}

/**
 * Caixa de seleção.
 *
 * `button` com `role="checkbox"` e não `<input type="checkbox">`: o nativo é
 * desenhado pelo SISTEMA. `accent-color` só troca a cor de preenchimento — a
 * caixa de 16 em `surface-2` com véu de 16% que o design desenha não é
 * alcançável por ele. É a mesma regra de lint que trocou os `<select>` do
 * modal de enquete.
 */
export function Caixa({
  marcado,
  rotulo,
  children,
  className,
  aoAlternar,
  ...props
}: Comum & { aoAlternar: (marcado: boolean) => void }) {
  const c = corpo("caixa", marcado, children, rotulo, className);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={c["aria-checked"]}
      aria-label={c["aria-label"]}
      className={c.className}
      onClick={() => aoAlternar(!marcado)}
      {...props}
    >
      {c.filhos}
    </button>
  );
}

/**
 * Ponto de opção.
 *
 * ⚠ Ele NÃO alterna sozinho: escolher já é o efeito, e desmarcar um radio
 * deixaria o grupo sem valor — estado que um `radiogroup` não deve alcançar.
 * Por isso `aoEscolher` e não `aoAlternar`.
 *
 * Quem o usa precisa envolvê-lo num `role="radiogroup"` com rótulo próprio.
 */
export function Opcao({
  marcado,
  rotulo,
  children,
  className,
  aoEscolher,
  ...props
}: Comum & { aoEscolher: () => void }) {
  const c = corpo("ponto", marcado, children, rotulo, className);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={c["aria-checked"]}
      aria-label={c["aria-label"]}
      className={c.className}
      onClick={aoEscolher}
      {...props}
    >
      {c.filhos}
    </button>
  );
}

/**
 * Só a MARCA, para quando o controle já é o elemento de fora.
 *
 * ⚠ Existe porque `Opcao` é um `<button>`, e há consumidor cujo alvo é um
 * CARTÃO inteiro — título, selo e explicação — que também é um `<button>`.
 * Botão dentro de botão é HTML inválido: o navegador reestrutura a árvore e o
 * clique interno aciona os dois. O erro já aconteceu uma vez nas ações da
 * linha de canal.
 *
 * Quem a usa fica com o `role="radio"` e o `aria-checked` no próprio elemento;
 * o CSS lê o estado do ancestral.
 */
export function MarcaDeOpcao({ className }: { className?: string }) {
  return (
    <span className={cn(css.marcador, css.ponto, className)} aria-hidden>
      <span className={css.miolo} aria-hidden />
    </span>
  );
}
