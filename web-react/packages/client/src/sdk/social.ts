/**
 * Gente: conversas diretas, grupos e amizades.
 *
 * Mora em `src/sdk/` pela regra de sempre. O que sai daqui são IDs e `boolean`;
 * `User`, `Channel` e a grafia do protocolo ficam dentro.
 *
 * Todas as funções devolvem em vez de lançar, e o motivo é o mesmo do
 * `enviarMensagem`: quem chama é um `onClick`, e uma promessa rejeitada num
 * handler vira erro não tratado no console em vez de mensagem na tela.
 */
import { client } from "./client";
import { publicarConversas, publicarRelacoes } from "./adapter";
import { toast } from "../components/ui/toastStore";

/**
 * Avisa, e não engole.
 *
 * Uma amizade que não foi pedida e um grupo que não foi criado são invisíveis
 * sem isto: a tela fica igual e a pessoa tenta de novo. O toast é a única
 * superfície de erro que existe para ação que não tem tela própria.
 */
function falhou(oQue: string, e: unknown): void {
  const status = (e as { response?: { status?: number } })?.response?.status;
  const detalhe =
    status === 404
      ? "Não encontramos essa pessoa."
      : status === 403
        ? "Você não tem permissão para isso."
        : status === 409
          ? "Isso já foi feito."
          : status !== undefined
            ? "O servidor recusou."
            : "Sem resposta do servidor.";
  toast({ tipo: "erro", titulo: oQue, descricao: detalhe });
}

/**
 * Abre (ou reabre) a conversa direta com alguém.
 *
 * `openDM` é idempotente no protocolo: chamar com uma conversa já existente
 * devolve a mesma. É o que permite o botão "Mensagem" do perfil não precisar
 * saber se já houve conversa antes.
 *
 * Devolve o ID do canal para quem chamou navegar — este módulo não navega:
 * `sdk/` traduz protocolo, e decidir para onde a pessoa vai é do store de
 * navegação.
 */
export async function abrirConversaCom(
  userId: string,
): Promise<string | undefined> {
  try {
    const canal = await client.users.get(userId)?.openDM();
    if (!canal) return undefined;
    publicarConversas();
    return canal.id;
  } catch (e) {
    falhou("Não deu para abrir a conversa.", e);
    return undefined;
  }
}

export async function criarGrupo(
  nome: string,
  userIds: readonly string[],
): Promise<string | undefined> {
  try {
    const canal = await client.channels.createGroup(nome, [...userIds]);
    publicarConversas();
    return canal.id;
  } catch (e) {
    falhou("Não deu para criar o grupo.", e);
    return undefined;
  }
}

/**
 * Sai de um grupo, ou fecha uma conversa.
 *
 * A mesma chamada para os dois, e é o protocolo que decide o que ela significa:
 * `DELETE /channels/{id}` num grupo é sair, numa DM é fechar. O upstream tem os
 * dois no mesmo lugar pela mesma razão.
 */
export async function sairDaConversa(channelId: string): Promise<boolean> {
  try {
    await client.channels.get(channelId)?.delete();
    publicarConversas();
    return true;
  } catch (e) {
    falhou("Não deu para sair.", e);
    return false;
  }
}

/* -------------------------------------------------------------- amizades */

/**
 * Pede amizade pelo nome de usuário.
 *
 * `POST /users/friend` com `username` — e não `User.addFriend()`, que exige já
 * ter o objeto da pessoa. Quem digita um nome numa caixa ainda não tem objeto
 * nenhum; é exatamente o caso que o método do SDK não cobre.
 */
export async function pedirAmizade(username: string): Promise<boolean> {
  try {
    await client.api.post("/users/friend" as never, { username } as never);
    publicarRelacoes();
    return true;
  } catch (e) {
    falhou("Não deu para enviar o pedido.", e);
    return false;
  }
}

/**
 * Aceita um pedido recebido.
 *
 * ⚠ **`PUT /users/{id}/friend` não tem método no SDK**, e o cliente Solid
 * contorna reenviando `addFriend()` pelo nome de usuário — o que funciona por
 * efeito colateral (o servidor trata pedido mútuo como aceite) e falha se a
 * pessoa tiver trocado de nome entre o pedido e o aceite.
 *
 * Aqui a rota certa é chamada direto. `client.api` é tipado sobre o OpenAPI
 * inteiro; "não está no SDK" não quer dizer "não dá".
 */
export async function aceitarAmizade(userId: string): Promise<boolean> {
  try {
    await client.api.put(`/users/${userId}/friend` as never);
    publicarRelacoes();
    return true;
  } catch (e) {
    falhou("Não deu para aceitar.", e);
    return false;
  }
}

/**
 * Recusa, cancela ou desfaz — as três são a mesma chamada.
 *
 * O protocolo tem um `DELETE` só, e o que ele significa depende do estado da
 * relação. Três funções aqui dariam a impressão de três operações; o que muda é
 * o RÓTULO na tela, e isso é decisão de componente.
 */
export async function desfazerAmizade(userId: string): Promise<boolean> {
  try {
    await client.users.get(userId)?.removeFriend();
    publicarRelacoes();
    return true;
  } catch (e) {
    falhou("Não deu para concluir.", e);
    return false;
  }
}

export async function bloquear(userId: string): Promise<boolean> {
  try {
    await client.users.get(userId)?.blockUser();
    publicarRelacoes();
    return true;
  } catch (e) {
    falhou("Não deu para bloquear.", e);
    return false;
  }
}

export async function desbloquear(userId: string): Promise<boolean> {
  try {
    await client.users.get(userId)?.unblockUser();
    publicarRelacoes();
    return true;
  } catch (e) {
    falhou("Não deu para desbloquear.", e);
    return false;
  }
}
