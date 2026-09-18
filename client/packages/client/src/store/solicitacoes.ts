/**
 * Solicitações de mensagem — a DM de quem não é seu amigo, antes de ler.
 *
 * ⚠ **O protocolo NÃO separa.** Toda DM entra igual no `Ready` e em
 * `channelCreate`; não há campo "pendente", rota de aceite nem evento. A fila é
 * conceito de CLIENTE, como `pastas.ts` e `silencio.ts`, e a consequência
 * honesta é a mesma deles: a decisão vale NESTA máquina. Aceitar aqui não
 * avisa a outra pessoa e não move nada no celular.
 *
 * O interruptor que liga tudo isto já existia — "Filtrar mensagens de
 * desconhecidos", em Privacidade — e até agora não filtrava nada.
 *
 * ⚠ **Por que existe `inicio`, e sem ele a feature seria um defeito.** Ligar o
 * filtro sobre uma conta antiga jogaria na fila TODA conversa com quem não é
 * amigo — inclusive a que a pessoa mantém há um ano com um colega de servidor.
 * O que separa "desconhecido chegando" de "conversa que já existia" é QUANDO a
 * DM foi criada, e isso o protocolo dá de graça: o ID do canal é ULID. DM
 * criada antes da primeira vez que este store rodou nesta máquina fica onde
 * sempre esteve.
 *
 * Não vai no preset, pela regra de sempre: carrega IDs de canal.
 */

import type { Relacao } from "../sdk/domain";

const CHAVE = "vortex:solicitacoes";

/** O que a pessoa decidiu sobre UMA conversa. */
export type Decisao =
  | { readonly estado: "aceita" }
  /**
   * Recusada ATÉ a mensagem que estava lá no momento da recusa.
   *
   * ⚠ Guardar só "recusada" esconderia a pessoa para sempre, inclusive quando
   * ela escreve de novo semanas depois — e recusar uma mensagem não é o mesmo
   * que bloquear quem a mandou. Quem quer isso tem o bloqueio, que o servidor
   * conhece. Mensagem nova devolve a conversa à fila.
   */
  | { readonly estado: "recusada"; readonly ate: string | undefined };

type Estado = {
  /** Epoch em ms da primeira leitura deste store nesta máquina. */
  readonly inicio: number;
  readonly decisoes: Readonly<Record<string, Decisao>>;
};

/* ------------------------------------------------------------ decisão pura */

/** O que o adapter sabe de uma conversa na hora de publicar. */
export type EntradaDeConversa = {
  readonly tipo: "dm" | "grupo" | "notas";
  /** A relação com o outro lado. `undefined` fora de DM ou pessoa não carregada. */
  readonly relacao: Relacao | undefined;
  /** Criação do canal, decodificada do ULID. */
  readonly criadaEm: number;
  readonly ultimaMensagemId: string | undefined;
};

export type Destino = "conversa" | "solicitacao" | "oculta";

/**
 * Para onde a conversa vai: a coluna, a fila ou lugar nenhum.
 *
 * Função PURA e separada do store porque é aqui que mora a regra inteira, e é
 * ela que se testa — o store só guarda o que a pessoa escolheu.
 */
export function destinoDaConversa(
  e: EntradaDeConversa,
  contexto: {
    readonly filtrar: boolean;
    readonly inicio: number;
    readonly decisao: Decisao | undefined;
    /**
     * A privacidade por servidor da pessoa LOCAL barra este remetente?
     * (`store/privacidadeDoServidor.ts`, `privacidadeRestringe`).
     *
     * Função e não booleano: responder pode custar uma busca de servidores em
     * comum, e só vale pagar quando a conversa chegou até esta pergunta —
     * amigo, bloqueado e conversa aceita saem antes.
     */
    readonly restritaPorPrivacidade?: () => boolean;
  },
): Destino {
  // Grupo e notas: não há "outro lado" desconhecido. Grupo só inclui quem é
  // amigo de quem adicionou, e as notas são você.
  if (e.tipo !== "dm") return "conversa";

  const { decisao } = contexto;
  if (decisao?.estado === "aceita") return "conversa";

  /*
    Bloqueado não volta à fila nem entra na coluna. A pessoa não pode escrever
    de novo, então "mensagem nova devolve à fila" não se aplica — e mostrar a
    conversa de alguém que você bloqueou seria desfazer o gesto pela metade.
  */
  if (e.relacao === "bloqueado") {
    return decisao?.estado === "recusada" ? "oculta" : "conversa";
  }

  // Amigo, e quem VOCÊ procurou: não é desconhecido chegando.
  if (e.relacao === "amigo" || e.relacao === "enviado") return "conversa";

  if (e.criadaEm < contexto.inicio) return "conversa";
  // Sem mensagem não há o que ler antes de decidir.
  if (e.ultimaMensagemId === undefined) return "conversa";
  /*
    ⚠ **A privacidade por servidor vale com o filtro global DESLIGADO.** São
    duas escolhas diferentes: "filtrar desconhecidos" é sobre qualquer pessoa,
    "ninguém deste servidor" é sobre as pessoas de um lugar. Quem fechou as DMs
    de um servidor não pediu que isso dependesse de outro interruptor. E ela
    DESVIA para a fila, nunca esconde: o servidor já recusa conversa nova, e o
    que chega aqui é conversa que existia antes da escolha.
  */
  if (!contexto.filtrar && !contexto.restritaPorPrivacidade?.()) {
    return "conversa";
  }

  if (decisao?.estado === "recusada" && decisao.ate === e.ultimaMensagemId) {
    return "oculta";
  }
  return "solicitacao";
}

/**
 * Por que o conteúdo de uma solicitação fica escondido — ou `undefined`.
 *
 * ⚠ **Heurística, e dita como tal.** O design esconde a prévia de quem manda
 * link de convite, e a razão é a de sempre em golpe por DM: o link é o golpe, e
 * ler já é metade do caminho. Link qualquer também conta — de desconhecido,
 * "mostrar mensagem" custa um clique e um link malicioso custa a conta.
 */
export function sinalDeSuspeita(texto: string): string | undefined {
  if (RE_CONVITE.test(texto)) return "link de convite detectado";
  if (RE_LINK.test(texto)) return "link detectado";
  return undefined;
}

const RE_CONVITE =
  /\b(?:discord\.gg|discord(?:app)?\.com\/invite|stt\.gg|rvlt\.gg|revolt\.chat\/invite)\/|\/(?:invite|convite)\/[\w-]+/i;
const RE_LINK = /\bhttps?:\/\/\S/i;

/* ------------------------------------------------------------------- store */

function ler(): Estado {
  const agora = Date.now();
  try {
    const cru = localStorage.getItem(CHAVE);
    if (cru) {
      const o: unknown = JSON.parse(cru);
      if (typeof o === "object" && o !== null) {
        const r = o as Record<string, unknown>;
        const inicio = typeof r.inicio === "number" ? r.inicio : agora;
        return { inicio, decisoes: lerDecisoes(r.decisoes) };
      }
    }
  } catch {
    /* JSON podre ou armazenamento bloqueado: começa de novo. */
  }
  const novo: Estado = { inicio: agora, decisoes: {} };
  gravar(novo);
  return novo;
}

/**
 * Conferido na LEITURA: `localStorage` é editável por quem usa o app, e uma
 * decisão com forma inventada não pode virar um estado que a regra não conhece.
 */
function lerDecisoes(bruto: unknown): Record<string, Decisao> {
  const saida: Record<string, Decisao> = {};
  if (typeof bruto !== "object" || bruto === null) return saida;
  for (const [id, d] of Object.entries(bruto as Record<string, unknown>)) {
    if (typeof d !== "object" || d === null) continue;
    const r = d as Record<string, unknown>;
    if (r.estado === "aceita") saida[id] = { estado: "aceita" };
    else if (r.estado === "recusada") {
      saida[id] = {
        estado: "recusada",
        ate: typeof r.ate === "string" ? r.ate : undefined,
      };
    }
  }
  return saida;
}

function gravar(e: Estado): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* Vale nesta aba — mesma decisão de `pastas.ts`. */
  }
}

let estado: Estado = ler();

const ouvintes = new Set<() => void>();

export function assinarSolicitacoes(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function inicioDasSolicitacoes(): number {
  return estado.inicio;
}

export function decisaoSobre(channelId: string): Decisao | undefined {
  return estado.decisoes[channelId];
}

function decidir(channelId: string, decisao: Decisao): void {
  const atual = estado.decisoes[channelId];
  if (
    atual?.estado === decisao.estado &&
    (decisao.estado !== "recusada" ||
      (atual.estado === "recusada" && atual.ate === decisao.ate))
  ) {
    return;
  }
  estado = {
    ...estado,
    decisoes: { ...estado.decisoes, [channelId]: decisao },
  };
  gravar(estado);
  for (const o of ouvintes) o();
}

/** Vira conversa normal. Também é o que abrir uma DM por conta própria faz. */
export function aceitarSolicitacao(channelId: string): void {
  decidir(channelId, { estado: "aceita" });
}

/** Some da fila até a pessoa escrever de novo. */
export function recusarSolicitacao(
  channelId: string,
  ultimaMensagemId: string | undefined,
): void {
  decidir(channelId, { estado: "recusada", ate: ultimaMensagemId });
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparSolicitacoes(inicio = 0): void {
  estado = { inicio, decisoes: {} };
}
