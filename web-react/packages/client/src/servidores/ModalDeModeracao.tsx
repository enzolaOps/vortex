import { useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Segmentado } from "../components/ui/Segmentado";
import { banir, expulsar, silenciarMembro } from "../sdk/servidores";
import { chaveDeMembro } from "../sdk/domain";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useMembro } from "../store/hooks";
import css from "./AdicionarServidor.module.css";

/**
 * Expulsar, banir e deixar de castigo.
 *
 * Um modal para os três porque a estrutura é a mesma — quem, o que acontece,
 * confirma — e o que muda é um campo. Três modais teriam três confirmações que
 * precisam concordar no tom.
 *
 * ⚠ **O texto diz a DIFERENÇA entre eles, e essa é a razão de o modal existir
 * em vez de a ação sair direto do menu.** Expulsar e banir parecem a mesma
 * coisa e não são: quem foi expulso volta pelo próximo convite, quem foi
 * banido não. Descobrir isso depois de clicar é tarde.
 */
const DURACOES = [
  { id: "5", rotulo: "5 min" },
  { id: "60", rotulo: "1 hora" },
  { id: "1440", rotulo: "1 dia" },
  { id: "10080", rotulo: "7 dias" },
] as const;

export function ModalDeModeracao({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const moderar = alvo?.tipo === "moderar" ? alvo : undefined;

  const membro = useMembro(
    chaveDeMembro(moderar?.serverId ?? "", moderar?.userId ?? ""),
  );

  const [razao, setRazao] = useState("");
  const [minutos, setMinutos] = useState("60");
  const [enviando, setEnviando] = useState(false);

  if (!moderar) return null;

  const nome = membro?.displayName ?? "essa pessoa";
  const acao = moderar.acao;

  const TITULO = {
    expulsar: "Expulsar do servidor",
    banir: "Banir do servidor",
    castigo: "Deixar de castigo",
  }[acao];

  const AVISO = {
    expulsar: `${nome} sai do servidor e pode voltar pelo próximo convite.`,
    banir: `${nome} sai do servidor e NÃO pode voltar, nem por convite.`,
    castigo: `${nome} continua no servidor, mas não consegue falar até o prazo acabar.`,
  }[acao];

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent titulo={TITULO} className={css.painel}>
        <div className={css.corpo}>
          <p className={css.aviso}>{AVISO}</p>

          {acao === "banir" ? (
            <Campo
              rotulo="Motivo (opcional)"
              dica="Fica no registro de banimentos."
              autoComplete="off"
              disabled={enviando}
              value={razao}
              onChange={(e) => setRazao(e.target.value)}
            />
          ) : null}

          {acao === "castigo" ? (
            <Segmentado
              rotulo="Por quanto tempo"
              valor={minutos}
              desabilitado={enviando}
              opcoes={DURACOES.map((d) => ({ id: d.id, rotulo: d.rotulo }))}
              aoEscolher={(id) => setMinutos(id)}
            />
          ) : null}

          <Botao
            variante="perigo"
            disabled={enviando}
            onClick={() => {
              setEnviando(true);
              const p =
                acao === "expulsar"
                  ? expulsar(moderar.serverId, moderar.userId)
                  : acao === "banir"
                    ? banir(moderar.serverId, moderar.userId, razao.trim() || undefined)
                    : silenciarMembro(
                        moderar.serverId,
                        moderar.userId,
                        Number(minutos),
                      );
              void p
                .then((ok) => {
                  if (ok) aoFechar();
                })
                .finally(() => setEnviando(false));
            }}
          >
            {enviando ? "Aplicando…" : TITULO}
          </Botao>

          <Botao variante="sutil" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Botao>
        </div>
      </DialogContent>
    </Dialog>
  );
}
