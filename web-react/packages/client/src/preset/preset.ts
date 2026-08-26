/**
 * Ler e escrever preset.
 *
 * Três regras do `enforcement.md` vivem aqui, e nenhuma delas é sobre formato:
 *
 * 1. Chave desconhecida é PRESERVADA, nunca descartada.
 * 2. Chave ausente recebe default.
 * 3. Nada de dado de sessão sai daqui.
 *
 * A (1) é a que costuma ser esquecida, e a consequência é permanente: alguém
 * abre numa versão antiga um preset feito numa versão nova, salva, e o trabalho
 * da versão nova evapora sem erro nenhum.
 */
import {
  LARGURA,
  limitarLargura,
  PAINEIS,
  PRESET_PADRAO,
  SLOTS,
  VERSAO_ATUAL,
  type PainelId,
  type Preset,
  type SlotConfig,
  type SlotId,
} from "./schema";
import { ehTokenDeTema, type TemaValido } from "./tokens";

/**
 * O preset lido, mais o objeto BRUTO de onde ele veio.
 *
 * O bruto é como a preservação de chave desconhecida funciona sem nenhum tipo
 * de "saco de extras": na escrita, o conhecido é mesclado POR CIMA do bruto.
 * Preserva em qualquer profundidade, inclusive dentro de um slot, inclusive
 * chaves que ainda não foram inventadas.
 *
 * A alternativa — declarar um campo `extras` — só preserva onde alguém lembrou
 * de colocar o campo, que é exatamente onde o problema não estava.
 */
export type PresetLido = {
  readonly preset: Preset;
  readonly bruto: Record<string, unknown>;
  readonly avisos: readonly string[];
};

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function lerPainel(v: unknown): PainelId | null {
  return typeof v === "string" && (PAINEIS as readonly string[]).includes(v)
    ? (v as PainelId)
    : null;
}

function lerSlot(v: unknown, padrao: SlotConfig): SlotConfig {
  if (!ehObjeto(v)) return padrao;

  // `painel` ausente e `painel: null` são coisas DIFERENTES: ausente quer
  // dizer "não opinei, use o default"; null quer dizer "quero este slot
  // vazio". Colapsar os dois faria um slot esvaziado de propósito voltar
  // preenchido na próxima leitura.
  const painel = "painel" in v ? lerPainel(v.painel) : padrao.painel;

  const largura =
    typeof v.largura === "number" && Number.isFinite(v.largura)
      ? limitarLargura(painel, v.largura)
      : painel === padrao.painel
        ? padrao.largura
        : painel && LARGURA[painel].padrao;

  return {
    painel,
    largura: typeof largura === "number" ? largura : 0,
    visivel: typeof v.visivel === "boolean" ? v.visivel : padrao.visivel,
  };
}

/**
 * Tema: só chave conhecida entra, e chave desconhecida NÃO é perdida.
 *
 * Ela não vira token — o app não sabe o que fazer com ela — mas continua no
 * bruto e volta na escrita. É a diferença entre "não entendo isto" e "isto não
 * existe", e só a primeira é honesta com um preset de versão futura.
 */
function lerTema(v: unknown): { tema: TemaValido; ignoradas: string[] } {
  const tema: Record<string, string> = {};
  const ignoradas: string[] = [];
  if (!ehObjeto(v)) return { tema, ignoradas };

  for (const [chave, valor] of Object.entries(v)) {
    if (typeof valor !== "string") continue;
    if (ehTokenDeTema(chave)) tema[chave] = valor;
    else ignoradas.push(chave);
  }
  return { tema, ignoradas };
}

/**
 * Migração explícita entre versões.
 *
 * Vazia hoje, e existe assim mesmo: a cadeia precisa estar no lugar ANTES de
 * haver uma v2, senão a v2 chega junto com a decisão de como migrar, sob
 * pressão, sem teste.
 */
const MIGRACOES: Record<number, (bruto: Record<string, unknown>) => Record<string, unknown>> =
  {};

function migrar(
  bruto: Record<string, unknown>,
  de: number,
): { bruto: Record<string, unknown>; avisos: string[] } {
  const avisos: string[] = [];
  let atual = bruto;
  for (let v = de; v < VERSAO_ATUAL; v++) {
    const passo = MIGRACOES[v];
    if (!passo) {
      avisos.push(`sem migração de v${v} para v${v + 1}; o que não foi entendido ficou preservado`);
      break;
    }
    atual = passo(atual);
  }
  return { bruto: atual, avisos };
}

export function lerPreset(texto: string): PresetLido {
  const avisos: string[] = [];

  let bruto: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(texto);
    if (!ehObjeto(parsed)) throw new Error("raiz não é objeto");
    bruto = parsed;
  } catch {
    return {
      preset: PRESET_PADRAO,
      bruto: {},
      avisos: ["preset ilegível; usando o padrão"],
    };
  }

  const versao =
    typeof bruto.version === "number" && Number.isInteger(bruto.version)
      ? bruto.version
      : VERSAO_ATUAL;

  if (versao > VERSAO_ATUAL) {
    /**
     * Preset de versão FUTURA.
     *
     * Não dá para migrar para trás, e destruir está fora de questão. Então:
     * aplica-se o que este código entende, o resto continua no bruto, e a
     * VERSÃO ORIGINAL é mantida na escrita — escrever `version: 1` num arquivo
     * que carrega estrutura de v2 seria mentir sobre o conteúdo, e a próxima
     * versão a abrir confiaria na mentira.
     */
    avisos.push(
      `preset da versão ${versao}, mais nova que a suportada (${VERSAO_ATUAL}); ` +
        `o que não foi entendido está preservado e volta intacto ao salvar`,
    );
  } else if (versao < VERSAO_ATUAL) {
    const m = migrar(bruto, versao);
    bruto = m.bruto;
    avisos.push(...m.avisos);
  }

  const layoutBruto = ehObjeto(bruto.layout) ? bruto.layout : {};
  const slotsBruto = ehObjeto(layoutBruto.slots) ? layoutBruto.slots : {};

  const slots = {} as Record<SlotId, SlotConfig>;
  for (const id of SLOTS) {
    slots[id] = lerSlot(slotsBruto[id], PRESET_PADRAO.layout.slots[id]);
  }

  const { tema, ignoradas } = lerTema(bruto.theme);
  if (ignoradas.length > 0) {
    avisos.push(
      `${ignoradas.length} chave(s) de tema não reconhecida(s), preservada(s): ` +
        ignoradas.join(", "),
    );
  }

  return {
    preset: {
      version: versao,
      layout: { slots },
      ...(Object.keys(tema).length > 0 ? { theme: tema } : {}),
    },
    bruto,
    avisos,
  };
}

/**
 * Mescla o conhecido POR CIMA do bruto, preservando o resto em profundidade.
 *
 * Recursivo só em objeto simples: array é substituído inteiro, porque mesclar
 * arrays por índice produz híbridos que ninguém pediu.
 */
function mesclar(
  base: Record<string, unknown>,
  novo: Record<string, unknown>,
): Record<string, unknown> {
  const saida: Record<string, unknown> = { ...base };
  for (const [chave, valor] of Object.entries(novo)) {
    const antes = saida[chave];
    saida[chave] =
      ehObjeto(valor) && ehObjeto(antes) ? mesclar(antes, valor) : valor;
  }
  return saida;
}

/**
 * Serializa. O que sai daqui pode ser colado num chat público.
 *
 * Não há nada a filtrar, e é esse o ponto: o tipo já impede que exista ID de
 * canal, servidor ou usuário para filtrar. O teste que afirma ausência de
 * ULID no output não é a defesa — é a confirmação de que a defesa (o tipo)
 * continua de pé.
 */
export function escreverPreset(
  preset: Preset,
  bruto: Record<string, unknown> = {},
): string {
  const conhecido: Record<string, unknown> = {
    version: preset.version,
    layout: { slots: preset.layout.slots },
    ...(preset.theme ? { theme: preset.theme } : {}),
  };
  return JSON.stringify(mesclar(bruto, conhecido), null, 2);
}
