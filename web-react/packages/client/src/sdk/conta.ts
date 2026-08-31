/**
 * A conta: criar, verificar, recuperar senha, escolher nome de usuário.
 *
 * Mora em `src/sdk/` pela regra de sempre — toca o `client`, e `DataCreateAccount`
 * e companhia são formas do protocolo que não saem daqui. A tela conhece
 * `criarConta(email, senha)` e mais nada.
 *
 * ⚠ **Sem captcha, e isso é DECISÃO, não pendência.** O protocolo aceita um
 * campo `captcha` e o upstream monta um hCaptcha invisível em toda tela desta
 * família. O Vortex não vai ter: a instância é privada, quem entra é gente com
 * acesso ao repositório, e um verificador anti-robô de terceiro numa tela de
 * senha custa uma dependência, um `sitekey` e uma chamada a um domínio externo
 * em troca de nada.
 *
 * A consequência é dita: numa instância com `captcha` LIGADO no servidor estas
 * chamadas voltam 400. O caminho é desligar lá, não construir o widget aqui.
 */
import { client } from "./client";
import { definirUsuarioLocal } from "./adapter";
import { dentro, erro, lerSessao, precisaDeNome } from "../store/sessao";

/**
 * Traduz a falha das telas de conta.
 *
 * Separado de `motivoDe` do login de propósito: os mesmos códigos HTTP querem
 * dizer coisas diferentes aqui. Um 409 no login não existe; na criação de
 * conta é "esse e-mail já tem conta", que é a informação mais útil da tela.
 */
export function motivoDeConta(e: unknown): string {
  const status = (e as { response?: { status?: number } })?.response?.status;

  if (status === 409) return "Já existe uma conta com esse e-mail.";
  if (status === 400) {
    return "O servidor recusou os dados. Confira o e-mail e a senha.";
  }
  if (status === 401 || status === 403) {
    return "Este link expirou ou já foi usado. Peça outro.";
  }
  if (status === 429) return "Tentativas demais. Espere um pouco.";
  if (status !== undefined && status >= 500) {
    return "O servidor não conseguiu responder. Tente de novo em instantes.";
  }
  if (status !== undefined) return "O servidor recusou o pedido.";
  return "Sem resposta do servidor. Verifique sua conexão.";
}

/**
 * Cria a conta.
 *
 * Não entra: o protocolo manda um e-mail de verificação e a sessão só existe
 * depois. Quem chama leva a pessoa para "confira seu e-mail".
 *
 * ⚠ Numa instância com `features.email` desligado não há e-mail nenhum e a
 * conta já nasce utilizável — o upstream detecta isso e faz login direto. Aqui
 * a tela seguinte diz para tentar entrar, que funciona nos dois casos e não
 * depende de ler a configuração antes de o app ter servidor.
 */
export async function criarConta(
  email: string,
  senha: string,
  convite: string | undefined,
): Promise<boolean> {
  try {
    await client.account.create({
      email,
      password: senha,
      // Só vai quando existe: mandar `invite: ""` numa instância aberta é um
      // convite inválido, não a ausência de convite.
      ...(convite ? { invite: convite } : {}),
    });
    return true;
  } catch (e) {
    erro(motivoDeConta(e));
    return false;
  }
}

/** Confirma o e-mail pelo token do link. */
export async function verificarEmail(token: string): Promise<boolean> {
  try {
    await client.account.verify(token);
    return true;
  } catch (e) {
    erro(motivoDeConta(e));
    return false;
  }
}

/** Manda de novo o e-mail de verificação. */
export async function reenviarVerificacao(email: string): Promise<boolean> {
  try {
    await client.account.reverify(email);
    return true;
  } catch (e) {
    erro(motivoDeConta(e));
    return false;
  }
}

/** Pede o e-mail de redefinição de senha. */
export async function pedirRedefinicao(email: string): Promise<boolean> {
  try {
    await client.account.resetPassword(email);
    return true;
  } catch (e) {
    erro(motivoDeConta(e));
    return false;
  }
}

/**
 * Define a senha nova pelo token do link.
 *
 * `derrubarSessoes` marcado por padrão, e é a escolha segura: quem redefine
 * senha frequentemente o faz porque perdeu o acesso ou desconfia dele, e
 * manter as sessões antigas vivas manteria quem invadiu lá dentro.
 */
export async function confirmarRedefinicao(
  token: string,
  novaSenha: string,
  derrubarSessoes: boolean,
): Promise<boolean> {
  try {
    await client.account.confirmPasswordReset(token, novaSenha, derrubarSessoes);
    return true;
  } catch (e) {
    erro(motivoDeConta(e));
    return false;
  }
}

/* ------------------------------------------------------------ onboarding */

type Hello = { readonly onboarding: boolean };

/**
 * A conta recém-criada ainda precisa escolher nome de usuário?
 *
 * ⚠ **Nenhuma das duas rotas de onboarding existe no SDK** — nem
 * `GET /onboard/hello` nem `POST /onboard/complete`. O cliente Solid as chama
 * cruas, e aqui é o mesmo. `client.api` é tipado sobre o OpenAPI inteiro, então
 * "não está no SDK" não quer dizer "não dá".
 *
 * Sem isto, uma conta nova entra sem nome de usuário: as mensagens dela saem
 * sem autor legível e a member list mostra um ID.
 */
export async function precisaEscolherNome(): Promise<boolean> {
  try {
    const r = (await client.api.get("/onboard/hello" as never)) as Hello;
    return r.onboarding === true;
  } catch {
    /*
      Falhar aqui NÃO segura a entrada.

      Uma rota indisponível — instância antiga, proxy mal configurado — não pode
      transformar um login bem-sucedido numa tela travada. O custo de errar para
      este lado é a pessoa entrar sem escolher nome; o custo do outro lado é ela
      não entrar.
    */
    return false;
  }
}

/** Escolhe o nome de usuário e conclui a entrada. */
export async function escolherNome(nome: string): Promise<void> {
  try {
    await client.api.post("/onboard/complete" as never, { username: nome } as never);
    const eu = lerSessao().userId;
    if (eu) definirUsuarioLocal(eu);
    if (eu) dentro(eu);
  } catch (e) {
    /*
      Continua na tela de nome, com o motivo — o mais comum é o nome já estar
      em uso, e mandar a pessoa de volta ao login por isso seria absurdo.

      O `userId` vai junto e não pode faltar: é ele que `escolherNome` lê para
      concluir na tentativa seguinte. Passar só a mensagem gravaria o texto do
      erro no lugar da identidade, e a segunda tentativa entraria com um
      "usuário" chamado "Já existe uma conta com esse e-mail".
    */
    precisaDeNome(lerSessao().userId ?? "", motivoDeConta(e));
  }
}
