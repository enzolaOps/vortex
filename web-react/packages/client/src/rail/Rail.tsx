import { memo } from "react";

import { Lamina } from "../components/ui/Lamina";
import { Tooltip } from "../components/ui/Tooltip";
import { contagem, rotuloDeNaoLidas } from "../lib/plural";
import { useServer, useServerIds, useServidorAtivo } from "../store/hooks";
import { selecionarServidor } from "../store/navegacao";
import css from "./Rail.module.css";

/**
 * Um servidor. Assina a si mesmo — a lista acima só conhece IDs.
 *
 * `memo` pela mesma razão do `MessageRow`: o rail re-renderiza quando o
 * servidor ATIVO muda, e sem isto os 40 itens remontariam a cada troca.
 * Aqui o React Compiler até compila (não há hook incompatível), mas ele
 * memoiza o corpo, não a identidade do elemento filho — quem corta a cascata
 * de re-render é `memo`.
 */
const ItemDeServidor = memo(function ItemDeServidor({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  const servidor = useServer(id);

  // Placeholder com a MESMA caixa do item real. `null` aqui não trava nada
  // (o rail não é virtualizado), mas encolher e crescer faria o rail pular
  // durante a hidratação — e é o mesmo princípio da linha que nunca mede 0px.
  if (!servidor) {
    return (
      <span className={css.item} aria-hidden>
        <span className={css.marca} />
      </span>
    );
  }

  const temNaoLidas = servidor.naoLidas > 0;

  return (
    /*
      `lado` é físico porque o Radix só fala em `side` físico — e aqui isso
      não viola a lei nº 6 por um detalhe que vale registrar: com
      `avoidCollisions` (default), o lado é uma PREFERÊNCIA. Rail movido para
      a borda oposta na fase 4 = sem espaço à direita = o Radix vira sozinho.

      O mapeamento logical→physical no wrapper é pendência aberta; até lá, a
      colisão cobre o caso real.
    */
    <Tooltip texto={servidor.name} lado="right">
      <button
        type="button"
        className={css.item}
        aria-current={ativo}
        aria-label={servidor.name}
        data-naolidas={temNaoLidas}
        onClick={() => selecionarServidor(id)}
      >
        {/* A lâmina é decorativa: `aria-current` já diz qual está aberto, e
            a contagem tem texto próprio. Ela substituiu uma pílula reta —
            que é o indicador de todo cliente de chat e não é de ninguém. */}
        <Lamina ativa={ativo} className={css.lamina} />

        <span className={css.marca} aria-hidden>
          {servidor.sigla}
          {servidor.mencoes > 0 ? (
            <span className={css.contador}>{contagem(servidor.mencoes)}</span>
          ) : null}
        </span>

        <span className={css.nome}>{servidor.name}</span>

        {/*
          Não-lidas nunca só por forma.

          A pílula sozinha é invisível para leitor de tela e some para quem
          usa `prefers-reduced-motion` com transição desligada. O texto é o
          que carrega o dado; a pílula é o atalho visual.
        */}
        {temNaoLidas ? (
          <span className="sr-only">
            {rotuloDeNaoLidas(servidor.naoLidas, servidor.mencoes)}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
});

/**
 * O rail de servidores.
 *
 * NÃO é virtualizado, e isso é decisão medida contra a lei nº 2, não
 * esquecimento: a lei existe porque retrofitar virtualização é reescrever a
 * tela. O que torna o retrofit barato aqui é a FORMA — a lista renderiza IDs e
 * cada item assina a própria entidade, que é exatamente a forma que um
 * `useVirtualizer` consome. Trocar o `.map()` por `getVirtualItems()` não toca
 * no `ItemDeServidor`.
 *
 * O gatilho para fazer a troca está escrito em `enforcement.md`: acima de ~200
 * servidores. Abaixo disso, o custo de montagem é menor que o do virtualizador.
 */
export function Rail() {
  const ids = useServerIds();
  const ativo = useServidorAtivo();

  return (
    <nav className={css.rail} aria-label="Servidores">
      {ids.length === 0 ? (
        <p className={css.vazio}>sem servidores</p>
      ) : (
        <div className={css.lista}>
          {ids.map((id) => (
            <ItemDeServidor key={id} id={id} ativo={id === ativo} />
          ))}
        </div>
      )}
    </nav>
  );
}
