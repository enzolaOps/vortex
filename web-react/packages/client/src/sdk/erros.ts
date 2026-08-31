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
};

/** Quando não há `type`, o status ainda diz alguma coisa. */
function porStatus(status: number | undefined): string | undefined {
  if (status === undefined) return undefined;
  if (status === 401 || status === 403) return "O servidor recusou o acesso.";
  if (status === 404) return "Isso não existe mais.";
  if (status === 429) return "Tentativas demais. Espere um pouco.";
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
  if (typeof tipo === "string") {
    const frase = POR_TIPO[tipo];
    if (frase !== undefined) return frase;
  }

  /*
    O `.response.status` fica no caminho de leitura mesmo sendo a forma que o
    `stoat-api` não usa: nem toda chamada do app passa por ele — há `fetch`
    direto em `conta.ts` e em `servidores.ts` —, e um dia pode voltar.
  */
  const status =
    (corpo as { response?: { status?: number } } | null)?.response?.status ??
    (corpo as { status?: number } | null)?.status;

  return (
    porStatus(typeof status === "number" ? status : undefined) ??
    "Sem resposta do servidor. Verifique sua conexão."
  );
}
