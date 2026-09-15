import type { ReactNode } from "react";

import { EyeSlash } from "../components/ui/icones";
import { chaveDeMembro } from "../sdk/domain";
import { usuarioLocalId } from "../sdk/adapter";
import { precisaVerificar, revelar } from "../store/filtroDeMidia";
import {
  useChannel,
  useMembro,
  useMessage,
  usePoliticaDeMidia,
  useRevelado,
} from "../store/hooks";
import css from "./MidiaFiltrada.module.css";

/**
 * A mídia passando pelo filtro de mídia explícita do servidor.
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
 * Assina cinco stores, mas só em linhas com mídia — que são poucas — e cada um
 * muda por ação humana (política, cargo, clique em mostrar), nunca por
 * presença ou digitação.
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

  const velada =
    serverId !== "" &&
    !revelado &&
    precisaVerificar(politica, membro?.cargosIds, autor === usuarioLocalId());

  if (!velada) return <>{children}</>;

  return (
    <button type="button" className={css.veu} onClick={() => revelar(anexoId)}>
      <EyeSlash aria-hidden />
      <span className={css.titulo}>Mídia não verificada</span>
      <span className={css.detalhe}>
        Este servidor filtra mídia explícita · mostrar
      </span>
    </button>
  );
}
