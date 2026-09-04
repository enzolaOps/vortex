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
import { SEMENTE_PADRAO, type Semente } from "../tema/derivar";
import {
  LARGURA,
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

/**
 * O painel está visível agora?
 *
 * Colocado em algum slot E com o slot ligado. As duas condições são
 * diferentes: um painel pode estar posicionado e escondido, e é isso que o
 * botão do cabeçalho alterna.
 */
export function painelVisivel(painel: PainelId): boolean {
  const id = slotDe(painel);
  return id !== undefined && preset.layout.slots[id].visivel;
}

/**
 * O slot da ponta final — onde painel sem casa vai morar.
 *
 * Constante e não busca: `d` é o único slot depois da âncora, e é onde toda
 * interface desta categoria põe membros, fixados e tópicos.
 */
const PONTA = "d" as const satisfies SlotId;

/**
 * Liga e desliga um painel pelo botão do cabeçalho.
 *
 * ⚠ **O shell tem TRÊS slots e o produto tem mais painéis que isso, e este é o
 * conflito nº 3 do plano de paridade aparecendo de novo.** A resolução aqui é a
 * mesma em espírito da coluna de conversas: em vez de gastar um slot por
 * painel, a ponta final abriga UM de cada vez e o cabeçalho escolhe qual — que
 * é o que todo cliente desta categoria faz, e o que o design implica ao mostrar
 * o segundo painel só em 3440.
 *
 * Três casos, e os três importam:
 *
 * 1. **Painel já visível** → esconde. O slot colapsa a zero sozinho, pela
 *    trilha `auto` do grid.
 * 2. **Painel posicionado e escondido** → mostra, onde quer que ele esteja.
 *    Respeita quem moveu membros para a outra ponta no modo edição — uma regra
 *    posicional aqui ligaria o painel errado.
 * 3. **Painel sem slot nenhum** → assume a ponta final. É o caso de `fixados`,
 *    que não está no preset de fábrica e não teria como aparecer.
 */
export function alternarPainel(painel: PainelId): void {
  const id = slotDe(painel);

  if (id !== undefined) {
    definirSlot(id, { visivel: !preset.layout.slots[id].visivel });
    return;
  }

  /*
    Sem casa: entra na ponta, com a largura padrão DELE.

    A largura vem de `LARGURA[painel].padrao` e não da que o slot tinha: o
    ocupante anterior pode ter sido a lista de membros a 232px, e fixados numa
    coluna de 232 quebra cada mensagem em quatro linhas — é a razão de o padrão
    dele ser 300.
  */
  definirSlot(PONTA, {
    painel,
    largura: LARGURA[painel].padrao,
    visivel: true,
  });
}

/**
 * A semente de tema em vigor. Nunca `undefined` para quem lê.
 *
 * Preset sem tema é preset que não opinou sobre cor, e a resposta certa é a
 * paleta de fábrica — não um estado especial que todo componente precise
 * tratar.
 */
export function lerSemente(): Semente {
  return preset.tema ?? SEMENTE_PADRAO.escuro;
}

/**
 * Troca a semente.
 *
 * NÃO pinta: quem pinta é `tema/pintor.ts`, assinando este store. A primeira
 * versão escrevia no `document` daqui e o teste reprovou com `document is not
 * defined` — store que depende de DOM é store sem teste.
 */
export function definirSemente(nova: Semente): void {
  if (
    preset.tema &&
    preset.tema.modo === nova.modo &&
    preset.tema.matiz === nova.matiz &&
    preset.tema.croma === nova.croma &&
    preset.tema.acento === nova.acento
  ) {
    return;
  }

  preset = { ...preset, tema: nova };
  emitir();
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
    semente: lerSemente,
    definirSemente,
  };
}
