import {
  DURACOES_DE_SILENCIO,
  duracaoDoSilencio,
  duracaoDoSilencioDoServidor,
  estaSilenciado,
  reativarCanal,
  reativarServidor,
  servidorSilenciado,
  silenciar,
  silenciarServidor,
  silencioAte,
  silencioDoServidorAte,
} from "../store/silencio";

/**
 * Silenciar, com UMA forma para as cinco superfícies.
 *
 * ⚠ **Havia TRÊS formas do mesmo gesto, e a auditoria as mediu.** O canal
 * tinha submenu com cinco prazos; o servidor tinha submenu no dropdown com os
 * mesmos cinco escritos de novo; a conversa tinha um item só que alternava
 * "até eu reativar". Nenhuma marcava a escolha com ✓ e nenhuma dizia quanto
 * faltava — as duas coisas que o design pede (D-DMN-37, D-NOTIF-26/27).
 *
 * A união marcada é o que torna isso uma peça só: canal e servidor são dois
 * mapas no store por uma razão registrada lá (a cadeia do design tem dois
 * elos), e o menu não precisa saber disso — ele pergunta ao alvo.
 *
 * ⚠ **Categoria NÃO entra, e a razão é de plumbing, não de gosto.** Silenciar
 * uma categoria pediria um TERCEIRO elo na cadeia, e `estaMudo(channelId,
 * serverId)` — quem responde "este canal está mudo?" ao rollup e ao realce da
 * coluna — não recebe a categoria. Sem ele, o silêncio da categoria existiria
 * no menu e não valeria em lugar nenhum: pior que a ausência. Fica registrado.
 */

/** Sobre o que o silêncio age. Canal cobre texto, voz, DM, grupo e tópico. */
export type AlvoDeSilencio =
  | { readonly tipo: "canal"; readonly id: string }
  | { readonly tipo: "servidor"; readonly id: string };

export function estaMudoOAlvo(alvo: AlvoDeSilencio): boolean {
  return alvo.tipo === "canal" ? estaSilenciado(alvo.id) : servidorSilenciado(alvo.id);
}

export function prazoDoAlvo(alvo: AlvoDeSilencio): number | undefined {
  return alvo.tipo === "canal" ? silencioAte(alvo.id) : silencioDoServidorAte(alvo.id);
}

export function duracaoDoAlvo(alvo: AlvoDeSilencio): number | undefined {
  return alvo.tipo === "canal"
    ? duracaoDoSilencio(alvo.id)
    : duracaoDoSilencioDoServidor(alvo.id);
}

export function silenciarAlvo(alvo: AlvoDeSilencio, duracaoMs: number): void {
  if (alvo.tipo === "canal") silenciar(alvo.id, duracaoMs);
  else silenciarServidor(alvo.id, duracaoMs);
}

export function reativarAlvo(alvo: AlvoDeSilencio): void {
  if (alvo.tipo === "canal") reativarCanal(alvo.id);
  else reativarServidor(alvo.id);
}

/**
 * "X restantes", ou a ausência dele.
 *
 * Pura e separada do componente para ter teste: é a única parte do submenu
 * com regra, e as bordas dela (prazo vencido, prazo sem fim, menos de um
 * minuto) são invisíveis olhando a tela no minuto errado.
 *
 * ⚠ **Horas ARREDONDADAS PARA CIMA, e minutos até 59.** "0 h" para quem tem
 * 20 minutos seria pior que não dizer nada, e o design escreve o restante em
 * uma unidade só.
 */
export function restanteDeSilencio(
  ate: number | undefined,
  agora: number,
): string | undefined {
  if (ate === undefined) return undefined;
  /* Sem prazo não há número a mostrar, e inventar "∞" diria menos que a
     própria marca de ✓ em "Até eu reativar". */
  if (ate === Infinity) return undefined;
  const min = Math.ceil((ate - agora) / 60_000);
  if (min <= 0) return undefined;
  if (min < 60) return `${String(min)} min restantes`;
  return `${String(Math.ceil(min / 60))} h restantes`;
}

/**
 * O instante contra o qual o restante é calculado.
 *
 * ⚠ **Nunca ANTES do início do silêncio.** O submenu guarda um relógio de
 * minuto que nasce na montagem, e ele pode estar montado desde antes de a
 * pessoa escolher o prazo. Medido no arnês: "Por 1 hora" escolhida com o
 * relógio 40 s atrasado dava "2 h restantes", porque 61 minutos arredondam
 * para cima. O início (`ate - duração`) é um piso verdadeiro para o instante
 * atual, e custa uma subtração em vez de um `setState` num efeito.
 *
 * ⚠ **Duração `NaN` é esperada**: silêncio hidratado do protocolo não diz
 * qual prazo foi escolhido (ver `lerMutes` em `store/silencio.ts`). Sem piso
 * conhecido, vale o relógio — e o `NaN` nunca pode vazar para o rótulo.
 */
export function relogioDoSilencio(
  agora: number,
  ate: number | undefined,
  duracaoMs: number | undefined,
): number {
  if (ate === undefined || duracaoMs === undefined) return agora;
  if (!Number.isFinite(ate) || !Number.isFinite(duracaoMs)) return agora;
  return Math.max(agora, ate - duracaoMs);
}

/**
 * A nota do fim do submenu (D-NOTIF-27), ou a ausência dela.
 *
 * Responde a pergunta que a escolha deixa: "e depois?". Com prazo, quando
 * volta; sem prazo, o que continua valendo — a contagem de não lidos, que é o
 * que separa silenciar de sair do canal.
 *
 * ⚠ **Sem nota quando não há silêncio.** Explicar os prazos antes de alguém
 * escolher um é texto que se lê uma vez e vira ruído permanente no menu.
 *
 * ⚠ **Prazo vencido também não tem nota**, e pela mesma razão do
 * `restanteDeSilencio`: "Volta a notificar · 0 min restantes" diria que ainda
 * está mudo quando já não está.
 */
export function notaDeSilencio(
  tipo: AlvoDeSilencio["tipo"],
  ate: number | undefined,
  agora: number,
): string | undefined {
  if (ate === undefined) return undefined;
  if (ate === Infinity) {
    const quem = tipo === "servidor" ? "O servidor" : "O canal";
    return `Silenciado até você reativar. ${quem} continua contando não lidos, sem notificar.`;
  }
  const restante = restanteDeSilencio(ate, agora);
  return restante ? `Volta a notificar automaticamente · ${restante}.` : undefined;
}

export { DURACOES_DE_SILENCIO };
