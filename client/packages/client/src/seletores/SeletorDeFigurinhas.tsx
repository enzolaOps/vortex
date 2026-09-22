import { useState, useSyncExternalStore } from "react";

import { ClockCounterClockwise } from "../components/ui/icones";
import { useFigurinha, useFigurinhasDoServidor } from "../expressoes/hooks";
import { assinarRecentes, lerRecentes, usarFigurinha } from "../expressoes/recentes";
import { gradienteDe, corDoTextoDe } from "../lib/gradiente";
import type { Figurinha } from "../sdk/expressoes";
import { useServer, useServerIds, useServidorAtivo } from "../store/hooks";
import {
  CascaDeSeletor,
  CELULA_DA_GRADE,
  SecaoDeSeletor,
} from "./CascaDeSeletor";
import css from "./Seletores.module.css";

/**
 * O seletor de figurinhas.
 *
 * ⚠ **Era casca inerte — "figurinha não existe no protocolo".** Existe agora no
 * fork do `delta`, e o seletor é o do design: recentes, um pacote por servidor
 * (o aberto primeiro), busca por nome, descrição e emoji relacionado, e o
 * rodapé com a prévia de quem está sob o ponteiro. Escolher ENVIA — figurinha é
 * a mensagem inteira, não algo inserido no rascunho.
 *
 * ⚠ **O pacote bloqueado do design NÃO entrou, e é o protocolo que decide.** Ele
 * mostra figurinhas de um servidor onde você não está, esmaecidas, "Entre no
 * servidor para usar estas figurinhas". Só que listar as figurinhas de um
 * servidor exige ser membro (`/servers/{id}/stickers` responde `NotFound` a
 * quem não é, como a de emojis), então não há de onde tirar esse pacote. A
 * regra de uso mora no servidor — mandar uma figurinha alheia volta
 * `InvalidOperation`.
 */
export function SeletorDeFigurinhas({
  aoEscolher,
}: {
  aoEscolher: (figurinha: Figurinha) => void;
}) {
  const [busca, setBusca] = useState("");
  const [sobre, setSobre] = useState<Figurinha | undefined>(undefined);
  const recentes = useSyncExternalStore(assinarRecentes, lerRecentes);
  const ativo = useServidorAtivo();
  const todos = useServerIds();
  /* O servidor aberto primeiro: é de onde a pessoa mais provavelmente quer. */
  const servidores = ativo && todos.includes(ativo) ? [ativo, ...todos.filter((s) => s !== ativo)] : todos;
  const filtro = busca.trim().toLowerCase();

  const escolher = (f: Figurinha) => {
    usarFigurinha(f.id);
    aoEscolher(f);
  };

  const irPara = (id: string) => {
    setBusca("");
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  return (
    <CascaDeSeletor
      rotulo="Figurinhas"
      busca={{ valor: busca, aoMudar: setBusca, placeholder: "Buscar figurinha" }}
      rail={
        <>
          <button
            type="button"
            className={css.categoria}
            aria-label="Recentes"
            onClick={() => irPara("vx-figurinhas-recentes")}
          >
            <ClockCounterClockwise aria-hidden />
          </button>
          {servidores.map((id) => (
            <LadrilhoDeServidor key={id} serverId={id} aoIr={() => irPara(ancoraDe(id))} />
          ))}
        </>
      }
      rodape={
        sobre ? (
          <>
            <Miniatura figurinha={sobre} pequena />
            <div className={css.previaTexto}>
              <span className={css.previaNomeFigurinha}>{sobre.nome}</span>
              <span className={css.previaOrigem}>
                <OrigemDaFigurinha figurinha={sobre} />
              </span>
            </div>
          </>
        ) : (
          <span className={css.previaOrigem}>
            Escolha uma figurinha — ela vai como mensagem
          </span>
        )
      }
    >
      {filtro === "" ? (
        <div id="vx-figurinhas-recentes">
          <SecaoDeSeletor titulo="Recentes" grude>
            {recentes.length === 0 ? (
              <p className={css.bloqueio}>As figurinhas que você enviar aparecem aqui</p>
            ) : (
              <div className={css.gradeDeFigurinhas}>
                {recentes.map((id) => (
                  <FigurinhaRecente key={id} id={id} aoEscolher={escolher} aoSobre={setSobre} />
                ))}
              </div>
            )}
          </SecaoDeSeletor>
        </div>
      ) : null}

      {servidores.map((id) => (
        <PacoteDoServidor
          key={id}
          serverId={id}
          filtro={filtro}
          aoEscolher={escolher}
          aoSobre={setSobre}
        />
      ))}
    </CascaDeSeletor>
  );
}

function ancoraDe(serverId: string): string {
  return `vx-figurinhas-${serverId}`;
}

function LadrilhoDeServidor({ serverId, aoIr }: { serverId: string; aoIr: () => void }) {
  const servidor = useServer(serverId);
  const lista = useFigurinhasDoServidor(serverId);
  /* Servidor sem figurinha não ganha ladrilho: ele levaria a uma seção vazia. */
  if (!servidor || lista.estado !== "pronta" || lista.itens.length === 0) return null;
  return (
    <button
      type="button"
      className={css.categoriaDeServidor}
      aria-label={servidor.name}
      style={{ background: gradienteDe(serverId), color: corDoTextoDe(serverId) }}
      onClick={aoIr}
    >
      {servidor.sigla}
    </button>
  );
}

function PacoteDoServidor({
  serverId,
  filtro,
  aoEscolher,
  aoSobre,
}: {
  serverId: string;
  filtro: string;
  aoEscolher: (f: Figurinha) => void;
  aoSobre: (f: Figurinha) => void;
}) {
  const servidor = useServer(serverId);
  const lista = useFigurinhasDoServidor(serverId);
  if (!servidor) return null;

  /*
    Carregando NÃO ganha seção: com vinte servidores seriam vinte "Carregando…"
    empilhados, e a maioria dos servidores não tem figurinha nenhuma — a seção
    aparece quando há o que mostrar. A falha, sim, é dita: sem ela um pacote
    que existe pareceria não existir.
  */
  if (lista.estado === "carregando") return null;
  if (lista.estado === "falhou") {
    return (
      <SecaoDeSeletor titulo={servidor.name}>
        <p className={css.bloqueio}>Não deu para carregar estas figurinhas</p>
      </SecaoDeSeletor>
    );
  }

  const visiveis =
    filtro === ""
      ? lista.itens
      : lista.itens.filter((f) =>
          [f.nome, f.descricao ?? "", f.emoji ?? ""].some((c) => c.toLowerCase().includes(filtro)),
        );
  if (visiveis.length === 0) return null;

  return (
    <div id={ancoraDe(serverId)}>
      <SecaoDeSeletor titulo={`${servidor.name} — ${String(lista.itens.length)}`}>
        <div className={css.gradeDeFigurinhas}>
          {visiveis.map((f) => (
            <BotaoDeFigurinha key={f.id} figurinha={f} aoEscolher={aoEscolher} aoSobre={aoSobre} />
          ))}
        </div>
      </SecaoDeSeletor>
    </div>
  );
}

function FigurinhaRecente({
  id,
  aoEscolher,
  aoSobre,
}: {
  id: string;
  aoEscolher: (f: Figurinha) => void;
  aoSobre: (f: Figurinha) => void;
}) {
  const f = useFigurinha(id);
  if (!f) return null;
  return <BotaoDeFigurinha figurinha={f} aoEscolher={aoEscolher} aoSobre={aoSobre} />;
}

function BotaoDeFigurinha({
  figurinha,
  aoEscolher,
  aoSobre,
}: {
  figurinha: Figurinha;
  aoEscolher: (f: Figurinha) => void;
  aoSobre: (f: Figurinha) => void;
}) {
  return (
    <button
      type="button"
      className={css.figurinha}
      {...CELULA_DA_GRADE}
      aria-label={figurinha.nome}
      onClick={() => aoEscolher(figurinha)}
      onPointerEnter={() => aoSobre(figurinha)}
      onFocus={() => aoSobre(figurinha)}
    >
      <Miniatura figurinha={figurinha} />
    </button>
  );
}

function Miniatura({ figurinha, pequena = false }: { figurinha: Figurinha; pequena?: boolean }) {
  if (figurinha.url) {
    return (
      <img
        className={pequena ? css.miniaturaPequena : css.miniatura}
        src={figurinha.url}
        alt=""
        loading="lazy"
      />
    );
  }
  return (
    <span className={pequena ? css.previaGlifo : css.figurinhaGlifo} aria-hidden>
      {figurinha.emoji ?? "🖼️"}
    </span>
  );
}

function OrigemDaFigurinha({ figurinha }: { figurinha: Figurinha }) {
  const servidor = useServer(figurinha.serverId);
  const partes = [servidor?.name, figurinha.emoji ? `${figurinha.emoji} relacionado` : undefined];
  return <>{partes.filter(Boolean).join(" · ")}</>;
}
