import { Hash, SpeakerHigh } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { CartaoDeOpcao } from "../components/ui/CartaoDeOpcao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { cn } from "../lib/cn";
import { sigla } from "../lib/sigla";
import { aindaNao } from "../pendente/pendencias";
import {
  buscarConvite,
  criarServidor,
  entrarPorConvite,
  type Convite,
} from "../sdk/servidores";
import { lerEntrada, voltarParaEntrar } from "../store/entrada";
import { selecionarServidor } from "../store/navegacao";
import css from "./AdicionarServidor.module.css";
import {
  canaisDe,
  DO_ZERO,
  MODELOS,
  NOME_DO_PROPOSITO,
  PROPOSITOS,
  type Modelo,
  type Proposito,
} from "./modelos";

/**
 * Criar um servidor, ou entrar num pelo convite.
 *
 * ⚠ **A estrutura é a da REFERÊNCIA, e a versão anterior era outra coisa.** Ela
 * tinha um `Segmentado` de duas abas — "Entrar por convite" e "Criar servidor"
 * — e a aba de criar era um campo de nome com um botão. A referência tem DOIS
 * PASSOS: escolher de onde partir, depois personalizar.
 *
 * ⚠ **Entrar por convite virou o RODAPÉ do primeiro passo.** Como aba irmã ela
 * recebia o mesmo peso visual de "criar um servidor", e as duas não têm o mesmo
 * peso: uma é a razão de a tela existir, a outra é uma saída para quem chegou
 * com um código na mão.
 *
 * ⚠ **Isto é o que substitui o Discover.** O Discover do upstream não é uma
 * tela, é um `<iframe>` para `stt.gg` com ponte `postMessage`. Numa instância
 * privada ele lista os servidores públicos do Stoat, não os seus — funciona e
 * não serve.
 */
type Passo =
  | { readonly tipo: "escolha" }
  | { readonly tipo: "personalizar"; readonly modelo: Modelo }
  | { readonly tipo: "convite" };

export function AdicionarServidor({ aoFechar }: { aoFechar: () => void }) {
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

  /* Com convite na URL o modal abre DIRETO nele: o clique no link já disse o
     que a pessoa quer, e mostrar o escolhedor de modelo seria ignorá-lo. */
  const [passo, setPasso] = useState<Passo>(() =>
    daUrl === undefined ? { tipo: "escolha" } : { tipo: "convite" },
  );

  if (passo.tipo === "convite") {
    return (
      <Dialog open onOpenChange={(v) => !v && aoFechar()}>
        <DialogContent titulo="Entrar em um servidor" className={css.painel}>
          <PorConvite aoFechar={aoFechar} inicial={daUrl} />
        </DialogContent>
      </Dialog>
    );
  }

  if (passo.tipo === "personalizar") {
    return (
      <Personalizar
        modelo={passo.modelo}
        aoFechar={aoFechar}
        aoVoltar={() => setPasso({ tipo: "escolha" })}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Criar um servidor"
        descricao="Comece do zero ou use um modelo. Dá para mudar tudo depois."
        className={css.painel}
      >
        {/*
          ⚠ "Do zero" fica ACIMA dos modelos e é o único com borda de acento —
          é instrução do design, e a razão é que cinco opções visualmente iguais
          fazem todo mundo ler as cinco para escolher a primeira.
        */}
        <button
          type="button"
          className={cn(css.opcao, css.destaque)}
          onClick={() => setPasso({ tipo: "personalizar", modelo: DO_ZERO })}
        >
          <span className={css.glifo} aria-hidden>
            {DO_ZERO.glifo}
          </span>
          <span className={css.opcaoTextos}>
            <span className={css.opcaoNome}>{DO_ZERO.nome}</span>
            <span className={css.opcaoDetalhe}>{DO_ZERO.detalhe}</span>
          </span>
        </button>

        <div className={css.sobrancelha}>Ou comece de um modelo</div>

        <div className={css.modelos}>
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={css.opcao}
              onClick={() => setPasso({ tipo: "personalizar", modelo: m })}
            >
              <span className={css.glifo} aria-hidden>
                {m.glifo}
              </span>
              <span className={css.opcaoTextos}>
                <span className={css.opcaoNome}>{m.nome}</span>
                <span className={css.opcaoDetalhe}>{m.detalhe}</span>
              </span>
            </button>
          ))}
        </div>

        <div className={css.rodapeDeConvite}>
          <span className={css.pergunta}>Já tem um convite?</span>
          <Botao variante="sutil" onClick={() => setPasso({ tipo: "convite" })}>
            Entrar em um servidor
          </Botao>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * O segundo passo: nome, propósito e o que o servidor vai nascer com.
 *
 * ⚠ **A lista de canais é PRÉVIA de algo que vai acontecer de verdade.** Ela
 * não é ilustração: os canais mostrados são exatamente os que `criarServidor`
 * cria, na mesma ordem. Ver `servidores/modelos.ts` — "modelo" não existe no
 * protocolo, mas o que ele FAZ aqui é criar canais, e isso existe.
 */
function Personalizar({
  modelo,
  aoFechar,
  aoVoltar,
}: {
  modelo: Modelo;
  aoFechar: () => void;
  aoVoltar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [proposito, setProposito] = useState<Proposito>("time");
  const [enviando, setEnviando] = useState(false);

  const limpo = nome.trim();
  const podeEnviar = limpo.length > 0 && !enviando;
  const canais = canaisDe(modelo, proposito);

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Personalize seu servidor"
        className={css.painel}
        rodape={
          <>
            <Botao variante="sutil" onClick={aoVoltar} disabled={enviando}>
              Voltar
            </Botao>
            <Botao
              variante="primario"
              disabled={!podeEnviar}
              onClick={() => {
                setEnviando(true);
                void criarServidor(limpo, canais)
                  .then((id) => {
                    if (!id) return;
                    /* Entrar no recém-criado é a continuação óbvia da ação —
                       criar e ficar parado obrigaria a procurá-lo no rail. */
                    selecionarServidor(id);
                    aoFechar();
                  })
                  .finally(() => setEnviando(false));
              }}
            >
              {enviando ? "Criando…" : "Criar servidor"}
            </Botao>
          </>
        }
      >
        <div className={css.sobrancelha}>{modelo.nome}</div>

        <div className={css.identidade}>
          {/*
            O ladrilho usa o gradiente do ID vazio e as iniciais do que está
            sendo digitado — o servidor ainda não existe, então não há ID. É a
            mesma peça do rail, e ver a inicial mudar enquanto se escreve é o
            que o design chama de prévia ao vivo.
          */}
          <Avatar id="" sigla={sigla(limpo || "Servidor")} tamanho="lg" />
          <div className={css.identidadeTextos}>
            <Botao
              variante="sutil"
              tamanho="pequeno"
              onClick={aindaNao("iconeDeServidor")}
            >
              Enviar ícone
            </Botao>
            <span className={css.dica}>Ícone opcional · 512×512</span>
          </div>
        </div>

        <Campo
          rotulo="Nome do servidor"
          autoComplete="off"
          autoFocus
          required
          disabled={enviando}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <div className={css.sobrancelha}>Para que é este servidor?</div>
        <div
          className={css.propositos}
          role="radiogroup"
          aria-label="Para que é este servidor?"
        >
          {PROPOSITOS.map((p) => (
            <CartaoDeOpcao
              key={p}
              marcado={proposito === p}
              titulo={NOME_DO_PROPOSITO[p].titulo}
              detalhe={NOME_DO_PROPOSITO[p].detalhe}
              aoEscolher={() => setProposito(p)}
            />
          ))}
        </div>

        <div className={css.sobrancelha}>Você vai começar com</div>
        {/*
          ⚠ **Lista com o glifo de cada tipo, e não um parágrafo com os nomes.**
          É o que faz a pessoa reconhecer daqui a dez segundos, na coluna, o que
          ela está vendo agora.
        */}
        <ul className={css.canais}>
          {canais.map((c) => (
            <li key={`${c.nome}-${String(c.voz)}`} className={css.canal}>
              <span className={css.canalGlifo} aria-hidden>
                {c.voz ? <SpeakerHigh size={14} /> : <Hash size={14} />}
              </span>
              {c.nome}
            </li>
          ))}
        </ul>

        <p className={css.termos}>
          Ao criar você concorda com as diretrizes da comunidade.
        </p>
      </DialogContent>
    </Dialog>
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
