import { assinarVideo, definirQualidadeDeStream } from "nucleo/sdk/chamada";
import { escolherSala } from "nucleo/store/ultimoLugar";
import {
  useCanaisDeVoz,
  useChamada,
  useChannel,
  useEstadoDaChamada,
  useFalhaDeVoz,
  usePalco,
  useUltimoLugar,
} from "nucleo/store/hooks";
import type { FonteDeVideo } from "nucleo/store/video";
import { useEffect, useState, type RefObject } from "react";

/**
 * Qual sala o palco mostra, e se ele está aberto NESTE servidor.
 *
 * A sala é a da chamada; sem chamada, a da falha que ainda está na tela; sem
 * nenhuma das duas (a pessoa acabou de sair), a última que ela viu aqui — é o
 * que o estado "você não está na sala" precisa para oferecer "Entrar".
 *
 * ⚠ **Aberto só no servidor da sala.** A chamada sobrevive a trocar de
 * servidor; o palco não: ele é a tela do servidor onde a sala mora. Em outro
 * servidor a chamada continua no widget.
 */
export function useSalaDoPalco(serverId: string | undefined): { aberto: boolean; canalId: string } {
  const palco = usePalco();
  const chamada = useChamada();
  const falha = useFalhaDeVoz();
  const lembrada = useUltimoLugar(serverId ?? "").sala;
  const existentes = useCanaisDeVoz(serverId ?? "");

  const daChamada = chamada.estado !== "fora" ? chamada.channelId : undefined;
  const padrao =
    lembrada !== undefined && existentes.includes(lembrada)
      ? lembrada
      : serverId !== undefined
        ? escolherSala(serverId)
        : undefined;
  const canalId = daChamada ?? falha?.channelId ?? padrao ?? "";
  const canal = useChannel(canalId);

  const aberto =
    serverId !== undefined && palco.tipo !== "fechado" && canalId !== "" && canal?.serverId === serverId;
  return { aberto, canalId };
}

/** "12:04" / "1:02:09" desde `desde` (epoch ms). Re-renderiza só quem o usa, 1x por segundo. */
export function useTempoDecorrido(desde: number): string | undefined {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (desde === 0) return;
    const id = setInterval(() => {
      setAgora(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [desde]);
  if (desde === 0) return undefined;
  const total = Math.max(0, Math.floor((agora - desde) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${String(h)}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

/** A pessoa está dentro (ou entrando): o palco mostra a sala, e não o aviso de fora. */
export function useNaChamada(): boolean {
  return useEstadoDaChamada() !== "fora";
}

/**
 * O papel do vídeo na tela decide a camada que se aceita receber.
 *
 * - `foco`: a transmissão grande do palco — camada alta.
 * - `miniatura`: tudo o que é pequeno (tira de pessoas, grade) — camada média,
 *   a menor que o motor sabe pedir (`QualidadeDeStream` não tem "baixa").
 */
export type PapelDoVideo = "foco" | "miniatura";

/**
 * A assinatura de vídeo de UM ladrilho, presa ao que está visível.
 *
 * ⚠ **Este é o modelo de assinatura do palco (TRD §5), e a regra é uma só: vídeo
 * só desce enquanto alguém pode vê-lo.** `autoSubscribe: false` no motor deixa
 * o áudio como único fluxo automático; cada faixa de vídeo é pedida aqui e
 * devolvida quando:
 *
 * 1. o ladrilho desmonta (saiu do palco, a pessoa foi ler outro canal, sala nova);
 * 2. o ladrilho sai da TELA (grade rolada: `IntersectionObserver`);
 * 3. a aba fica oculta (`visibilityState`).
 *
 * A contagem de quem quer cada faixa mora em `nucleo/sdk/assinaturaDeVideo.ts`
 * (dois ladrilhos para a mesma faixa não derrubam um ao outro, e a devolução
 * espera 250 ms para a troca de foco → miniatura não passar por zero).
 *
 * A camada vem do `papel` e é pedida DEPOIS da assinatura, porque
 * `definirQualidadeDeStream` age sobre a publicação já assinada.
 *
 * `soAudio` não é decidido aqui: é escolha explícita da pessoa, pela mesma
 * `definirQualidadeDeStream`.
 *
 * Faixa própria nunca é assinada (não é remota): `proprio` desliga o efeito.
 *
 * `documento` é onde o vídeo aparece (a janela destacada tem o dela).
 */
export function useAssinaturaDeVideo(
  alvo: RefObject<Element | null>,
  userId: string,
  fonte: FonteDeVideo,
  papel: PapelDoVideo,
  proprio: boolean,
  documento: Document = document,
): void {
  const [naTela, setNaTela] = useState(true);
  const [aberta, setAberta] = useState(() => documento.visibilityState !== "hidden");

  useEffect(() => {
    const el = alvo.current;
    // ⚠ O observador é da janela DONA do elemento: na janela destacada o ladrilho vive
    // noutro documento, e o da principal observaria um nó que ele não renderiza.
    const Observador = el?.ownerDocument.defaultView?.IntersectionObserver ?? globalThis.IntersectionObserver;
    if (!el || typeof Observador === "undefined") return;
    const io = new Observador((entradas) => {
      const ultima = entradas[entradas.length - 1];
      if (ultima) setNaTela(ultima.isIntersecting);
    });
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [alvo]);

  useEffect(() => {
    // ⚠ A visibilidade é a do documento ONDE o vídeo aparece. A principal escondida
    // (a pessoa está no jogo) não tira o vídeo de quem olha a janela destacada.
    const aoMudar = () => {
      setAberta(documento.visibilityState !== "hidden");
    };
    documento.addEventListener("visibilitychange", aoMudar);
    return () => {
      documento.removeEventListener("visibilitychange", aoMudar);
    };
  }, [documento]);

  const quer = !proprio && naTela && aberta;
  useEffect(() => {
    if (!quer) return;
    if (assinarVideo(userId, fonte, true)) {
      definirQualidadeDeStream(userId, fonte, papel === "foco" ? "alta" : "media");
    }
    return () => {
      assinarVideo(userId, fonte, false);
    };
  }, [quer, userId, fonte, papel]);
}
