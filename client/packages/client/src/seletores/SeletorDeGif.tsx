import { Star } from "../components/ui/icones";
import { useState } from "react";

import { aindaNao } from "../pendente/pendencias";
import { CascaDeSeletor } from "./CascaDeSeletor";
import css from "./Seletores.module.css";

/**
 * As categorias que o design desenha na tira acima do grid.
 *
 * Rótulos de PRODUTO, não do provedor: "Deu ruim" é como se procura um GIF
 * numa conversa de trabalho, e nenhuma API de GIF tem uma categoria com esse
 * nome. Quando o provedor entrar, cada uma vira uma consulta.
 */
const CATEGORIAS = ["Em alta", "Reações", "Comemoração", "Deu ruim"] as const;

/**
 * As proporções do design, na ordem do design.
 *
 * O masonry existe porque a altura varia — e é isso que estes números
 * exercitam. Uma grade de placeholders todos iguais provaria o layout errado:
 * o `columns` do CSS só se distingue de um grid quando os itens têm alturas
 * diferentes.
 */
const AMOSTRAS = [
  { id: "a", rotulo: "gif 16:9", altura: 118 },
  { id: "b", rotulo: "gif 4:5", altura: 172 },
  { id: "c", rotulo: "gif 1:1", altura: 142 },
  { id: "d", rotulo: "gif 16:9", altura: 104 },
  { id: "e", rotulo: "gif 3:4", altura: 160 },
] as const;

/**
 * O seletor de GIF.
 *
 * ⚠ **É o único dos quatro que depende de REDE EXTERNA**, e por isso o mais
 * distante de funcionar: um provedor (Tenor, Giphy) significa uma chave de
 * API, um domínio a mais na CSP e a URL de cada busca saindo da máquina de
 * quem usa. Numa instância privada isso é uma decisão de produto, não uma
 * integração.
 *
 * O que está construído é a casca inteira, com a física certa: masonry em
 * `columns` porque as alturas variam — o próprio design explica que emoji e
 * figurinha usam grid fixo "para o alvo ser previsível" e o GIF não pode.
 */
export function SeletorDeGif() {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);

  return (
    <CascaDeSeletor
      rotulo="GIF"
      busca={{ valor: busca, aoMudar: setBusca, placeholder: "Buscar GIF" }}
      acaoDaBusca={
        <button
          type="button"
          className={css.acaoQuadrada}
          aria-label="Favoritos"
          onClick={aindaNao("gif")}
        >
          <Star aria-hidden />
        </button>
      }
      rodape={
        <span className={css.previaOrigem}>
          Enter envia direto · shift+clique só insere no composer
        </span>
      }
    >
      <div className={css.tiras}>
        {CATEGORIAS.map((c) => (
          <button
            key={c}
            type="button"
            className={css.tira}
            aria-pressed={c === categoria}
            onClick={() => setCategoria(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className={css.masonry}>
        {AMOSTRAS.map((a) => (
          <button
            /*
              ⚠ Cada amostra tem `id` PRÓPRIO, e não é preciosismo: duas delas
              têm o mesmo rótulo ("gif 16:9"), então usar o rótulo como chave
              daria colisão — e o lint do projeto proíbe o índice, que era a
              saída fácil. A regra existe porque índice corrompe o estado da
              linha, e aqui o que virá são GIFs de verdade, que reordenam a
              cada busca.
            */
            key={a.id}
            type="button"
            className={css.gif}
            style={{ blockSize: `${a.altura}px` }}
            onClick={aindaNao("gif")}
          >
            <span className={css.gifRotulo}>{a.rotulo}</span>
          </button>
        ))}
      </div>
    </CascaDeSeletor>
  );
}
