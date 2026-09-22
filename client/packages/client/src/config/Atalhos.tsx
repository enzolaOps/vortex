import { useMemo, useState } from "react";

import { Combinacao } from "../components/ui/Tecla";
import { casa } from "../atalhos/busca";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { MagnifyingGlass } from "../components/ui/icones";
import {
  GRUPOS_DA_PAGINA,
  linhasDaPagina,
} from "../atalhos/registro";
import { atalho } from "../lib/plataforma";
import { classes as pg, PaginaDeAjustes } from "./Pagina";
import css from "./Atalhos.module.css";

/**
 * Atalhos de teclado.
 *
 * ⚠ **A tabela desta tela era TEXTO, e a auditoria mediu o custo disso:**
 * vinte e quatro combinações escritas, uma funcionando. Agora as linhas são
 * DERIVADAS de `atalhos/registro.ts`, onde o tipo exige um handler por
 * entrada — anunciar um atalho que não faz nada deixou de ser representável.
 * A página não pode mais divergir do que o app escuta, porque é a mesma lista.
 *
 * ⚠ **Sem o teto de 840**, ao contrário das outras páginas de preferência. Ela
 * é uma grade que se reflui sozinha (`auto-fit`, mínimo 330), e o teto deixaria
 * duas colunas onde cabem três — com metade da tela vazia. O teto serve à
 * LEITURA em linha; isto é varredura: a pessoa está procurando uma tecla, não
 * lendo um texto.
 *
 * ⚠ **Esta é uma tela de REFERÊNCIA, não de configuração**, e é o que a
 * referência desenha: sem botão de editar, sem gravador. Remapear é trabalho de
 * verdade — precisa de um gravador de combinação, detecção de conflito e um
 * store persistido — e um botão "Editar" inerte em trinta linhas seria o
 * defeito que o lint de `onSelect` foi instalado para matar, multiplicado por
 * trinta. Os globais têm o botão porque a tabela deles depende do Electron
 * inteiro, e ali o registro de pendências responde por um.
 *
 * A ordem dos grupos é a de quem procura: navegação primeiro, porque é o que
 * se aprende no primeiro dia.
 */

export function Atalhos() {
  const [busca, setBusca] = useState("");

  /*
    As linhas são estáveis: o registro é module-level e os atalhos de voz vêm
    do store de preferências, lido uma vez na montagem desta página. Recalcular
    a cada tecla varreria trinta entradas — barato, mas o `useMemo` aqui é
    sobre o registro, não sobre a busca.
  */
  const todas = useMemo(() => linhasDaPagina(), []);

  const visiveis = todas.filter((l) => casa(l, busca));

  /* Grupo sem item SOME — é a regra do design, e é o que faz a busca parecer
     um filtro em vez de um realce. */
  const grupos = GRUPOS_DA_PAGINA.filter((g) =>
    visiveis.some((l) => l.grupo === g),
  );

  return (
    <PaginaDeAjustes cheia>
      <div className={css.barraDeBusca}>
        <MagnifyingGlass aria-hidden className={css.lupa} />
        <input
          className={css.campoDeBusca}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar atalho"
          aria-label="Buscar atalho"
          type="search"
        />
      </div>

      {grupos.length === 0 ? (
        <EstadoVazio
          icone={<MagnifyingGlass aria-hidden />}
          titulo={`Nenhum atalho corresponde a "${busca}"`}
          /* A tecla do exemplo sai da PLATAFORMA: um texto de ajuda que
             ensina `⌘K` a quem usa Windows ensina o atalho errado, que é
             exatamente o que `lib/plataforma.ts` existe para impedir. */
          detalhe={`Busque por ação ("responder") ou por tecla ("${atalho({ mod: true, tecla: "K" })}").`}
        />
      ) : (
        <div className={css.grade}>
          {grupos.map((g) => (
            <section key={g}>
              <h2 className={css.tituloDoGrupo}>{g}</h2>
              <div className={css.cartao}>
                {visiveis
                  .filter((l) => l.grupo === g)
                  .map((l) => (
                    <div key={l.id} className={css.linha}>
                      <span className={css.acao}>{l.rotulo}</span>
                      <Combinacao teclas={l.teclas} />
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className={pg.recado}>
        As teclas aparecem como a sua plataforma as chama. Atalhos que valem com
        o app em segundo plano ficam em Voz e vídeo — esses dependem do
        aplicativo de desktop, porque o navegador não vê tecla fora da aba.
      </p>
    </PaginaDeAjustes>
  );
}
