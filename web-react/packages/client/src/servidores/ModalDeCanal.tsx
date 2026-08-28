import { useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Segmentado } from "../components/ui/Segmentado";
import {
  criarCanal,
  criarCategoria,
  renomearCanal,
  renomearCategoria,
} from "../sdk/servidores";
import { assinarAlvo, lerAlvo } from "../store/administracao";
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function titulo(tipo: string | undefined): string {
  if (tipo === "editarCanal") return "Editar canal";
  if (tipo === "criarCategoria") return "Nova categoria";
  if (tipo === "renomearCategoria") return "Renomear categoria";
  return "Novo canal";
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

  const limpo = nome.trim();
  const podeEnviar = limpo.length > 0 && !enviando;

  return (
    <form
      className={css.corpo}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeEnviar) return;
        setEnviando(true);
        void criarCanal(serverId, limpo, voz)
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
        dica={categoriaId ? "Ele nasce nesta categoria." : undefined}
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
