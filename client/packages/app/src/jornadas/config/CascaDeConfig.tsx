import {
  abrirConfig,
  assinarConfig,
  fecharConfig,
  lerConfig,
} from "nucleo/store/config";
import { useServer, useServidorAtivo } from "nucleo/store/hooks";
import { assinarMeuStatus, lerMeuStatus } from "nucleo/store/meuStatus";
import { lerMeuPerfil } from "nucleo/sdk/perfil";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { admin, config } from "../../textos";
import { Avatar } from "../../ui/ds";
import { LimiteDeErro } from "../../shell/LimiteDeErro";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import { Banimentos } from "../admin/Banimentos";
import { Canais } from "../admin/Canais";
import { Cargos } from "../admin/Cargos";
import { Convites } from "../admin/Convites";
import { Membros } from "../admin/Membros";
import {
  GRUPOS_DO_SERVIDOR,
  NOME_DA_SECAO_DE_SERVIDOR,
  podeAbrirSecao,
  secaoDeServidor,
  secoesPermitidas,
  SUBTITULO_DA_SECAO_DE_SERVIDOR,
  type SecaoDeServidor,
} from "../admin/secoes";
import { VisaoGeral } from "../admin/VisaoGeral";
import { Confirmacao } from "../admin/Confirmacao";
import { encerrarSessao } from "../sessao/encerrar";
import { Aparencia } from "./Aparencia";
import css from "./Casca.module.css";
import { Conta } from "./Conta";
import { Dispositivos } from "./Dispositivos";
import { Notificacoes } from "./Notificacoes";
import { Perfil } from "./Perfil";
import { assinarPerfilMudou, lerRevisaoDoPerfil } from "./perfilMudou";
import {
  GRUPOS_DA_NAVEGACAO,
  NOME_DA_SECAO,
  SUBTITULO_DA_SECAO,
  secaoEssencial,
  type SecaoEssencial,
} from "./secoes";
import { VozEVideo } from "./VozEVideo";

/** O conteúdo de cada seção. `Record` exaustivo: seção nova não compila sem tela. */
const CONTEUDO: Record<SecaoEssencial, () => ReactNode> = {
  perfil: () => <Perfil />,
  conta: () => <Conta />,
  sessoes: () => <Dispositivos />,
  vozEVideo: () => <VozEVideo />,
  notificacoes: () => <Notificacoes />,
  aparencia: () => <Aparencia />,
};

/** O conteúdo de cada seção de administração. `Record` exaustivo, como o de cima. */
const CONTEUDO_DO_SERVIDOR: Record<
  SecaoDeServidor,
  (serverId: string) => ReactNode
> = {
  servidor: (s) => <VisaoGeral serverId={s} />,
  canais: (s) => <Canais serverId={s} />,
  convites: (s) => <Convites serverId={s} />,
  cargos: (s) => <Cargos serverId={s} />,
  membros: (s) => <Membros serverId={s} />,
  banimentos: (s) => <Banimentos serverId={s} />,
};

/** Qual servidor se administra: o da URL ou, sem ele, o que está aberto. */
function servidorDaAdministracao(
  doEndereco: string | undefined,
  ativo: string,
): string {
  return doEndereco ?? ativo;
}

/** O servidor, no alto da navegação de administração. */
function IdentidadeDoServidor({ serverId }: { serverId: string }) {
  const servidor = useServer(serverId);
  if (!servidor) return null;
  return (
    <div className={css.identidade}>
      <Avatar
        nome={servidor.name}
        id={serverId}
        tamanho={36}
        imagem={servidor.avatarUrl}
      />
      <div className={css.identidadeTextos}>
        <span className={css.identidadeNome}>{servidor.name}</span>
        <span className={css.identidadeUsuario}>{admin.servidor}</span>
      </div>
    </div>
  );
}

/** Quem sou eu, no alto da navegação. */
function Identidade() {
  // O nome muda ao salvar o perfil; sem assinar, a navegação só atualizaria na próxima abertura.
  useSyncExternalStore(assinarPerfilMudou, lerRevisaoDoPerfil);
  const eu = lerMeuPerfil();
  const status = useSyncExternalStore(assinarMeuStatus, lerMeuStatus);
  if (!eu) return null;
  const presenca =
    status.presenca === "invisivel" ? "offline" : status.presenca;
  return (
    <div className={css.identidade}>
      <Avatar
        nome={eu.displayName}
        id={eu.username}
        tamanho={36}
        imagem={eu.avatarUrl}
        status={presenca}
      />
      <div className={css.identidadeTextos}>
        <span className={css.identidadeNome}>{eu.displayName}</span>
        <span className={css.identidadeUsuario}>@{eu.username}</span>
      </div>
    </div>
  );
}

/**
 * As configurações como ROTA, por cima do shell (nunca no lugar dele).
 *
 * Substituir o shell desmontaria a lista de mensagens com tudo o que ela mediu
 * e ancorou; aqui o shell continua montado por baixo, e fechar devolve a pessoa
 * exatamente onde estava. O Dialogo traz foco preso, Esc e devolução do foco; o
 * dono do estado é o store de configurações, que a URL espelha.
 *
 * Duas famílias de seção na mesma casca: as pessoais (perfil, conta…) e as de
 * administração de UM servidor (PRD 4.7), que carregam o servidor na URL e só
 * mostram o que a pessoa pode usar.
 */
export function CascaDeConfig() {
  const [saindo, setSaindo] = useState(false);
  const aberta = useSyncExternalStore(assinarConfig, lerConfig);
  const ativo = useServidorAtivo();
  const aberto = aberta.secao !== null;
  const secaoPessoal = secaoEssencial(aberta.secao);
  const serverId = servidorDaAdministracao(aberta.serverId, ativo);
  const secaoPedida = secaoDeServidor(aberta.secao);
  const permitidas = serverId === "" ? [] : secoesPermitidas(serverId);
  // Seção de servidor sem permissão cai na primeira que a pessoa pode usar.
  const secaoAdmin =
    secaoPedida === undefined
      ? undefined
      : podeAbrirSecao(serverId, secaoPedida)
        ? secaoPedida
        : permitidas[0];
  const secao = secaoPessoal ?? secaoAdmin;

  /*
    O endereço acompanha o que está na tela: seção que não é desta jornada (ou administração
    sem acesso nenhum) cai no perfil; seção proibida cai na primeira permitida; e o endereço
    sem servidor (/config/canais) ganha o servidor aberto, para o link ser completo.
  */
  useEffect(() => {
    if (!aberto) return;
    if (secao === undefined) abrirConfig("perfil");
    else if (secaoPedida !== undefined && secaoAdmin !== secaoPedida)
      abrirConfig(secaoAdmin ?? "perfil", serverId);
    else if (
      secaoAdmin !== undefined &&
      aberta.serverId === undefined &&
      serverId !== ""
    )
      abrirConfig(secaoAdmin, serverId);
  }, [aberto, secao, secaoPedida, secaoAdmin, aberta.serverId, serverId]);

  return (
    <Dialogo
      open={aberto && secao !== undefined}
      onOpenChange={(a) => {
        if (!a) fecharConfig();
      }}
    >
      <ConteudoDoDialogo
        titulo={config.titulo}
        tituloOculto
        className={css.casca}
        onOpenAutoFocus={(e) => {
          // O foco nasce no item da seção atual, e não no primeiro da lista.
          e.preventDefault();
          document
            .querySelector<HTMLElement>(`nav[aria-label] [aria-current="page"]`)
            ?.focus();
        }}
      >
        {secaoPessoal !== undefined && (
          <>
            <nav className={css.navegacao} aria-label={config.navegacao}>
              <Identidade />
              {GRUPOS_DA_NAVEGACAO.map((g) => (
                <div key={g.titulo} className={css.grupo}>
                  <p className={css.tituloDoGrupo}>{g.titulo}</p>
                  {g.itens.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={css.item}
                      aria-current={s === secaoPessoal ? "page" : undefined}
                      onClick={() => {
                        abrirConfig(s);
                      }}
                    >
                      {NOME_DA_SECAO[s]}
                    </button>
                  ))}
                </div>
              ))}
              <button
                type="button"
                className={`${css.item} ${css.sair}`}
                onClick={() => {
                  setSaindo(true);
                }}
              >
                {config.sair}
              </button>
              <Confirmacao
                aberto={saindo}
                aoMudar={setSaindo}
                titulo={config.sairTitulo}
                texto={config.sairTexto}
                confirmar={config.sair}
                aoConfirmar={async () => {
                  await encerrarSessao();
                  return true;
                }}
              />
            </nav>
            <section
              className={css.painel}
              aria-label={NOME_DA_SECAO[secaoPessoal]}
            >
              <header className={css.cabecalho}>
                <h2 className={css.tituloDaPagina}>
                  {NOME_DA_SECAO[secaoPessoal]}
                </h2>
                <p className={css.subtituloDaPagina}>
                  {SUBTITULO_DA_SECAO[secaoPessoal]}
                </p>
              </header>
              <div className={css.corpo} tabIndex={-1}>
                <LimiteDeErro chave={secaoPessoal}>{CONTEUDO[secaoPessoal]()}</LimiteDeErro>
              </div>
            </section>
          </>
        )}
        {secaoAdmin !== undefined && (
          <>
            <nav className={css.navegacao} aria-label={admin.navegacao.rotulo}>
              <IdentidadeDoServidor serverId={serverId} />
              {GRUPOS_DO_SERVIDOR.map((g) => {
                const itens = g.itens.filter((s) => permitidas.includes(s));
                if (itens.length === 0) return null;
                return (
                  <div key={g.titulo} className={css.grupo}>
                    <p className={css.tituloDoGrupo}>{g.titulo}</p>
                    {itens.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={css.item}
                        aria-current={s === secaoAdmin ? "page" : undefined}
                        onClick={() => {
                          abrirConfig(s, serverId);
                        }}
                      >
                        {NOME_DA_SECAO_DE_SERVIDOR[s]}
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>
            <section
              className={css.painel}
              aria-label={NOME_DA_SECAO_DE_SERVIDOR[secaoAdmin]}
            >
              <header className={css.cabecalho}>
                <h2 className={css.tituloDaPagina}>
                  {NOME_DA_SECAO_DE_SERVIDOR[secaoAdmin]}
                </h2>
                <p className={css.subtituloDaPagina}>
                  {SUBTITULO_DA_SECAO_DE_SERVIDOR[secaoAdmin]}
                </p>
              </header>
              <div className={css.corpo} tabIndex={-1}>
                <LimiteDeErro chave={`${serverId}:${secaoAdmin}`}>{CONTEUDO_DO_SERVIDOR[secaoAdmin](serverId)}</LimiteDeErro>
              </div>
            </section>
          </>
        )}
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
