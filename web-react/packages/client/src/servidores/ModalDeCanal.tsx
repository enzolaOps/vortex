import { useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { criarPasta } from "../store/pastas";
import { Lock } from "@phosphor-icons/react";

import { Escolha } from "../components/ui/Escolha";
import { Interruptor } from "../components/ui/Interruptor";
import { Caixa, MarcaDeOpcao } from "../components/ui/Marcador";
import { aindaNao, type PendenciaId } from "../pendente/pendencias";
import { fecharCanal } from "../sdk/canal";
import { CATEGORIA_PADRAO } from "../sdk/domain";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import {
  criarCanal,
  criarCategoriaEDevolverId,
  moverCanaisParaCategoria,
  renomearCanal,
  renomearCategoria,
} from "../sdk/servidores";
import { administrar, assinarAlvo, lerAlvo } from "../store/administracao";
import { useCategorias, useChannel, useServer } from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import css from "./AdicionarServidor.module.css";

/**
 * Criar e editar canal — e criar e renomear categoria.
 *
 * Quatro alvos num modal porque são o mesmo FORMULÁRIO: um nome, às vezes um
 * tópico, às vezes um seletor de tipo. Quatro modais seriam quatro formulários
 * que precisam concordar, e o primeiro a divergir seria o que ninguém abriu
 * naquela semana.
 *
 * O alvo vem do store, não de prop — a regra que o registro de modais
 * estabeleceu, e a mesma que `menuDeMensagem` já seguia.
 */
/**
 * Os quatro tipos que o design desenha, e só dois existem.
 *
 * ⚠ `forum` e a galeria de mídia dão ZERO ocorrências no schema do Stoat — não
 * são campos que faltam, são conceitos que não existem. Ficam na lista com o
 * registro de pendências atrás: clicar diz o que o tipo fará e do que depende,
 * em vez de sumir da lista e ninguém saber que ele foi pensado.
 */
const TIPOS = [
  {
    id: "texto",
    glifo: "#",
    rotulo: "Texto",
    detalhe: "Mensagens, imagens, threads",
    pendencia: undefined,
  },
  {
    id: "voz",
    glifo: "◈",
    rotulo: "Voz",
    detalhe: "Áudio, vídeo, tela e chat embutido",
    pendencia: undefined,
  },
  {
    id: "forum",
    glifo: "▤",
    rotulo: "Fórum",
    detalhe: "Posts organizados por tópico",
    pendencia: "canalDeForum",
  },
  {
    id: "midia",
    glifo: "▦",
    rotulo: "Mídia",
    detalhe: "Galeria de imagens e vídeos",
    pendencia: "canalDeMidia",
  },
] as const satisfies readonly {
  id: string;
  glifo: string;
  rotulo: string;
  detalhe: string;
  pendencia: PendenciaId | undefined;
}[];

type TipoDeCanal = (typeof TIPOS)[number]["id"];

export function ModalDeCanal({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo={titulo(alvo?.tipo)}
        className={
          alvo?.tipo === "criarCategoria" || alvo?.tipo === "renomearCategoria"
            ? css.painelCategoria
            : css.painel
        }
      >
        {alvo?.tipo === "criarCanal" ? (
          <FormaDeCanal
            aoFechar={aoFechar}
            serverId={alvo.serverId}
            categoriaId={alvo.categoriaId}
            voz={alvo.voz}
          />
        ) : alvo?.tipo === "editarCanal" ? (
          <FormaDeEdicao aoFechar={aoFechar} channelId={alvo.channelId} />
        ) : alvo?.tipo === "criarCategoria" ? (
          <FormaDeCategoria aoFechar={aoFechar} serverId={alvo.serverId} />
        ) : alvo?.tipo === "renomearCategoria" ? (
          <FormaDeCategoria
            aoFechar={aoFechar}
            serverId={alvo.serverId}
            categoriaId={alvo.categoriaId}
          />
        ) : alvo?.tipo === "criarPasta" ? (
          <FormaDePasta aoFechar={aoFechar} servidorInicial={alvo.serverId} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function titulo(tipo: string | undefined): string {
  if (tipo === "editarCanal") return "Editar canal";
  if (tipo === "criarCategoria") return "Criar categoria";
  if (tipo === "renomearCategoria") return "Renomear categoria";
  if (tipo === "criarPasta") return "Nova pasta";
  /* "Criar canal", como o design — e não "Novo canal". O verbo diz o que o
     botão do rodapé vai fazer; o adjetivo não diz nada. */
  return "Criar canal";
}

/**
 * O nome de uma pasta NOVA.
 *
 * ⚠ **Ele fazia criar E renomear, e renomear saiu.** A regra de "um formulário
 * para os dois" vale quando as duas telas são o mesmo campo — e deixou de
 * valer: editar pasta agora é nome, cor, lista de servidores e a preferência
 * de expansão (`EditorDePasta`). Criar continua sendo uma pergunta só, e é o
 * que sobrou aqui.
 *
 * ⚠ **Não é assíncrono**, ao contrário dos irmãos: pasta é conceito de
 * CLIENTE e a escrita é local. Não há promessa a esperar nem falha de rede a
 * traduzir — ver `store/pastas.ts`.
 */
function FormaDePasta({
  aoFechar,
  servidorInicial,
}: {
  aoFechar: () => void;
  servidorInicial?: string;
}) {
  const [nome, setNome] = useState("");
  const limpo = nome.trim();

  return (
    <form
      className={css.corpo}
      onSubmit={(e) => {
        e.preventDefault();
        if (limpo.length === 0) return;
        criarPasta(limpo, servidorInicial ? [servidorInicial] : []);
        aoFechar();
      }}
    >
      <Campo
        rotulo="Nome da pasta"
        dica="Aparece embaixo do grupo, no rail."
        autoFocus
        maxLength={32}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      <div className={css.acoes}>
        <Botao variante="neutro" type="button" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao variante="primario" type="submit" disabled={limpo.length === 0}>
          Criar pasta
        </Botao>
      </div>
    </form>
  );
}

function FormaDeCanal({
  aoFechar,
  serverId,
  categoriaId,
  voz: vozInicial,
}: {
  aoFechar: () => void;
  serverId: string;
  categoriaId: string | undefined;
  voz: boolean;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoDeCanal>(vozInicial ? "voz" : "texto");
  const [privado, setPrivado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  /*
    ⚠ **Canal não nasce sem categoria — decisão de produto.** As categorias
    REAIS do servidor, sem a cesta dos não categorizados: `CATEGORIA_PADRAO` é
    o balde que o protocolo usa para o que está fora de grupo, e oferecê-lo
    aqui seria oferecer justamente o que a decisão proíbe.
  */
  const categorias = useCategorias(serverId).filter(
    (c) => c.id !== CATEGORIA_PADRAO,
  );
  const [escolhida, setEscolhida] = useState(
    () => categoriaId ?? categorias[0]?.id ?? "",
  );

  const limpo = nome.trim();
  const voz = tipo === "voz";
  const podeEnviar = limpo.length > 0 && escolhida !== "" && !enviando;
  const glifo = TIPOS.find((t) => t.id === tipo)?.glifo ?? "#";

  /*
    Servidor sem categoria nenhuma: não há onde pôr o canal, e a tela diz isso
    em vez de deixar o botão morto sem explicação. Acontece de verdade num
    servidor criado por outro cliente.
  */
  if (categorias.length === 0) {
    return (
      <div className={css.corpo}>
        <p className={css.aviso}>
          Este servidor não tem categorias, e um canal precisa de uma. Crie a
          primeira e depois volte aqui.
        </p>
        <div className={css.acoes}>
          <Botao variante="neutro" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            onClick={() => administrar({ tipo: "criarCategoria", serverId })}
          >
            Criar categoria
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <form
      className={css.corpo}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeEnviar) return;
        setEnviando(true);
        void criarCanal(serverId, limpo, voz, escolhida)
          .then(async (id) => {
            if (!id) return;
            /*
              ⚠ **Privado é uma SEGUNDA escrita, e depois da criação.** Não há
              campo `private` em `Channel`: privacidade é negar `ViewChannel`
              no cargo padrão, e override só existe depois de o canal existir.
              Ver `fecharCanal`.
            */
            if (privado) await fecharCanal(id);
            // Abrir o canal recém-criado é a continuação óbvia da ação; criar e
            // ficar parado obrigaria a procurá-lo na coluna.
            if (!voz) selecionarCanal(id);
            aoFechar();
          })
          .finally(() => setEnviando(false));
      }}
    >
      <div className={css.sobrancelha}>Tipo de canal</div>
      <div className={css.tipos} role="radiogroup" aria-label="Tipo de canal">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={tipo === t.id}
            className={css.tipo}
            disabled={enviando}
            onClick={() => {
              /* Tipo sem protocolo não vira seleção: marcar "Fórum" e deixar
                 o formulário seguir criaria um canal de TEXTO com o rótulo
                 errado — pior que não oferecer. */
              if (t.pendencia) {
                aindaNao(t.pendencia)();
                return;
              }
              setTipo(t.id);
            }}
          >
            <span className={css.tipoGlifo} aria-hidden>
              {t.glifo}
            </span>
            <span className={css.tipoTextos}>
              <span className={css.tipoNome}>{t.rotulo}</span>
              <span className={css.tipoDetalhe}>{t.detalhe}</span>
            </span>
            <MarcaDeOpcao />
          </button>
        ))}
      </div>

      <div className={css.sobrancelha}>Nome do canal</div>
      {/*
        O glifo do tipo vive DENTRO do campo, como prefixo — é o design, e ele
        faz o campo dizer o que está sendo criado sem uma segunda etiqueta.
        Por isso não é o `Campo`: aquele desenha rótulo e caixa, e aqui o
        rótulo é a sobrancelha acima.
      */}
      <div className={css.campoComGlifo}>
        <span className={css.prefixo} aria-hidden>
          {glifo}
        </span>
        <input
          className={css.entrada}
          aria-label="Nome do canal"
          /* O protocolo aceita espaço e maiúscula; a coluna mostra `#nome`.
             Não normalizo aqui: inventar uma regra que o servidor não tem
             faria o nome digitado e o nome salvo divergirem. */
          autoComplete="off"
          autoFocus
          required
          disabled={enviando}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>

      <Escolha
        rotulo="Categoria"
        valor={escolhida}
        disabled={enviando}
        opcoes={categorias.map((c) => c.id)}
        aoEscolher={setEscolhida}
        rotuloDe={(id) =>
          categorias.find((c) => c.id === id)?.titulo ?? "Sem nome"
        }
      />

      <div className={css.privado}>
        <span className={css.privadoTexto}>
          <Lock size={14} className={css.cadeado} aria-hidden />
          <span>
            <span className={css.privadoTitulo}>Canal privado</span>
            <span className={css.privadoDetalhe}>
              Só cargos e membros selecionados
            </span>
          </span>
        </span>
        <Interruptor
          ligado={privado}
          rotulo="Canal privado"
          aoAlternar={setPrivado}
        />
      </div>

      {/*
        ⚠ **A frase do design promete uma etapa que aqui NÃO existe** — ele diz
        "você escolhe os cargos na etapa seguinte". Um segundo passo de
        seleção de cargos é tela própria, e a que existe é a página de
        permissões do canal. Então o texto aponta para ela, que é verdade.
      */}
      {privado ? (
        <p className={css.privadoNota}>
          O canal nasce escondido de todo mundo. Libere os cargos em
          Configurações do canal · Permissões.
        </p>
      ) : null}

      <div className={css.acoes}>
        <Botao
          variante="neutro"
          type="button"
          onClick={aoFechar}
          disabled={enviando}
        >
          Cancelar
        </Botao>
        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Criando…" : "Criar canal"}
        </Botao>
      </div>
    </form>
  );
}

function FormaDeEdicao({
  aoFechar,
  channelId,
}: {
  aoFechar: () => void;
  channelId: string;
}) {
  const canal = useChannel(channelId);
  const [nome, setNome] = useState(canal?.name ?? "");
  const [topico, setTopico] = useState(canal?.topico ?? "");
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
        void renomearCanal(channelId, limpo, topico.trim())
          .then((ok) => {
            if (ok) aoFechar();
          })
          .finally(() => setEnviando(false));
      }}
    >
      <Campo
        rotulo="Nome do canal"
        autoComplete="off"
        autoFocus
        required
        disabled={enviando}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Campo
        rotulo="Tópico"
        /* "Tópico" e não "descrição": no produto isto é o assunto do canal, e
           é assim que quem usa chama. `description` é o nome do protocolo. */
        dica="Aparece no cabeçalho do canal. Pode ficar vazio."
        autoComplete="off"
        disabled={enviando}
        value={topico}
        onChange={(e) => setTopico(e.target.value)}
      />
      <Botao variante="primario" type="submit" disabled={!podeEnviar}>
        {enviando ? "Salvando…" : "Salvar"}
      </Botao>
    </form>
  );
}

/**
 * Criar ou renomear categoria — e criar tem duas etapas quando se pede.
 *
 * ⚠ **"Categoria privada" é PENDENTE, e a razão é o protocolo.** `Category` é
 * `{id, title, channels}` e nada mais. A própria referência diz que a lista de
 * acesso escreve "overrides de categoria" — e eles não existem no Stoat. Por
 * isso o interruptor não vira, e a lista de "quem pode ver" não é desenhada:
 * ela só faz sentido com a privacidade, e um seletor de cargos que escreve em
 * lugar nenhum é superfície grande para retorno zero.
 *
 * ⚠ **"Mover canais para cá depois" é REAL.** Mover é reescrever o array de
 * `categories`, que este cliente já faz. A referência diz que ele "abre o
 * seletor de canais ao criar", e é o que acontece: a criação leva à segunda
 * etapa, dentro da mesma janela.
 */
function FormaDeCategoria({
  aoFechar,
  serverId,
  categoriaId,
}: {
  aoFechar: () => void;
  serverId: string;
  categoriaId?: string;
}) {
  const grupos = useCategorias(serverId);
  const servidor = useServer(serverId);
  const atual = grupos.find((g) => g.id === categoriaId);
  const [nome, setNome] = useState(atual?.titulo ?? "");
  const [mover, setMover] = useState(false);
  const [enviando, setEnviando] = useState(false);
  /** A categoria recém-criada, quando a segunda etapa foi pedida. */
  const [criada, setCriada] = useState<string | undefined>(undefined);

  const limpo = nome.trim();
  const podeEnviar = limpo.length > 0 && !enviando;

  if (criada !== undefined) {
    return (
      <EscolherCanais
        serverId={serverId}
        categoriaId={criada}
        nome={limpo}
        aoFechar={aoFechar}
      />
    );
  }

  return (
    <form
      className={css.corpo}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeEnviar) return;
        setEnviando(true);

        if (categoriaId) {
          void renomearCategoria(serverId, categoriaId, limpo)
            .then((ok) => {
              if (ok) aoFechar();
            })
            .finally(() => setEnviando(false));
          return;
        }

        void criarCategoriaEDevolverId(serverId, limpo)
          .then((id) => {
            if (id === undefined) return;
            /* Sem "mover", criar já termina. Com, a mesma janela vira o
               seletor — é o que a referência chama de "abre o seletor de
               canais ao criar". */
            if (mover) setCriada(id);
            else aoFechar();
          })
          .finally(() => setEnviando(false));
      }}
    >
      {/* O servidor no subtítulo, como a referência. Só ao CRIAR: renomear
          acontece sobre uma categoria que já está na tela. */}
      {categoriaId ? null : (
        <p className={css.subtitulo}>em {servidor?.name ?? "este servidor"}</p>
      )}

      <Campo
        rotulo="Nome da categoria"
        dica="Exibida em maiúsculas na sidebar, independente de como você digitar."
        autoComplete="off"
        autoFocus
        required
        maxLength={32}
        disabled={enviando}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      {categoriaId ? null : (
        <>
          <div className={css.privado}>
            <span className={css.privadoTexto}>
              <Lock size={16} className={css.cadeado} aria-hidden />
              <span>
                <span className={css.privadoTitulo}>Categoria privada</span>
                <span className={css.privadoDetalhe}>
                  Canais criados aqui herdam a restrição
                </span>
              </span>
            </span>
            <Interruptor
              ligado={false}
              rotulo="Categoria privada"
              aoAlternar={aindaNao("categoriaPrivada")}
            />
          </div>

          <div className={css.privado}>
            <span className={css.privadoTexto}>
              <span>
                <span className={css.privadoTitulo}>
                  Mover canais para cá depois
                </span>
                <span className={css.privadoDetalhe}>
                  Abre o seletor de canais ao criar
                </span>
              </span>
            </span>
            <Interruptor
              ligado={mover}
              rotulo="Mover canais para cá depois"
              aoAlternar={setMover}
            />
          </div>
        </>
      )}

      <div className={css.acoes}>
        <Botao
          variante="neutro"
          type="button"
          onClick={aoFechar}
          disabled={enviando}
        >
          Cancelar
        </Botao>
        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Salvando…" : categoriaId ? "Salvar" : "Criar categoria"}
        </Botao>
      </div>
    </form>
  );
}

/**
 * A segunda etapa: quais canais vão para a categoria recém-criada.
 *
 * ⚠ **Ela só existe DEPOIS da criação, e é o que a referência manda:** "ao
 * criar, os canais existentes não são movidos automaticamente — mover é uma
 * segunda etapa explícita". Mover no mesmo passo faria a categoria nascer
 * levando canais que ninguém escolheu.
 *
 * Fechar aqui é saída legítima: a categoria já existe, vazia. Não há o que
 * desfazer, e por isso o botão diz "Fechar" e não "Cancelar" quando nada foi
 * marcado — cancelar prometeria desfazer a criação.
 */
function EscolherCanais({
  serverId,
  categoriaId,
  nome,
  aoFechar,
}: {
  serverId: string;
  categoriaId: string;
  nome: string;
  aoFechar: () => void;
}) {
  const grupos = useCategorias(serverId);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  /* Todos os canais do servidor MENOS os que já estão na categoria nova —
     oferecer o que já está lá daria uma escolha sem efeito. */
  const candidatos = grupos
    .filter((g) => g.id !== categoriaId)
    .flatMap((g) => g.canais);

  return (
    <div className={css.corpo}>
      <p className={css.subtitulo}>
        Escolha o que vai para <strong>{nome}</strong>. Dá para mover depois.
      </p>

      {candidatos.length === 0 ? (
        <p className={css.aviso}>
          Não há outros canais para mover. A categoria foi criada vazia.
        </p>
      ) : (
        <div className={css.canaisParaMover}>
          {candidatos.map((id) => (
            <LinhaDeCanalParaMover
              key={id}
              channelId={id}
              marcado={marcados.has(id)}
              aoAlternar={() =>
                setMarcados((atual) => {
                  const proximo = new Set(atual);
                  if (!proximo.delete(id)) proximo.add(id);
                  return proximo;
                })
              }
            />
          ))}
        </div>
      )}

      <div className={css.acoes}>
        <Botao variante="neutro" onClick={aoFechar} disabled={enviando}>
          {marcados.size === 0 ? "Fechar" : "Cancelar"}
        </Botao>
        <Botao
          variante="primario"
          disabled={marcados.size === 0 || enviando}
          onClick={() => {
            setEnviando(true);
            void moverCanaisParaCategoria(serverId, categoriaId, [...marcados])
              .then((ok) => {
                if (ok) aoFechar();
              })
              .finally(() => setEnviando(false));
          }}
        >
          {enviando
            ? "Movendo…"
            : marcados.size === 1
              ? "Mover 1 canal"
              : `Mover ${String(marcados.size)} canais`}
        </Botao>
      </div>
    </div>
  );
}

/** Uma linha do seletor. Assina o canal — lei nº 1. */
function LinhaDeCanalParaMover({
  channelId,
  marcado,
  aoAlternar,
}: {
  channelId: string;
  marcado: boolean;
  aoAlternar: () => void;
}) {
  const canal = useChannel(channelId);
  if (!canal) return null;

  return (
    <Caixa
      marcado={marcado}
      rotulo={`Mover ${canal.name}`}
      aoAlternar={aoAlternar}
    >
      {canal.tipo === "voz" ? "◈ " : "# "}
      {canal.name}
    </Caixa>
  );
}
