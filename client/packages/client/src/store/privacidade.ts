/**
 * Preferências de privacidade.
 *
 * ⚠ **Nenhuma delas está no protocolo Stoat**, e é diferente de "ainda não
 * implementei". O Revolt guarda em `UserSettings` um blob opaco por chave, sem
 * esquema — não há `DataEditUser` com "quem pode me mandar pedido de amizade".
 * Filtro de desconhecidos e política de pedido são conceito de CLIENTE aqui,
 * como `pastas.ts` e `colapso.ts`.
 *
 * A consequência honesta: elas valem nesta máquina. Quando o Vortex tiver
 * servidor próprio, sobem para `UserSettings` sem a tela mudar de forma — a
 * mesma promessa de `notificacoes.ts`.
 */

/**
 * Quem pode mandar pedido de amizade.
 *
 * União fechada e não string: opção nova não compila sem entrar no rótulo, que
 * é o que impede o seletor de mostrar um valor que o resolvedor não conhece.
 */
export const POLITICAS_DE_PEDIDO = [
  "todos",
  "amigosDeAmigos",
  "meusServidores",
  "ninguem",
] as const;
export type PoliticaDePedido = (typeof POLITICAS_DE_PEDIDO)[number];

export const ROTULO_DA_POLITICA: Record<PoliticaDePedido, string> = {
  todos: "Todos",
  amigosDeAmigos: "Amigos de amigos",
  meusServidores: "Membros dos meus servidores",
  ninguem: "Ninguém",
};

export type Privacidade = {
  /** Mensagem de quem não é amigo vai para a caixa de solicitações. */
  readonly filtrarDesconhecidos: boolean;
  readonly politicaDePedido: PoliticaDePedido;
  /**
   * Telemetria anônima.
   *
   * ⚠ **Começa DESLIGADA, e isso não é um default conservador — é a verdade.**
   * Não existe coletor: nada é enviado hoje, com o interruptor em qualquer
   * posição. Ligá-lo por padrão faria a tela afirmar que dados saem daqui, que
   * é a única das quatro em que o erro seria uma mentira sobre privacidade.
   */
  readonly telemetria: boolean;
};

const CHAVE = "vortex:privacidade";

const PADRAO: Privacidade = {
  filtrarDesconhecidos: true,
  politicaDePedido: "amigosDeAmigos",
  telemetria: false,
};

function ler(): Privacidade {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return PADRAO;
    const o: unknown = JSON.parse(cru);
    if (typeof o !== "object" || o === null) return PADRAO;
    const r = o as Record<string, unknown>;
    const politica = POLITICAS_DE_PEDIDO.find((p) => p === r.politicaDePedido);
    return {
      filtrarDesconhecidos:
        typeof r.filtrarDesconhecidos === "boolean"
          ? r.filtrarDesconhecidos
          : PADRAO.filtrarDesconhecidos,
      politicaDePedido: politica ?? PADRAO.politicaDePedido,
      telemetria: typeof r.telemetria === "boolean" ? r.telemetria : PADRAO.telemetria,
    };
  } catch {
    return PADRAO;
  }
}

let prefs: Privacidade = ler();

const ouvintes = new Set<() => void>();

export function assinarPrivacidade(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável — trocada só quando algo muda de verdade. */
export function lerPrivacidade(): Privacidade {
  return prefs;
}

export function definirPrivacidade(mudanca: Partial<Privacidade>): void {
  prefs = { ...prefs, ...mudanca };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(prefs));
  } catch {
    /* vale nesta aba */
  }
  for (const o of ouvintes) o();
}
