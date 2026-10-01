/**
 * Canais silenciados.
 *
 * Store LOCAL, e isso não é preguiça: o SDK não tem escrita para isto. Ele
 * expõe `channel.muted` como uma pergunta que o APP responde, via a opção
 * `channelIsMuted` — a decisão é do cliente por desenho do protocolo.
 *
 * Persistido em `localStorage` e sincronizado entre dispositivos por
 * `UserSettings` (ver o fim do arquivo e `sdk/sincronizar.ts`). O store
 * continua sendo a fonte: quem sincroniza escreve nele.
 *
 * Como o colapso de categoria, e pela mesma razão: preferência de leitura por
 * canal, mudada por clique humano, lida por um booleano. Um store por chave
 * seria maquinário para dezenas de itens.
 */

import { avisarSync } from "./sync";

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
  else {
    silenciar(channelId, duracaoMs);
    return;
  }
  persistirNotificacoes();
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
  persistirNotificacoes();
  for (const ouvinte of ouvintes) ouvinte();
}

/** Reativa os avisos do canal. Sem efeito se ele já falava. */
export function reativarCanal(channelId: string): void {
  if (!silenciados.delete(channelId)) return;
  persistirNotificacoes();
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
  persistirNotificacoes();
  for (const ouvinte of ouvintes) ouvinte();
}

export function reativarServidor(serverId: string): void {
  if (!servidoresSilenciados.delete(serverId)) return;
  persistirNotificacoes();
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
  semSeguirTopicos.clear();
  try {
    localStorage.removeItem(LOCAL_NOTIFICACOES);
    localStorage.removeItem(LOCAL_OPCOES);
  } catch {
    /* mesma regra da escrita */
  }
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

  persistirNotificacoes();
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
  persistirNotificacoes();
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
 * Os três interruptores do modal do servidor.
 *
 * ⚠ **"Notificar eventos do servidor" deixou de ser pendência (D-NOTIF-12).**
 * Ela esperava evento agendado no protocolo, e o fork o tem: `eventos/` lista,
 * cria e lembra "começa em 10 minutos" a quem marcou interesse. Desligar aqui
 * cala esse lembrete para os eventos DESTE servidor — é o único aviso de
 * evento que o cliente produz, e é o que o detalhe "Início de evento agendado"
 * descreve.
 */
export type OpcoesDoServidor = {
  readonly suprimirTodos: boolean;
  readonly suprimirCargos: boolean;
  readonly notificarEventos: boolean;
};

/* Os padrões do design: @everyone suprimido, cargo não, eventos sim. Menção
   em massa num servidor grande é a notificação que mais faz alguém desligar
   tudo. */
const OPCOES_PADRAO: OpcoesDoServidor = {
  suprimirTodos: true,
  suprimirCargos: false,
  notificarEventos: true,
};

const mesmasOpcoes = (a: OpcoesDoServidor, b: OpcoesDoServidor): boolean =>
  a.suprimirTodos === b.suprimirTodos &&
  a.suprimirCargos === b.suprimirCargos &&
  a.notificarEventos === b.notificarEventos;

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
  if (mesmasOpcoes(proxima, atual)) return;
  opcoesDeServidor.set(serverId, proxima);
  persistirOpcoes();
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * "Seguir tópicos automaticamente", por canal — D-NOTIF-16.
 *
 * ⚠ **Guarda-se a EXCEÇÃO, e o padrão é seguir.** O `delta` deste fork segue
 * o tópico sozinho quando alguém responde nele (`message_send.rs`: *"Replying
 * follows the thread"*), então "ligado" é o que o servidor já faz e não
 * precisa de registro; o que se guarda são os canais onde a pessoa pediu o
 * contrário. Quem desfaz o seguir automático é o envio — ver `postar` no
 * adapter.
 *
 * O canal é o PAI do tópico: é no modal dele que o interruptor mora, e é ele
 * que a pessoa reconhece ("os tópicos de #produto").
 */
const semSeguirTopicos = new Set<string>();

export function segueTopicosAutomaticamente(channelId: string): boolean {
  return !semSeguirTopicos.has(channelId);
}

export function definirSeguirTopicos(channelId: string, seguir: boolean): void {
  if (seguir === segueTopicosAutomaticamente(channelId)) return;
  if (seguir) semSeguirTopicos.delete(channelId);
  else semSeguirTopicos.add(channelId);
  persistirOpcoes();
  for (const ouvinte of ouvintes) ouvinte();
}

/* ------------------------------------------- persistência e sincronia */

/*
  Duas chaves, e a divisão tem razão.

  ⚠ **`notifications` é a chave do cliente OFICIAL**, no formato dele
  (`vendor/stoat-web/.../NotificationOptions.ts`): quem abre a mesma conta no
  Stoat vê os mesmos silêncios e níveis, e o que ele escrever chega aqui. As
  opções de supressão não existem lá, e enfiá-las numa chave compartilhada
  seria apostar que o outro cliente preserva campo que não conhece — ele não
  preserva, `clean()` reconstrói o objeto. Por isso moram em chave própria.

  ⚠ **"Até eu reativar" é mute SEM `until`, nunca `Infinity`.**
  `JSON.stringify(Infinity)` vira `null`, e o formato upstream já diz "sem
  prazo" pela ausência do campo. Prazo vencido não é gravado: ele já deixou de
  valer na leitura, e mandá-lo para outro dispositivo só faria o outro lado
  apagá-lo de novo.
*/
export const CHAVE_NOTIFICACOES = "notifications";
export const CHAVE_OPCOES_DE_SERVIDOR = "vortex:notificacoesDoServidor";

/* Local com prefixo próprio: `notifications` cru no `localStorage` do domínio
   seria nome genérico demais para uma origem que outras bibliotecas dividem. */
const LOCAL_NOTIFICACOES = "vortex:silencio";
const LOCAL_OPCOES = "vortex:notificacoesDoServidor";

const PARA_PROTOCOLO: Record<NivelDeNotificacao, string> = {
  todas: "all",
  mencoes: "mention",
  nada: "none",
};

function nivelDoProtocolo(v: unknown): NivelDeNotificacao | undefined {
  if (v === "all") return "todas";
  if (v === "mention") return "mencoes";
  if (v === "none") return "nada";
  return undefined;
}

function objeto(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

export function exportarNotificacoes(): string {
  const agora = Date.now();
  const mutes = (m: Map<string, Silencio>) => {
    const o: Record<string, { until?: number }> = {};
    for (const [id, s] of m) {
      if (s.ate === Infinity) o[id] = {};
      else if (s.ate > agora) o[id] = { until: s.ate };
    }
    return o;
  };
  const niveisDe = (m: Map<string, NivelDeNotificacao>) => {
    const o: Record<string, string> = {};
    for (const [id, n] of m) o[id] = PARA_PROTOCOLO[n];
    return o;
  };
  return JSON.stringify({
    server: niveisDe(niveisDeServidor),
    channel: niveisDe(niveis),
    server_mutes: mutes(servidoresSilenciados),
    channel_mutes: mutes(silenciados),
  });
}

/**
 * Entrada reservada da mesma chave: a lista de canais que NÃO seguem tópico
 * ao responder. Mesma chave e não uma nova, porque é a mesma família de
 * decisão (opções de notificação que o cliente oficial não conhece) e uma
 * chave de sincronia a mais é um caminho a mais para divergir. `@` não é
 * caractere de ULID, então não colide com ID de servidor.
 */
const CHAVE_SEM_SEGUIR = "@semSeguirTopicos";

export function exportarOpcoesDeServidor(): string {
  const o: Record<string, OpcoesDoServidor | readonly string[]> = {};
  for (const [id, op] of opcoesDeServidor) {
    if (!mesmasOpcoes(op, OPCOES_PADRAO)) o[id] = op;
  }
  if (semSeguirTopicos.size > 0) o[CHAVE_SEM_SEGUIR] = [...semSeguirTopicos];
  return JSON.stringify(o);
}

/** Aplica nos mapas crus. `false` = o texto não é o formato, nada mudou. */
function lerNotificacoes(cru: string): boolean {
  const r = objeto(JSON.parse(cru));
  if (!r) return false;
  const agora = Date.now();
  const proximosNiveis = new Map<string, NivelDeNotificacao>();
  const proximosDeServidor = new Map<string, NivelDeNotificacao>();
  const proximosMutes = new Map<string, Silencio>();
  const proximosMutesDeServidor = new Map<string, Silencio>();

  const lerNiveis = (
    v: unknown,
    destino: Map<string, NivelDeNotificacao>,
    mutes: Map<string, Silencio>,
  ) => {
    for (const [id, n] of Object.entries(objeto(v) ?? {})) {
      // O upstream antigo guardava o silêncio como nível "muted".
      if (n === "muted") mutes.set(id, { ate: Infinity, duracaoMs: Infinity });
      const nivel = nivelDoProtocolo(n);
      if (nivel) destino.set(id, nivel);
    }
  };
  /*
    ⚠ **A DURAÇÃO escolhida não existe no formato do fio, e não é inventada.**
    O upstream guarda só `until`, então um silêncio vindo de outro dispositivo
    não diz qual das cinco opções a pessoa marcou. `NaN` não é igual a nenhuma
    delas, então o menu mostra o tempo restante e NENHUM ✓ — que é a verdade.
    Aproximar pelo prazo restante marcaria a opção errada em metade dos casos,
    que é exatamente o que motivou guardar a duração aqui.
  */
  const lerMutes = (v: unknown, destino: Map<string, Silencio>) => {
    for (const [id, e] of Object.entries(objeto(v) ?? {})) {
      const mute = objeto(e);
      if (!mute) continue;
      const ate = mute.until;
      if (typeof ate === "number" && Number.isFinite(ate)) {
        if (ate > agora) destino.set(id, { ate, duracaoMs: Number.NaN });
      } else {
        destino.set(id, { ate: Infinity, duracaoMs: Infinity });
      }
    }
  };

  lerNiveis(r.channel, proximosNiveis, proximosMutes);
  lerNiveis(r.server, proximosDeServidor, proximosMutesDeServidor);
  lerMutes(r.channel_mutes, proximosMutes);
  lerMutes(r.server_mutes, proximosMutesDeServidor);

  /*
    ⚠ **Troca os mapas crus, e NÃO passa pelos setters.** `definirNivelDoCanal`
    acopla "nada" ao silêncio; aplicado a um estado que veio de fora, ele
    reescreveria o que o outro dispositivo decidiu — e um canal com "nada" e
    SEM silêncio, que o cliente oficial produz, viraria um silêncio que
    ninguém pôs.
  */
  niveis.clear();
  niveisDeServidor.clear();
  silenciados.clear();
  servidoresSilenciados.clear();
  for (const [k, v] of proximosNiveis) niveis.set(k, v);
  for (const [k, v] of proximosDeServidor) niveisDeServidor.set(k, v);
  for (const [k, v] of proximosMutes) silenciados.set(k, v);
  for (const [k, v] of proximosMutesDeServidor) servidoresSilenciados.set(k, v);
  return true;
}

function lerOpcoes(cru: string): boolean {
  const r = objeto(JSON.parse(cru));
  if (!r) return false;
  opcoesDeServidor.clear();
  semSeguirTopicos.clear();
  const semSeguir = r[CHAVE_SEM_SEGUIR];
  if (Array.isArray(semSeguir)) {
    for (const id of semSeguir) if (typeof id === "string") semSeguirTopicos.add(id);
  }
  for (const [id, v] of Object.entries(r)) {
    const o = objeto(v);
    if (
      o &&
      typeof o.suprimirTodos === "boolean" &&
      typeof o.suprimirCargos === "boolean"
    ) {
      opcoesDeServidor.set(id, {
        suprimirTodos: o.suprimirTodos,
        suprimirCargos: o.suprimirCargos,
        /* Ausente é o formato de antes do interruptor existir — vale o
           padrão, que é avisar. */
        notificarEventos:
          typeof o.notificarEventos === "boolean"
            ? o.notificarEventos
            : OPCOES_PADRAO.notificarEventos,
      });
    }
  }
  return true;
}

function gravar(chaveLocal: string, valor: string): void {
  try {
    localStorage.setItem(chaveLocal, valor);
  } catch {
    /* armazenamento bloqueado: vale nesta aba */
  }
}

function persistirNotificacoes(): void {
  const valor = exportarNotificacoes();
  gravar(LOCAL_NOTIFICACOES, valor);
  avisarSync(CHAVE_NOTIFICACOES, valor);
}

function persistirOpcoes(): void {
  const valor = exportarOpcoesDeServidor();
  gravar(LOCAL_OPCOES, valor);
  avisarSync(CHAVE_OPCOES_DE_SERVIDOR, valor);
}

/**
 * Troca o estado pelo que veio do servidor, e acorda quem assina.
 *
 * Lança com JSON podre: quem chama (`sdk/sincronizar.ts`) já trata isso como
 * "fica o local".
 */
export function hidratarNotificacoes(cru: string): void {
  if (!lerNotificacoes(cru)) return;
  gravar(LOCAL_NOTIFICACOES, exportarNotificacoes());
  for (const ouvinte of ouvintes) ouvinte();
}

export function hidratarOpcoesDeServidor(cru: string): void {
  if (!lerOpcoes(cru)) return;
  gravar(LOCAL_OPCOES, exportarOpcoesDeServidor());
  for (const ouvinte of ouvintes) ouvinte();
}

/* Carga inicial. No fim do módulo porque os mapas acima precisam existir. */
function carregarLocal(): void {
  try {
    const n = localStorage.getItem(LOCAL_NOTIFICACOES);
    if (n) lerNotificacoes(n);
  } catch {
    /* JSON podre ou armazenamento bloqueado: começa vazio */
  }
  try {
    const o = localStorage.getItem(LOCAL_OPCOES);
    if (o) lerOpcoes(o);
  } catch {
    /* idem */
  }
}
carregarLocal();
