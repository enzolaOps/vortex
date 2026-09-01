import {
  ICONE,
  X,
} from "../components/ui/icones";
import {
  Fragment,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { Avatar } from "../components/ui/Avatar";
import { cn } from "../lib/cn";
import { Tooltip } from "../components/ui/Tooltip";
import { sigla } from "../lib/sigla";
import { assinarDesktop, lerDesktop } from "../store/desktop";
import { lerMeuPerfil } from "../sdk/perfil";
import { sair } from "../sdk/autenticacao";
import { assinarSessao, lerSessao } from "../store/sessao";
import {
  abrirConfig,
  assinarConfig,
  GRUPOS_DE_SERVIDOR,
  DESCRICAO_DA_SECAO as DESCRICAO,
  NOME_DA_SECAO as NOME,
  fecharConfig,
  lerConfig,
  type SecaoId,
} from "../store/config";
import { useChannel, useServer, useServidorAtivo } from "../store/hooks";
import { Acesso } from "./Acesso";
import { Aparencia } from "./Aparencia";
import { Atalhos } from "./Atalhos";
import { Avancado } from "./Avancado";
import { Desktop } from "./Desktop";
import { Membros } from "./Membros";
import { Privacidade } from "./Privacidade";
import { Seguranca } from "./Seguranca";
import { VozEVideo } from "./VozEVideo";
import { Notificacoes } from "./Notificacoes";
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


/**
 * A coluna, em DOIS blocos separados por régua — da referência.
 *
 * ⚠ A divisão não é decorativa: o primeiro bloco é a CONTA (quem você é, como
 * entram em contato), o segundo é o APARELHO (como esta máquina se comporta).
 * São duas perguntas diferentes, e a régua diz isso sem precisar de um segundo
 * rótulo — inventar um nome para "Voz e vídeo, Notificações, Aparência,
 * Atalhos" produziria uma categoria que ninguém procura.
 *
 * Notificações vem antes de Aparência, e a ordem é do design: as duas são
 * preferências, mas uma decide o que INTERROMPE e a outra como a tela é
 * pintada. Quem abre configurações por incômodo abre por causa da primeira.
 */
const DE_USUARIO: readonly (readonly SecaoId[])[] = [
  ["perfil", "conta", "sessoes", "privacidade"],
  ["vozEVideo", "notificacoes", "aparencia", "atalhos", "avancado"],
];

/**
 * As que só existem na casca.
 *
 * ⚠ **Fora do menu no navegador, e não desabilitadas.** Uma página de opções
 * que não controlam nada é o defeito que o registro de pendências existe para
 * evitar, e aqui ele seria a página inteira — não um botão. É a mesma regra
 * dos itens de moderação da member list: o que você nunca vai poder usar é
 * ruído permanente.
 */
const SO_NA_CASCA: readonly SecaoId[] = ["desktop"];

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

/**
 * O cartão de identidade no topo da coluna.
 *
 * ⚠ Ele NÃO é um alvo — não abre menu de status nem leva ao perfil. O painel
 * do rodapé da coluna de canais já faz as duas coisas, e um segundo gatilho
 * para o mesmo menu, numa tela que tem "Perfil" como primeiro item da lista
 * logo abaixo, seria dois caminhos disputando o mesmo destino. Aqui ele
 * responde uma pergunta só: em qual conta você está.
 */
function Identidade() {
  /*
    Mesma leitura do `PainelDeUsuario`: o perfil vem do cache do SDK sem
    assinatura (nome de exibição muda uma vez a cada nunca), e o ID vem da
    SESSÃO — `client.user` é `undefined` antes do `Ready`, e esta coluna
    desenha desde a abertura.
  */
  const perfil = lerMeuPerfil();
  const meuId = useSyncExternalStore(assinarSessao, lerSessao).userId ?? "";
  const nome = perfil?.displayName ?? "você";

  return (
    <div className={css.identidade}>
      <Avatar
        id={meuId}
        sigla={perfil ? sigla(nome) : undefined}
        url={perfil?.avatarUrl}
        tamanho="xs"
      />
      <div className={css.identidadeTextos}>
        <div className={css.identidadeNome}>{nome}</div>
        <div className={css.identidadeArroba}>
          {perfil?.username ? `@${perfil.username}` : "sem sessão"}
        </div>
      </div>
    </div>
  );
}

export function Configuracoes() {
  const config = useSyncExternalStore(assinarConfig, lerConfig);
  /* Do snapshot e não de `naDesktop()` — ver `store/desktop.ts`. */
  const { naCasca } = useSyncExternalStore(assinarDesktop, lerDesktop);
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
    privacidade: () => <Privacidade />,
    vozEVideo: () => <VozEVideo />,
    aparencia: () => <Aparencia />,
    notificacoes: () => <Notificacoes />,
    atalhos: () => <Atalhos />,
    avancado: () => <Avancado />,
    desktop: () => <Desktop />,
    servidor: () => <Servidor serverId={serverId} />,
    membros: () => <Membros serverId={serverId} />,
    cargos: () => <Cargos serverId={serverId} />,
    convites: () => <Convites serverId={serverId} />,
    acesso: () => <Acesso serverId={serverId} />,
    banimentos: () => <Banimentos serverId={serverId} />,
    seguranca: () => <Seguranca serverId={serverId} />,
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
        <Identidade />

        <div className={css.lista}>
          <p className={css.grupo}>Configurações do usuário</p>
          {(naCasca
            ? [...DE_USUARIO.slice(0, -1), [...DE_USUARIO[1]!, ...SO_NA_CASCA]]
            : DE_USUARIO
          ).map((bloco, i) => (
            <Fragment key={bloco[0]}>
              {/* A régua separa os blocos, nunca abre o primeiro. */}
              {i > 0 ? <hr className={css.regua} /> : null}
              {bloco.map((id) => (
                <ItemDoMenu key={id} id={id} ativa={id === secao} />
              ))}
            </Fragment>
          ))}

          {/*
            As de servidor só aparecem quando há servidor — e não
            desabilitadas: um menu com metade cinza ensina que existe coisa que
            você não pode usar, ruído permanente para quem só usa conversas.
          */}
          {serverId ? (
            <>
              {/*
                ⚠ **O nome do servidor encabeça o PRIMEIRO grupo, não os
                quatro.** Repeti-lo em cada um daria "Vortex Core" quatro vezes
                numa coluna de 248px; os subtítulos do design (Servidor ·
                Expressões · Pessoas · Moderação) é que separam.
              */}
              <p className={css.grupo}>{servidor?.name ?? "Servidor"}</p>
              {GRUPOS_DE_SERVIDOR.map((g, i) => (
                <Fragment key={g.titulo}>
                  {i > 0 ? <p className={css.subgrupo}>{g.titulo}</p> : null}
                  {g.itens.map((id) => (
                    <ItemDoMenu
                      key={id}
                      id={id}
                      ativa={id === secao}
                      serverId={serverId}
                    />
                  ))}
                </Fragment>
              ))}
            </>
          ) : null}

          {/*
            ⚠ **Sair faltava aqui, e o lugar dele é este.** Ele existe no menu
            do rodapé da coluna de canais — atrás de um dropdown que precisa
            ser aberto —, e o design o põe no fim desta lista, separado por
            régua e em vermelho. É onde se procura por ele: encerrar sessão é
            configuração de conta, não ajuste de presença.
          */}
          <hr className={css.regua} />
          <button
            type="button"
            className={cn(css.item, css.sair)}
            onClick={() => void sair()}
          >
            Sair
          </button>
        </div>
      </nav>
      )}

      <div className={css.conteudo}>
        {/* Rolável com foco: ver `MessageList` — rolável sem foco é inoperável
            por teclado. */}
        <div className={css.rolagem} tabIndex={0}>
          {/*
            O título rola COM o conteúdo, e é a mudança que tira uma barra
            inteira da tela. Ele mora aqui e não dentro de cada seção porque a
            fonte já é o `NOME_DA_SECAO` — repeti-lo em treze arquivos daria
            treze lugares para o título divergir do item marcado na coluna.
          */}
          <header className={css.paginaCabecalho}>
            <h1 className={css.paginaTitulo}>{NOME[secao]}</h1>
            {/* Subtítulo só onde ele diz algo — ver `DESCRICAO_DA_SECAO`. */}
            {DESCRICAO[secao] !== undefined ? (
              <p className={css.paginaSubtitulo}>{DESCRICAO[secao]}</p>
            ) : null}
          </header>
          {CONTEUDO[secao]()}
        </div>
      </div>

      {/*
        Fora do `.conteudo`: ele flutua sobre o canto da TELA, e o design o
        desenha assim — 34px com borda, sobre o vazio à direita da coluna de
        840. Numa barra ele custaria 65px de altura em toda seção para repetir
        o que o item marcado na coluna já diz.
      */}
      <Tooltip texto="Fechar (Esc)" lado="inicio">
        <button
          type="button"
          className={css.fechar}
          aria-label="Fechar configurações"
          onClick={fecharConfig}
        >
          <X size={ICONE.controle} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}
