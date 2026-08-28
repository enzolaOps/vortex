import { GearSix, House, Plus } from "@phosphor-icons/react";
import { memo } from "react";

import { Lamina } from "../components/ui/Lamina";
import { Tooltip } from "../components/ui/Tooltip";
import { contagem, rotuloDeNaoLidas } from "../lib/plural";
import {
  useLocal,
  useServer,
  useServerIds,
  useServidorAtivo,
} from "../store/hooks";
import { abrirConfig } from "../store/config";
import { abrirModal } from "../store/modais";
import { irParaCasa, selecionarServidor } from "../store/navegacao";
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
      `fim`, não `right`.

      O Radix só fala `side` físico, e por isso este componente carregava um
      `lado="right"` com uma nota dizendo que a colisão automática cobria o
      caso real. Cobria — mas a premissa de lado ficava escrita aqui, que é o
      que a lei nº 6 proíbe. O mapeamento lógico→físico agora vive no wrapper,
      lê a direção real do documento, e o rail volta a não saber de que lado
      da tela ele está.
    */
    <Tooltip texto={servidor.name} lado="fim">
      <button
        type="button"
        className={css.item}
        aria-current={ativo}
        aria-label={servidor.name}
        data-naolidas={temNaoLidas}
        onClick={() => selecionarServidor(id)}
      >
        {/*
          A lâmina é decorativa: `aria-current` já diz qual está aberto, e a
          contagem tem texto próprio. Ela substituiu uma pílula reta — que é o
          indicador de todo cliente de chat e não é de ninguém.

          A escala é a MESMA da lista de canais, e agora carrega não-lida aqui
          também. `data-naolidas` era escrito neste botão e nenhuma regra o
          lia: não-lida de SERVIDOR era invisível, e o rail é justamente onde
          ela mais importa — é a coluna que responde "para onde eu vou agora"
          sem abrir nada.
        */}
        <Lamina
          estado={ativo ? "ativa" : temNaoLidas ? "atencao" : "repouso"}
          className={css.lamina}
        />

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
  const local = useLocal();
  const naCasa = local.tipo === "casa" || local.tipo === "amigos" || local.tipo === "dm";

  return (
    <nav className={css.rail} aria-label="Servidores">
      {/*
        A casa, e ela é a primeira coisa do rail por um motivo estrutural: sem
        este botão, DM, grupo e amigos não têm por onde ser alcançados. O rail
        listava SÓ servidores, e essa ausência derrubava quatro superfícies de
        uma vez — foi assim que o mapa de superfícies a classificou.
      */}
      <Tooltip texto="Conversas" lado="fim">
        <button
          type="button"
          className={css.item}
          aria-current={naCasa}
          aria-label="Conversas"
          onClick={irParaCasa}
        >
          <Lamina estado={naCasa ? "ativa" : "repouso"} className={css.lamina} />
          <span className={css.marca} aria-hidden>
            {/* `fill` só no ativo: é a variação SEMÂNTICA do Phosphor, não
                decorativa — a mesma regra do resto do app. */}
            <House size={22} weight={naCasa ? "fill" : "regular"} />
          </span>
          <span className={css.nome}>Conversas</span>
        </button>
      </Tooltip>

      {ids.length === 0 ? (
        <p className={css.vazio}>sem servidores</p>
      ) : (
        <div className={css.lista}>
          {ids.map((id) => (
            <ItemDeServidor key={id} id={id} ativo={id === ativo} />
          ))}
        </div>
      )}

      {/*
        O `+`, e ele é o único ponto de entrada para criar OU entrar num
        servidor. Sem ele, as duas coisas não têm por onde acontecer — foi
        assim que o mapa de superfícies classificou a ausência.
      */}
      {/*
        Configurações, no rodapé do rail.

        Aqui e não num menu de usuário porque o rail é a única coluna sempre
        visível — e porque até agora a única entrada para o picker de paleta e o
        modo de edição era o cabeçalho do ARNÊS, que não existe no produto.
      */}
      <Tooltip texto="Configurações" lado="fim">
        <button
          type="button"
          className={css.item}
          aria-label="Configurações"
          onClick={() => abrirConfig("perfil")}
        >
          <span className={css.marca} aria-hidden>
            <GearSix size={20} />
          </span>
          <span className={css.nome}>Configurações</span>
        </button>
      </Tooltip>

      <Tooltip texto="Adicionar servidor" lado="fim">
        <button
          type="button"
          className={css.item}
          aria-label="Adicionar servidor"
          onClick={() => abrirModal("adicionarServidor")}
        >
          <span className={css.marca} aria-hidden>
            <Plus size={20} />
          </span>
          <span className={css.nome}>Adicionar</span>
        </button>
      </Tooltip>
    </nav>
  );
}
