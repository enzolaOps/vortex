import { irParaCasa } from "nucleo/store/navegacao";
import { abrirServidor } from "nucleo/store/ultimoLugar";
import {
  useLocal,
  useNaoLidasDeConversas,
  useProntidao,
  useServer,
  useServerIds,
  useServidorAtivo,
} from "nucleo/store/hooks";

import { salas } from "../../textos";
import { ItemDaDock } from "../../ui/ds";
import { Casa } from "../../ui/icones";
import css from "./Salas.module.css";

function ServidorNaDock({ id, selecionado }: { id: string; selecionado: boolean }) {
  const servidor = useServer(id);
  if (!servidor) return null;
  return (
    <ItemDaDock
      nome={servidor.name}
      id={id}
      selecionado={selecionado}
      naoLida={servidor.naoLidas > 0}
      mencoes={servidor.mencoes}
      onClick={() => {
        abrirServidor(id);
      }}
    />
  );
}

/** Esqueleto da dock até o `Ready`: ladrilhos no lugar dos servidores que ainda não chegaram. */
export function EsqueletoDaDock() {
  return (
    <div className={css.esqueletoDaDock} role="status" aria-label={salas.carregandoServidor}>
      <span className={css.bloco} />
      <span className={css.bloco} />
      <span className={css.bloco} />
    </div>
  );
}

/**
 * Início + um destino por servidor. Assina só a lista de IDs e o lugar atual: o
 * ladrilho de cada servidor assina a si mesmo, então uma menção nova toca um
 * ladrilho, não a dock.
 */
export function ConteudoDaDock() {
  const pronto = useProntidao();
  const ids = useServerIds();
  const ativo = useServidorAtivo();
  const local = useLocal();
  const naoLidasDeConversas = useNaoLidasDeConversas();

  if (!pronto) return <EsqueletoDaDock />;
  return (
    <>
      <ItemDaDock
        nome={salas.casa}
        icone={<Casa tamanho={20} />}
        selecionado={local.tipo === "casa" || local.tipo === "amigos" || local.tipo === "dm"}
        naoLida={naoLidasDeConversas > 0}
        onClick={irParaCasa}
      />
      {ids.map((id) => (
        <ServidorNaDock key={id} id={id} selecionado={id === ativo} />
      ))}
    </>
  );
}
