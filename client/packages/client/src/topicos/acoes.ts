import { podeAbrirTopico, topicoDaMensagem } from "../sdk/topicos";
import { pode } from "../sdk/permissoes";
import { administrar } from "../store/administracao";
import { selecionarCanal } from "../store/navegacao";

/**
 * "Criar tópico" a partir de uma mensagem — a barra de ações e o menu chamam isto.
 *
 * Se a mensagem já tem tópico, ABRE o que existe em vez de perguntar um nome
 * para depois o servidor devolver o mesmo tópico. O servidor também garante
 * um tópico por mensagem; conferir aqui poupa o modal.
 */
export function abrirTopicoDaMensagem(channelId: string, messageId: string): void {
  const existente = topicoDaMensagem(channelId, messageId);
  if (existente) {
    selecionarCanal(existente);
    return;
  }
  administrar({ tipo: "criarTopico", channelId, mensagemId: messageId });
}

/** Abrir tópico é ENVIAR no canal para o servidor — e só onde o protocolo aceita. */
export function podeCriarTopico(channelId: string): boolean {
  return podeAbrirTopico(channelId) && pode(channelId, "enviar");
}
