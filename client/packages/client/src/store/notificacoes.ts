/**
 * Preferências de notificação.
 *
 * ⚠ **A preferência é REAL e persistida em `localStorage`; o que falta é quem a consome.** Som,
 * push e badge no ícone dependem de coisas que este app ainda não tem — áudio,
 * service worker, casca Electron. A escolha entre "não construir a tela" e
 * "construir com o consumo pendente" foi tomada: a segunda, porque a regra
 * deste projeto é construir a interface 1:1 e registrar o que não funciona.
 *
 * A forma não muda quando o notificador chegar: ele lê daqui.
 *
 * Store module-level com `useSyncExternalStore`, como `silencio.ts` e
 * `colapso.ts` — preferência de leitura, mudada por clique humano, lida por
 * booleano. Um store por chave seria maquinário para uma dúzia de itens.
 */

/**
 * Os oito eventos do design, na ordem dele — cada um com o PADRÃO dos três
 * canais.
 *
 * ⚠ **O padrão é por EVENTO, e não uma regra global.** Ele carrega a única
 * opinião de produto desta tela: o que interrompe (menção direta, DM, chamada)
 * vale som e push; o resto fica no toast. Uma regra global daria bipe por
 * mensagem em servidor movimentado, que é o motivo pelo qual as pessoas
 * desligam notificação inteira em vez de ajustá-la.
 *
 * Evento do servidor é o único SEM toast: ele chega dez minutos antes, e um
 * toast que aparece e some não é o que faz alguém não perder a hora.
 */
export const EVENTOS_DE_NOTIFICACAO = [
  {
    id: "mensagem",
    rotulo: "Mensagem em canal",
    detalhe: 'Canais com "todas as mensagens"',
    padrao: ["toast"],
  },
  {
    id: "mencaoDireta",
    rotulo: "Menção direta",
    detalhe: "@você, resposta à sua mensagem",
    padrao: ["toast", "som", "push"],
  },
  {
    id: "mencaoDeCargo",
    rotulo: "Menção de cargo",
    detalhe: "@Design, @Moderação",
    padrao: ["toast"],
  },
  {
    id: "dm",
    rotulo: "Mensagem direta",
    detalhe: "DM 1:1 e grupo",
    padrao: ["toast", "som", "push"],
  },
  {
    id: "chamada",
    rotulo: "Chamada recebida",
    detalhe: "Voz e vídeo em DM",
    padrao: ["toast", "som", "push"],
  },
  {
    id: "amizade",
    rotulo: "Pedido de amizade",
    detalhe: "Novos pedidos e aceites",
    padrao: ["toast"],
  },
  {
    id: "topico",
    rotulo: "Tópico seguido",
    detalhe: "Respostas em threads que você segue",
    padrao: ["toast"],
  },
  {
    id: "evento",
    rotulo: "Evento do servidor",
    detalhe: "10 minutos antes de começar",
    padrao: ["push"],
  },
] as const satisfies readonly {
  id: string;
  rotulo: string;
  detalhe: string;
  padrao: readonly ("toast" | "som" | "push")[];
}[];

export type EventoDeNotificacao = (typeof EVENTOS_DE_NOTIFICACAO)[number]["id"];

/** Os três canais de entrega. Fechado: canal novo não compila sem coluna. */
export const CANAIS_DE_ENTREGA = ["toast", "som", "push"] as const;
export type CanalDeEntrega = (typeof CANAIS_DE_ENTREGA)[number];

export type Preferencias = {
  readonly desktop: boolean;
  readonly push: boolean;
  readonly previa: boolean;
  readonly badge: boolean;
  readonly silencioNoturno: boolean;
  readonly silencioDas: string;
  readonly silencioAte: string;
  /** Domingo é 0, como `Date.getDay()`. */
  readonly silencioDias: readonly number[];
  /** `evento:canal` → ligado. Ausente = desligado. */
  readonly matriz: ReadonlySet<string>;
};

export function chaveDaMatriz(
  evento: EventoDeNotificacao,
  canal: CanalDeEntrega,
): string {
  return `${evento}:${canal}`;
}

/* Derivado das entradas acima: a lista é a fonte, não uma cópia dela. */
const PADRAO_DA_MATRIZ: ReadonlySet<string> = new Set(
  EVENTOS_DE_NOTIFICACAO.flatMap((e) =>
    e.padrao.map((c) => chaveDaMatriz(e.id, c)),
  ),
);

const CHAVE = "vortex:notificacoes";
const HORA = /^\d{2}:\d{2}$/;

const PADRAO: Preferencias = {
  desktop: true,
  push: true,
  previa: true,
  badge: true,
  silencioNoturno: true,
  silencioDas: "22:00",
  silencioAte: "08:00",
  /* Segunda a sexta: quem trabalha acorda cedo nos dias úteis, e o fim de
     semana é justamente quando a madrugada é escolha. */
  silencioDias: [1, 2, 3, 4, 5],
  matriz: PADRAO_DA_MATRIZ,
};

function booleano(v: unknown, recuo: boolean): boolean {
  return typeof v === "boolean" ? v : recuo;
}

function ler(): Preferencias {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return PADRAO;
    const o: unknown = JSON.parse(cru);
    if (typeof o !== "object" || o === null) return PADRAO;
    const r = o as Record<string, unknown>;
    const dias = Array.isArray(r.silencioDias)
      ? r.silencioDias.filter(
          (d): d is number => typeof d === "number" && d >= 0 && d <= 6,
        )
      : PADRAO.silencioDias;
    const matriz = Array.isArray(r.matriz)
      ? new Set(r.matriz.filter((c): c is string => typeof c === "string"))
      : PADRAO_DA_MATRIZ;
    return {
      desktop: booleano(r.desktop, PADRAO.desktop),
      push: booleano(r.push, PADRAO.push),
      previa: booleano(r.previa, PADRAO.previa),
      badge: booleano(r.badge, PADRAO.badge),
      silencioNoturno: booleano(r.silencioNoturno, PADRAO.silencioNoturno),
      silencioDas:
        typeof r.silencioDas === "string" && HORA.test(r.silencioDas)
          ? r.silencioDas
          : PADRAO.silencioDas,
      silencioAte:
        typeof r.silencioAte === "string" && HORA.test(r.silencioAte)
          ? r.silencioAte
          : PADRAO.silencioAte,
      silencioDias: dias.length > 0 ? dias : PADRAO.silencioDias,
      matriz,
    };
  } catch {
    return PADRAO;
  }
}

let prefs: Preferencias = ler();

const ouvintes = new Set<() => void>();

export function assinarNotificacoes(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável — trocada só quando algo muda de verdade. */
export function lerNotificacoes(): Preferencias {
  return prefs;
}

export function definirNotificacoes(mudanca: Partial<Preferencias>): void {
  prefs = { ...prefs, ...mudanca };
  try {
    localStorage.setItem(
      CHAVE,
      JSON.stringify({ ...prefs, matriz: [...prefs.matriz] }),
    );
  } catch {
    /* vale nesta aba */
  }
  for (const o of ouvintes) o();
}

export function alternarNaMatriz(
  evento: EventoDeNotificacao,
  canal: CanalDeEntrega,
): void {
  const chave = chaveDaMatriz(evento, canal);
  const proxima = new Set(prefs.matriz);
  if (!proxima.delete(chave)) proxima.add(chave);
  definirNotificacoes({ matriz: proxima });
}

export function alternarDia(dia: number): void {
  const tem = prefs.silencioDias.includes(dia);
  definirNotificacoes({
    silencioDias: tem
      ? prefs.silencioDias.filter((d) => d !== dia)
      : [...prefs.silencioDias, dia].sort((a, b) => a - b),
  });
}
