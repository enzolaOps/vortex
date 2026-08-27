/**
 * Entrar e sair — a fronteira entre o app e a sessão do SDK.
 *
 * Mora em `src/sdk/` porque toca o `client` diretamente, e é a camada
 * anticorrupção fazendo o de sempre: `DataLogin` e `Session` são formas do
 * protocolo, e nada disso sai daqui. A tela de login conhece `entrar(email,
 * senha)` e mais nada.
 *
 * ⚠ **`client.login()` é a única linha deste projeto que nunca rodou.** Não há
 * backend alcançável — `pi-infra` é outro repositório, e não existe
 * configuração de servidor aqui. Todo o resto do caminho é exercitado por
 * teste: a persistência, a restauração, a tradução do erro, o logout e as
 * transições de estado. A chamada em si está isolada num único ponto, de
 * propósito, para que o dia em que ela falhar tenha um lugar só para olhar.
 */
import { definirUsuarioLocal } from "./adapter";
import { client } from "./client";
import {
  dentro,
  entrando,
  erro,
  esquecerToken,
  fora,
  guardarToken,
  lerTokenGuardado,
} from "../store/sessao";

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
export function motivoDe(e: unknown): string {
  const status = (e as { response?: { status?: number } })?.response?.status;

  if (status === 401) return "E-mail ou senha incorretos.";
  if (status === 429) return "Tentativas demais. Espere um pouco.";
  if (status !== undefined && status >= 500) {
    return "O servidor não conseguiu responder. Tente de novo em instantes.";
  }
  if (status !== undefined) return "O servidor recusou o acesso.";
  return "Sem resposta do servidor. Verifique sua conexão.";
}

/**
 * Entra.
 *
 * O nome amigável identifica ESTA sessão na lista de dispositivos da conta —
 * é o que permite a pessoa reconhecer e derrubar um acesso que não é dela.
 * Genérico de propósito: "Vortex (web)" e não o user agent, que carrega versão
 * de sistema e navegador para uma lista que outras pessoas podem ver.
 */
export async function entrar(email: string, senha: string): Promise<void> {
  entrando();
  try {
    // ⚠ A linha que nunca rodou. Ver o cabeçalho.
    await client.login({
      email,
      password: senha,
      friendly_name: "Vortex (web)",
    });

    const eu = client.user?.id;
    if (!eu) {
      // Login que "deu certo" sem usuário é estado impossível pelo protocolo,
      // e virar `dentro` aqui produziria um app sem autor para as mensagens.
      erro("Entrou, mas o servidor não disse quem você é.");
      return;
    }

    guardarSessaoAtual(eu);
    definirUsuarioLocal(eu);
    dentro(eu);
  } catch (e) {
    erro(motivoDe(e));
  }
}

/**
 * Guarda a sessão que o SDK acabou de criar.
 *
 * Lida do `client` e não construída aqui: o `_id` da sessão é do servidor, e
 * inventá-lo produziria um token que restaura mas não pode ser revogado.
 */
function guardarSessaoAtual(userId: string): void {
  const s = (client as { session?: unknown }).session;
  if (typeof s === "object" && s !== null && "token" in s && "_id" in s) {
    guardarToken({
      _id: String((s as { _id: unknown })._id),
      token: String((s as { token: unknown }).token),
      user_id: userId,
    });
  }
}

/**
 * Tenta voltar com a sessão guardada. Chamado uma vez, na abertura.
 *
 * `useExistingSession` NÃO valida nada — ele só instala o token e conecta. Um
 * token revogado só se revela quando o socket recusa, e é por isso que o
 * evento `logout` do SDK precisa estar ligado: é ele quem descobre.
 *
 * Optimista de propósito: mostrar o app e cair para o login se o token morreu
 * é melhor que segurar a pessoa numa tela de espera a cada abertura para
 * confirmar algo que quase sempre está certo.
 */
export function restaurarSessao(): void {
  const guardado = lerTokenGuardado();
  if (!guardado) {
    fora();
    return;
  }

  try {
    client.useExistingSession({
      _id: guardado._id,
      token: guardado.token,
      user_id: guardado.user_id,
    });
    definirUsuarioLocal(guardado.user_id);
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
    esquecerToken();
    fora();
  });
}
