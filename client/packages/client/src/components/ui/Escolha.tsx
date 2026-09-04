import { CaretDown } from "./icones";

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
  rotuloDe,
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
  /**
   * O que MOSTRAR para cada opção, quando o valor não é o texto.
   *
   * ⚠ Existe porque há escolha cujo valor é um ID: categoria tem título e ID
   * separados, e dois títulos podem ser iguais. Usar o título como valor faria
   * a escolha resolver para a categoria errada — silenciosamente, e só num
   * servidor que tivesse duas categorias com o mesmo nome.
   *
   * Sem ela o comportamento é o de sempre: a opção é o próprio texto.
   */
  rotuloDe?: (v: string) => string;
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
            <span className={css.valor}>{rotuloDe ? rotuloDe(valor) : valor}</span>
            <CaretDown aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {opcoes.map((o) => (
            <DropdownMenuItem key={o} onSelect={() => aoEscolher(o)}>
              {rotuloDe ? rotuloDe(o) : o}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
