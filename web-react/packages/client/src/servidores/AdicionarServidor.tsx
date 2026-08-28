import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Segmentado } from "../components/ui/Segmentado";
import {
  buscarConvite,
  criarServidor,
  entrarPorConvite,
  type Convite,
} from "../sdk/servidores";
import { lerEntrada, voltarParaEntrar } from "../store/entrada";
import { selecionarServidor } from "../store/navegacao";
import css from "./AdicionarServidor.module.css";

/**
 * Criar um servidor, ou entrar num pelo convite.
 *
 * Um modal com dois caminhos, e não dois modais: as duas ações respondem à
 * mesma intenção — "quero mais um servidor no rail" —, e o upstream as separa
 * em `CreateOrJoinServer` → `CreateServer` | `JoinServer`, o que custa um
 * clique só para escolher entre dois campos de texto.
 *
 * ⚠ **Isto é o que substitui o Discover**, e a troca foi decidida no plano de
 * paridade: o Discover do upstream não é uma tela, é um `<iframe>` para
 * `stt.gg` com ponte `postMessage`. Numa instância privada ele lista os
 * servidores públicos do Stoat, não os seus — funciona e não serve.
 */
const ABAS = [
  { id: "entrar", rotulo: "Entrar por convite" },
  { id: "criar", rotulo: "Criar servidor" },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export function AdicionarServidor({ aoFechar }: { aoFechar: () => void }) {
  const [aba, setAba] = useState<Aba>("entrar");
  /*
    O código que veio pela URL, se veio.

    Lido do store e não de prop: o registro de modais passa só `aoFechar`, e a
    regra que ele estabeleceu é "modal que precisa de alvo lê o alvo do próprio
    store". Consumido uma vez — deixá-lo lá faria o convite reabrir a cada
    abertura do modal.
  */
  const [daUrl] = useState(() => {
    const tela = lerEntrada();
    if (tela.tipo !== "convite") return undefined;
    voltarParaEntrar();
    return tela.codigo;
  });

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent titulo="Adicionar servidor" className={css.painel}>
        <Segmentado
          rotulo="O que fazer"
          valor={aba}
          opcoes={ABAS.map((a) => ({ id: a.id, rotulo: a.rotulo }))}
          aoEscolher={(id) => setAba(id)}
        />

        {aba === "entrar" ? (
          <PorConvite aoFechar={aoFechar} inicial={daUrl} />
        ) : (
          <Criar aoFechar={aoFechar} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Criar({ aoFechar }: { aoFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);

  const limpo = nome.trim();
  const podeEnviar = limpo.length > 0 && !enviando;

  return (
    <form
      className={css.corpo}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeEnviar) return;
        setEnviando(true);
        void criarServidor(limpo)
          .then((id) => {
            if (!id) return;
            // Entrar no servidor recém-criado é a continuação óbvia da ação —
            // criar e ficar parado obrigaria a procurá-lo no rail.
            selecionarServidor(id);
            aoFechar();
          })
          .finally(() => setEnviando(false));
      }}
    >
      <Campo
        rotulo="Nome do servidor"
        dica="Dá para mudar depois."
        autoComplete="off"
        autoFocus
        required
        disabled={enviando}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Botao variante="primario" type="submit" disabled={!podeEnviar}>
        {enviando ? "Criando…" : "Criar"}
      </Botao>
    </form>
  );
}

function PorConvite({
  aoFechar,
  inicial,
}: {
  aoFechar: () => void;
  inicial: string | undefined;
}) {
  const [entrada, setEntrada] = useState(inicial ?? "");
  const [buscando, setBuscando] = useState(inicial !== undefined);
  const [convite, setConvite] = useState<Convite | undefined>(undefined);
  const [erro, setErro] = useState<string | undefined>(undefined);

  // Veio da URL: busca sozinha. Pedir um clique para fazer o que o clique no
  // link já pediu é cerimônia.
  useEffect(() => {
    if (inicial === undefined) return;
    let vivo = true;
    void buscarConvite(inicial)
      .then((r) => {
        if (!vivo) return;
        if ("erro" in r) setErro(r.erro);
        else setConvite(r);
      })
      .finally(() => {
        if (vivo) setBuscando(false);
      });
    return () => {
      vivo = false;
    };
  }, [inicial]);

  const limpo = entrada.trim();
  const podeBuscar = limpo.length > 0 && !buscando;

  if (convite) {
    return (
      <PreviaDoConvite
        convite={convite}
        aoFechar={aoFechar}
        aoVoltar={() => setConvite(undefined)}
      />
    );
  }

  return (
    <form
      className={css.corpo}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeBuscar) return;
        setBuscando(true);
        setErro(undefined);
        void buscarConvite(limpo)
          .then((r) => {
            if ("erro" in r) setErro(r.erro);
            else setConvite(r);
          })
          .finally(() => setBuscando(false));
      }}
    >
      <Campo
        rotulo="Convite"
        /* Aceita o link inteiro porque é isso que se copia — obrigar a extrair
           o código à mão é atrito por nada. */
        dica="Cole o link ou só o código."
        placeholder="https://…/convite/abc123"
        autoComplete="off"
        autoFocus
        required
        disabled={buscando}
        erro={erro}
        value={entrada}
        onChange={(e) => {
          setEntrada(e.target.value);
          setErro(undefined);
        }}
      />
      <Botao variante="primario" type="submit" disabled={!podeBuscar}>
        {buscando ? "Procurando…" : "Ver convite"}
      </Botao>
    </form>
  );
}

/**
 * A prévia antes de entrar.
 *
 * Entrar direto do código seria mais curto e pior: um convite é um link que
 * alguém mandou, e quem clica merece saber ONDE vai cair antes de virar membro
 * de um servidor que não conhece.
 */
export function PreviaDoConvite({
  convite,
  aoFechar,
  aoVoltar,
}: {
  convite: Convite;
  aoFechar: () => void;
  aoVoltar?: () => void;
}) {
  const [entrando, setEntrando] = useState(false);

  return (
    <div className={css.corpo}>
      <div className={css.previa}>
        <span className={css.marca} aria-hidden>
          {convite.sigla}
        </span>
        <span className={css.sobre}>
          <span className={css.nome}>{convite.nomeDoServidor}</span>
          <span className={css.detalhe}>
            {convite.membros.toLocaleString("pt-BR")}{" "}
            {convite.membros === 1 ? "membro" : "membros"} · você cai em #
            {convite.nomeDoCanal}
          </span>
          <span className={css.detalhe}>
            Convite de {convite.convidadoPor}
          </span>
        </span>
      </div>

      <Botao
        variante="primario"
        disabled={entrando}
        onClick={() => {
          /*
            Já sou membro: abre em vez de entrar.

            Chamar `join` de novo não quebra nada — o protocolo é idempotente
            aqui — mas o botão dizendo "Entrar" para quem já está dentro é a
            interface mentindo sobre o que vai acontecer.
          */
          if (convite.jaSouMembro) {
            selecionarServidor(convite.serverId);
            aoFechar();
            return;
          }
          setEntrando(true);
          void entrarPorConvite()
            .then((id) => {
              if (!id) return;
              selecionarServidor(id);
              aoFechar();
            })
            .finally(() => setEntrando(false));
        }}
      >
        {convite.jaSouMembro
          ? "Abrir"
          : entrando
            ? "Entrando…"
            : "Entrar no servidor"}
      </Botao>

      {aoVoltar ? (
        <Botao variante="sutil" onClick={aoVoltar} disabled={entrando}>
          Usar outro convite
        </Botao>
      ) : null}
    </div>
  );
}
