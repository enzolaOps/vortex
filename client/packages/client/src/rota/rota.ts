/**
 * A URL, como PROJEÇÃO do store de navegação.
 *
 * A direção é a coisa mais importante deste arquivo, e a decisão foi tomada
 * antes de qualquer linha: **o store continua sendo a fonte da verdade e a URL
 * espelha.** O caminho inverso — router como dono, store lendo dele — daria
 * duas fontes para a mesma pergunta, e a lei nº 1 existe justamente contra
 * isso. Aqui o `popstate` é só mais um jeito de CHAMAR os mesmos setters que o
 * rail e a lista de canais chamam.
 *
 * Sem biblioteca de router, e isso é escolha e não preguiça: são três formas
 * de caminho contra um store que já existe. React Router traria contexto,
 * re-render por navegação e um segundo dono do estado — os três problemas que
 * a arquitetura deste projeto gasta esforço para não ter.
 *
 * O que isto destrava, e que era IRREPRESENTÁVEL antes: link de convite,
 * permalink de mensagem, F5 no lugar certo e deep-link do Electron.
 */
import { pedirIrParaMensagem } from "../store/comandos";
import {
  assinarEntrada,
  definirEntrada,
  lerEntrada,
  type TelaDeEntrada,
} from "../store/entrada";
import {
  abrirConfig,
  fecharConfig,
  lerConfig,
  assinarConfig,
  SECOES,
  type Config,
  type SecaoId,
} from "../store/config";
import {
  abrirConversa,
  assinarNavegacao,
  irPara,
  irParaAmigos,
  irParaCasa,
  lerLocal,
  type AbaDePessoas,
  type Local,
} from "../store/navegacao";

/**
 * O que um segmento de ID pode conter.
 *
 * Permissivo de propósito — ULID canônico é `[0-9A-HJKMNP-TV-Z]{26}`, mas o
 * arnês gera IDs próprios e um fork de backend pode mudar o formato. O que
 * protege não é a forma do ID: é o store, onde ID desconhecido simplesmente
 * não acha entidade e a coluna mostra o estado vazio. Recusar aqui trocaria um
 * estado vazio honesto por uma rota que não existe.
 */
const ID = "[0-9A-Za-z_-]{1,64}";

const SERVIDOR = new RegExp(`^/servidor/(${ID})(?:/canal/(${ID})(?:/(${ID}))?)?$`);
const CONVERSA = new RegExp(`^/dm/(${ID})$`);

/**
 * Os caminhos de FORA — os que existem antes de haver sessão.
 *
 * Dois deles não são conveniência, são obrigatórios: `verificar` e `redefinir`
 * chegam por LINK DE E-MAIL, e link de e-mail é uma URL. Sem estas rotas, o
 * clique no e-mail abriria a tela de senha e o token se perderia — a conta
 * ficaria sem confirmar e a senha sem redefinir, os dois em silêncio.
 *
 * O token é permissivo por design: ele é opaco, gerado pelo servidor, e recusar
 * formato aqui seria adivinhar um formato que o backend pode mudar. Quem valida
 * é quem o emitiu.
 */
const TOKEN = "[0-9A-Za-z_.~-]{1,256}";
const VERIFICAR = new RegExp(`^/(?:verificar|login/verify)/(${TOKEN})$`);
const EXCLUIR = new RegExp(`^/delete/(${TOKEN})$`);

/*
  ⚠ **DOIS caminhos para redefinir, e o segundo é o que o servidor manda.**

  A API monta o link do e-mail como `{hosts.app}/login/reset/{token}` — está
  fixo em `crates/core/database/src/util/email.rs`, e é o caminho do cliente
  Solid. O nosso é `/redefinir/:token`. Com só o nosso, o clique no e-mail cai
  numa rota que este app não conhece e o token se perde em silêncio: o mesmo
  defeito que estas rotas existem para impedir.

  Consertar do lado da API custaria implantar o fork (`enzolaOps/vortex-api`),
  que está travado no build arm64. E mesmo com o fork pronto, aceitar o
  caminho do upstream continua sendo o certo — um e-mail antigo na caixa de
  alguém não muda de endereço quando o servidor muda.

  Verificado contra a instância local: o link chega exatamente assim.
*/
const REDEFINIR = new RegExp(`^/(?:redefinir|login/reset)/(${TOKEN})$`);
const CONVITE = new RegExp(`^/convite/(${ID})$`);

const ENTRADA: Readonly<Record<string, TelaDeEntrada>> = {
  "/entrar": { tipo: "entrar" },
  "/entrar/criar": { tipo: "criar" },
  "/entrar/recuperar": { tipo: "recuperar" },
  // O endereço NÃO entra na URL: e-mail em barra de endereço fica em
  // histórico, em log de proxy e em print de tela.
  "/entrar/conferir": { tipo: "conferirEmail", email: undefined },
};

/** O caminho de uma tela de entrada. */
export function caminhoDaEntrada(tela: TelaDeEntrada): string {
  switch (tela.tipo) {
    case "entrar":
      return "/entrar";
    case "criar":
      return "/entrar/criar";
    case "recuperar":
      return "/entrar/recuperar";
    case "conferirEmail":
      return "/entrar/conferir";
    case "verificar":
      return `/verificar/${tela.token}`;
    case "redefinir":
      return `/redefinir/${tela.token}`;
    case "excluir":
      return `/delete/${tela.token}`;
    case "convite":
      return `/convite/${tela.codigo}`;
  }
}

/** A tela de entrada que um caminho representa, se for um caminho de fora. */
export function interpretarEntrada(caminho: string): TelaDeEntrada | undefined {
  const fixa = ENTRADA[caminho];
  if (fixa) return fixa;

  const v = VERIFICAR.exec(caminho);
  if (v) return { tipo: "verificar", token: v[1]! };

  const r = REDEFINIR.exec(caminho);
  if (r) return { tipo: "redefinir", token: r[1]! };

  const x = EXCLUIR.exec(caminho);
  if (x) return { tipo: "excluir", token: x[1]! };

  const c = CONVITE.exec(caminho);
  if (c) return { tipo: "convite", codigo: c[1]! };

  return undefined;
}

/* ------------------------------------------------------- configurações */

const CONFIG = new RegExp(`^/config/(${ID})(?:/(${ID}))?$`);

/**
 * O caminho das configurações, ou `undefined` quando estão fechadas.
 *
 * Terceira projeção do arquivo, ao lado do lugar e da tela de entrada, e ela é
 * ORTOGONAL às outras duas: configurações abrem sobre onde a pessoa está, sem
 * mexer no canal aberto. É por isso que elas não entraram em `Local` — seriam
 * um lugar que substitui o lugar, e fechar teria de adivinhar para onde voltar.
 */
export function caminhoDaConfig(c: Config): string | undefined {
  if (c.secao === null) return undefined;
  return c.serverId
    ? `/config/${c.secao}/${c.serverId}`
    : `/config/${c.secao}`;
}

export function interpretarConfig(caminho: string): Config | undefined {
  const m = CONFIG.exec(caminho);
  if (!m) return undefined;
  const secao = m[1] as SecaoId;
  // Seção desconhecida NÃO abre nada: uma URL digitada errada não deve abrir
  // uma tela de configuração vazia, que pareceria bug.
  if (!SECOES.includes(secao)) return undefined;
  /*
    ⚠ O canal NÃO vem da URL, e é decisão.

    As seções de canal precisam de um alvo, e a URL de configurações tem uma
    posição só depois da seção — que já é o servidor. Dar duas exigiria um
    formato novo (`/config/canal/:servidor/:canal`) para um caso que ninguém
    linka: quem manda "veja as permissões do #geral" manda o link do canal, não
    o das configurações dele. Entrar por URL numa seção de canal cai na tela de
    "abra um canal", que é honesto.
  */
  return { secao, serverId: m[2], channelId: undefined };
}

/**
 * O nome de cada aba de pessoas na URL.
 *
 * Em português e no plural, como o resto dos caminhos deste app — quem lê a
 * barra de endereço lê `/amigos/bloqueados`, não `/amigos/bloqueado`. Os dois
 * mapas são inversos e ficam juntos para não divergirem.
 */
const SLUG: Record<AbaDePessoas, string> = {
  amigo: "amigos",
  recebido: "pedidos",
  enviado: "enviados",
  bloqueado: "bloqueados",
};

const ABA_DO_SLUG: Record<string, AbaDePessoas | undefined> =
  Object.fromEntries(
    (Object.entries(SLUG) as [AbaDePessoas, string][]).map(([k, v]) => [v, k]),
  );

const PESSOAS = /^\/amigos\/([a-z]+)$/;

/** O caminho que representa um lugar. A metade fácil da projeção. */
export function caminhoDe(local: Local): string {
  switch (local.tipo) {
    case "casa":
      return "/";
    case "amigos":
      /* A aba padrão não entra no caminho: `/amigos` e `/amigos/amigos` seriam
         dois endereços para a mesma tela, e o segundo é feio de ler. */
      return local.aba === "amigo" ? "/amigos" : `/amigos/${SLUG[local.aba]}`;
    case "dm":
      return `/dm/${local.channelId}`;
    case "servidor":
      return local.channelId === undefined
        ? `/servidor/${local.serverId}`
        : `/servidor/${local.serverId}/canal/${local.channelId}`;
  }
}

/**
 * O lugar que um caminho representa, mais a mensagem se houver.
 *
 * A mensagem sai SEPARADA do lugar de propósito: ela não é estado, é um salto
 * de uma vez só. Guardá-la no `Local` faria a URL carregar para sempre uma
 * posição que a pessoa já abandonou ao rolar, e o botão "voltar" levaria de
 * volta a um ponto do histórico em vez de a uma tela.
 *
 * Caminho desconhecido devolve `casa`, e não `undefined`: o app tem de abrir
 * em algum lugar, e uma URL digitada errado não é motivo para tela em branco.
 */
export function interpretar(caminho: string): {
  local: Local;
  mensagemId: string | undefined;
} {
  const servidor = SERVIDOR.exec(caminho);
  if (servidor) {
    return {
      local: {
        tipo: "servidor",
        serverId: servidor[1]!,
        channelId: servidor[2],
      },
      mensagemId: servidor[3],
    };
  }

  if (caminho === "/amigos") {
    return { local: { tipo: "amigos", aba: "amigo" }, mensagemId: undefined };
  }

  const pessoas = PESSOAS.exec(caminho);
  if (pessoas) {
    const aba = ABA_DO_SLUG[pessoas[1]!];
    /* Slug desconhecido cai na aba padrão em vez de na casa: o lugar existe, o
       que não existe é aquela aba — e mandar para a casa esconderia a tela
       inteira por causa de um erro de digitação no fim da URL. */
    return {
      local: { tipo: "amigos", aba: aba ?? "amigo" },
      mensagemId: undefined,
    };
  }

  const conversa = CONVERSA.exec(caminho);
  if (conversa) {
    return { local: { tipo: "dm", channelId: conversa[1]! }, mensagemId: undefined };
  }

  return { local: { tipo: "casa" }, mensagemId: undefined };
}

/** Aplica um lugar chamando os MESMOS setters que a interface chama. */
function aplicar(local: Local): void {
  switch (local.tipo) {
    case "casa":
      irParaCasa();
      return;
    case "amigos":
      irParaAmigos(local.aba);
      return;
    case "dm":
      abrirConversa(local.channelId);
      return;
    case "servidor":
      irPara(local.serverId, local.channelId);
      return;
  }
}

let ligada = false;

/**
 * Liga a projeção. Idempotente, module-level, chamada uma vez na abertura.
 *
 * Não vive num `useEffect`: `history` e `popstate` não pertencem a árvore de
 * componente nenhuma, e prendê-los a uma faria a rota morrer numa remontagem.
 * Mesmo padrão de `ligarAtalhoDaPaleta`.
 *
 * **O laço se fecha pela comparação de caminho, e não por uma flag.** O
 * `popstate` chama os setters, os setters emitem, o assinante calcula o
 * caminho — e ele já é igual ao da barra de endereço, então nada é escrito.
 * Flag daria o mesmo resultado enquanto ninguém navegasse durante a aplicação;
 * a comparação vale sempre, porque compara o estado real dos dois lados.
 */
export function ligarRota(): void {
  if (ligada || typeof window === "undefined") return;
  ligada = true;

  /*
    A tela de FORA vem primeiro, e ela é exclusiva: um caminho de entrada não
    é um lugar do app. Se a URL for `/redefinir/abc`, não há servidor nem canal
    a aplicar — há um token a entregar.
  */
  const entrada = interpretarEntrada(window.location.pathname);
  if (entrada) definirEntrada(entrada);

  const config = interpretarConfig(window.location.pathname);
  if (config?.secao) abrirConfig(config.secao, config.serverId);

  const inicial = interpretar(window.location.pathname);
  if (!entrada) aplicar(inicial.local);
  // `replaceState` na primeira: a entrada de histórico da abertura é a própria
  // abertura. `push` aqui daria um "voltar" que não sai do lugar.
  window.history.replaceState(
    null,
    "",
    entrada ? caminhoDaEntrada(lerEntrada()) : caminhoDe(lerLocal()),
  );
  if (inicial.mensagemId !== undefined) {
    pedirIrParaMensagem(
      inicial.local.tipo === "servidor" ? (inicial.local.channelId ?? "") : "",
      inicial.mensagemId,
    );
  }

  assinarNavegacao(() => {
    const caminho = caminhoDe(lerLocal());
    if (caminho === window.location.pathname) return;
    window.history.pushState(null, "", caminho);
  });

  assinarConfig(() => {
    /*
      Configurações abertas MANDAM no caminho; fechadas, quem manda é o lugar.

      A ordem importa: sem ela, fechar as configurações não escreveria nada
      (porque `caminhoDaConfig` devolve `undefined`) e a URL ficaria em
      `/config/perfil` com a tela já fechada.
    */
    const caminho = caminhoDaConfig(lerConfig()) ?? caminhoDe(lerLocal());
    if (caminho === window.location.pathname) return;
    window.history.pushState(null, "", caminho);
  });

  assinarEntrada(() => {
    const caminho = caminhoDaEntrada(lerEntrada());
    if (caminho === window.location.pathname) return;
    window.history.pushState(null, "", caminho);
  });

  window.addEventListener("popstate", () => {
    const deFora = interpretarEntrada(window.location.pathname);
    if (deFora) {
      definirEntrada(deFora);
      return;
    }

    /*
      Voltar fecha as configurações e devolve o lugar de antes — que é o
      comportamento que a decisão "rota, não modal" existe para dar.
    */
    const config = interpretarConfig(window.location.pathname);
    if (config?.secao) {
      abrirConfig(config.secao, config.serverId);
      return;
    }
    fecharConfig();
    const { local, mensagemId } = interpretar(window.location.pathname);
    aplicar(local);
    if (mensagemId !== undefined && local.tipo === "servidor" && local.channelId) {
      pedirIrParaMensagem(local.channelId, mensagemId);
    }
  });
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function desligarRota(): void {
  ligada = false;
}
