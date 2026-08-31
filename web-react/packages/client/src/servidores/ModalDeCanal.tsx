import { useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { criarPasta } from "../store/pastas";
import { Escolha } from "../components/ui/Escolha";
import { CATEGORIA_PADRAO } from "../sdk/domain";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Segmentado } from "../components/ui/Segmentado";
import {
  criarCanal,
  criarCategoria,
  renomearCanal,
  renomearCategoria,
} from "../sdk/servidores";
import { administrar, assinarAlvo, lerAlvo } from "../store/administracao";
import { useChannel, useCategorias } from "../store/hooks";
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
const TIPOS = [
  { id: "texto", rotulo: "Texto" },
  { id: "voz", rotulo: "Voz" },
] as const;

export function ModalDeCanal({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent titulo={titulo(alvo?.tipo)} className={css.painel}>
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
  if (tipo === "criarCategoria") return "Nova categoria";
  if (tipo === "renomearCategoria") return "Renomear categoria";
  if (tipo === "criarPasta") return "Nova pasta";
  return "Novo canal";
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
  const [voz, setVoz] = useState(vozInicial);
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
  const podeEnviar = limpo.length > 0 && escolhida !== "" && !enviando;

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
          .then((id) => {
            if (!id) return;
            // Abrir o canal recém-criado é a continuação óbvia da ação; criar e
            // ficar parado obrigaria a procurá-lo na coluna.
            if (!voz) selecionarCanal(id);
            aoFechar();
          })
          .finally(() => setEnviando(false));
      }}
    >
      <Campo
        rotulo="Nome do canal"
        /* O protocolo aceita espaço e maiúscula; a coluna mostra `#nome`. Não
           normalizo aqui: inventar uma regra que o servidor não tem faria o
           nome digitado e o nome salvo divergirem. */
        dica={undefined}
        autoComplete="off"
        autoFocus
        required
        disabled={enviando}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      <Segmentado
        rotulo="Tipo do canal"
        valor={voz ? "voz" : "texto"}
        desabilitado={enviando}
        opcoes={TIPOS.map((t) => ({ id: t.id, rotulo: t.rotulo }))}
        aoEscolher={(id) => setVoz(id === "voz")}
      />

      {/*
        A categoria é ESCOLHÍVEL mesmo quando veio pré-selecionada do menu:
        "Novo canal aqui" acerta o caso comum, e quem mudou de ideia no meio do
        formulário não deveria ter que fechar e reabrir noutro lugar.
      */}
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

      <Botao variante="primario" type="submit" disabled={!podeEnviar}>
        {enviando ? "Criando…" : "Criar canal"}
      </Botao>
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
  const atual = grupos.find((g) => g.id === categoriaId);
  const [nome, setNome] = useState(atual?.titulo ?? "");
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
        const p = categoriaId
          ? renomearCategoria(serverId, categoriaId, limpo)
          : criarCategoria(serverId, limpo);
        void p
          .then((ok) => {
            if (ok) aoFechar();
          })
          .finally(() => setEnviando(false));
      }}
    >
      <Campo
        rotulo="Nome da categoria"
        autoComplete="off"
        autoFocus
        required
        disabled={enviando}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Botao variante="primario" type="submit" disabled={!podeEnviar}>
        {enviando ? "Salvando…" : categoriaId ? "Salvar" : "Criar categoria"}
      </Botao>
    </form>
  );
}
