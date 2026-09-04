/**
 * Canais silenciados.
 *
 * Store LOCAL, e isso não é preguiça: o SDK não tem escrita para isto. Ele
 * expõe `channel.muted` como uma pergunta que o APP responde, via a opção
 * `channelIsMuted` — a decisão é do cliente por desenho do protocolo.
 *
 * Sincronizar entre dispositivos é possível (vai em configuração de usuário) e
 * fica listado. Local é o estado honesto de um app sem sessão, e a forma não
 * muda quando a sincronia chegar: o store continua sendo a fonte, e quem
 * sincroniza escreve nele.
 *
 * Como o colapso de categoria, e pela mesma razão: preferência de leitura por
 * canal, mudada por clique humano, lida por um booleano. Um store por chave
 * seria maquinário para dezenas de itens.
 */

/**
 * Até quando cada canal fica silenciado, em epoch ms.
 *
 * ⚠ **Guarda o PRAZO, nunca o tempo restante** — o store não tem relógio. Quem
 * mostra "7 h" calcula a diferença; se o store guardasse os minutos,
 * publicaria a cada tique e acordaria a coluna inteira. É a mesma separação de
 * `falando` e do cronômetro da chamada.
 *
 * `Infinity` é "até eu reativar", e não uma data absurda: a comparação
 * `agora < ate` funciona igual, e o valor DIZ que não há prazo em vez de
 * fingir um.
 */
const silenciados = new Map<string, number>();
const ouvintes = new Set<() => void>();

/** As cinco do design, na ordem dele. */
export const DURACOES_DE_SILENCIO = [
  { rotulo: "Por 15 minutos", ms: 15 * 60_000 },
  { rotulo: "Por 1 hora", ms: 60 * 60_000 },
  { rotulo: "Por 8 horas", ms: 8 * 60 * 60_000 },
  { rotulo: "Por 24 horas", ms: 24 * 60 * 60_000 },
  { rotulo: "Até eu reativar", ms: Infinity },
] as const;

export function assinarSilencio(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * Booleano, comparado por valor — quem assina só acorda se o SEU canal mudar.
 *
 * ⚠ A expiração é verificada na LEITURA e não por temporizador. Um `setTimeout`
 * por canal silenciado seria um relógio por item numa coluna de dezenas, e
 * ainda erraria depois de a máquina dormir. Aqui o silêncio simplesmente
 * deixa de valer no primeiro render seguinte ao prazo — e o design diz que ele
 * "volta sozinho sem notificar o histórico perdido", que é exatamente isto.
 */
export function estaSilenciado(channelId: string): boolean {
  const ate = silenciados.get(channelId);
  if (ate === undefined) return false;
  if (Date.now() < ate) return true;
  silenciados.delete(channelId);
  return false;
}

/** O prazo, para quem mostra o restante. `undefined` = não silenciado. */
export function silencioAte(channelId: string): number | undefined {
  return estaSilenciado(channelId) ? silenciados.get(channelId) : undefined;
}

/**
 * Silencia por um prazo, ou reativa se já estiver silenciado.
 *
 * Sem argumento vale para sempre — é o que o clique único do cabeçalho faz, e
 * o que o menu chama de "até eu reativar".
 */
export function alternarSilencio(channelId: string, duracaoMs = Infinity): void {
  if (estaSilenciado(channelId)) silenciados.delete(channelId);
  else silenciados.set(channelId, duracaoMs === Infinity ? Infinity : Date.now() + duracaoMs);
  for (const ouvinte of ouvintes) ouvinte();
}

/** Estado limpo entre testes. */
export function limparSilencio(): void {
  silenciados.clear();
  niveis.clear();
}

/* ------------------------------------------- nível por canal */

/**
 * O que notifica NESTE canal, independente do padrão global.
 *
 * ⚠ **Um NÍVEL e não uma matriz, ao contrário de `store/notificacoes.ts`.** A
 * tela global cruza evento × forma de entrega porque ali a pergunta é "como eu
 * quero ser avisado"; aqui a pergunta é outra e menor — "quanto deste canal me
 * interessa". Repetir a matriz por canal daria dezenas de células para
 * responder uma escolha de três valores, e a pessoa abandonaria antes.
 *
 * ⚠ **Mora aqui e não num store novo porque é o MESMO eixo do silêncio.**
 * "Nada" é silenciar; "só menções" e "todas" são graus acima disso. Dois
 * stores sobre a mesma pergunta acabariam discordando — um canal silenciado
 * com nível "todas as mensagens" é um estado que não deve poder existir, e
 * com um store só ele não existe.
 */
export const NIVEIS_DE_NOTIFICACAO = [
  { id: "todas", rotulo: "Todas as mensagens" },
  { id: "mencoes", rotulo: "Só menções" },
  { id: "nada", rotulo: "Nada" },
] as const;

export type NivelDeNotificacao = (typeof NIVEIS_DE_NOTIFICACAO)[number]["id"];

/**
 * `undefined` = segue o padrão global, e é diferente de "todas".
 *
 * A distinção importa: quem nunca escolheu deve acompanhar a mudança do
 * padrão; quem escolheu "todas" quer todas mesmo que o padrão mude. Guardar
 * `"todas"` para todo canal apagaria a diferença.
 */
const niveis = new Map<string, NivelDeNotificacao>();

export function nivelDoCanal(channelId: string): NivelDeNotificacao | undefined {
  return niveis.get(channelId);
}

export function definirNivelDoCanal(
  channelId: string,
  nivel: NivelDeNotificacao | undefined,
): void {
  if (niveis.get(channelId) === nivel) return;
  if (nivel === undefined) niveis.delete(channelId);
  else niveis.set(channelId, nivel);

  /*
    ⚠ **"Nada" e silenciar são o MESMO estado, e escrever os dois é o que
    impede a divergência.** Sem esta linha, um canal com nível "nada" e sem
    silêncio mostraria o sino aceso enquanto não notifica nada — a interface
    contradizendo o próprio comportamento.
  */
  const mudo = estaSilenciado(channelId);
  if (nivel === "nada" && !mudo) alternarSilencio(channelId);
  else if (nivel !== "nada" && nivel !== undefined && mudo) {
    alternarSilencio(channelId);
  }

  for (const ouvinte of ouvintes) ouvinte();
}
