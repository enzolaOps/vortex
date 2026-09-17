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

export { DURACOES_DE_SILENCIO };
