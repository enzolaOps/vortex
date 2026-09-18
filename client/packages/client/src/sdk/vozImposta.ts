/**
 * O que o SERVIDOR fez com a sua voz — movido, desconectado, silenciado.
 *
 * ⚠ **Os três aconteciam em SILÊNCIO, e o silêncio era o defeito.** Ser movido
 * de canal por quem modera chegava aqui como um `RoomEvent.Disconnected` do
 * LiveKit, e o motor respondia zerando a chamada: a faixa sumia, o cartão
 * sumia, e nada na tela dizia por quê. Ser desconectado dava o mesmo quadro.
 * Ser silenciado no servidor acendia o `SRV` na linha dos OUTROS e não dizia
 * nada para quem tinha acabado de perder o microfone.
 *
 * É a classe de falha que este projeto trata como pior que a ausência: a
 * interface muda de estado sozinha e quem está nela conclui que a chamada caiu.
 *
 * ---
 *
 * ⚠ **A corrida que este módulo existe para resolver.** Mover alguém é uma
 * requisição só do lado do servidor (`member_edit.rs`), e ela produz DOIS
 * sinais por caminhos diferentes:
 *
 * 1. `voice_client.remove_user(nó antigo)` → o LiveKit fecha a sua conexão com
 *    `DisconnectReason.PARTICIPANT_REMOVED`;
 * 2. `EventV1::UserMoveVoiceChannel { from, to }` → chega pelo websocket.
 *
 * O primeiro é indistinguível de "um moderador te desconectou", e ele costuma
 * chegar ANTES do segundo — o servidor remove e só então publica. Reagir na
 * hora diria "você foi desconectada" e, meio segundo depois, "você foi movida":
 * dois avisos contraditórios sobre o mesmo fato.
 *
 * Então nenhum dos dois decide sozinho. Quem chegar primeiro abre uma janela de
 * {@link JANELA_MS}; a resolução acontece quando o segundo chega ou quando a
 * janela fecha. Movimento GANHA de remoção: uma remoção acompanhada de
 * movimento é o transporte do movimento, não um fato próprio.
 *
 * ---
 *
 * ⚠ **Não dizemos QUEM moveu, e o design pede.** D-LAC-24 escreve "por Ana
 * Ribeiro". O protocolo não carrega o autor em nenhum dos dois sinais:
 * `UserMoveVoiceChannel` tem `{user, from, to, token, node}` e
 * `ServerMemberUpdate` tem `{id, data, clear}`. O autor existe no registro de
 * auditoria (`member_edit.rs` grava um `AuditLogEntry`), e ir buscá-lo custaria
 * uma chamada de rede no instante do aviso, sobre uma rota que exige
 * `ViewAuditLog` — permissão que justamente quem acabou de ser movido quase
 * nunca tem. Um nome inventado seria pior que a ausência dele.
 *
 * ---
 *
 * ⚠ **Módulo PURO de propósito.** Ele não importa `livekit-client` (é o motor
 * que traduz o motivo de desconexão) nem o adapter (é ele que lê o evento
 * cru). O que entra são ids e nomes já resolvidos; o que sai são toasts. Assim
 * a corrida acima tem teste com relógio falso, sem sala e sem socket.
 */
import { toast } from "../components/ui/toastStore";

/**
 * Quanto se espera pelo segundo sinal antes de decidir.
 *
 * Os dois nascem da MESMA requisição no servidor, então a distância entre eles
 * é a diferença de latência entre o websocket e o fecho da conexão WebRTC —
 * dezenas de milissegundos numa rede normal. A folga é grande porque o custo de
 * errar é assimétrico: esperar um segundo a mais atrasa um aviso; decidir cedo
 * demais afirma o contrário do que aconteceu.
 */
export const JANELA_MS = 1500;

export type MovimentoImposto = {
  readonly de: string;
  readonly para: string;
  readonly nomeDe: string;
  readonly nomePara: string;
};

export type RemocaoImposta = {
  readonly canal: string;
  readonly nome: string;
};

let movimento: MovimentoImposto | undefined;
let remocao: RemocaoImposta | undefined;
let prazo: ReturnType<typeof setTimeout> | undefined;

/**
 * Como voltar para uma sala.
 *
 * Injetável, e o padrão carrega o motor por `import()` dinâmico pela mesma
 * razão que `sdk/chamada.ts` existe: este módulo é importado pelo adapter, que
 * está no carregamento inicial, e um import estático da fachada traria meio
 * megabyte de WebRTC junto — além de fechar o ciclo `adapter → vozImposta →
 * chamada → adapter`.
 */
let entrarNaVoz: (channelId: string) => void = (channelId) => {
  void import("./chamada").then((m) => {
    void m.entrarNaChamada(channelId);
  });
};

/** Só para teste: troca o caminho de volta por um dublê. */
export function definirEntradaDeVoz(f: (channelId: string) => void): void {
  entrarNaVoz = f;
}

function agendar(): void {
  if (prazo !== undefined) clearTimeout(prazo);
  prazo = setTimeout(resolver, JANELA_MS);
}

function resolver(): void {
  if (prazo !== undefined) clearTimeout(prazo);
  prazo = undefined;
  const m = movimento;
  const r = remocao;
  movimento = undefined;
  remocao = undefined;

  if (m) {
    /*
      O retorno é ENTRADA NORMAL na voz, e o design escreve isso: *"o retorno é
      uma entrada normal na voz, não um 'desfazer' privilegiado"*. Ou seja, se
      a sala de origem estiver cheia ou fechada para você, voltar falha como
      qualquer entrada falharia — o botão não desfaz a decisão de quem moderou.
    */
    toast({
      tipo: "info",
      titulo: `Você foi movida para ${m.nomePara}.`,
      descricao: "Um moderador mudou você de canal.",
      acao: {
        rotulo: `Voltar para ${m.nomeDe}`,
        descricaoAlternativa: `Para voltar, entre de novo em ${m.nomeDe} pela coluna de canais.`,
        aoAtivar: () => {
          entrarNaVoz(m.de);
        },
      },
    });
    /* E a entrada no destino, que é o que faz o aviso ser verdade: o servidor
       já abriu a sala nova e emitiu o token, mas quem conecta é o cliente. Sem
       isto "você foi movida" descreveria um lugar onde você não está. */
    entrarNaVoz(m.para);
    return;
  }

  if (r) {
    toast({
      tipo: "erro",
      titulo: "Você foi desconectada da voz.",
      descricao: `Um moderador tirou você de ${r.nome}.`,
      acao: {
        rotulo: "Reconectar",
        descricaoAlternativa: `Para voltar, entre de novo em ${r.nome} pela coluna de canais.`,
        aoAtivar: () => {
          entrarNaVoz(r.canal);
        },
      },
    });
  }
}

/** O servidor te mudou de canal — lido do evento cru `UserMoveVoiceChannel`. */
export function registrarMovimentoImposto(m: MovimentoImposto): void {
  movimento = m;
  if (remocao) {
    resolver();
    return;
  }
  agendar();
}

/**
 * O LiveKit te tirou da sala por ordem de fora (`PARTICIPANT_REMOVED`).
 *
 * Pode ser desconexão por moderação OU a primeira metade de um movimento — é
 * justamente o que a janela decide.
 */
export function registrarRemocaoImposta(r: RemocaoImposta): void {
  remocao = r;
  if (movimento) {
    resolver();
    return;
  }
  agendar();
}

/**
 * Lê `UserMoveVoiceChannel` de um evento cru do socket.
 *
 * ⚠ **Cru porque o SDK o DESCARTA.** O `case "UserMoveVoiceChannel"` em
 * `events/v1.ts` é um `// todo` vazio, e o tipo dele lá nem declara `from`/`to`
 * — o servidor manda os quatro campos (`events/client.rs`), o SDK tipou dois.
 * É o mesmo arranjo de `can_publish`: o payload vale, a hidratação não.
 *
 * O evento é privado do alvo (`.private(target_user.id)`), então não há o que
 * conferir sobre "sou eu": quem recebe é quem foi movido.
 */
export function lerMovimentoImposto(
  evento: unknown,
): { readonly de: string; readonly para: string } | undefined {
  const e = evento as { type?: string; from?: unknown; to?: unknown };
  if (e.type !== "UserMoveVoiceChannel") return undefined;
  if (typeof e.from !== "string" || typeof e.to !== "string") return undefined;
  if (e.from === "" || e.to === "" || e.from === e.to) return undefined;
  return { de: e.from, para: e.to };
}

/**
 * Mudo pelo servidor mudou — para VOCÊ.
 *
 * ⚠ **Sem ação de desfazer, e o design diz por quê**: *"só um moderador pode
 * reverter"*. Um botão aqui prometeria um caminho que o servidor recusa
 * (`MuteMembers` sobre si mesmo não existe), e alvo que sempre falha é o
 * defeito que o lint de `onSelect` deste projeto foi instalado para matar.
 *
 * O aviso de LIBERAÇÃO existe pelo mesmo motivo que o de restrição: sem ele,
 * recuperar o microfone seria outra mudança de estado que acontece sozinha e
 * não se explica. É `info` nos dois sentidos — restrição administrativa não é
 * falha, e é a mesma razão pela qual o `SRV` da coluna é âmbar e não vermelho.
 */
export function avisarMudoDoServidor(podeFalar: boolean): void {
  toast(
    podeFalar
      ? { tipo: "info", titulo: "Você pode falar de novo neste servidor." }
      : {
          tipo: "info",
          titulo: "Você foi silenciada no servidor.",
          descricao: "Só um moderador pode reverter.",
        },
  );
}

/** Ensurdecido pelo servidor — `can_receive`. Mesma regra do mudo. */
export function avisarSurdoDoServidor(podeOuvir: boolean): void {
  toast(
    podeOuvir
      ? { tipo: "info", titulo: "Você voltou a ouvir neste servidor." }
      : {
          tipo: "info",
          titulo: "Você foi ensurdecida no servidor.",
          descricao: "Só um moderador pode reverter.",
        },
  );
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparVozImposta(): void {
  if (prazo !== undefined) clearTimeout(prazo);
  prazo = undefined;
  movimento = undefined;
  remocao = undefined;
}
