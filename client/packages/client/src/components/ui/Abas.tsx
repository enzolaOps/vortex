import { cn } from "../../lib/cn";
import css from "./Abas.module.css";

/**
 * Abas com sublinhado.
 *
 * ⚠ **Ela era pendência registrada — "fora por falta de consumidor" — e agora
 * tem um.** A regra do projeto sobre primitivos é que eles nascem com a
 * primeira superfície que os usa, senão são o "scaffold ahead" que o
 * `pnpm utilities` existe para pegar. O editor de cargo tem quatro abas
 * (Exibição · Permissões · Links · Gerenciar membros) e é esse consumidor.
 *
 * ⚠ **Não confundir com o `Segmentado`.** Aquele é o controle de PÍLULA, que
 * escolhe entre valores de um mesmo campo — densidade, tema — e vive dentro de
 * um formulário. Este troca de VISTA sobre o mesmo objeto, e é por isso que
 * ele mora colado numa régua que atravessa a largura: a régua diz que o que
 * está abaixo dela muda junto.
 *
 * Valores do design (`Vortex DMs, Voz e Modais`):
 *
 *     container   display:flex; gap:2px; border-bottom:1px solid rgba(255,255,255,0.08)
 *     item        padding:9px 14px; font-size:13px; font-weight:600
 *     ativo       color:#E6EAF0; box-shadow: inset 0 -2px 0 #35C2CC
 *     repouso     color:#77808E
 */
export function Abas<T extends string>({
  rotulo,
  valor,
  itens,
  aoEscolher,
  className,
}: {
  /** O nome acessível da barra — "Editor de cargo", e não "Abas". */
  rotulo: string;
  valor: T;
  readonly itens: readonly {
    readonly valor: T;
    readonly rotulo: string;
    /** Um número ao lado, quando a aba conta alguma coisa. */
    readonly contagem?: string;
  }[];
  aoEscolher: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={rotulo} className={cn(css.barra, className)}>
      {itens.map((it) => {
        const ativa = it.valor === valor;
        return (
          <button
            key={it.valor}
            type="button"
            role="tab"
            aria-selected={ativa}
            className={css.aba}
            onClick={() => {
              aoEscolher(it.valor);
            }}
          >
            {it.rotulo}
            {it.contagem === undefined ? null : (
              <span className={css.contagem}>{it.contagem}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
