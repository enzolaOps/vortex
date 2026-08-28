/**
 * O próprio perfil e a própria conta.
 *
 * Separado de `conta.ts`, que cuida do que acontece ANTES de haver sessão —
 * criar, verificar, recuperar. Aqui é o que só existe depois: editar quem você
 * é e derrubar dispositivos.
 */
import { client } from "./client";
import { toast } from "../components/ui/toastStore";

export type MeuPerfil = {
  readonly displayName: string;
  readonly username: string;
  readonly pronomes: string;
  readonly bio: string;
};

export type Dispositivo = {
  readonly id: string;
  readonly nome: string;
  /** É a sessão desta aba. Não pode ser derrubada por engano. */
  readonly atual: boolean;
};

function motivo(e: unknown): string {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status === 401) return "Senha incorreta.";
  if (status === 409) return "Esse nome de usuário já está em uso.";
  if (status === 400) return "O servidor recusou os dados.";
  if (status === 429) return "Tentativas demais. Espere um pouco.";
  if (status !== undefined && status >= 500) {
    return "O servidor não conseguiu responder.";
  }
  if (status !== undefined) return "O servidor recusou o pedido.";
  return "Sem resposta do servidor.";
}

function falhou(oQue: string, e: unknown): void {
  toast({ tipo: "erro", titulo: oQue, descricao: motivo(e) });
}

/** O que os campos do perfil mostram hoje. Lido do cache do SDK. */
export function lerMeuPerfil(): MeuPerfil | undefined {
  const eu = client.user;
  if (!eu) return undefined;
  return {
    displayName: eu.displayName || eu.username,
    username: eu.username,
    pronomes: eu.pronouns ?? "",
    /*
      A bio NÃO está no cache do usuário.

      `profile.content` vem de `fetchProfile()`, que é uma chamada própria — o
      `Ready` não a manda. Começar vazia e deixar a pessoa escrever é honesto;
      o que seria errado é mostrar vazio E salvar por cima do que existe, e por
      isso `salvarPerfil` só envia a bio quando ela tem conteúdo.
    */
    bio: "",
  };
}

/**
 * Salva nome de exibição, pronomes e bio.
 *
 * Os três num `edit` só porque o protocolo aceita — e porque um formulário com
 * três botões "salvar" faz a pessoa salvar um e perder os outros dois.
 *
 * ⚠ **Campo vazio vira REMOÇÃO, não string vazia.** O protocolo tem
 * `remove: ["Pronouns"]` justamente porque `""` e "não declarado" são coisas
 * diferentes: a segunda esconde a linha do cartão de perfil, a primeira
 * mostraria uma linha em branco.
 */
export async function salvarPerfil(
  displayName: string,
  pronomes: string,
  bio: string,
): Promise<boolean> {
  try {
    const remover: string[] = [];
    if (!displayName) remover.push("DisplayName");
    if (!pronomes) remover.push("Pronouns");
    if (!bio) remover.push("ProfileContent");

    await client.user?.edit({
      ...(displayName ? { display_name: displayName } : {}),
      ...(pronomes ? { pronouns: pronomes } : {}),
      ...(bio ? { profile: { content: bio } } : {}),
      ...(remover.length ? { remove: remover as never } : {}),
    });
    return true;
  } catch (e) {
    falhou("Não deu para salvar o perfil.", e);
    return false;
  }
}

/**
 * Troca o nome de usuário. Pede a senha — é mudança de identidade.
 *
 * O protocolo exige a senha aqui e não no resto do perfil, e a razão é boa:
 * nome de exibição é como você se apresenta, nome de usuário é como as pessoas
 * te ACHAM. Trocá-lo por trás de uma sessão esquecida em outro computador
 * sequestraria a identidade sem tocar na senha.
 */
export async function trocarNomeDeUsuario(
  novo: string,
  senha: string,
): Promise<boolean> {
  try {
    await client.user?.changeUsername(novo, senha);
    return true;
  } catch (e) {
    falhou("Não deu para trocar o nome.", e);
    return false;
  }
}

export async function trocarSenha(nova: string, atual: string): Promise<boolean> {
  try {
    await client.account.changePassword(nova, atual);
    toast({ tipo: "info", titulo: "Senha alterada." });
    return true;
  } catch (e) {
    falhou("Não deu para trocar a senha.", e);
    return false;
  }
}

export async function trocarEmail(novo: string, senha: string): Promise<boolean> {
  try {
    await client.account.changeEmail(novo, senha);
    toast({
      tipo: "info",
      titulo: "E-mail alterado.",
      descricao: "Confirme pelo link que mandamos para o endereço novo.",
    });
    return true;
  } catch (e) {
    falhou("Não deu para trocar o e-mail.", e);
    return false;
  }
}

/* ----------------------------------------------------------- dispositivos */

/**
 * Os dispositivos com sessão aberta.
 *
 * ⚠ Estava adiada desde a etapa 2 por não haver onde morar. Agora mora aqui, e
 * é a superfície que transforma "meu token está em `localStorage`" de risco
 * abstrato em algo com que dá para fazer alguma coisa: quem desconfia de um
 * acesso derruba aquele acesso.
 */
export async function listarDispositivos(): Promise<readonly Dispositivo[]> {
  try {
    const sessoes = await client.sessions.fetch();
    const atual = client.sessionId;
    return sessoes.map((s) => ({
      id: s.id,
      nome: s.name,
      atual: s.id === atual,
    }));
  } catch (e) {
    falhou("Não deu para listar os dispositivos.", e);
    return [];
  }
}

export async function renomearDispositivo(
  id: string,
  nome: string,
): Promise<boolean> {
  try {
    await client.sessions.get(id)?.rename(nome);
    return true;
  } catch (e) {
    falhou("Não deu para renomear.", e);
    return false;
  }
}

/**
 * Derruba um dispositivo. Pede a senha.
 *
 * ⚠ **O protocolo exige um TICKET de MFA, não a senha crua** — e é por isso
 * que esta função é mais longa que as outras: `mfa.createTicket({password})`
 * troca a senha por um bilhete de uso único, e é o bilhete que autoriza.
 *
 * A senha é pedida porque derrubar sessão é justamente o que alguém faria com
 * uma sessão roubada para trancar o dono do lado de fora.
 */
export async function derrubarDispositivo(
  id: string,
  senha: string,
): Promise<boolean> {
  try {
    const mfa = await client.account.mfa();
    const bilhete = await mfa.createTicket({ password: senha });
    await client.sessions.get(id)?.delete(bilhete);
    return true;
  } catch (e) {
    falhou("Não deu para derrubar o dispositivo.", e);
    return false;
  }
}

/**
 * Derruba TODOS os outros.
 *
 * `revokeSelf: false` — a sessão desta aba fica. Derrubar a própria junto
 * deslogaria quem acabou de tomar a decisão de segurança, no exato momento em
 * que ela quer conferir se deu certo.
 */
export async function derrubarOutros(senha: string): Promise<boolean> {
  try {
    const mfa = await client.account.mfa();
    const bilhete = await mfa.createTicket({ password: senha });
    await client.sessions.deleteAll(bilhete, false);
    toast({ tipo: "info", titulo: "Os outros dispositivos foram desconectados." });
    return true;
  } catch (e) {
    falhou("Não deu para desconectar.", e);
    return false;
  }
}
