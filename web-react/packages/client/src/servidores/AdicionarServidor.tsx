import { Hash, SpeakerHigh } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { CartaoDeOpcao } from "../components/ui/CartaoDeOpcao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { cn } from "../lib/cn";
import { corDoTextoDe, gradienteDe } from "../lib/gradiente";
import { sigla } from "../lib/sigla";
import {
  buscarConvite,
  criarServidor,
  entrarPorConvite,
  vestirIconeNoServidor,
  type Convite,
} from "../sdk/servidores";
import { lerEntrada, voltarParaEntrar } from "../store/entrada";
import { selecionarServidor } from "../store/navegacao";
import { subirAnexo, temServidorDeMidia } from "../sdk/anexos";
import { toast } from "../components/ui/toastStore";
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

  /* ------------------------------------------------------------- ícone */

  const seletorDeIcone = useRef<HTMLInputElement>(null);
  /** O ID que o `autumn` devolveu, quando já subiu. */
  const [icone, setIcone] = useState<string | undefined>(undefined);
  /** O `blob:` da prévia local. */
  const [previa, setPrevia] = useState<string | undefined>(undefined);
  const [subindoIcone, setSubindoIcone] = useState(false);
  const temMidia = temServidorDeMidia();

  /*
    ⚠ **`URL.revokeObjectURL` no desmonte, e é o erro nº 5 do briefing.** Cada
    `createObjectURL` prende o arquivo na memória da aba até ser revogado —
    fechar o modal sem revogar deixaria a imagem presa pelo resto da sessão, e
    quem troca de ícone três vezes prende três.
  */
  useEffect(() => {
    return () => {
      if (previa !== undefined) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  /**
   * Sobe o ícone escolhido e mostra a prévia.
   *
   * ⚠ **A prévia aparece ANTES do upload terminar, e é de propósito.** Ela sai
   * do arquivo local, então é instantânea; esperar a rede para mostrar o que a
   * pessoa acabou de escolher faria o ladrilho parecer que ignorou o clique.
   * Se o upload falhar, a prévia é desfeita — mostrar uma imagem que não vai
   * junto é pior que não mostrar nenhuma.
   *
   * Tag `icons` e não `attachments`: o `autumn` valida por tag, e o teto de
   * ícone é 2,5 MB contra 20 MB de anexo. Mandar pela tag errada passaria uma
   * imagem que o servidor recusa ao vesti-la.
   */
  function escolherIcone(arquivo: File) {
    const anterior = previa;
    const url = URL.createObjectURL(arquivo);
    setPrevia(url);
    setSubindoIcone(true);
    if (anterior !== undefined) URL.revokeObjectURL(anterior);

    void subirAnexo(arquivo, "icons")
      .then((id) => setIcone(id))
      .catch((e: unknown) => {
        URL.revokeObjectURL(url);
        setPrevia(undefined);
        setIcone(undefined);
        toast({
          tipo: "erro",
          titulo: "Não deu para enviar o ícone.",
          descricao: e instanceof Error ? e.message : "Tente outra imagem.",
        });
      })
      .finally(() => setSubindoIcone(false));
  }

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
                void criarServidor(limpo, modelo.categoria, canais)
                  .then((id) => {
                    if (!id) return;
                    /*
                      O ícone é vestido DEPOIS, porque o protocolo não o aceita
                      na criação — ver `vestirIconeNoServidor`.

                      ⚠ **Sem `await`, e o modal fecha na frente.** Aquela
                      chamada pode esperar o `retry_after` de um `429` — dez
                      segundos, medidos —, e segurar "Criando…" todo esse tempo
                      por causa de um enfeite seria punir quem escolheu ícone.
                      O servidor já existe e já é utilizável; o ladrilho troca
                      sozinho quando o `ServerUpdate` chegar.

                      Falhar não desfaz nada: o aviso diz onde terminar.
                    */
                    if (icone !== undefined) {
                      void vestirIconeNoServidor(id, icone).then((colou) => {
                        if (colou) return;
                        toast({
                          /* `info` e não `erro`: o servidor foi criado, que é
                             o que a pessoa pediu. O tipo só tem dois valores. */
                          tipo: "info",
                          titulo: "O servidor foi criado sem o ícone.",
                          descricao:
                            "Você pode enviá-lo em Configurações do servidor.",
                        });
                      });
                    }
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
          <Avatar
            id=""
            sigla={sigla(limpo || "Servidor")}
            url={previa}
            tamanho="lg"
          />
          <div className={css.identidadeTextos}>
            <Botao
              variante="sutil"
              tamanho="pequeno"
              disabled={subindoIcone || !temMidia}
              onClick={() => seletorDeIcone.current?.click()}
            >
              {subindoIcone
                ? "Enviando…"
                : icone !== undefined
                  ? "Trocar ícone"
                  : "Enviar ícone"}
            </Botao>

            {/*
              O `input` de arquivo escondido, acionado pelo botão. Ver o
              composer: nativo é renderizado pelo SISTEMA e não aceita os oito
              estados da régua, e `display: none` em vez de opacidade zero
              para não deixar uma parada de tabulação invisível.
            */}
            <input
              ref={seletorDeIcone}
              type="file"
              accept="image/*"
              className={css.seletorDeIcone}
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) escolherIcone(arquivo);
              }}
            />

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
        {/*
          A faixa. Sem banner ela é o gradiente do ID do servidor — a mesma
          peça do ladrilho do rail, e o que impede um retângulo cinza.
        */}
        <div
          className={css.faixa}
          style={{ backgroundImage: gradienteDe(convite.serverId) }}
          aria-hidden
        >
          {convite.bannerUrl !== undefined ? (
            <img className={css.bannerImagem} src={convite.bannerUrl} alt="" />
          ) : null}
        </div>

        <div
          className={css.marca}
          aria-hidden
          style={{
            backgroundImage: gradienteDe(convite.serverId),
            color: corDoTextoDe(convite.serverId),
          }}
        >
          {convite.sigla}
          {convite.iconeUrl !== undefined ? (
            <img className={css.iconeImagem} src={convite.iconeUrl} alt="" />
          ) : null}
        </div>

        <div className={css.sobre}>
          <span className={css.nome}>{convite.nomeDoServidor}</span>

          {/* Só quando há: um assunto vazio deixaria uma linha de altura sem
              conteúdo entre o nome e a contagem. */}
          {convite.assuntoDoCanal !== undefined ? (
            <span className={css.assunto}>{convite.assuntoDoCanal}</span>
          ) : null}

          <span className={css.detalhe}>
            {convite.membros.toLocaleString("pt-BR")}{" "}
            {convite.membros === 1 ? "membro" : "membros"} · você cai em #
            {convite.nomeDoCanal}
          </span>

          <span className={css.convidou}>
            <Avatar
              id={convite.codigo}
              sigla={sigla(convite.convidadoPor)}
              url={convite.avatarDeQuemConvidou}
              tamanho="xxs"
            />
            Convite de {convite.convidadoPor}
          </span>
        </div>
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

      {/* Depois do botão e apagada: é condição, não decisão — a referência a
          põe em caption justamente para não competir com a ação. */}
      {convite.jaSouMembro ? null : (
        <p className={css.regras}>
          Ao entrar você aceita as regras do servidor.
        </p>
      )}
    </div>
  );
}
