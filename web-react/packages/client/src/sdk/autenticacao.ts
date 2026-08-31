/**
 * Entrar e sair — a fronteira entre o app e a sessão do SDK.
 *
 * Mora em `src/sdk/` porque toca o `client` diretamente, e é a camada
 * anticorrupção fazendo o de sempre: `DataLogin`, `ResponseLogin` e `MFAMethod`
 * são formas do protocolo, e nada disso sai daqui. A tela de entrada conhece
 * `entrar(email, senha)` e `responderMfa(metodo, valor)`, e mais nada.
 *
 * ⚠ **`client.login()` do SDK NÃO é usado, e isso é conserto, não preferência.**
 * Ele tem três defeitos, verificáveis em `stoat.js/src/Client.ts:372`:
 *
 * 1. Nunca chama `#updateHeaders()`, então nenhum cabeçalho de autenticação é
 *    instalado e toda chamada seguinte sai anônima.
 * 2. Nunca chama `connect()` — a linha está lá, comentada, com um `// TODO`.
 *    Sem websocket não há `Ready`, e sem `Ready` não há usuário, canal nem
 *    mensagem.
 * 3. Lança a string crua `"MFA not implemented!"` quando a conta tem segundo
 *    fator, que é justamente a conta que mais precisa entrar.
 *
 * O que isso produzia aqui: `entrar()` chamava `login`, lia `client.user?.id` —
 * `undefined`, porque sem `connect()` não há `Ready` — e caía no ramo de erro
 * dizendo que o servidor não disse quem você é. A pendência do `CLAUDE.md`
 * dizia que faltava "só o caminho de sucesso"; o caminho de sucesso estava
 * quebrado.
 *
 * ⚠ **E `useExistingSession` tem metade do mesmo furo**, que ninguém tinha
 * notado: ele instala o cabeçalho e **também não conecta**. Restaurar sessão
 * guardada abria o app com socket fechado. É por isso que `conectar()` existe
 * aqui e é chamado nos dois caminhos.
 *
 * Consertar no submodule não é opção: `stoat.js` é gitlink compartilhado com a
 * ilha `web/`, com check de CI exigindo o mesmo commit. Este arquivo é a camada
 * que existe exatamente para absorver diferença assim.
 */
import { toast } from "../components/ui/toastStore";
import { definirUsuarioLocal, startAdapter } from "./adapter";
import { escolherNome, precisaEscolherNome } from "./conta";
import { client } from "./client";
import {
  dentro,
  desativada,
  entrando,
  erro,
  esquecerToken,
  fora,
  guardarToken,
  lerSessao,
  lerTokenGuardado,
  precisaDeMfa,
  precisaDeNome,
  type MetodoDeMfa,
} from "../store/sessao";
import { motivoDoErro } from "./erros";
import { lerEscolhaDeIdentidade } from "../store/entrada";

/**
 * O nome que identifica ESTA sessão na lista de dispositivos da conta.
 *
 * É o que permite a pessoa reconhecer e derrubar um acesso que não é dela.
 * Genérico de propósito: "Vortex (web)" e não o user agent, que carrega versão
 * de sistema e de navegador para uma lista que outras pessoas podem ver.
 */
const NOME_AMIGAVEL = "Vortex (web)";

/**
 * Traduz a falha para quem digitou a senha.
 *
 * "Failed to fetch" é escrito para quem programa. Quem está na tela precisa
 * saber se errou a senha ou se o servidor não respondeu — são problemas
 * diferentes, com ações diferentes, e confundi-los faz a pessoa tentar a coisa
 * errada por minutos.
 *
 * O `status` vem do erro do SDK, que carrega a resposta HTTP. Sem status é
 * rede: o pedido não chegou a lugar nenhum.
 */
/* Delega para o tradutor unico — ver `sdk/erros.ts`. O corpo que
   estava aqui lia `e.response.status`, que o `stoat-api` nunca
   produz, entao TODA falha virava "Sem resposta do servidor". */
export function motivoDe(e: unknown): string {
  return motivoDoErro(e);
}

/* ------------------------------------------------------------- protocolo */

/**
 * `Password | Recovery` → o vocabulário do Vortex.
 *
 * Traduzido e não repassado: a tela de segundo fator é escrita em português e
 * não deve conhecer a grafia do Stoat. É a mesma regra que fez `PresenceStatus`
 * existir em vez de o app falar `"Busy"`.
 *
 * ⚠ **`Totp` é omitido de propósito** — aplicativo autenticador ficou fora do
 * Vortex. Um desafio só de TOTP vira lista vazia e a tela diz que não dá, que é
 * o tratamento certo para um método que este cliente não responde.
 */
const METODO: Record<string, MetodoDeMfa> = {
  Password: "senha",
  Recovery: "recuperacao",
};

/** O caminho inverso, para montar a resposta que o protocolo espera. */
function respostaDoProtocolo(
  metodo: MetodoDeMfa,
  valor: string,
): Record<string, string> {
  return metodo === "senha" ? { password: valor } : { recovery_code: valor };
}

/**
 * O bilhete de MFA, entre a primeira tentativa e a segunda.
 *
 * Module-level e não no store de sessão: é dado de PROTOCOLO — um token opaco
 * com validade curta — e o store de sessão é domínio. A tela precisa saber que
 * há um desafio e quais métodos servem; não precisa nunca ver o bilhete.
 */
let bilhete: string | undefined;

type RespostaDeLogin =
  | { result: "Success"; _id: string; token: string; user_id: string }
  | { result: "MFA"; ticket: string; allowed_methods: readonly string[] }
  | { result: "Disabled"; user_id: string };

/**
 * Instala a sessão e ABRE O SOCKET.
 *
 * As duas coisas juntas, num lugar só, porque separá-las foi o defeito
 * original: `useExistingSession` sozinho deixa o app com cabeçalho instalado e
 * nenhum evento chegando — um estado que parece funcionar até alguém esperar
 * uma mensagem.
 */

function instalar(sessao: {
  _id: string;
  token: string;
  user_id: string;
}): void {
  /*
    ⚠ **A PONTE, e ela nunca era ligada no produto.**

    `startAdapter()` registra `ready`, `serverCreate`, `channelCreate`,
    `messageCreate` — todo o caminho que traz dado do socket para o store. Ele
    era chamado em UM lugar só: `dev/firehose.ts`. Ou seja, funcionava no
    arnês e em lugar nenhum além dele.

    O sintoma era o app abrir vazio contra um servidor real e continuar vazio:
    o rail dizia "sem servidores" com o `Ready` trazendo um, a coluna dizia
    "este servidor não tem canais" com o canal existindo no backend, e nada
    mudava ao recarregar. Nenhum erro em lugar nenhum — o socket autenticava,
    o `Ready` chegava, e ninguém estava ouvindo.

    ⚠ **ANTES de `conectar()`, e a ordem é o mecanismo.** O `ready` é emitido
    uma vez, logo depois da hidratação; registrar o ouvinte depois de abrir o
    socket é uma corrida que se perde em rede rápida — que é exatamente o caso
    de uma instância local.

    Idempotente, então chamar nos dois caminhos (login e restauração) não
    duplica ouvinte.
  */
  /*
    A mesma sessão duas vezes é o `StrictMode`, não um pedido novo. Sair aqui
    preserva o socket já aberto; reinstalar o abriria de novo.
  */
  startAdapter();

  client.useExistingSession(sessao);
  void conectar();
  definirUsuarioLocal(sessao.user_id);
}


/**
 * Abre o socket — mas só depois de saber PARA ONDE.
 *
 * ⚠ **`client.connect()` cru manda o token para `wss://stoat.chat/events`
 * quando a configuração não carregou.** A linha do SDK é
 * `this.events.connect(this.configuration?.ws ?? "wss://stoat.chat/events",
 * token)`: o `??` é um fallback para a instância PÚBLICA do Stoat, e o segundo
 * argumento é a credencial da sessão.
 *
 * ⚠ **A primeira versão desta guarda RECUSAVA em vez de esperar, e isso
 * quebrou a restauração de sessão.** `useExistingSession` é SÍNCRONO e não
 * espera nada; só `client.login()` faz `await this.#fetchConfiguration()`, e
 * nós não o usamos (ele é quebrado — ver o comentário de `entrar`). Então no
 * F5 a configuração ainda estava em voo, a guarda disparava, e o app abria
 * sem socket nenhum com um toast dizendo para recarregar — que não adiantava,
 * porque a corrida se repetia.
 *
 * Medido no navegador: toast "a configuração não carregou" em toda
 * restauração de sessão, com o servidor no ar e respondendo.
 *
 * Agora ela ESPERA. O `configured` do SDK é signal do Solid, e lê-lo aqui
 * dentro de `sdk/` seria legítimo — mas um `while` sobre o campo custa menos
 * que arrastar reatividade para um caminho que roda uma vez por sessão.
 *
 * O teto existe para o caso em que a configuração nunca chega: aí sim o
 * comportamento honesto é não conectar e dizer, porque conectar significaria
 * mandar a credencial para um servidor de terceiro.
 */
async function conectar(): Promise<void> {
  if (!(await esperarConfiguracao())) {
    toast({
      tipo: "erro",
      titulo: "Não deu para falar com o servidor.",
      descricao: "A configuração não carregou. Recarregue a página.",
    });
    return;
  }
  client.connect();
}

/** Quanto esperar pela configuração antes de desistir. */
const TETO_DA_CONFIGURACAO_MS = 15_000;
const PASSO_MS = 50;

async function esperarConfiguracao(): Promise<boolean> {
  const limite = Date.now() + TETO_DA_CONFIGURACAO_MS;
  while (client.configuration?.ws === undefined) {
    if (Date.now() > limite) return false;
    await new Promise((r) => setTimeout(r, PASSO_MS));
  }
  return true;
}

/**
 * Decide o que fazer com a resposta do servidor.
 *
 * Os três resultados do protocolo viram os três estados da interface. O
 * upstream trata `Disabled` com um `alert()` e um `// TODO`; aqui ele é um
 * estado próprio, porque "sua conta foi desativada" e "sua senha está errada"
 * pedem ações completamente diferentes de quem está na tela.
 */
async function concluir(r: RespostaDeLogin): Promise<void> {
  if (r.result === "MFA") {
    bilhete = r.ticket;
    const metodos = r.allowed_methods
      .map((m) => METODO[m])
      .filter((m): m is MetodoDeMfa => m !== undefined);
    /*
      Lista vazia seria um desafio sem como responder — tela sem saída. Se o
      servidor mandar só métodos que este cliente não conhece, é mais honesto
      dizer que não dá do que mostrar um formulário inerte.
    */
    if (metodos.length === 0) {
      erro(
        "Esta conta exige um aplicativo autenticador, e o Vortex não usa esse " +
          "método. Entre por outro cliente para desativá-lo.",
      );
      return;
    }
    precisaDeMfa(metodos);
    return;
  }

  if (r.result === "Disabled") {
    desativada();
    return;
  }

  bilhete = undefined;
  const sessao = { _id: r._id, token: r.token, user_id: r.user_id };
  guardarToken(sessao);
  instalar(sessao);
  /*
    `user_id` vem da RESPOSTA, não de `client.user`.

    O código antigo lia `client.user?.id` e caía num ramo de erro quando ele
    era `undefined` — o que era sempre, já que sem `connect()` não havia
    `Ready`. Mas mesmo com o socket aberto isso seria uma corrida: `Ready`
    chega depois. A resposta do login já carrega o ID, e usá-la elimina a
    espera e o ramo de erro junto.
  */
  /*
    O onboarding vem ANTES de `dentro`, não depois.

    Entrar e depois voltar para uma tela de nome faria o app piscar inteiro —
    shell, lista, colunas — para então ser substituído. Aqui a sessão já vale
    (token instalado, socket aberto) e só o último passo falta.
  */
  if (await precisaEscolherNome()) {
    /*
      ⚠ **Quem veio do CADASTRO já escolheu, e não pode ser perguntado de
      novo.** O formulário do design pede nome de usuário e nome de exibição
      junto com e-mail e senha; o protocolo só aceita os dois últimos em
      `account/create` e joga o resto para o onboarding. Mostrar a tela de nome
      depois disso partiria o cadastro em duas — que é justamente o que guardar
      a escolha existe para evitar.

      A tela de nome continua existindo, e é o caminho de quem chega ao
      onboarding sem ter passado por aqui: conta criada por outro cliente, ou
      cadastro interrompido antes de completar.
    */
    const escolhido = lerEscolhaDeIdentidade();
    if (escolhido?.usuario) {
      await escolherNome(escolhido.usuario);
      return;
    }

    precisaDeNome(r.user_id);
    return;
  }

  dentro(r.user_id);
}

async function postLogin(corpo: Record<string, unknown>): Promise<void> {
  const r = (await client.api.post(
    "/auth/session/login",
    corpo as never,
  )) as RespostaDeLogin;
  await concluir(r);
}

/* --------------------------------------------------------------- entrada */

export async function entrar(email: string, senha: string): Promise<void> {
  entrando();
  try {
    await postLogin({ email, password: senha, friendly_name: NOME_AMIGAVEL });
  } catch (e) {
    erro(motivoDe(e));
  }
}

/**
 * Responde ao segundo fator e tenta de novo.
 *
 * O laço é o do upstream (`Controller.ts:531`): a mesma rota, agora com
 * `mfa_ticket` e `mfa_response`. Pode voltar `MFA` de novo — código errado —, e
 * aí a tela simplesmente continua pedindo.
 */
export async function responderMfa(
  metodo: MetodoDeMfa,
  valor: string,
): Promise<void> {
  if (bilhete === undefined) {
    erro("A verificação expirou. Entre de novo.");
    return;
  }

  const guardado = bilhete;
  const metodos = lerSessao().metodos;
  /*
    Segue no MFA, ocupado — e NÃO em `entrando`.

    `entrando()` põe o estado da tela de SENHA, e o portão renderiza por estado:
    a pessoa apertaria "Verificar" e veria o formulário de e-mail voltar. O
    defeito não daria erro nenhum; só a tela errada.
  */
  precisaDeMfa(metodos, { ocupada: true });
  try {
    await postLogin({
      mfa_ticket: guardado,
      mfa_response: respostaDoProtocolo(metodo, valor),
      friendly_name: NOME_AMIGAVEL,
    });
  } catch (e) {
    /*
      Código errado devolve 401, e "E-mail ou senha incorretos" seria mentira
      aqui. O bilhete continua valendo, então a tela volta a pedir o código em
      vez de mandar a pessoa recomeçar.
    */
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 401) {
      /*
        O bilhete continua valendo, então a tela volta a PEDIR em vez de mandar
        a pessoa recomeçar. E o motivo vai junto do estado `mfa`: chamar
        `erro()` aqui levaria de volta à tela de senha, que é o mesmo defeito de
        cima por outra porta.
      */
      bilhete = guardado;
      precisaDeMfa(metodos, { motivo: "Código incorreto." });
      return;
    }
    erro(motivoDe(e));
  }
}

/** Desiste do segundo fator e volta para a tela de entrada. */
export function cancelarMfa(): void {
  bilhete = undefined;
  fora();
}

/**
 * Tenta voltar com a sessão guardada. Chamado uma vez, na abertura.
 *
 * `useExistingSession` NÃO valida nada — ele instala o token; agora `instalar`
 * também abre o socket, que é o que faltava. Um token revogado só se revela
 * quando o socket recusa, e é por isso que o evento `logout` do SDK precisa
 * estar ligado: é ele quem descobre.
 *
 * Otimista de propósito: mostrar o app e cair para o login se o token morreu é
 * melhor que segurar a pessoa numa tela de espera a cada abertura para
 * confirmar algo que quase sempre está certo.
 */
export function restaurarSessao(): void {
  const guardado = lerTokenGuardado();
  if (!guardado) {
    fora();
    return;
  }

  try {
    instalar(guardado);
    dentro(guardado.user_id);
  } catch {
    // Token com forma válida que o SDK recusou. Trata como ausência.
    esquecerToken();
    fora();
  }
}

/**
 * Sai — por escolha da pessoa ou porque o servidor derrubou a sessão.
 *
 * `esquecerToken` ANTES do `logout`: se a chamada de rede falhar, a sessão
 * local precisa ter sumido do mesmo jeito. A ordem inversa deixaria alguém
 * "deslogado" na tela e logado no armazenamento — e o próximo F5 traria a
 * conta de volta.
 */
export async function sair(): Promise<void> {
  bilhete = undefined;
  esquecerToken();
  fora();
  try {
    await client.logout();
  } catch {
    // A sessão local já foi. Falhar em avisar o servidor não pode prender
    // ninguém dentro do app.
  }
}

/**
 * O servidor derrubou a sessão — token revogado, senha trocada, banimento.
 *
 * Ligado uma vez na abertura. Sem isto o app ficaria numa tela viva com um
 * socket morto, e a pessoa só descobriria tentando enviar algo.
 */
export function ligarLogoutDoServidor(): void {
  client.on("logout", () => {
    bilhete = undefined;
    esquecerToken();
    fora();
  });
}
