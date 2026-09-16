import { useState, useSyncExternalStore } from "react";

import { Botao } from "../../components/ui/Botao";
import { CampoDeBusca } from "../../components/ui/CampoDeBusca";
import { Dialog, DialogClose, DialogContent } from "../../components/ui/Dialog";
import { X } from "../../components/ui/icones";
import { toast } from "../../components/ui/toastStore";
import { cn } from "../../lib/cn";
import { iniciarAtividade } from "../../sdk/atividades";
import { motivoDoErro } from "../../sdk/erros";
import { assinarChamada, lerChamada } from "../../store/chamada";
import { useChannel } from "../../store/hooks";
import { definirPalco } from "../../store/palcoDeVoz";
import { ATIVIDADES, explicarPendente, type Atividade } from "./catalogo";
import css from "./ModalDeAtividades.module.css";

/**
 * "Iniciar atividade" — o `ActivitiesModal` da referência, com os valores do
 * design (`Vortex Voz - Completo`, seção Atividades compartilhadas).
 *
 * A sala é a da CHAMADA, e não o canal aberto na tela: atividade é da sala de
 * voz, e quem está lendo outro canal enquanto conversa continua abrindo a
 * atividade onde está falando.
 */
export function ModalDeAtividades({ aoFechar }: { aoFechar: () => void }) {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const canal = useChannel(chamada.channelId);
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState("quadro");
  const [iniciando, setIniciando] = useState(false);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = ATIVIDADES.filter((a) =>
    a.nome.toLocaleLowerCase("pt-BR").includes(termo),
  );

  const pessoas = chamada.participantes.length;

  function iniciar(a: Atividade) {
    if (a.host.tipo === "pendente") {
      explicarPendente(a);
      return;
    }
    if (!chamada.channelId) return;
    setIniciando(true);
    iniciarAtividade(chamada.channelId, a.id)
      .then(() => {
        // A atividade abre num ladrilho da grade — então a grade vem junto.
        definirPalco({ tipo: "grade" });
        aoFechar();
      })
      .catch((e: unknown) => {
        setIniciando(false);
        toast({
          tipo: "erro",
          titulo: "Não deu para iniciar a atividade.",
          descricao: motivoDoErro(e),
        });
      });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent titulo="Iniciar atividade" tituloOculto className={cn("p-02", css.painel)}>
        <header className={css.cabecalho}>
          <div>
            <h2 className={css.titulo}>Iniciar atividade</h2>
            <p className={css.subtitulo}>
              em {canal?.name ?? "sala de voz"} ·{" "}
              {pessoas === 1 ? "1 pessoa" : `${String(pessoas)} pessoas`}
            </p>
          </div>
          <DialogClose className={css.fechar} aria-label="Fechar">
            <X aria-hidden />
          </DialogClose>
        </header>

        <div className={css.buscaFaixa}>
          <CampoDeBusca
            className={css.busca}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar atividade"
            aria-label="Buscar atividade"
          />
        </div>

        <div className={css.lista} tabIndex={0}>
          <div className={css.sobrancelha}>Em destaque</div>
          {visiveis.map((a) => {
            const ativa = a.id === escolhida;
            return (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                aria-pressed={ativa}
                className={css.item}
                onClick={() => setEscolhida(a.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEscolhida(a.id);
                  }
                }}
              >
                <span className={css.miniatura} aria-hidden />
                <span className={css.textos}>
                  <span className={css.nome}>{a.nome}</span>
                  <span className={css.capacidade}>{a.capacidade}</span>
                </span>
                {ativa ? (
                  <Botao
                    variante="primario"
                    tamanho="pequeno"
                    carregando={iniciando}
                    onClick={(e) => {
                      e.stopPropagation();
                      iniciar(a);
                    }}
                  >
                    Iniciar
                  </Botao>
                ) : null}
              </div>
            );
          })}
          {visiveis.length === 0 ? (
            <p className={css.vazio}>Nenhuma atividade com esse nome.</p>
          ) : null}
        </div>

        <p className={css.rodape}>
          A atividade abre num tile próprio na grade, do mesmo tamanho de um stream.
        </p>
      </DialogContent>
    </Dialog>
  );
}
