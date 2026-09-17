import { useSyncExternalStore, type ReactNode } from "react";

import { chaveDeMembro } from "../sdk/domain";
import { usuarioLocalId } from "../sdk/adapter";
import {
  precisaVerificar,
  revelar,
  veladaPeloFiltroPessoal,
} from "../store/filtroDeMidia";
import {
  assinarPrivacidadeDoServidor,
  lerPrivacidadeDoServidor,
} from "../store/privacidadeDoServidor";
import {
  useChannel,
  useEhAmigo,
  useMembro,
  useMessage,
  usePoliticaDeMidia,
  useRevelado,
} from "../store/hooks";
import css from "./MidiaFiltrada.module.css";

/**
 * A mídia passando pelos DOIS filtros de mídia explícita: a política do
 * servidor (quem administra) e a escolha pessoal de privacidade neste servidor
 * (`store/privacidadeDoServidor.ts`). Qualquer um dos dois vela.
 *
 * ⚠ **O véu ocupa a CAIXA JÁ RESERVADA, e não acrescenta nada.** A proporção
 * vem do metadata do anexo e é o pai (`.midia`) quem a aplica; trocar a
 * imagem pelo véu, e o véu pela imagem, não muda a altura da linha — numa
 * lista ancorada, uma linha que muda de altura ao revelar empurraria o que a
 * pessoa está lendo.
 *
 * A imagem velada NÃO é carregada: quem escolheu não ver não deveria pagar o
 * download, e o navegador não deveria ter o arquivo em cache.
 *
 * ⚠ **Cobre em vez de borrar, e é o design:** o véu dele é `surface.sunken` a
 * 92% sobre o xadrez de placeholder — a 92% um `blur()` embaixo não se vê, e
 * borrar exigiria baixar justamente a imagem que a política mandou esconder.
 * Os textos e a amostra são os de `PrivacidadeDoServidor`, a mesma prévia.
 *
 * Assina sete stores, mas só em linhas com mídia — que são poucas — e cada um
 * muda por ação humana (política, cargo, privacidade, amizade, clique em
 * mostrar), nunca por presença ou digitação: a amizade vem por `useEhAmigo`,
 * que é booleano justamente para a presença do autor não acordar a mídia.
 */
export function MidiaFiltrada({
  messageId,
  anexoId,
  children,
}: {
  messageId: string;
  anexoId: string;
  children: ReactNode;
}) {
  const mensagem = useMessage(messageId);
  const serverId = useChannel(mensagem?.channelId ?? "")?.serverId ?? "";
  const politica = usePoliticaDeMidia(serverId);
  const autor = mensagem?.authorId ?? "";
  const membro = useMembro(chaveDeMembro(serverId, autor));
  const revelado = useRevelado(anexoId);
  const autorEhAmigo = useEhAmigo(autor);
  // String por valor: trocar a privacidade de OUTRO servidor não acorda esta.
  const filtroPessoal = useSyncExternalStore(assinarPrivacidadeDoServidor, () =>
    lerPrivacidadeDoServidor(serverId).filtro,
  );
  const autorEhVoce = autor === usuarioLocalId();

  const velada =
    serverId !== "" &&
    !revelado &&
    (precisaVerificar(politica, membro?.cargosIds, autorEhVoce) ||
      veladaPeloFiltroPessoal(filtroPessoal, autorEhAmigo, autorEhVoce));

  if (!velada) return <>{children}</>;

  return (
    <button
      type="button"
      className={css.veu}
      aria-label="Conteúdo sensível — revelar"
      onClick={() => revelar(anexoId)}
    >
      <span className={css.titulo}>Conteúdo sensível</span>
      <span className={css.detalhe}>clique para revelar</span>
    </button>
  );
}
