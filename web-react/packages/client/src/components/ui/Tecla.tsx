import { cn } from "../../lib/cn";
import css from "./Tecla.module.css";

/**
 * Uma tecla, escrita como a plataforma a chama.
 *
 * ⚠ **A tradução é obrigatória, e o projeto já tomou essa decisão uma vez** —
 * o botão da paleta na coluna de canais mostra `⌘K` num Mac e `Ctrl K` no
 * resto, com a razão escrita: mostrar "Ctrl" a quem usa Mac ensina o atalho
 * errado, e quem tenta e não funciona não tenta de novo. Aqui a mesma regra
 * vale para trinta atalhos de uma vez, o que é justamente por que ela precisa
 * morar num lugar só.
 *
 * `<kbd>` e não `<span>`: o elemento existe para isto, e leitor de tela e
 * tradutor automático tratam o conteúdo de forma diferente por causa dele.
 */
export function Tecla({ children }: { children: string }) {
  return <kbd className={css.tecla}>{children}</kbd>;
}

/**
 * Os modificadores, na grafia da plataforma.
 *
 * Fora do render: é constante da máquina, não estado. `navigator.platform` está
 * deprecado e continua sendo o que funciona em todo navegador; `userAgentData`
 * ainda não é universal.
 */
const MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

const MODIFICADOR: Record<string, string> = MAC
  ? { mod: "⌘", alt: "⌥", shift: "⇧", enter: "↵", backspace: "⌫", esc: "esc" }
  : {
      mod: "Ctrl",
      alt: "Alt",
      shift: "Shift",
      enter: "Enter",
      backspace: "⌫",
      esc: "Esc",
    };

/**
 * Uma combinação escrita em NOTAÇÃO NEUTRA, traduzida na exibição.
 *
 * O registro de atalhos escreve `["mod", "K"]`, nunca `"⌘K"`. Guardar o glifo
 * do Mac no registro obrigaria cada consumidor a desfazer a tradução para
 * mostrar "Ctrl" — e o primeiro que esquecesse mostraria o símbolo errado sem
 * erro nenhum.
 *
 * Símbolo desconhecido passa direto: é o caso de `"K"`, `"↑ / ↓"` e
 * `"no composer"`, que não dependem de plataforma.
 */
export function Combinacao({
  teclas,
  className,
}: {
  teclas: readonly string[];
  className?: string;
}) {
  return (
    <span className={cn(css.combinacao, className)}>
      {/*
        `key` pelo TOKEN e não pelo índice — a regra do projeto vale aqui como
        na lista de mensagens. Combinação com a mesma tecla duas vezes não
        existe e não faria sentido ("⌘⌘K"), então o token é único por
        combinação.
      */}
      {teclas.map((t) => (
        <Tecla key={t}>{MODIFICADOR[t] ?? t}</Tecla>
      ))}
    </span>
  );
}
