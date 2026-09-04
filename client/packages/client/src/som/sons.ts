import { assinarChamada, lerChamada, type Chamada } from "../store/chamada";
import {
  assinarConexao,
  lerConexao,
  type EstadoDaConexao,
} from "../store/conexao";
import { lerPreferenciasDeVoz } from "../store/preferenciasDeVoz";

/**
 * Os sons do app, sintetizados.
 *
 * ⚠ **O app era MUDO, e som existia num lugar só: o teste de alto-falante das
 * configurações.** Entrar numa sala de voz, sair, silenciar o microfone e
 * perder a conexão aconteciam sem nenhum aviso audível — e essas são
 * exatamente as ações que a pessoa executa SEM estar olhando para a tela, que
 * é o que torna o som o canal certo para elas. Quem usa relatou como "falta
 * feedback sonoro".
 *
 * ⚠ **Sintetizados e não arquivos, e a escolha tem três consequências.**
 * (1) Zero bytes no bundle, num cliente onde meio megabyte de LiveKit já
 * precisou virar `import()` dinâmico. (2) O caráter é afinável numa linha, em
 * vez de exigir um ciclo de ferramenta de áudio. (3) Não há requisição de rede
 * no instante em que o som precisa tocar — um `.ogg` buscado na hora chega
 * depois do evento que ele anuncia.
 *
 * O que se perde é timbre: seno com envelope é um bipe, não um som desenhado.
 * Para confirmação de estado num app de produtividade isso é o certo — som
 * elaborado cansa quem o ouve quarenta vezes por dia.
 *
 * ⚠ **Não há háptico nesta plataforma.** A Vibration API é de dispositivo
 * móvel, e o briefing diz web e Electron desktop. Onde um app de celular
 * vibraria, aqui só existe o visual (o estado pressionado) e isto.
 */

/*
  União fechada e não array: ninguém itera os sons, e `Record<Som, …>` abaixo
  já dá a exaustividade — som novo não compila até ter motivo. É a mesma
  mecânica de `Palco` e `FormaDoPopout`.
*/
export type Som = "entrar" | "sair" | "mudo" | "desmudo" | "queda";

/**
 * Cada som é um MOTIVO de uma ou duas notas, e a direção carrega o sentido.
 *
 * Subir é chegar e abrir; descer é sair e fechar. É a convenção que todo
 * cliente de voz usa, e ela funciona porque não precisa ser aprendida — uma
 * quinta ascendente soa como porta abrindo para quem nunca ouviu esta em
 * particular.
 *
 * ⚠ **`queda` é o único que desce uma TERÇA MENOR**, e não uma quinta: o
 * intervalo menor é o que distingue "você saiu" (decisão sua, quinta) de "a
 * conexão caiu" (aconteceu com você). Sem essa distinção os dois eventos mais
 * parecidos do app soariam iguais no momento em que menos se pode confundi-los.
 */
const MOTIVOS: Record<Som, { readonly notas: readonly number[]; readonly ganho: number }> = {
  /* C5 → G5, quinta ascendente. */
  entrar: { notas: [523.25, 783.99], ganho: 1 },
  /* G5 → C5, a mesma quinta ao contrário. */
  sair: { notas: [783.99, 523.25], ganho: 1 },
  /* Nota única e grave: silenciar não é um destino, é um estado. */
  mudo: { notas: [392.0], ganho: 0.85 },
  desmudo: { notas: [587.33], ganho: 0.85 },
  /* A4 → F4, terça menor descendente, e mais alto que os outros porque
     ele é o único que precisa ser ouvido por cima de uma conversa. */
  queda: { notas: [440.0, 349.23], ganho: 1.2 },
};

/** Duração de cada nota. Curto o bastante para não atrasar a próxima ação. */
const NOTA_S = 0.09;

/**
 * O pico de ganho, e ele é BAIXO de propósito.
 *
 * Som de interface compete com a voz de quem está na chamada. 0,05 é audível
 * num fone em volume de conversa e não sobressalta — o teto foi escolhido
 * ouvindo, não calculado.
 */
const PICO = 0.05;

/**
 * Silêncio antes de soltar o dispositivo de áudio.
 *
 * ⚠ **Existe por causa do erro nº 5, e o projeto já pagou por ele uma vez:**
 * `midiaDeTeste.ts` registra que cada abertura da tela de voz deixava um
 * `AudioContext` vivo, e que o navegador tem teto de contextos por aba. Aqui
 * o contexto é um só — esse defeito não se repete —, mas um contexto ATIVO
 * mantém o dispositivo de áudio acordado, e este app fica aberto oito horas.
 * `suspend()` devolve o dispositivo sem destruir o contexto, então o próximo
 * som não paga a construção de novo.
 */
const OCIOSO_MS = 4000;

let ctx: AudioContext | undefined;
let dormir: ReturnType<typeof setTimeout> | undefined;

function contexto(): AudioContext | undefined {
  if (typeof AudioContext === "undefined") return undefined;
  ctx ??= new AudioContext();
  return ctx;
}

/**
 * Toca um som, ou não faz nada.
 *
 * ⚠ **Toda falha é engolida, e é decisão.** As causas possíveis são a política
 * de autoplay (o contexto nasce suspenso até o primeiro gesto), a ausência de
 * dispositivo de saída e a aba em segundo plano. Nenhuma delas é defeito, e
 * nenhuma delas é algo que quem usa possa consertar — um toast dizendo "não
 * deu para tocar o bipe" seria ruído sobre um não-evento.
 *
 * Chamado dos caminhos de voz e de conexão, nunca do caminho de mensagem: a
 * linha é o componente mais quente do app, e som por mensagem recebida
 * precisaria de coalescência própria antes de existir.
 */
export function tocar(som: Som): void {
  const prefs = lerPreferenciasDeVoz();
  if (!prefs.sons) return;

  const c = contexto();
  if (!c) return;

  /*
    `resume()` é assíncrono e pode ser recusado antes do primeiro gesto. Tocar
    DEPOIS dele, e não em paralelo, é o que evita agendar notas contra um
    relógio parado — `currentTime` não anda enquanto o contexto está suspenso,
    e as notas sairiam todas empilhadas no mesmo instante ao acordar.
  */
  void c
    .resume()
    .then(() => {
      emitir(c, som, prefs.volumeDeSaida / 100);
      adiarSono(c);
    })
    .catch(() => undefined);
}

function emitir(c: AudioContext, som: Som, volume: number): void {
  const motivo = MOTIVOS[som];
  const pico = PICO * motivo.ganho * volume;
  if (pico <= 0) return;

  motivo.notas.forEach((hz, i) => {
    const inicio = c.currentTime + i * NOTA_S;
    const osc = c.createOscillator();
    const env = c.createGain();

    /*
      Seno e não onda serrilhada ou quadrada: os harmônicos das outras duas
      cortam num som curto e agudo, e o que se ouve é um clique. Para um bipe
      de confirmação o fundamental sozinho é o que soa limpo.
    */
    osc.type = "sine";
    osc.frequency.value = hz;

    /*
      ⚠ **Envelope obrigatório, e sem ele o som é um ESTALO.** Ligar e desligar
      um oscilador em ganho cheio produz descontinuidade na forma de onda — o
      alto-falante recebe um degrau, e o degrau é um clique que se ouve mais
      que a nota. Ataque de 6ms e decaimento exponencial resolvem os dois
      lados.

      `exponentialRampToValueAtTime` não aceita zero como alvo (o log de zero
      não existe), daí o 0,0001 — inaudível, e o `stop` corta depois dele.
    */
    env.gain.setValueAtTime(0.0001, inicio);
    env.gain.exponentialRampToValueAtTime(pico, inicio + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, inicio + NOTA_S);

    osc.connect(env).connect(c.destination);
    osc.start(inicio);
    osc.stop(inicio + NOTA_S + 0.01);
  });
}

function adiarSono(c: AudioContext): void {
  if (dormir !== undefined) clearTimeout(dormir);
  dormir = setTimeout(() => {
    dormir = undefined;
    void c.suspend().catch(() => undefined);
  }, OCIOSO_MS);
}

/**
 * Estado limpo entre testes. O módulo é global e sobrevive.
 *
 * Mesmo contrato de `limparChamada` — sem isto, um teste que tocasse um som
 * deixaria o `setTimeout` de sono pendurado para o seguinte.
 */
export function limparSons(): void {
  if (dormir !== undefined) clearTimeout(dormir);
  dormir = undefined;
  void ctx?.close().catch(() => undefined);
  ctx = undefined;
}

/* ============================================================
   A ligação com os stores
   ============================================================ */

/**
 * Liga os sons aos STORES, e não aos handlers dos botões.
 *
 * ⚠ **A diferença importa e é a razão de este arquivo existir assim.** Mudo é
 * alcançável pela doca da sala, pelo popout, pela faixa de voz, pelo painel de
 * usuário e por atalho de teclado; entrar e sair, por mais quatro caminhos. Um
 * `tocar()` em cada handler seriam nove sítios que precisam concordar, e o
 * primeiro a divergir seria o que ninguém apertou naquela semana.
 *
 * O store é a fonte da verdade: se o estado mudou, o som toca — inclusive
 * quando quem mudou foi o SERVIDOR (mudo de servidor, queda, desconexão), que
 * é justamente o caso em que ninguém apertou nada e o aviso é mais necessário.
 *
 * ⚠ **Não toca no primeiro valor.** Sem a leitura inicial, abrir o app já
 * conectado dispararia "entrou na sala" para uma chamada que começou antes —
 * e restaurar sessão durante uma chamada é caso normal.
 */
export function ligarSonsDeVoz(): () => void {
  let chamadaAnterior = lerChamada();
  let conexaoAnterior = lerConexao();

  const pararChamada = assinarChamada(() => {
    const agora = lerChamada();
    const som = somDaChamada(chamadaAnterior, agora);
    chamadaAnterior = agora;
    if (som) tocar(som);
  });

  const pararConexao = assinarConexao(() => {
    const agora = lerConexao();
    const som = somDaConexao(conexaoAnterior, agora);
    conexaoAnterior = agora;
    if (som) tocar(som);
  });

  return () => {
    pararChamada();
    pararConexao();
  };
}

/* ============================================================
   A decisão, separada do efeito
   ------------------------------------------------------------
   ⚠ **Funções PURAS porque o efeito é intestável aqui.** `tocar` depende de
   `AudioContext`, que não existe em jsdom — um teste de `ligarSonsDeVoz`
   inteiro não observaria nada e passaria sempre, que é o mesmo que não ter
   teste. As ramificações que importam são estas, e elas não precisam de áudio
   para serem exercitadas.
   ============================================================ */

/** O que a mudança de chamada merece ouvir, ou nada. */
export function somDaChamada(
  antes: Pick<Chamada, "estado" | "mudo">,
  agora: Pick<Chamada, "estado" | "mudo">,
): Som | undefined {
  /* `dentro` e não `conectando`: o som confirma que a sala ACEITOU, e
     "entrando…" ainda pode falhar — um bipe de chegada seguido de erro é
     pior que silêncio. */
  if (antes.estado !== "dentro" && agora.estado === "dentro") return "entrar";
  if (antes.estado !== "fora" && agora.estado === "fora") return "sair";

  /*
    Mudo só DENTRO da chamada. Fora dela o botão guarda preferência para a
    próxima sala — é decisão registrada do projeto —, e anunciar com som algo
    que não está no ar afirmaria que alguma coisa mudou agora.
  */
  if (agora.estado === "dentro" && antes.mudo !== agora.mudo) {
    return agora.mudo ? "mudo" : "desmudo";
  }
  return undefined;
}

/**
 * Só a QUEDA tem som.
 *
 * A volta já tem a faixa sumindo da tela, e um bipe de "voltou" chegaria
 * depois de a pessoa já ter visto — é a mesma assimetria da faixa de
 * reconexão, que espera 1,5s para avisar e para de avisar na hora.
 */
export function somDaConexao(
  antes: EstadoDaConexao,
  agora: EstadoDaConexao,
): Som | undefined {
  return antes === "conectado" && agora !== "conectado" ? "queda" : undefined;
}
