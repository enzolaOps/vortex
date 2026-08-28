/**
 * Onde a pessoa está.
 *
 * Store module-level, como todo o resto. Isto é o caso mais tentador de
 * Context que existe no app inteiro — "é só um ID, o app todo precisa dele" —
 * e é exatamente por isso que ele NÃO está em Context: Context propaga
 * tudo-ou-nada, e trocar de canal acordaria toda árvore que estivesse dentro
 * dele, incluindo painéis que não têm nada com o assunto.
 *
 * Aqui o rail assina o servidor ativo, a lista de canais assina o canal ativo,
 * e a member list não assina nenhum dos dois.
 */
import {
  definirCanalAberto,
  primeiroCanalDe,
  publicarConversas,
  publicarRelacoes,
} from "../sdk/adapter";

/**
 * O lugar, como UNIÃO MARCADA — e isto deixou de ser detalhe.
 *
 * Eram duas strings, e duas strings não conseguem dizer "estou na casa":
 * `servidorAtivo === ""` significava "nada escolhido", que é ausência de
 * lugar, não um lugar. Enquanto o app só tinha servidores isso não custava
 * nada; com DM, casa e convite entrando pelo plano de paridade, custa o
 * suficiente para não ser representável.
 *
 * É também o que o router precisa. A URL é PROJEÇÃO deste tipo — cada
 * variante vira um caminho e volta — e sem a marca não há o que projetar:
 * `("", "01ABC")` não diz se aquele canal é de servidor ou de DM.
 *
 * `dm` já é representável no domínio: `ChannelSnapshot.serverId` é opcional
 * desde a fase 3, de propósito. O que falta é a coluna que LISTA conversas, e
 * ela é da etapa 3 — o tipo chega antes porque é o tipo que destrava a rota.
 */
export type Local =
  | { readonly tipo: "casa" }
  /** A lista de pessoas: amigos, pedidos e bloqueados. */
  | { readonly tipo: "amigos" }
  | {
      readonly tipo: "servidor";
      readonly serverId: string;
      /** `undefined` = servidor sem canal visível. Estado legítimo. */
      readonly channelId: string | undefined;
    }
  | { readonly tipo: "dm"; readonly channelId: string };

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

const CASA: Local = { tipo: "casa" };

/**
 * O snapshot, e ele é CACHEADO.
 *
 * Antes eram duas strings, e primitivo compara por valor — `assertStable`
 * passava de graça. Agora é objeto, e a armadilha nº 1 do briefing volta a
 * valer aqui: montar `{tipo, serverId, channelId}` dentro do getter daria
 * referência nova a cada chamada e loop de render.
 */
let local: Local = CASA;

function emitir() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarNavegacao(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerLocal(): Local {
  return local;
}

/**
 * Os dois leitores antigos, agora DERIVADOS.
 *
 * Continuam devolvendo string por um motivo que não é compatibilidade: quem
 * assina só quer saber se o ID mudou, e string é comparada por valor pelo
 * `Object.is`. O rail que assina `useServidorAtivo` não acorda quando o canal
 * muda dentro do mesmo servidor — que é o comportamento que a lei nº 1 pede, e
 * que se perderia se todo mundo passasse a assinar o objeto inteiro.
 */
export function lerServidorAtivo(): string {
  return local.tipo === "servidor" ? local.serverId : "";
}

export function lerCanalAtivo(): string {
  if (local.tipo === "servidor") return local.channelId ?? "";
  if (local.tipo === "dm") return local.channelId;
  return "";
}

/**
 * Publica o lugar novo, avisando o adapter de qual canal está aberto.
 *
 * O empurrão vai do store para o adapter, nunca ao contrário: o handler de
 * `messageCreate` precisa saber qual canal está aberto no momento da ESCRITA,
 * e perguntar ao React de lá inverteria a direção do dado.
 */
function publicar(novo: Local): void {
  const canalAntes = lerCanalAtivo();
  local = novo;
  const canalDepois = lerCanalAtivo();

  if (canalAntes !== canalDepois) {
    definirCanalAberto(canalDepois || undefined);
  }
  emitir();
}

/** Abrir um canal zera as não-lidas dele. */
export function selecionarCanal(channelId: string): void {
  if (lerCanalAtivo() === channelId) return;

  if (local.tipo === "servidor") {
    publicar({ tipo: "servidor", serverId: local.serverId, channelId });
    return;
  }
  publicar({ tipo: "dm", channelId });
}

/**
 * Trocar de servidor abre o primeiro canal de texto dele.
 *
 * Servidor sem canal nenhum é estado legítimo — servidor recém-criado, ou um
 * onde a pessoa não tem permissão de ver nada. Nesse caso o canal fica
 * indefinido e a coluna de conteúdo mostra o estado vazio, em vez de manter
 * aberto o canal do lugar anterior.
 */
export function selecionarServidor(serverId: string): void {
  if (local.tipo === "servidor" && local.serverId === serverId) return;
  publicar({
    tipo: "servidor",
    serverId,
    channelId: primeiroCanalDe(serverId) ?? undefined,
  });
}

/**
 * Vai direto a um canal DENTRO de um servidor, sem passar pelo primeiro.
 *
 * É o que a rota precisa e o que os dois setters acima não sabem fazer:
 * `/servidor/A/canal/B` tem de abrir B, e `selecionarServidor` abriria o
 * primeiro canal de A antes de qualquer coisa — a pessoa veria o canal errado
 * piscar em toda abertura de link.
 */
export function irPara(serverId: string, channelId: string | undefined): void {
  if (
    local.tipo === "servidor" &&
    local.serverId === serverId &&
    local.channelId === channelId
  ) {
    return;
  }
  publicar({ tipo: "servidor", serverId, channelId });
}

export function abrirConversa(channelId: string): void {
  if (local.tipo === "dm" && local.channelId === channelId) return;
  publicar({ tipo: "dm", channelId });
}

export function irParaCasa(): void {
  /*
    Reordena a coluna AQUI, e não a cada mensagem.

    A ordem das conversas é por recência, e recalculá-la a cada mensagem seria
    `n log n` no caminho mais quente do app — 500 vezes por segundo sob
    firehose, para uma coluna que ninguém está olhando. Abrir a casa é o único
    momento em que a ordem é observável.
  */
  publicarConversas();
  if (local.tipo === "casa") return;
  publicar(CASA);
}

export function irParaAmigos(): void {
  /*
    Publica as abas AQUI, simétrico ao que `irParaCasa` faz com as conversas.

    Agrupar e ordenar quatro baldes é uma varredura sobre todo mundo que o
    cliente conhece, e fazê-la a cada `userUpdate` seria pagá-la centenas de
    vezes por segundo — `userUpdate` é o evento mais frequente que existe, e
    quase sempre só a presença mudou.

    ⚠ Sem esta linha as quatro abas abriam VAZIAS, e o defeito era invisível na
    leitura do código: a publicação existia, só que no `ready`, que não chega
    sem servidor. Apareceu abrindo a tela.
  */
  publicarRelacoes();
  if (local.tipo === "amigos") return;
  publicar({ tipo: "amigos" });
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparNavegacao(): void {
  local = CASA;
}
