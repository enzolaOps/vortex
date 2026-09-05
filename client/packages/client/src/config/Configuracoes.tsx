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
  DE_SERVIDOR,
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
import { gradienteDe } from "../lib/gradiente";
import { useMembrosDoServidor } from "../store/hooks";
import { cargosDoServidor } from "../sdk/cargos";
import { souDono } from "../sdk/servidores";
import { administrar } from "../store/administracao";
import { Tag } from "./Tag";
import { Modelo } from "./Modelo";
import { Figurinhas } from "./Figurinhas";
import { Sons } from "./Sons";

/**
 * A casca de configurações.
 *
 * ⚠ **Rota, e SOBRE o shell e não no lugar dele.** As duas decisões estão em
 * `store/config.ts` com a razão. A casca é um painel centrado; a lista de
 * mensagens continua montada atrás — abrir "Aparência" não pode custar a
 * remontagem de dez mil linhas medidas.
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

/**
 * A coluna de configurações de um SERVIDOR.
 *
 * Componente próprio, e não JSX solto dentro de `Configuracoes`, porque ele
 * precisa de hooks — a contagem de membros e a de cargos vêm do store, e hook
 * dentro de um `?:` não é hook. É a mesma razão pela qual `NavegacaoDoCanal`
 * já era um componente.
 */
/* Um por sessão — criar `Intl.NumberFormat` é caro, usar é barato. */
const NUMERO = new Intl.NumberFormat("pt-BR");

function NavegacaoDoServidor({
  serverId,
  nome,
  secao,
}: {
  serverId: string;
  nome: string | undefined;
  secao: SecaoId;
}) {
  const membros = useMembrosDoServidor(serverId);
  const cargos = cargosDoServidor(serverId);

  /*
    ⚠ **Membros e cargos têm contagem; banimentos NÃO, e é divergência
    deliberada.** A referência mostra `37` ao lado de Banimentos, e o número
    dele só existe depois de um `fetchBans` — uma chamada de rede por abertura
    da coluna, para desenhar um número que a própria página mostra ao ser
    aberta. Estes dois saem de graça do que o `Ready` já trouxe.

    Formatado com `Intl` aqui e não no item: um formatter por render de oito
    itens seria o erro nº 4 do briefing numa superfície fria.
  */
  const contagem: Partial<Record<SecaoId, string>> = {
    membros: NUMERO.format(membros.length),
    cargos: NUMERO.format(cargos.length),
  };

  return (
    <nav className={css.menu} aria-label={`Configurações de ${nome ?? "servidor"}`}>
      {/*
        O cartão de identidade do SERVIDOR, fora da área rolável.

        ⚠ **Ele era um `<p>` com o nome DENTRO da lista, e a diferença não é
        decoração.** A coluna do usuário já põe a identidade fora do scroller —
        quem você é não some ao descer a lista —, e a do servidor não seguia a
        própria regra: o nome rolava para fora, e numa instância com vários
        servidores a tela deixava de dizer qual deles você está configurando
        exatamente enquanto você desce até "Banimentos".

        As medidas são do design e da referência: ladrilho 28×28 raio 9 com o
        gradiente do servidor, nome em 13/600 com reticências, e "Configurações"
        abaixo em 11 — que é o que diz que esta tela é a de gestão, e não o
        perfil dele.
      */}
      <div className={css.identidade}>
        <span
          aria-hidden
          className={css.ladrilhoDoServidor}
          style={{ backgroundImage: gradienteDe(serverId) }}
        >
          {sigla(nome ?? "?")}
        </span>
        <div className={css.identidadeTextos}>
          <p className={css.identidadeNome}>{nome ?? "Servidor"}</p>
          <p className={css.identidadeArroba}>Configurações</p>
        </div>
      </div>

      <div className={css.lista}>
        {/*
          ⚠ **Os quatro títulos aparecem, e o primeiro não aparecia.** A versão
          anterior pulava o título quando `i === 0` porque o nome do servidor
          ocupava aquele lugar; com o nome no cartão acima, pular "Servidor"
          deixava os itens dele órfãos, encostados no cartão e sem categoria —
          enquanto os outros três grupos tinham a sua.
        */}
        {GRUPOS_DE_SERVIDOR.map((g) => (
          <Fragment key={g.titulo}>
            <p className={css.subgrupo}>{g.titulo}</p>
            {g.itens.map((id) => (
              <ItemDoMenu
                key={id}
                id={id}
                ativa={id === secao}
                serverId={serverId}
                contagem={contagem[id]}
              />
            ))}
          </Fragment>
        ))}

        {/*
          O grupo de perigo, no fim da coluna e sem título.

          ⚠ **Estes dois NÃO são seções, e é por isso que não estão em
          `GRUPOS_DE_SERVIDOR`.** Eles não abrem página nenhuma: abrem um
          modal e acabam. Pô-los na união `SecaoId` obrigaria a inventar duas
          telas vazias para satisfazer o `Record` de conteúdo, e o mecanismo
          que existe para impedir seção sem tela passaria a exigir telas que
          ninguém quer.

          ⚠ **Antes de virem para cá, "Apagar servidor" morava no rodapé da
          Visão geral** com confirmação inline de dois passos. A referência os
          põe na navegação; a confirmação virou modal porque, de um item de
          coluna, não há onde uma pergunta inline apareça.

          Sem título de grupo, como na referência: régua e vermelho já dizem
          que aqui muda o tom, e um rótulo "Perigo" nomearia o óbvio ocupando
          uma linha.
        */}
        <hr className={css.regua} />
        <button
          type="button"
          className={css.item}
          onClick={() => administrar({ tipo: "transferirPropriedade", serverId })}
        >
          <span className={css.itemRotulo}>Transferir propriedade</span>
        </button>
        <button
          type="button"
          className={cn(css.item, css.sair)}
          onClick={() => administrar({ tipo: "apagarServidor", serverId })}
        >
          <span className={css.itemRotulo}>
            {souDono(serverId) ? "Excluir servidor" : "Sair do servidor"}
          </span>
        </button>
      </div>
    </nav>
  );
}

function ItemDoMenu({
  id,
  ativa,
  serverId,
  contagem,
}: {
  id: SecaoId;
  ativa: boolean;
  serverId?: string;
  /**
   * O número à direita do rótulo — "1.204" em Membros, "9" em Cargos.
   *
   * ⚠ **String e não `number`, de propósito.** Quem chama já formatou com
   * `Intl`, e um número cru aqui deixaria a formatação para o render de um
   * componente que aparece oito vezes na coluna. É a mesma regra de
   * `createdAtText` e `tamanhoTexto`: derivar na escrita.
   */
  contagem?: string;
}) {
  return (
    <button
      type="button"
      className={css.item}
      aria-current={ativa}
      onClick={() => abrirConfig(id, serverId)}
    >
      <span className={css.itemRotulo}>{NOME[id]}</span>
      {contagem === undefined ? null : (
        <span className={css.itemContagem}>{contagem}</span>
      )}
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
    tag: () => <Tag serverId={serverId} />,
    modelo: () => <Modelo serverId={serverId} />,
    figurinhas: () => <Figurinhas serverId={serverId} />,
    sons: () => <Sons serverId={serverId} />,
    canal: () => <VisaoGeralDoCanal channelId={channelId} />,
    canalPermissoes: () => <PermissoesDoCanal channelId={channelId} />,
    canalConvites: () => <ConvitesDoCanal channelId={channelId} />,
  };

  return (
    // ponytail: overlay próprio — Dialog trava o scroll da lista virtualizada
    <div
      className={cn(css.veu, "camada-chega")}
      onClick={(e) => {
        if (e.target === e.currentTarget) fecharConfig();
      }}
    >
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
      {/*
        ⚠ **O servidor tem casca PRÓPRIA, e antes ele dividia a coluna com as
        do usuário.** As quatro seções dele vinham penduradas abaixo de
        "Configurações do usuário", então quem abria a gestão de um servidor
        via Perfil, Conta, Dispositivos e Privacidade antes de chegar em
        Membros — e o design desenha duas telas separadas, como a referência.

        É o MESMO defeito que as de canal já tinham e que o comentário abaixo
        registra; ele só não tinha sido aplicado um nível acima. Quem usa
        relatou: "o servidor era para ter uma tela própria de gerenciamento,
        não dividir com o usuário".

        A casca é DERIVADA da seção aberta (`DE_SERVIDOR.includes`), sem
        estado novo: se a seção é de servidor, a coluna é a dele. Um campo
        "qual casca" daria duas fontes para o mesmo fato, e a que diverge é
        sempre a que ninguém abriu naquela semana.
      */}
      {canal ? (
        <NavegacaoDoCanal canal={canal} secao={secao} servidor={servidor?.name} />
      ) : DE_SERVIDOR.includes(secao) && serverId ? (
        <NavegacaoDoServidor
          serverId={serverId}
          nome={servidor?.name}
          secao={secao}
        />
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
            ⚠ **As de servidor SAÍRAM daqui.** Elas eram um segundo grupo
            nesta mesma coluna; agora têm casca própria, escolhida no `if` lá
            de cima. Ver o comentário de lá.
          */}

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
    </div>
  );
}
