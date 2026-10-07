import { abrirConfig, assinarConfig, fecharConfig, lerConfig } from "nucleo/store/config";
import { assinarMeuStatus, lerMeuStatus } from "nucleo/store/meuStatus";
import { lerMeuPerfil } from "nucleo/sdk/perfil";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { config } from "../../textos";
import { Avatar } from "../../ui/ds";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
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

/** Quem sou eu, no alto da navegação. */
function Identidade() {
  // O nome muda ao salvar o perfil; sem assinar, a navegação só atualizaria na próxima abertura.
  useSyncExternalStore(assinarPerfilMudou, lerRevisaoDoPerfil);
  const eu = lerMeuPerfil();
  const status = useSyncExternalStore(assinarMeuStatus, lerMeuStatus);
  if (!eu) return null;
  const presenca = status.presenca === "invisivel" ? "offline" : status.presenca;
  return (
    <div className={css.identidade}>
      <Avatar nome={eu.displayName} id={eu.username} tamanho={36} status={presenca} />
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
 */
export function CascaDeConfig() {
  const aberta = useSyncExternalStore(assinarConfig, lerConfig);
  const secao = secaoEssencial(aberta.secao);
  const aberto = aberta.secao !== null;

  // Seção que não é desta jornada (URL de administração, por exemplo) cai no perfil.
  useEffect(() => {
    if (aberto && secao === undefined) abrirConfig("perfil");
  }, [aberto, secao]);

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
          document.querySelector<HTMLElement>(`nav[aria-label="${config.navegacao}"] [aria-current="page"]`)?.focus();
        }}
      >
        {secao !== undefined && (
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
                      aria-current={s === secao ? "page" : undefined}
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
                onClick={() => void encerrarSessao()}
              >
                {config.sair}
              </button>
            </nav>
            <section className={css.painel} aria-label={NOME_DA_SECAO[secao]}>
              <header className={css.cabecalho}>
                <h2 className={css.tituloDaPagina}>{NOME_DA_SECAO[secao]}</h2>
                <p className={css.subtituloDaPagina}>{SUBTITULO_DA_SECAO[secao]}</p>
              </header>
              <div className={css.corpo} tabIndex={-1}>
                {CONTEUDO[secao]()}
              </div>
            </section>
          </>
        )}
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
