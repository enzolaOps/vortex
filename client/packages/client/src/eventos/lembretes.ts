import { toast } from "../components/ui/toastStore";
import { ARNES_ATIVO } from "../dev/arnesAtivo";
import { decidirLembreteDeEvento } from "../notificacao/decidir";
import { ponteDeNotificacoes } from "../notificacao/notificador";
import { usuarioLocalId } from "../sdk/adapter";
import { conectado } from "../sdk/client";
import {
  carregarMeusInteresses,
  lembretesDevidos,
  lerTodosOsEventos,
  quandoLongo,
  type EventoDoServidor,
} from "../sdk/eventos";
import { tocar } from "../som/sons";
import { lerMeuStatus } from "../store/meuStatus";
import { irParaEventos } from "../store/navegacao";
import { lerNotificacoes } from "../store/notificacoes";
import { opcoesDoServidor } from "../store/silencio";

/**
 * O lembrete de "10 minutos antes" — o que o interruptor "Lembrar
 * interessados" do assistente promete.
 *
 * ⚠ **Do CLIENTE, e é decisão dita.** O serviço que manda push fora do app
 * (`pushd`) segue pinado no upstream, e ensiná-lo a agendar seria o terceiro
 * serviço do fork a publicar. O custo: o lembrete só chega com o app aberto —
 * na aba, no desktop ou na bandeja. É o caso comum de uma ferramenta que fica
 * aberta o dia inteiro, e é o que fica registrado no PR.
 *
 * Um intervalo de 30 s e não um `setTimeout` por evento: com timeout, editar a
 * hora de um evento exigiria achar e cancelar o timer antigo, e a aba
 * suspensa pelo navegador acordaria com timers atrasados disparando de uma
 * vez. A varredura é sobre os eventos em que EU marquei interesse — dezenas.
 */

const avisados = new Set<string>();
let ligado = false;
let interessesCarregados = false;

function avisar(e: EventoDoServidor, agora: number): void {
  const prefs = lerNotificacoes();
  const janelaEmFoco = typeof document !== "undefined" && document.hasFocus();
  const canais = decidirLembreteDeEvento({
    prefs,
    naoPerturbe: lerMeuStatus().presenca === "dnd",
    agora: new Date(agora),
    janelaEmFoco,
  });
  const titulo = `${e.nome} começa em 10 minutos`;
  const corpo = quandoLongo(e, agora);

  if (canais.has("som")) tocar("mensagem");
  if (canais.has("toast")) {
    toast({
      tipo: "info",
      titulo,
      descricao: corpo,
      acao: {
        rotulo: "Ver evento",
        descricaoAlternativa: `Abrir os eventos do servidor de ${e.nome}`,
        aoAtivar: () => irParaEventos(e.serverId),
      },
    });
  }
  if (
    canais.has("push") &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    try {
      const n = new Notification(titulo, { body: corpo, tag: `evento-${e.id}`, silent: true });
      n.onclick = () => {
        ponteDeNotificacoes()?.focar();
        window.focus();
        irParaEventos(e.serverId);
        n.close();
      };
    } catch {
      /* Contexto sem construtor de notificação — fica sem aviso do sistema. */
    }
  }
}

function varrer(): void {
  if (!interessesCarregados && conectado()) {
    interessesCarregados = true;
    void carregarMeusInteresses();
  }
  const agora = Date.now();
  for (const { chave, evento } of lembretesDevidos(
    lerTodosOsEventos(),
    usuarioLocalId(),
    agora,
    avisados,
    (serverId) => opcoesDoServidor(serverId).notificarEventos,
  )) {
    avisados.add(chave);
    avisar(evento, agora);
  }
}

/** Liga a varredura. Idempotente; devolve como desligar. */
export function ligarLembretesDeEventos(): () => void {
  if (ligado || ARNES_ATIVO) return () => undefined;
  ligado = true;
  varrer();
  const id = setInterval(varrer, 30_000);
  return () => {
    clearInterval(id);
    ligado = false;
  };
}
