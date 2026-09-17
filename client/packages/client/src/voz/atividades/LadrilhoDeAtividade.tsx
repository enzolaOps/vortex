import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Botao } from "../../components/ui/Botao";
import { toast } from "../../components/ui/toastStore";
import { usuarioLocalId } from "../../sdk/adapter";
import { encerrarAtividade, enviarOperacao } from "../../sdk/atividades";
import { motivoDoErro } from "../../sdk/erros";
import {
  assinarOperacoes,
  assinarSessao,
  lerRegistro,
  lerSessao,
} from "../../store/atividades";
import { atividadePorId } from "./catalogo";
import { lerMensagemDoHost, VERSAO_DO_CONTRATO, type MensagemParaHost } from "./protocolo";
import css from "./LadrilhoDeAtividade.module.css";

/**
 * A atividade em curso, num ladrilho da grade do tamanho de um stream (2×2).
 *
 * ⚠ **O iframe é `sandbox="allow-scripts"` e NADA MAIS.** Sem
 * `allow-same-origin` a origem dele é opaca, mesmo servido pelo próprio app:
 * ele não lê o token em `localStorage`, os cookies nem o DOM daqui. Sem
 * `allow-top-navigation`, `allow-popups` e `allow-forms`, ele não tira a
 * pessoa da página nem abre janela. O único canal é `postMessage`, e toda
 * mensagem passa por `lerMensagemDoHost` — e só é aceita se vier da
 * `contentWindow` deste iframe (origem não distingue: todo sandbox é `"null"`).
 *
 * Renderiza `null` sem sessão, então a grade não reserva espaço à toa.
 */
export function LadrilhoDeAtividade({ channelId }: { channelId: string }) {
  const sessao = useSyncExternalStore(assinarSessao(channelId), () => lerSessao(channelId));
  const quadro = useRef<HTMLIFrameElement>(null);
  const [encerrando, setEncerrando] = useState(false);

  const atividade = sessao ? atividadePorId(sessao.tipo) : undefined;
  const caminho = atividade?.host.tipo === "pronto" ? atividade.host.caminho : undefined;
  const sessaoId = sessao?.id;

  useEffect(() => {
    if (!sessaoId || !caminho) return;
    const alvo = quadro.current;
    if (!alvo) return;

    const paraHost = (m: MensagemParaHost) => alvo.contentWindow?.postMessage(m, "*");
    let pronto = false;

    const aoMensagem = (e: MessageEvent) => {
      if (e.source !== alvo.contentWindow) return;
      const m = lerMensagemDoHost(e.data);
      if (!m) return;
      if (m.tipo === "pronto") {
        pronto = true;
        paraHost({
          vortex: VERSAO_DO_CONTRATO,
          tipo: "carregar",
          eu: usuarioLocalId() ?? "",
          registro: lerRegistro(channelId).map((o) => o.op),
        });
        return;
      }
      void enviarOperacao(channelId, sessaoId, m.op, m.snapshot).catch((erro: unknown) =>
        toast({
          tipo: "erro",
          titulo: "A atividade não sincronizou.",
          descricao: motivoDoErro(erro),
        }),
      );
    };

    window.addEventListener("message", aoMensagem);
    const soltar = assinarOperacoes(channelId, (op) => {
      if (pronto) paraHost({ vortex: VERSAO_DO_CONTRATO, tipo: "op", op: op.op });
    });
    return () => {
      window.removeEventListener("message", aoMensagem);
      soltar();
    };
  }, [channelId, sessaoId, caminho]);

  if (!sessao || !atividade) return null;

  function encerrar() {
    setEncerrando(true);
    encerrarAtividade(channelId)
      .catch((e: unknown) =>
        toast({ tipo: "erro", titulo: "Não deu para encerrar.", descricao: motivoDoErro(e) }),
      )
      .finally(() => setEncerrando(false));
  }

  return (
    <div className={css.ladrilho}>
      {caminho ? (
        <iframe
          ref={quadro}
          key={sessao.id}
          className={css.host}
          src={caminho}
          title={atividade.nome}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
        />
      ) : null}

      <div className={css.placa}>
        <span className={css.nome}>{atividade.nome}</span>
        <Botao tamanho="pequeno" variante="perigoSutil" carregando={encerrando} onClick={encerrar}>
          Encerrar
        </Botao>
      </div>
    </div>
  );
}
