import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useRef, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { ChatsCircle, X } from "../components/ui/icones";
import { cn } from "../lib/cn";
import { contagem, plural } from "../lib/plural";
import { quando } from "../lib/quando";
import { carregarTopicos, type Recorte } from "../sdk/topicos";
import { DIAS_SEM_ATIVIDADE_PARA_ARQUIVAR } from "../forum/estado";
import { selecionarCanal } from "../store/navegacao";
import { remedir } from "../lib/remedir";
import { useAgoraPorMinuto } from "../store/relogio";
import {
  useCanalAtivo,
  useChannel,
  usePessoa,
  useServidorAtivo,
  useTopico,
  useTopicosDoServidor,
} from "../store/hooks";
import css from "./PainelDeTopicos.module.css";

/**
 * O painel de tópicos — ativos, os que eu sigo e os arquivados do servidor.
 *
 * ⚠ **Virtualizado desde a primeira linha**, e não por simetria com a member
 * list: um servidor ativo acumula tópicos na casa das centenas, e arquivados
 * nunca somem. Retrofitar virtualização é reescrever a tela (lei nº 2).
 *
 * O cartão assina o PRÓPRIO tópico e o próprio canal (para a contagem de não
 * lidas). A lista assina só a lista de IDs do recorte — uma resposta nova num
 * tópico acorda o cartão dele e, se mudar a ordem, a lista.
 */

/** Altura do cartão (11 + 18 + 5 + 15 + 7 + 18 + 11) mais os 6 de margem. */
const ALTURA_CARTAO = 91;

const Cartao = memo(function Cartao({ id, ativo }: { id: string; ativo: boolean }) {
  const t = useTopico(id);
  const canal = useChannel(id);
  const pai = useChannel(t?.paiId ?? "");
  const autor = usePessoa(t?.ultimoAutorId ?? "");
  const agora = useAgoraPorMinuto();

  // Nunca `null`: linha não resolvida mede 0px e realimenta o virtualizador.
  if (!t) return <div className={css.cartao} aria-hidden />;

  const naoLidas = canal?.naoLidas ?? 0;
  const partes = [pai ? `#${pai.name}` : undefined];
  /*
    O design conta MENSAGENS aqui ("#produto · 12 mensagens") e respostas no
    cabeçalho do tópico. Num post a abertura mora dentro e é uma das mensagens;
    `respostas` a desconta, então ela volta para a conta deste rótulo.
  */
  if (t.respostas !== undefined) {
    const mensagens = t.respostas + (t.abertura?.noTopico ? 1 : 0);
    partes.push(plural(mensagens, "mensagem", "mensagens"));
  }
  const ultima = quando(t.ultimaEm, agora, "curto");

  return (
    <button
      type="button"
      className={cn(css.cartao, ativo && css.ativo)}
      aria-current={ativo ? "true" : undefined}
      onClick={() => selecionarCanal(id)}
    >
      <span className={css.linhaDoTitulo}>
        <ChatsCircle aria-hidden className={css.glifo} />
        <span className={css.nome}>{t.nome}</span>
        {naoLidas > 0 ? <span className={css.badge}>{contagem(naoLidas)}</span> : null}
      </span>
      <span className={css.meta}>{partes.filter(Boolean).join(" · ")}</span>
      <span className={css.rodape}>
        <span className={css.pilha} aria-hidden>
          {t.seguidores.slice(0, 3).map((pessoa) => (
            <Avatar key={pessoa} id={pessoa} tamanho="xxs" className={css.rosto} />
          ))}
        </span>
        <span className={css.ultima}>{autor ? `${autor.displayName} · ${ultima}` : ultima}</span>
        {t.seguindo ? <span className={css.seguindo}>seguindo</span> : null}
      </span>
    </button>
  );
});

export function PainelDeTopicos({ aoFechar }: { aoFechar?: () => void }) {
  const serverId = useServidorAtivo();
  const canalAtivo = useCanalAtivo();
  const [recorte, setRecorte] = useState<Recorte>("ativos");
  const ativos = useTopicosDoServidor(serverId, "ativos");
  const seguindo = useTopicosDoServidor(serverId, "seguindo");
  const arquivados = useTopicosDoServidor(serverId, "arquivados");
  const ids = recorte === "ativos" ? ativos : recorte === "seguindo" ? seguindo : arquivados;

  /*
    Os ativos chegam no `Ready`, sem contagem. A listagem traz a contagem — e
    é fire-and-forget: sem rede o painel continua com o que a sessão já sabe.
  */
  useEffect(() => {
    if (serverId) void carregarTopicos(serverId);
  }, [serverId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual, spike
  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ALTURA_CARTAO,
    getItemKey: (i) => ids[i] ?? i,
    overscan: 6,
  });

  // Largura mudou = remedir: o nome do canal pai trunca em outro ponto.
  const ultimaLargura = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      const w = e?.contentRect.width ?? 0;
      if (w === ultimaLargura.current) return;
      ultimaLargura.current = w;
      remedir(virtualizer);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [virtualizer]);

  const abas: { id: Recorte; rotulo: string; n: number | undefined }[] = [
    { id: "ativos", rotulo: "Ativos", n: ativos.length },
    { id: "seguindo", rotulo: "Seguindo", n: seguindo.length },
    // Sem número, como o design: arquivados só são conhecidos depois de pedidos.
    { id: "arquivados", rotulo: "Arquivados", n: undefined },
  ];

  return (
    <div className={css.painel}>
      <header className={css.cabecalho}>
        <span className={css.titulo}>Tópicos</span>
        {aoFechar ? (
          <button type="button" className={css.fechar} aria-label="Fechar tópicos" onClick={aoFechar}>
            <X aria-hidden />
          </button>
        ) : null}
      </header>

      <div className={css.abas} role="tablist" aria-label="Filtro de tópicos">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={recorte === a.id}
            className={css.aba}
            onClick={() => {
              setRecorte(a.id);
              // Arquivados nunca viajam com a sessão: pedir é abrir a aba.
              if (a.id === "arquivados" && serverId) {
                void carregarTopicos(serverId, { arquivados: true });
              }
            }}
          >
            {a.rotulo}
            {a.n !== undefined && a.n > 0 ? <span className={css.contagem}>{contagem(a.n)}</span> : null}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className={css.lista} tabIndex={0} role="tabpanel">
        {ids.length === 0 ? (
          <div className={css.vazio}>
            <span className={css.vazioIcone} aria-hidden>
              <ChatsCircle />
            </span>
            <span className={css.vazioTitulo}>
              {recorte === "arquivados"
                ? "Nada arquivado ainda"
                : recorte === "seguindo"
                  ? "Você não segue nenhum tópico"
                  : "Nenhum tópico aberto"}
            </span>
            <span className={css.vazioDetalhe}>
              {recorte === "arquivados"
                ? `Tópicos sem atividade por ${DIAS_SEM_ATIVIDADE_PARA_ARQUIVAR} dias vêm para cá e podem ser reabertos com uma resposta.`
                : recorte === "seguindo"
                  ? "Responder num tópico passa a segui-lo."
                  : "Abra um tópico a partir de uma mensagem ou da linha do canal."}
            </span>
          </div>
        ) : (
          <div className={css.trilho} style={{ blockSize: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className={css.item}
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <Cartao id={ids[item.index]!} ativo={ids[item.index] === canalAtivo} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
