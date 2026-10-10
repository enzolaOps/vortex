import { useChannel } from "nucleo/store/hooks";

import { chat } from "../../textos";
import { Cadeado, Canal } from "../../ui/icones";
import { AreaDeChat } from "./AreaDeChat";
import css from "./CabecalhoDoCanal.module.css";

/**
 * O cabeçalho de um canal de servidor: ícone, nome, cadeado quando o canal é
 * restrito e o tópico (se houver). Assina SÓ o canal aberto, por ID.
 *
 * Não tem ações: busca e fixados ainda não têm superfície, e botão sem destino
 * é o defeito que o app evita. Cada ação entra aqui quando o destino existir.
 * A conversa direta e o grupo têm cabeçalho próprio (`AreaDaDm`).
 */
export function CabecalhoDoCanal({ canalId }: { canalId: string }) {
  const canal = useChannel(canalId);
  if (!canal) return null;
  return (
    <header className={css.cabeca} aria-label={chat.cabecalho.rotulo}>
      <h2 className={css.nome}>
        <Canal className={css.icone} aria-hidden="true" />
        <span className={css.texto}>{canal.name}</span>
        {canal.privado && (
          <span className={css.cadeado} role="img" aria-label={chat.cabecalho.restrito} title={chat.cabecalho.restrito}>
            <Cadeado aria-hidden="true" />
          </span>
        )}
      </h2>
      {canal.topico !== undefined && canal.topico.trim() !== "" && (
        <p className={css.topico} title={canal.topico}>
          {canal.topico}
        </p>
      )}
    </header>
  );
}

/** O canal de servidor aberto: cabeçalho em cima e o chat (lista + composer) tomando o resto. */
export function AreaDoCanal({ canalId, servidorId }: { canalId: string; servidorId: string }) {
  return (
    <div className={css.canal}>
      <CabecalhoDoCanal canalId={canalId} />
      <div className={css.chat}>
        <AreaDeChat canalId={canalId} servidorId={servidorId} />
      </div>
    </div>
  );
}
