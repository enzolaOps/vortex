/**
 * O layout do shell. Store module-level, lei nº 1.
 *
 * Fica FORA do store de mensagens, e a referência da fase 4 é explícita sobre
 * isso — mas o motivo forte só aparece no modo edição: escrever no store a
 * cada frame enquanto alguém arrasta a borda de um slot re-renderizaria a
 * lista de mensagens a 60fps. É o caso mais óbvio de update não-escopado que
 * este projeto consegue produzir.
 *
 * A defesa é estrutural e começa aqui: durante o arraste a posição vive em ref
 * e CSS var, e o commit só acontece no drop. Este store nunca vê o frame
 * intermediário.
 *
 * O snapshot é o objeto `Preset`, guardado por referência e trocado inteiro na
 * escrita — a armadilha nº 1 continua valendo: nada é montado no getter.
 */
import {
  limitarLargura,
  PRESET_PADRAO,
  type PainelId,
  type Preset,
  type SlotConfig,
  type SlotId,
} from "../preset/schema";

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

let preset: Preset = PRESET_PADRAO;
/**
 * O bruto de onde o preset veio, para a preservação de chave desconhecida
 * sobreviver a um ciclo ler → editar → escrever dentro do app.
 */
let bruto: Record<string, unknown> = {};

function emitir() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarLayout(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerLayout(): Preset {
  return preset;
}

export function lerBruto(): Record<string, unknown> {
  return bruto;
}

export function aplicarPreset(novo: Preset, origem: Record<string, unknown> = {}): void {
  preset = novo;
  bruto = origem;
  emitir();
}

/** Troca um slot inteiro. Usado pelo commit do arraste e pelo modo edição. */
export function definirSlot(id: SlotId, mudanca: Partial<SlotConfig>): void {
  const atual = preset.layout.slots[id];
  const painel = mudanca.painel !== undefined ? mudanca.painel : atual.painel;
  const proximo: SlotConfig = {
    painel,
    // Largura passa pelo limite SEMPRE, inclusive quando não foi ela que
    // mudou: trocar o painel de um slot muda quais limites valem, e uma
    // largura legítima para a lista de canais pode estar fora da do rail.
    largura: limitarLargura(painel, mudanca.largura ?? atual.largura),
    visivel: mudanca.visivel ?? atual.visivel,
  };

  if (
    proximo.painel === atual.painel &&
    proximo.largura === atual.largura &&
    proximo.visivel === atual.visivel
  ) {
    return;
  }

  preset = {
    ...preset,
    layout: { slots: { ...preset.layout.slots, [id]: proximo } },
  };
  emitir();
}

/**
 * Troca dois slots de painel — é como "mudar de lado" acontece.
 *
 * A largura viaja junto com o painel, não com o slot: quem arrastou a lista de
 * canais para a outra ponta espera a largura que escolheu para ela, não a que
 * o painel anterior tinha. E passa pelo limite, porque os limites são por
 * painel.
 */
export function trocarSlots(a: SlotId, b: SlotId): void {
  if (a === b) return;
  const sa = preset.layout.slots[a];
  const sb = preset.layout.slots[b];

  preset = {
    ...preset,
    layout: {
      slots: {
        ...preset.layout.slots,
        [a]: { ...sb, largura: limitarLargura(sb.painel, sb.largura) },
        [b]: { ...sa, largura: limitarLargura(sa.painel, sa.largura) },
      },
    },
  };
  emitir();
}

/** Em qual slot está um painel, se estiver em algum. */
export function slotDe(painel: PainelId): SlotId | undefined {
  const slots = preset.layout.slots;
  return (Object.keys(slots) as SlotId[]).find((id) => slots[id].painel === painel);
}

export function resetar(): void {
  preset = PRESET_PADRAO;
  bruto = {};
  emitir();
}

/**
 * Sonda do arnês.
 *
 * Nasceu como substituta do modo edição, que agora existe — e fica porque
 * mudou de função: é o que permite verificar o layout em navegador sem
 * simular ponteiro. As medições da fase 4 (troca de lado, colapso sem espaço
 * morto, colapso seguindo o painel) foram feitas por aqui.
 *
 * Sai do bundle de produção junto com o resto do `import.meta.env.DEV`.
 */
if (import.meta.env.DEV) {
  (globalThis as never as Record<string, unknown>).__layout = {
    ler: lerLayout,
    slot: definirSlot,
    trocar: trocarSlots,
    resetar,
    onde: slotDe,
  };
}
