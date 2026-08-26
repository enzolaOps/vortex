import { Check, Hash, SpeakerHigh } from "@phosphor-icons/react";
import { memo } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";
import { contagem, rotuloDeNaoLidas } from "../lib/plural";
import { marcarCanalLido } from "../sdk/adapter";
import type { CanalTipo } from "../sdk/domain";
import {
  useCanaisDeTexto,
  useCanaisDeVoz,
  useCanalAtivo,
  useChannel,
  useServer,
  useServidorAtivo,
} from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import css from "./ListaDeCanais.module.css";

const ROTULO_DE_SECAO: Record<CanalTipo, string> = {
  texto: "canais de texto",
  voz: "canais de voz",
};

/**
 * Um canal. Assina a si mesmo.
 *
 * `memo` corta a cascata: mensagem nova num canal qualquer republica a
 * contagem daquele canal e mais nada. Sem isto, a lista inteira re-renderizaria
 * a cada mensagem de cada canal — e num servidor movimentado isso é constante.
 */
const Canal = memo(function Canal({ id, ativo }: { id: string; ativo: boolean }) {
  const canal = useChannel(id);

  if (!canal) {
    return <span className={css.canal} aria-hidden />;
  }

  const temNaoLidas = canal.naoLidas > 0;
  const Icone = canal.tipo === "voz" ? SpeakerHigh : Hash;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className={css.canal}
          aria-current={ativo}
          data-naolidas={temNaoLidas}
          onClick={() => selecionarCanal(id)}
        >
          {/* Ícones Phosphor, weight regular, 20px — um set só, sem exceção. */}
          <Icone size={20} className={css.icone} aria-hidden />
          <span className={css.nome}>{canal.name}</span>

          {canal.mencoes > 0 ? (
            <span className={css.contador}>{contagem(canal.mencoes)}</span>
          ) : temNaoLidas ? (
            <span className={css.ponto} aria-hidden />
          ) : null}

          {/*
            O ponto é decoração; o dado é este texto.

            Peso da fonte e um círculo de 8px não existem para leitor de tela,
            e "não lido" é justamente o estado que decide onde a pessoa clica.
          */}
        {temNaoLidas ? (
          <span className="sr-only">
            {rotuloDeNaoLidas(canal.naoLidas, canal.mencoes)}
          </span>
        ) : null}
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => marcarCanalLido(id)}
          disabled={!temNaoLidas}
        >
          <Check size={20} aria-hidden />
          Marcar como lida
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

/**
 * A lista de canais do servidor ativo.
 *
 * A separação texto/voz é derivada do tipo do canal, não das CATEGORIAS do
 * servidor — o protocolo tem categorias (`server.categories`) e elas são
 * pendência listada, não esquecimento: exigem ordem própria, colapso
 * persistido e arrastar-e-soltar, e nenhum dos três é o que esta coluna
 * precisa provar agora.
 *
 * Como o rail: renderiza IDs, cada linha assina a própria entidade. É a forma
 * que um `useVirtualizer` consome, e o que mantém o retrofit barato quando um
 * servidor com 400 canais aparecer.
 */
export function ListaDeCanais() {
  const serverId = useServidorAtivo();
  const servidor = useServer(serverId);
  const texto = useCanaisDeTexto(serverId);
  const voz = useCanaisDeVoz(serverId);
  const canalAtivo = useCanalAtivo();

  // Já vêm separados do adapter — a coluna não parte nada no render, porque
  // partir exigiria ler o tipo de canais que ela não assina.
  const secoes = { texto, voz };
  const vazio = texto.length === 0 && voz.length === 0;

  if (!serverId) {
    return (
      <div className={css.painel}>
        <p className={css.vazio}>escolha um servidor</p>
      </div>
    );
  }

  return (
    <div className={css.painel}>
      <header className={css.cabecalho}>
        <span>{servidor?.name ?? "…"}</span>
      </header>

      <div className={css.rolagem}>
        {vazio ? (
          <p className={css.vazio}>este servidor não tem canais</p>
        ) : (
          <nav aria-label="Canais">
            {(["texto", "voz"] as const).map((tipo) =>
              secoes[tipo].length === 0 ? null : (
                <div key={tipo}>
                  <h2 className={css.secao}>{ROTULO_DE_SECAO[tipo]}</h2>
                  {secoes[tipo].map((id) => (
                    <Canal key={id} id={id} ativo={id === canalAtivo} />
                  ))}
                </div>
              ),
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
