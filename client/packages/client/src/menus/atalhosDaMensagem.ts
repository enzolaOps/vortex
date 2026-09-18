import { copiarTexto } from "../lib/copiar";
import { EH_MAC } from "../lib/plataforma";
import { usuarioLocalId } from "../sdk/adapter";
import { pode } from "../sdk/permissoes";
import { administrar } from "../store/administracao";
import { responderA } from "../store/resposta";
import { editar } from "../store/edicaoDeMensagem";
import { channels, messages } from "../sdk/adapter";

/**
 * Os atalhos que o menu da mensagem EXIBE.
 *
 * ⚠ **Eles estavam escritos ao lado dos itens e não faziam nada.** `R`, `E`,
 * `⌫` e `⇧⌘C` aparecem no menu desde que ele foi construído — a auditoria de
 * clique direito os mediu como "atalhos exibidos sem handler". Um atalho
 * anunciado que não funciona é pior que atalho nenhum: quem o tenta uma vez
 * conclui que o app está quebrado e não tenta os outros.
 *
 * ⚠ **A função é a mesma que o item do menu chama**, e não um segundo caminho.
 * Dois caminhos para a mesma ação divergem no primeiro que ganha uma condição
 * — e aqui a condição é permissão, que é exatamente o que não pode divergir.
 *
 * Fora de componente para poder ser exercitada: a decisão ("esta tecla faz
 * isto com esta mensagem?") é pura sobre o snapshot e as permissões.
 */

/** O formato mínimo de tecla que `atalhoDaMensagem` precisa. */
export type TeclaDeAtalho = {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
};

/** O que a tecla PEDE, antes de qualquer permissão. */
export type AcaoDeAtalho =
  | "responder"
  | "editar"
  | "apagar"
  | "copiarLink";

/**
 * Qual ação a tecla pede — `null` quando ela não é deste mecanismo.
 *
 * ⚠ **`metaKey` no Mac e `ctrlKey` no resto, nunca os dois.** Aceitar
 * `Ctrl+Shift+C` num Mac roubaria o atalho do DevTools; aceitar `⌘` no Windows
 * não custa nada porque a tecla não existe, mas dizer que aceita seria falso.
 */
export function acaoDaTecla(tecla: TeclaDeAtalho): AcaoDeAtalho | null {
  const mod = EH_MAC ? tecla.metaKey : tecla.ctrlKey;

  if (mod && tecla.shiftKey && tecla.key.toLowerCase() === "c") {
    return "copiarLink";
  }
  /* Daqui para baixo, modificador nenhum: `Alt+R` é do navegador, e `Ctrl+E`
     é a barra de endereço em metade deles. */
  if (tecla.ctrlKey || tecla.metaKey || tecla.altKey) return null;

  if (tecla.key.toLowerCase() === "r") return "responder";
  if (tecla.key.toLowerCase() === "e") return "editar";
  /*
    ⚠ **`Delete` E `Backspace`.** O menu desenha `⌫`, que é o Backspace — mas
    num teclado completo `Delete` é a tecla que a mão procura para apagar, e
    aceitar só uma faria metade das pessoas concluir que o atalho não existe.
  */
  if (tecla.key === "Backspace" || tecla.key === "Delete") return "apagar";

  return null;
}

/**
 * Executa o atalho sobre uma mensagem. `false` = não havia o que fazer.
 *
 * Devolver booleano e não `void` é o que permite ao chamador decidir sobre o
 * `preventDefault`: engolir a tecla quando a ação não é permitida faria
 * `Backspace` parar de funcionar dentro da lista sem nada explicar.
 */
export function executarAtalhoDeMensagem(
  acao: AcaoDeAtalho,
  messageId: string,
): boolean {
  const m = messages.getSnapshot(messageId);
  if (!m) return false;

  const souOAutor = m.authorId !== undefined && m.authorId === usuarioLocalId();

  switch (acao) {
    case "responder": {
      if (!pode(m.channelId, "responder")) return false;
      responderA(m.channelId, m.id);
      return true;
    }
    case "editar": {
      /* Editar é só do AUTOR, e não é permissão de servidor: o protocolo não
         deixa ninguém editar mensagem alheia, nem quem administra. */
      if (!souOAutor) return false;
      editar(m.id);
      return true;
    }
    case "apagar": {
      if (!souOAutor && !pode(m.channelId, "fixar")) return false;
      administrar({ tipo: "apagarMensagem", messageId: m.id });
      return true;
    }
    case "copiarLink": {
      /* O canal da MENSAGEM, e não a rota atual — a mesma regra do item do
         menu: nas fixadas, na busca e no chat da sala a rota é outra coisa. */
      const serverId = channels.getSnapshot(m.channelId)?.serverId;
      if (serverId === undefined) return false;
      void copiarTexto(
        `${location.origin}/servidor/${serverId}/canal/${m.channelId}/${m.id}`,
        "Link",
      );
      return true;
    }
  }
}
