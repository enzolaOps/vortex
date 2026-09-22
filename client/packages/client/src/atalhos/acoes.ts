/**
 * O que cada atalho FAZ.
 *
 * Separado de `registro.ts` para que o registro seja só a tabela — tecla,
 * rótulo, grupo — e possa ser lido inteiro de uma vez. Aqui mora o trabalho,
 * e é ele que o teste exercita.
 *
 * ⚠ **Nenhuma destas funções conhece teclado.** Elas são chamadas pelo
 * listener, pelo composer e pelo teste, e as três passam pelo mesmo caminho —
 * que é o que impede o atalho de funcionar num lugar e não no outro.
 */
import {
  channelMessageIds,
  channels,
  marcarCanalLido,
  messages,
  usuarioLocalId,
} from "../sdk/adapter";
import {
  canaisOrdenados,
  conversasOrdenadas,
  servidoresOrdenados,
  vizinho,
} from "../sdk/ordem";
import {
  abrirConversa,
  irPara,
  irParaCasa,
  lerLocal,
  selecionarCanal,
} from "../store/navegacao";
import { alternarSuperficie } from "../store/drawer";
import { editar } from "../store/edicaoDeMensagem";
import { responderA } from "../store/resposta";
import { abrirSeletorDeReacao } from "../store/seletorDeReacao";
import { lerAlvoDoMenu } from "../store/menuDeMensagem";
import { pode } from "../sdk/permissoes";
import { abrirFerramentaDoComposer } from "../store/ferramentaDoComposer";
import { abrirPaleta } from "../store/paleta";

/* ------------------------------------------------------------- navegação */

/**
 * O canal atual, seja ele de servidor ou de conversa.
 *
 * Existe porque `lerCanalAtivo` devolve `""` para "nenhum", e `""` é um id
 * válido para `indexOf` — o que faria o vizinho ser calculado sobre uma
 * posição que não existe em vez de cair no ramo de ausência.
 */
function canalAtual(): string | undefined {
  const local = lerLocal();
  if (local.tipo === "servidor") return local.channelId;
  if (local.tipo === "dm") return local.channelId;
  return undefined;
}

export function irParaServidorVizinho(passo: 1 | -1): void {
  const local = lerLocal();
  const atual =
    local.tipo === "servidor" || local.tipo === "eventos"
      ? local.serverId
      : undefined;
  const alvo = vizinho(servidoresOrdenados(), atual, passo);
  if (alvo === undefined) return;
  /*
    Abre o servidor E o primeiro canal dele, que é o que `irPara` com
    `undefined` resolve. Trocar de servidor e cair numa coluna sem conversa
    seria pior que não trocar: a tela perde o conteúdo e a única pista do que
    aconteceu é a sidebar mudando.
  */
  irPara(alvo, undefined);
}

/**
 * Canal anterior / próximo — e a lista depende de ONDE a pessoa está.
 *
 * Na casa e nas conversas a sequência é a das DMs; num servidor, a dos canais
 * dele. É a mesma coluna que a tecla percorre, e é isso que faz o atalho
 * parecer a coluna em vez de uma segunda ordenação escondida.
 */
export function irParaCanalVizinho(passo: 1 | -1): void {
  const local = lerLocal();

  if (local.tipo === "servidor") {
    const alvo = vizinho(canaisOrdenados(local.serverId), local.channelId, passo);
    if (alvo !== undefined) selecionarCanal(alvo);
    return;
  }

  if (local.tipo === "dm" || local.tipo === "casa") {
    const atual = local.tipo === "dm" ? local.channelId : undefined;
    const alvo = vizinho(conversasOrdenadas(), atual, passo);
    if (alvo !== undefined) abrirConversa(alvo);
  }
}

/**
 * O canal não lido mais ANTIGO.
 *
 * "Mais antigo" é o primeiro na ordem da coluna e não o de menor ULID: quem
 * aperta ⇧⌥↑ está limpando a coluna de cima para baixo, e a ordem que a mão
 * espera é a que os olhos veem. Silenciado não conta — silenciar é pedir para
 * não ser chamado, e um atalho que leva até lá é exatamente ser chamado.
 */
export function irParaCanalNaoLido(): void {
  for (const serverId of servidoresOrdenados()) {
    for (const id of canaisOrdenados(serverId)) {
      const canal = channels.peek(id);
      if (!canal || canal.silenciado || canal.naoLidas === 0) continue;
      irPara(serverId, id);
      return;
    }
  }

  for (const id of conversasOrdenadas()) {
    const canal = channels.peek(id);
    if (!canal || canal.silenciado || canal.naoLidas === 0) continue;
    abrirConversa(id);
    return;
  }
}

/**
 * Voltar e avançar no histórico.
 *
 * `history` e não um store próprio: a URL é PROJEÇÃO da navegação desde o
 * router, e `popstate` já chama os mesmos setters que o rail chama. Um
 * segundo histórico aqui seria um segundo dono do mesmo estado.
 */
export function voltarNoHistorico(): void {
  history.back();
}

export function avancarNoHistorico(): void {
  history.forward();
}

export function irParaConversas(): void {
  irParaCasa();
}

export function abrirNavegadorRapido(): void {
  abrirPaleta();
}

/* ------------------------------------------------------------- mensagens */

/** A última mensagem do canal aberto, ou nada. */
function ultimaMensagemDoCanal(channelId: string): string | undefined {
  const ids = channelMessageIds.peek(channelId);
  return ids && ids.length > 0 ? ids[ids.length - 1] : undefined;
}

export function responderAUltima(): void {
  const channelId = canalAtual();
  if (!channelId || !pode(channelId, "responder")) return;
  const id = ultimaMensagemDoCanal(channelId);
  if (id) responderA(channelId, id);
}

/**
 * Editar a última mensagem SUA.
 *
 * ⚠ **Varre de trás para frente e só até a primeira que é sua** — não é
 * `filter().pop()`. Num canal com dez mil ids carregados, a diferença entre
 * parar na primeira e varrer tudo é a diferença entre uma tecla instantânea e
 * uma que engasga, e o gesto é "↑ no composer", que se repete.
 *
 * O protocolo não deixa ninguém editar mensagem alheia, nem quem administra —
 * então a condição é autoria, e não permissão de servidor.
 */
export function editarUltimaMinha(): void {
  const channelId = canalAtual();
  if (!channelId) return;
  const eu = usuarioLocalId();
  if (!eu) return;

  const ids = channelMessageIds.peek(channelId) ?? [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const m = messages.peek(ids[i]!);
    if (m?.authorId === eu) {
      editar(m.id);
      return;
    }
  }
}

/**
 * A mensagem que ⌘⇧E mira.
 *
 * ⚠ **Ponteiro → foco → alvo do menu**, nessa ordem, e cada degrau existe por
 * um caso. O `:hover` responde ao mouse; o foco responde a quem navega a lista
 * pelo teclado (as setas movem `tabindex` entre as linhas); o store responde
 * ao menu ABERTO, quando o ponteiro está sobre um portal fora da linha e o
 * `:hover` já não casa com nada.
 *
 * `:hover` dentro de `querySelectorAll` e não um listener de `pointermove`: o
 * navegador já mantém essa resposta, e perguntá-la no momento da tecla custa
 * zero enquanto ninguém aperta nada. A ÚLTIMA casada é a mais profunda, que é
 * a linha e não um ancestral.
 *
 * ⚠ **R, E e ⌫ NÃO passam por aqui** — eles já têm mecanismo próprio em
 * `menus/atalhosDaMensagem.ts`, disparado pela `MessageList` sobre a linha
 * FOCADA, e chamam as mesmas funções dos itens do menu. Um segundo caminho
 * para as mesmas três teclas divergiria na primeira condição de permissão que
 * um dos dois ganhasse.
 */
export function mensagemMirada(): string | undefined {
  if (typeof document !== "undefined") {
    const sob = document.querySelectorAll<HTMLElement>(
      "[data-menu-mensagem]:hover",
    );
    const ultima = sob[sob.length - 1];
    if (ultima?.dataset.menuMensagem) return ultima.dataset.menuMensagem;

    const focada = document.activeElement?.closest<HTMLElement>(
      "[data-menu-mensagem]",
    );
    if (focada?.dataset.menuMensagem) return focada.dataset.menuMensagem;
  }

  const alvo = lerAlvoDoMenu();
  return alvo?.tipo === "mensagem" ? alvo.id : undefined;
}

/**
 * Adicionar reação — no alvo mirado, ou na última do canal.
 *
 * A âncora é a LINHA no DOM, porque o seletor é um popover posicionado e
 * abri-lo sem âncora o põe em (0,0). Sem linha montada — a mensagem rolou
 * para fora — o atalho não faz nada, que é melhor que um painel no canto da
 * tela apontando para lugar nenhum.
 */
export function reagirNaMensagemMirada(): void {
  const channelId = canalAtual();
  const id = mensagemMirada() ?? (channelId && ultimaMensagemDoCanal(channelId));
  if (!id) return;
  const m = messages.peek(id);
  if (!m || !pode(m.channelId, "reagir")) return;

  const linha = document.querySelector(`[data-menu-mensagem="${CSS.escape(id)}"]`);
  if (!linha) return;
  abrirSeletorDeReacao(id, linha);
}

export function marcarCanalAtivoLido(): void {
  const channelId = canalAtual();
  if (channelId) marcarCanalLido(channelId);
}

/**
 * Marcar o SERVIDOR inteiro como lido.
 *
 * Canal a canal e não uma rota própria: o protocolo escreve o cursor de
 * leitura por canal (`ChannelUnread.lastMessageId`), e não existe "ack de
 * servidor". Os que já estão zerados são pulados — `marcarCanalLido` avisa o
 * servidor, e mandar quarenta `ack` de canais já lidos é tráfego por nada.
 */
export function marcarServidorAtivoLido(): void {
  const local = lerLocal();
  if (local.tipo !== "servidor") return;
  for (const id of canaisOrdenados(local.serverId)) {
    if ((channels.peek(id)?.naoLidas ?? 0) > 0) marcarCanalLido(id);
  }
}

/* --------------------------------------------------------------- painéis */

export function alternarMembros(): void {
  alternarSuperficie("membros");
}

export function alternarFixados(): void {
  alternarSuperficie("fixados");
}

export function alternarTopicos(): void {
  alternarSuperficie("topicos");
}

export function alternarCaixaDeEntrada(): void {
  alternarSuperficie("caixaDeEntrada");
}

export function alternarBuscaNoCanal(): void {
  alternarSuperficie("busca");
}

export function abrirSeletorDeEmoji(): void {
  abrirFerramentaDoComposer("emoji");
}

export function abrirSeletorDeGif(): void {
  abrirFerramentaDoComposer("gif");
}
