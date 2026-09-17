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
/**
 * ⚠ **Guarda o PRAZO e a DURAÇÃO escolhida, e a segunda entrou para o ✓.**
 *
 * Só com o prazo não dá para dizer QUAL das cinco a pessoa escolheu: vinte
 * minutos depois de "Por 1 hora" e quarenta depois de "Por 8 horas" são dois
 * instantes futuros quaisquer. O menu do design marca a escolha com ✓, e
 * marcar por aproximação diria a errada em metade dos casos.
 *
 * Um objeto e não um segundo `Map`: dois mapas sobre o mesmo fato acabam
 * discordando, que é o argumento que este arquivo já usa contra silenciar
 * canal por canal para silenciar o servidor.
 */
type Silencio = { readonly ate: number; readonly duracaoMs: number };

const silenciados = new Map<string, Silencio>();
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
  const s = silenciados.get(channelId);
  if (s === undefined) return false;
  if (Date.now() < s.ate) return true;
  silenciados.delete(channelId);
  return false;
}

/** O prazo, para quem mostra o restante. `undefined` = não silenciado. */
export function silencioAte(channelId: string): number | undefined {
  return estaSilenciado(channelId) ? silenciados.get(channelId)?.ate : undefined;
}

/** A duração ESCOLHIDA, para o ✓ do menu. `undefined` = não silenciado. */
export function duracaoDoSilencio(channelId: string): number | undefined {
  return estaSilenciado(channelId) ? silenciados.get(channelId)?.duracaoMs : undefined;
}

/**
 * Silencia por um prazo, ou reativa se já estiver silenciado.
 *
 * Sem argumento vale para sempre — é o que o clique único do cabeçalho faz, e
 * o que o menu chama de "até eu reativar".
 */
export function alternarSilencio(channelId: string, duracaoMs = Infinity): void {
  if (estaSilenciado(channelId)) silenciados.delete(channelId);
  else silenciar(channelId, duracaoMs);
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * Silencia por um prazo, SEM alternar.
 *
 * ⚠ **O submenu das cinco durações precisa disto e não de `alternarSilencio`.**
 * Escolher "Por 8 horas" com o canal já silenciado por 15 minutos é TROCAR o
 * prazo; com o alternador, o mesmo clique REATIVARIA os avisos — o contrário
 * do que o item diz.
 */
export function silenciar(channelId: string, duracaoMs = Infinity): void {
  silenciados.set(channelId, {
    ate: duracaoMs === Infinity ? Infinity : Date.now() + duracaoMs,
    duracaoMs,
  });
  for (const ouvinte of ouvintes) ouvinte();
}

/** Reativa os avisos do canal. Sem efeito se ele já falava. */
export function reativarCanal(channelId: string): void {
  if (!silenciados.delete(channelId)) return;
  for (const ouvinte of ouvintes) ouvinte();
}

/* --------------------------------------------- silêncio por servidor */

/**
 * Até quando cada SERVIDOR fica silenciado — a mesma forma de `silenciados`.
 *
 * ⚠ **Mapa próprio, e não "silenciar cada canal do servidor".** Escrever o
 * prazo em todos os canais seria o atalho óbvio e errado de três jeitos: canal
 * criado depois nasceria falando; reativar o servidor apagaria o silêncio que
 * a pessoa tinha posto num canal específico ANTES; e o menu do canal diria
 * "Reativar avisos" para um silêncio que ninguém pôs nele. O design escreve a
 * cadeia com os dois elos separados — "silenciado do servidor → silenciado do
 * canal" —, e dois elos pedem dois mapas.
 *
 * Quem pergunta "este canal está mudo?" é `estaMudo`, que junta os dois; o SDK
 * responde `channel.muted` por ele (ver `sdk/client.ts`).
 */
const servidoresSilenciados = new Map<string, Silencio>();

export function servidorSilenciado(serverId: string): boolean {
  const s = servidoresSilenciados.get(serverId);
  if (s === undefined) return false;
  if (Date.now() < s.ate) return true;
  servidoresSilenciados.delete(serverId);
  return false;
}

/** O prazo do servidor, para quem mostra o restante. */
export function silencioDoServidorAte(serverId: string): number | undefined {
  return servidorSilenciado(serverId) ? servidoresSilenciados.get(serverId)?.ate : undefined;
}

/** A duração ESCOLHIDA do servidor, para o ✓ do menu. */
export function duracaoDoSilencioDoServidor(serverId: string): number | undefined {
  return servidorSilenciado(serverId)
    ? servidoresSilenciados.get(serverId)?.duracaoMs
    : undefined;
}

/** Silencia o servidor por um prazo; `Infinity` é "até eu reativar". */
export function silenciarServidor(serverId: string, duracaoMs = Infinity): void {
  servidoresSilenciados.set(serverId, {
    ate: duracaoMs === Infinity ? Infinity : Date.now() + duracaoMs,
    duracaoMs,
  });
  for (const ouvinte of ouvintes) ouvinte();
}

export function reativarServidor(serverId: string): void {
  if (!servidoresSilenciados.delete(serverId)) return;
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * O canal está mudo — por ele mesmo OU pelo servidor dele.
 *
 * É a pergunta que o rollup de não-lidas e o realce da coluna fazem. O
 * notificador NÃO a usa: ele precisa dos dois elos separados, porque a cadeia
 * do design os ordena.
 */
export function estaMudo(channelId: string, serverId: string | undefined): boolean {
  return estaSilenciado(channelId) || (serverId !== undefined && servidorSilenciado(serverId));
}

/** Estado limpo entre testes. */
export function limparSilencio(): void {
  silenciados.clear();
  niveis.clear();
  servidoresSilenciados.clear();
  niveisDeServidor.clear();
  opcoesDeServidor.clear();
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

/* ------------------------------------------- nível por servidor */

/**
 * O PADRÃO do servidor — de onde o canal sem exceção herda.
 *
 * ⚠ **"Nada" aqui NÃO silencia o servidor**, ao contrário do canal, e a
 * diferença está escrita no próprio design: "Nada · só badge de não lido, sem
 * notificação". Silenciar o servidor apaga também o realce da coluna e do
 * rail; o padrão "nada" só cala o aviso. Acoplar os dois como no canal faria
 * escolher "nada" no modal esconder as bolinhas de não-lida do rail — uma
 * consequência que a opção não anuncia.
 *
 * `undefined` = segue o padrão global (só menções), pela mesma razão do canal.
 */
const niveisDeServidor = new Map<string, NivelDeNotificacao>();

export function nivelDoServidor(serverId: string): NivelDeNotificacao | undefined {
  return niveisDeServidor.get(serverId);
}

export function definirNivelDoServidor(
  serverId: string,
  nivel: NivelDeNotificacao | undefined,
): void {
  if (niveisDeServidor.get(serverId) === nivel) return;
  if (nivel === undefined) niveisDeServidor.delete(serverId);
  else niveisDeServidor.set(serverId, nivel);
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * O nível que VALE num canal: a exceção do canal, senão o padrão do servidor.
 *
 * É a ponta final da cadeia do design — "padrão do servidor → exceção do
 * canal". `undefined` continua sendo "ninguém escolheu": o notificador aplica
 * o padrão global (só menções).
 */
export function nivelEfetivo(
  channelId: string,
  serverId: string | undefined,
): NivelDeNotificacao | undefined {
  return niveis.get(channelId) ?? (serverId ? niveisDeServidor.get(serverId) : undefined);
}

/**
 * Os dois interruptores do modal do servidor que têm efeito hoje.
 *
 * "Notificar eventos do servidor" é o terceiro do design e fica pendente: o
 * protocolo não tem evento agendado.
 */
export type OpcoesDoServidor = {
  readonly suprimirTodos: boolean;
  readonly suprimirCargos: boolean;
};

/* Os padrões do design: @everyone suprimido, cargo não. Menção em massa num
   servidor grande é a notificação que mais faz alguém desligar tudo. */
const OPCOES_PADRAO: OpcoesDoServidor = { suprimirTodos: true, suprimirCargos: false };

const opcoesDeServidor = new Map<string, OpcoesDoServidor>();

/** Referência estável: o padrão é uma constante, a escolha é trocada inteira. */
export function opcoesDoServidor(serverId: string): OpcoesDoServidor {
  return opcoesDeServidor.get(serverId) ?? OPCOES_PADRAO;
}

export function definirOpcoesDoServidor(
  serverId: string,
  mudanca: Partial<OpcoesDoServidor>,
): void {
  const atual = opcoesDoServidor(serverId);
  const proxima = { ...atual, ...mudanca };
  if (
    proxima.suprimirTodos === atual.suprimirTodos &&
    proxima.suprimirCargos === atual.suprimirCargos
  ) {
    return;
  }
  opcoesDeServidor.set(serverId, proxima);
  for (const ouvinte of ouvintes) ouvinte();
}
