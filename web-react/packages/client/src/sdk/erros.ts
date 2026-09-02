import { formatarBytes } from "../lib/bytes";

/**
 * O que deu errado, em português, a partir do que o servidor realmente manda.
 *
 * ⚠ **Isto existe porque TODA mensagem de erro do app estava errada, e da
 * mesma forma.** Sete módulos de `sdk/` traduziam a falha lendo
 * `e.response.status` — a forma do `axios`, que este projeto não usa. O
 * `stoat-api` faz `throw data` com o CORPO já parseado, e corpo nenhum tem
 * `.response`. Resultado: o status era sempre `undefined`, todo `if` caía
 * fora, e cada falha virava a última linha da cadeia — "Sem resposta do
 * servidor. Verifique sua conexão." Senha errada dizia isso. E-mail repetido
 * dizia isso. Conta desativada dizia isso.
 *
 * Descoberto entrando no app contra o servidor local: o login falhava com
 * "Sem resposta do servidor" enquanto o `curl` do mesmo corpo respondia 200.
 *
 * ⚠ **A fonte primária é o `type`, não o status.** O Revolt devolve
 * `{"type":"InvalidCredentials", "location":"..."}` e é o `type` que distingue
 * os casos que o mesmo status agrupa — 400 cobre `ShortPassword`,
 * `MissingInvite` e mais uma dúzia de coisas sem relação. O status entra só
 * como rede de segurança para o que não tem `type`, como um 502 do proxy que
 * devolve HTML.
 */

/**
 * O corpo do erro como objeto — inclusive quando ele chega como STRING.
 *
 * ⚠ **O `stoat-api` lança a resposta em TEXTO, não parseada, e isso me custou
 * uma segunda rodada.** A linha dele é
 * `const data = await fetchdata.text()` seguida de `if (ok) return JSONParse(data)`
 * `else throw data` — ou seja, o sucesso vem objeto e a falha vem string. Meu
 * primeiro tradutor procurava `.type` direto no que foi lançado, achava
 * `undefined` numa string, e continuava respondendo "Sem resposta do
 * servidor" exatamente como o código que ele veio substituir.
 *
 * Medido no navegador contra a instância local: senha errada seguia dizendo
 * falha de rede depois do conserto. É o mesmo defeito duas vezes, e a segunda
 * só apareceu porque o teste da primeira também assumia objeto.
 */
function comoObjeto(e: unknown): unknown {
  if (typeof e !== "string") return e;
  try {
    return JSON.parse(e);
  } catch {
    /* Nem toda falha é JSON: um 502 de proxy devolve HTML, e uma rede caída
       devolve um `Error`. Devolver a string crua deixa o resto da cadeia
       seguir para o fallback de rede, que é a resposta certa para os dois. */
    return e;
  }
}

/** As respostas que valem uma frase própria. */
const POR_TIPO: Record<string, string> = {
  /* --------------------------------------------------------------- entrada */
  InvalidCredentials: "E-mail ou senha incorretos.",
  /*
    ⚠ O servidor responde `ShortPassword` para senha CURTA, e é o que ele diz
    quando a senha não bate com o mínimo dele — inclusive numa tentativa de
    login. Dizer "muito curta" a quem digitou a senha errada seria pior que o
    genérico, então aqui ele vira a mesma frase de credencial inválida no
    caminho de entrada; quem cria conta recebe a versão específica, porque lá a
    pessoa está escolhendo a senha agora.
  */
  ShortPassword: "E-mail ou senha incorretos.",
  DisabledAccount: "Esta conta está desativada.",
  UnverifiedAccount: "Confirme seu e-mail antes de entrar.",
  LockedOut: "Tentativas demais. Espere um pouco antes de tentar de novo.",
  InvalidSession: "Sua sessão expirou. Entre de novo.",
  InvalidToken: "O código não confere.",

  /* ----------------------------------------------------------------- conta */
  MissingInvite: "Esta instância exige um convite para criar conta.",
  InvalidInvite: "Este convite não vale.",
  EmailFailed: "Não deu para enviar o e-mail.",
  /*
    ⚠ `OperationFailed` é o que o servidor devolve para e-mail JÁ CADASTRADO —
    medido, com 500. Não é um erro interno de verdade, e tratá-lo como tal
    mandaria a pessoa "tentar de novo em instantes" para sempre.

    A frase não confirma que a conta existe: dizer "este e-mail já tem conta" a
    quem não a tem entrega quem está cadastrado na instância. Ela aponta a
    saída sem afirmar nada.
  */
  OperationFailed: "Não deu para criar a conta. Se ela já existe, tente entrar.",

  /* ------------------------------------------------------------ permissão */
  MissingPermission: "Você não tem permissão para isto.",
  NotElevated: "Seu cargo não está acima do dessa pessoa.",
  NotFound: "Isso não existe mais.",
  AlreadyOnboarded: "Esta conta já está pronta.",
  UsernameTaken: "Esse nome de usuário já está em uso.",

  /* --------------------------------------------- servidor de mídia (autumn) */
  /*
    ⚠ **O `autumn` é um serviço SEPARADO e responde com o mesmo envelope.**
    Foi por isso que ele não ganhou uma segunda tabela de frases: duas tabelas
    que precisam concordar divergem na primeira que alguém esquece — o mesmo
    argumento que juntou os pares de contraste num arquivo só.

    Os tipos foram lidos da fonte (`crates/services/autumn/src/api.rs`), não
    adivinhados: são exatamente estes cinco mais `InternalError`.
  */
  FileTooSmall: "Esse arquivo está vazio.",
  FileTypeNotAllowed: "Esse tipo de arquivo não é aceito aqui.",
  NotAuthenticated: "Sua sessão expirou. Entre de novo.",
};

/** Quando não há `type`, o status ainda diz alguma coisa. */
function porStatus(status: number | undefined): string | undefined {
  if (status === undefined) return undefined;
  if (status === 401 || status === 403) return "O servidor recusou o acesso.";
  if (status === 404) return "Isso não existe mais.";
  if (status === 429) return "Tentativas demais. Espere um pouco.";
  /*
    ⚠ 413 vem do servidor de mídia e NÃO traz o envelope do Revolt. Medido
    contra a instância local: corpo `request body is malformed (failed to read
    stream)`, texto puro, porque a camada de limite do axum corta antes do
    handler. Sem esta linha a frase virava "o servidor recusou o pedido", que
    não diz o que fazer.
  */
  if (status === 413) return "Esse arquivo é grande demais.";
  if (status >= 500) return "O servidor não conseguiu responder.";
  return "O servidor recusou o pedido.";
}

/**
 * A frase para quem está na tela.
 *
 * ⚠ **Nunca devolve o `type` cru nem a `location`.** O corpo do Revolt carrega
 * o arquivo e a linha do Rust onde a falha aconteceu; jogar isso na tela
 * expõe a versão do servidor e não ajuda ninguém que esteja tentando entrar.
 */
export function motivoDoErro(e: unknown): string {
  const corpo = comoObjeto(e);
  const tipo = (corpo as { type?: unknown } | null)?.type;

  /*
    ⚠ **`FileTooLarge` é o único com número, e o número é a mensagem.**
    "Esse arquivo é grande demais" sem dizer o teto obriga a pessoa a
    descobrir o limite por tentativa e erro, subindo o mesmo vídeo três vezes.

    E o teto NÃO está duplicado no cliente de propósito: ele vem de
    `user.limits()` no servidor e muda com a configuração da instância. O
    único jeito de a frase estar sempre certa é ela repetir o que o servidor
    acabou de dizer.
  */
  if (tipo === "FileTooLarge") {
    const max = (corpo as { max?: unknown } | null)?.max;
    const teto = typeof max === "number" ? formatarBytes(max) : undefined;
    return teto === undefined
      ? "Esse arquivo é grande demais."
      : `Esse arquivo passa do limite de ${teto}.`;
  }

  if (typeof tipo === "string") {
    const frase = POR_TIPO[tipo];
    if (frase !== undefined) return frase;
  }

  /*
    O `.response.status` fica no caminho de leitura mesmo sendo a forma que o
    `stoat-api` não usa: nem toda chamada do app passa por ele — há `fetch`
    direto em `conta.ts` e em `servidores.ts` —, e um dia pode voltar.
  */
  /*
    ⚠ **`retry_after` é a ASSINATURA de um 429, e sem esta leitura ele virava
    "verifique sua conexão".** Relatado por quem usa: mudar os pronomes e
    salvar devolvia cinco toasts dizendo que o servidor não respondeu — e o
    servidor tinha respondido, com 429.

    A causa é o `stoat-api`: ele faz `throw data` com o TEXTO cru da resposta
    (`src/index.ts`), sem status e sem envelope. O corpo de um 429 do Revolt é
    `{"retry_after": 3434}` e mais nada — não tem `type`, que é o que
    `POR_TIPO` lê, nem `status`, que é o que `porStatus` lê. As duas portas
    fechadas, e a frase de 429 que existe logo abaixo era INALCANÇÁVEL por
    este caminho.

    Medido contra a instância local: o SEGUNDO `PATCH /users/@me` seguido já
    devolve 429, com `retry_after` entre 3,4 e 9,4 segundos. Não é caso raro —
    é o que acontece quando alguém corrige um campo e salva de novo.

    ⚠ **Dizer os SEGUNDOS, e não só "espere um pouco".** "Tentativas demais"
    sem número é o que faz a pessoa clicar de novo na hora, que é exatamente o
    que renova o limite. O servidor já mandou quanto falta; repeti-lo é a
    diferença entre um aviso e uma instrução.
  */
  const espera = (corpo as { retry_after?: unknown } | null)?.retry_after;
  if (typeof espera === "number" && espera > 0) {
    const seg = Math.max(1, Math.ceil(espera / 1000));
    return `Tentativas demais. Espere ${String(seg)} segundo${seg === 1 ? "" : "s"}.`;
  }

  const status =
    (corpo as { response?: { status?: number } } | null)?.response?.status ??
    (corpo as { status?: number } | null)?.status;

  return (
    porStatus(typeof status === "number" ? status : undefined) ??
    "Sem resposta do servidor. Verifique sua conexão."
  );
}
