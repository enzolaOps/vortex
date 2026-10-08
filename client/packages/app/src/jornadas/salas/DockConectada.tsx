import { useState } from "react";
import { abrirConfig } from "nucleo/store/config";
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

import { admin, config, salas } from "../../textos";
import { ItemDaDock } from "../../ui/ds";
import { Casa, Configuracoes, Mais } from "../../ui/icones";
import { CriarServidor } from "../admin/CriarServidor";
import css from "./Salas.module.css";

function ServidorNaDock({
  id,
  selecionado,
}: {
  id: string;
  selecionado: boolean;
}) {
  const servidor = useServer(id);
  if (!servidor) return null;
  return (
    <ItemDaDock
      nome={servidor.name}
      id={id}
      imagem={servidor.avatarUrl}
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
    <div
      className={css.esqueletoDaDock}
      role="status"
      aria-label={salas.carregandoServidor}
    >
      <span className={css.bloco} />
      <span className={css.bloco} />
      <span className={css.bloco} />
    </div>
  );
}

/** O "+" da dock: criar um servidor ou entrar por convite. */
function AdicionarServidor() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <ItemDaDock
        nome={admin.criarServidor.titulo}
        icone={<Mais tamanho={20} />}
        onClick={() => {
          setAberto(true);
        }}
      />
      <CriarServidor aberto={aberto} aoMudar={setAberto} />
    </>
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
        selecionado={
          local.tipo === "casa" ||
          local.tipo === "amigos" ||
          local.tipo === "dm"
        }
        naoLida={naoLidasDeConversas > 0}
        onClick={irParaCasa}
      />
      <div className={css.listaDaDock}>
        {ids.map((id) => (
          <ServidorNaDock key={id} id={id} selecionado={id === ativo} />
        ))}
        <AdicionarServidor />
      </div>
      <div className={css.rodapeDaDock}>
        <ItemDaDock
          nome={config.abrir}
          icone={<Configuracoes tamanho={20} />}
          onClick={() => {
            abrirConfig("perfil");
          }}
        />
      </div>
    </>
  );
}
