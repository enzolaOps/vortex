import { CaretDown } from "@phosphor-icons/react";

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
  valor,
  opcoes,
  disabled,
  aoEscolher,
}: {
  rotulo: string;
  valor: string;
  opcoes: readonly string[];
  disabled?: boolean;
  aoEscolher: (v: string) => void;
}) {
  return (
    <div className={css.selecao}>
      <span className={css.rotulo}>{rotulo}</span>
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
