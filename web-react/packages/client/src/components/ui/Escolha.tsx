import { CaretDown } from "@phosphor-icons/react";

import { cn } from "../../lib/cn";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import css from "./Escolha.module.css";

/**
 * Uma escolha entre poucas opções, com a cara do `<select>` do design.
 *
 * ⚠ **Ele SUBIU de `enquete/CriarEnquete.tsx`, e o comentário de lá previu o
 * momento:** *"vive aqui e não em `components/ui/` de propósito … quando o
 * segundo consumidor aparecer, ele sobe"*. As configurações de canal são o
 * segundo — modo lento, região de voz, modo de vídeo e bitrate são quatro de
 * uma vez.
 *
 * O que ele deliberadamente NÃO faz: busca, grupos e listas longas. A regra do
 * projeto é que a biblioteca resolve o genérico e a gente escreve o
 * específico; um wrapper que tentasse cobrir o seletor de fuso horário
 * carregaria três casos que nenhum consumidor tem hoje.
 *
 * `valor` é o RÓTULO exibido e `opcoes` são os rótulos: quem chama guarda o
 * próprio estado. Um par `{id, rotulo}` seria mais correto num mundo com
 * opções vindas do servidor — e nenhuma destas vem.
 */
export function Escolha({
  rotulo,
  rotuloOculto = false,
  valor,
  opcoes,
  disabled,
  className,
  aoEscolher,
}: {
  rotulo: string;
  /**
   * O rótulo vira só o nome acessível.
   *
   * ⚠ Existe porque numa LINHA de ajuste quem nomeia o controle é o título da
   * linha, à esquerda. Repetir o rótulo em cima do gatilho daria a mesma
   * palavra duas vezes a 20px de distância — e o leitor de tela anunciaria as
   * duas. O nome não some: ele continua no `aria-label`.
   */
  rotuloOculto?: boolean;
  valor: string;
  opcoes: readonly string[];
  disabled?: boolean;
  /** A largura é de quem chama: 240 na linha de ajuste, cheia no formulário. */
  className?: string;
  aoEscolher: (v: string) => void;
}) {
  return (
    <div className={cn(css.selecao, className)}>
      {rotuloOculto ? null : <span className={css.rotulo}>{rotulo}</span>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={css.gatilho}
            aria-label={rotulo}
            disabled={disabled}
          >
            <span className={css.valor}>{valor}</span>
            <CaretDown aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {opcoes.map((o) => (
            <DropdownMenuItem key={o} onSelect={() => aoEscolher(o)}>
              {o}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
