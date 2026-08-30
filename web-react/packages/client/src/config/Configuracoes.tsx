import { X } from "@phosphor-icons/react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { Tooltip } from "../components/ui/Tooltip";
import {
  abrirConfig,
  assinarConfig,
  DE_SERVIDOR,
  NOME_DA_SECAO as NOME,
  fecharConfig,
  lerConfig,
  type SecaoId,
} from "../store/config";
import { useChannel, useServer, useServidorAtivo } from "../store/hooks";
import { Aparencia } from "./Aparencia";
import { Banimentos } from "./Banimentos";
import { Cargos } from "./Cargos";
import { Conta } from "./Conta";
import { Convites } from "./Convites";
import { Emojis } from "./Emojis";
import { Perfil } from "./Perfil";
import { Servidor } from "./Servidor";
import { Sessoes } from "./Sessoes";
import { ConvitesDoCanal } from "./canal/ConvitesDoCanal";
import { NavegacaoDoCanal } from "./canal/NavegacaoDoCanal";
import { PermissoesDoCanal } from "./canal/PermissoesDoCanal";
import { VisaoGeralDoCanal } from "./canal/VisaoGeralDoCanal";
import css from "./Configuracoes.module.css";

/**
 * A casca de configurações.
 *
 * ⚠ **Rota e não modal, e SOBRE o shell e não no lugar dele.** As duas
 * decisões estão em `store/config.ts` com a razão. A consequência visível aqui
 * é que a lista de mensagens continua montada atrás — abrir "Aparência" não
 * pode custar a remontagem de dez mil linhas medidas.
 *
 * ⚠ **Duas destas seções já existiam e não sabiam disso:** "Aparência" é o
 * `PickerDePaleta` e o modo de edição que a fase 4 construiu, e que até agora
 * só tinham entrada pelo cabeçalho do ARNÊS. O plano de paridade previu isso —
 * a contagem de 42 páginas do upstream é maior que o trabalho real.
 */

/** O rótulo de cada seção. `Record` fechado: seção nova não compila sem nome. */


const DE_USUARIO: readonly SecaoId[] = ["perfil", "conta", "sessoes", "aparencia"];

function ItemDoMenu({
  id,
  ativa,
  serverId,
}: {
  id: SecaoId;
  ativa: boolean;
  serverId?: string;
}) {
  return (
    <button
      type="button"
      className={css.item}
      aria-current={ativa}
      onClick={() => abrirConfig(id, serverId)}
    >
      {NOME[id]}
    </button>
  );
}

export function Configuracoes() {
  const config = useSyncExternalStore(assinarConfig, lerConfig);
  const servidorAtivo = useServidorAtivo();
  const servidor = useServer(config.serverId ?? servidorAtivo);

  /*
    Esc fecha, e o listener vive num efeito porque ele só existe enquanto a tela
    existe — ao contrário do atalho da paleta, que é global e module-level.
  */
  useEffect(() => {
    if (config.secao === null) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") fecharConfig();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [config.secao]);

  /* ANTES do `return null`: hook depois de saída antecipada muda a ordem
     entre renders, e o lint das Rules of React reprova com razão. */
  const channelId = config.channelId ?? "";
  const canal = useChannel(channelId);

  if (config.secao === null) return null;

  const secao = config.secao;
  const serverId = config.serverId ?? servidorAtivo;

  const CONTEUDO: Record<SecaoId, () => ReactNode> = {
    perfil: () => <Perfil />,
    conta: () => <Conta />,
    sessoes: () => <Sessoes />,
    aparencia: () => <Aparencia />,
    servidor: () => <Servidor serverId={serverId} />,
    cargos: () => <Cargos serverId={serverId} />,
    convites: () => <Convites serverId={serverId} />,
    banimentos: () => <Banimentos serverId={serverId} />,
    emojis: () => <Emojis serverId={serverId} />,
    canal: () => <VisaoGeralDoCanal channelId={channelId} />,
    canalPermissoes: () => <PermissoesDoCanal channelId={channelId} />,
    canalConvites: () => <ConvitesDoCanal channelId={channelId} />,
  };

  return (
    <div
      className={css.tela}
      role="dialog"
      aria-modal="true"
      aria-label="Configurações"
    >
      {/*
        ⚠ **As de canal SUBSTITUEM a navegação, não se somam a ela.**

        Eu as tinha pendurado como um terceiro grupo abaixo de "Você" e do
        servidor, e o design não faz isso: `Vortex Configurações do Canal`
        desenha uma casca PRÓPRIA — coluna de 248px com o tipo do canal, o
        breadcrumb do servidor, três itens, "Excluir canal" e o ID no rodapé.
        Somar os três grupos punha a pessoa a um clique de "Dispositivos"
        quando ela abriu as configurações de um canal.
      */}
      {canal ? (
        <NavegacaoDoCanal canal={canal} secao={secao} servidor={servidor?.name} />
      ) : (
      <nav className={css.menu} aria-label="Seções">
        <p className={css.grupo}>Você</p>
        {DE_USUARIO.map((id) => (
          <ItemDoMenu key={id} id={id} ativa={id === secao} />
        ))}

        {/*
          As de servidor só aparecem quando há servidor — e não desabilitadas:
          um menu com metade cinza ensina que existe coisa que você não pode
          usar, ruído permanente para quem só usa conversas.
        */}
        {serverId ? (
          <>
            <p className={css.grupo}>{servidor?.name ?? "Servidor"}</p>
            {DE_SERVIDOR.map((id) => (
              <ItemDoMenu
                key={id}
                id={id}
                ativa={id === secao}
                serverId={serverId}
              />
            ))}
          </>
        ) : null}
      </nav>
      )}

      <div className={css.conteudo}>
        <header className={css.cabecalho}>
          <h1 className={css.titulo}>{NOME[secao]}</h1>
          <Tooltip texto="Fechar (Esc)" lado="inicio">
            <button
              type="button"
              className={css.fechar}
              aria-label="Fechar configurações"
              onClick={fecharConfig}
            >
              <X size={20} aria-hidden />
            </button>
          </Tooltip>
        </header>

        {/* Rolável com foco: ver `MessageList` — rolável sem foco é inoperável
            por teclado. */}
        <div className={css.rolagem} tabIndex={0}>
          {CONTEUDO[secao]()}
        </div>
      </div>
    </div>
  );
}
