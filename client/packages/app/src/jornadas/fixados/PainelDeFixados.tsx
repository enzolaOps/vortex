import { carregarAteMensagem, desafixarMensagem, members } from "nucleo/sdk/adapter";
import { chaveDeMembro } from "nucleo/sdk/domain";
import { carregarFixadas, carregarMaisFixadas, selecionarFixada } from "nucleo/store/fixados";
import { useConexao, useMessage, useNomeDoMembro, usePode } from "nucleo/store/hooks";
import { textoDaPrevia } from "nucleo/ui-logica/busca/trecho";
import { toast } from "nucleo/ui-logica/toastStore";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { chat, fixados } from "../../textos";
import { Botao, PainelVidro } from "../../ui/ds";
import { Desafixar, Fechar } from "../../ui/icones";
import { pedirSalto } from "../chat/saltos";
import { fecharFixadosDevolvendoFoco, useFixados } from "./hooks";
import css from "./PainelDeFixados.module.css";

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Esqueleto() {
  return (
    <div className={css.esqueleto} role="status" aria-busy="true" aria-label={fixados.estados.carregando}>
      {["a", "b", "c"].map((id) => (
        <div key={id} className={css.esqueletoLinha} aria-hidden="true">
          <span className={css.esqueletoNome} />
          <span className={css.esqueletoTexto} />
          <span className={css.esqueletoTexto} data-curto="" />
        </div>
      ))}
    </div>
  );
}

/**
 * Um item: assina SÓ a própria mensagem. Editar uma fixada toca um item, não o
 * painel. O alvo de clique é um botão (não um `option`) porque o item também
 * carrega "Desafixar" — controle dentro de `option` é ARIA inválido.
 */
function Item({
  id,
  servidorId,
  ativo,
  indo,
  podeDesafixar,
  aoAbrir,
}: {
  id: string;
  servidorId: string;
  ativo: boolean;
  indo: boolean;
  podeDesafixar: boolean;
  aoAbrir: () => void;
}) {
  const m = useMessage(id);
  const nome = useNomeDoMembro(chaveDeMembro(servidorId, m?.authorId ?? "")) ?? chat.autorDesconhecido;
  if (!m) return null;
  const texto = textoDaPrevia(
    m.content,
    (uid) => members.peek(chaveDeMembro(servidorId, uid))?.displayName ?? chat.autorDesconhecido,
  );
  const primeiroAnexo = m.anexos[0];
  return (
    <li className={css.item} data-ativo={ativo || undefined}>
      <button
        type="button"
        className={css.ir}
        data-fixado-ir=""
        aria-label={fixados.lista.ir(nome)}
        aria-busy={indo || undefined}
        onClick={aoAbrir}
      >
        <span className={css.cabecaDoItem} aria-hidden="true">
          <span className={css.autor}>{nome}</span>
          <span className={css.hora}>{QUANDO.format(m.createdAt)}</span>
        </span>
        <span className={css.trecho} aria-hidden="true">
          {texto === "" ? <span className={css.semTexto}>{fixados.lista.semTexto}</span> : texto}
        </span>
        {primeiroAnexo !== undefined && (
          <span className={css.anexo} aria-hidden="true">
            {fixados.lista.anexo(primeiroAnexo.nome, m.anexos.length)}
          </span>
        )}
        {indo && <span className={css.indo}>{fixados.lista.indo}</span>}
      </button>
      {podeDesafixar && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<Desafixar />}
          aria-label={fixados.lista.desafixarDe(nome)}
          title={fixados.lista.desafixar}
          onClick={() => {
            desafixarMensagem(id);
          }}
        />
      )}
    </li>
  );
}

/**
 * O painel de fixadas do canal, na área da gaveta (a mesma da busca, que ele
 * substitui enquanto aberto).
 *
 * A lista vem de `Channel.search({ pinned: true })` na primeira abertura e é mantida
 * pelos eventos de fixar/desafixar (`nucleo/store/fixados`). Cada item salta até a
 * mensagem na timeline — carregando o histórico até ela, se for antiga — com realce.
 *
 * ⚠ **Não é virtualizado, de propósito:** são as mensagens que alguém escolheu
 * fixar, dezenas no máximo, e cresce de 50 em 50 por botão.
 */
export function PainelDeFixados({ canalId, servidorId }: { canalId: string; servidorId: string }) {
  const estado = useFixados();
  const conexao = useConexao();
  const raiz = useRef<HTMLDivElement | null>(null);
  const [indo, setIndo] = useState<string | undefined>(undefined);
  const carga = estado.cargas[canalId];
  const semConexao = conexao === "sem-conexao";
  const podeFixar = usePode(canalId, "fixar");

  // O foco entra no painel ao abrir; as setas levam aos itens.
  useEffect(() => {
    raiz.current?.focus();
  }, []);

  // Primeira abertura (ou tentativa anterior que falhou): busca. Sem conexão, espera.
  const status = carga?.status;
  useEffect(() => {
    if (semConexao) return;
    if (status === undefined) void carregarFixadas(canalId);
  }, [canalId, semConexao, status]);

  // A conexão VOLTOU: a lista pode ter perdido eventos, então refaz sem esvaziar a tela.
  const conexaoAnterior = useRef(conexao);
  useEffect(() => {
    const voltou = conexaoAnterior.current !== "conectado" && conexao === "conectado";
    conexaoAnterior.current = conexao;
    if (voltou) void carregarFixadas(canalId, true);
  }, [conexao, canalId]);

  const abrir = async (id: string) => {
    selecionarFixada(id);
    setIndo(id);
    const chegada = await carregarAteMensagem(canalId, id);
    setIndo(undefined);
    if (chegada.estado === "pronta") pedirSalto(canalId, chegada.chave);
    else if (chegada.estado === "ausente") toast({ tipo: "info", titulo: fixados.salto.ausente });
    else toast({ tipo: "erro", titulo: fixados.salto.falhou });
  };

  const aoTeclar = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fecharFixadosDevolvendoFoco();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const alvos = [...(raiz.current?.querySelectorAll<HTMLElement>("[data-fixado-ir]") ?? [])];
    if (alvos.length === 0) return;
    e.preventDefault();
    const atual = alvos.indexOf(document.activeElement as HTMLElement);
    const proximo = e.key === "ArrowDown" ? Math.min(atual + 1, alvos.length - 1) : Math.max(atual - 1, 0);
    alvos[proximo]?.focus();
    alvos[proximo]?.scrollIntoView({ block: "nearest" });
  };

  let corpo: ReactNode;
  if (carga?.status === "pronta") {
    if (carga.ids.length === 0) {
      corpo = (
        <div className={css.estado} role="status">
          <p className={css.estadoTitulo}>{fixados.estados.vazio}</p>
          <p className={css.estadoDica}>{fixados.estados.vazioDica}</p>
        </div>
      );
    } else {
      corpo = (
        <>
          <p className={css.contagem} role="status">
            {fixados.lista.contagem(carga.ids.length, carga.temMais)}
          </p>
          <ul className={css.lista} aria-label={fixados.lista.rotulo}>
            {carga.ids.map((id) => (
              <Item
                key={id}
                id={id}
                servidorId={servidorId}
                ativo={estado.selecionado === id}
                indo={indo === id}
                podeDesafixar={podeFixar}
                aoAbrir={() => {
                  if (indo === undefined) void abrir(id);
                }}
              />
            ))}
          </ul>
          {carga.temMais && (
            <div className={css.rodape}>
              <Botao
                variante="secundario"
                tamanho="sm"
                carregando={carga.carregandoMais}
                onClick={() => void carregarMaisFixadas(canalId)}
              >
                {carga.carregandoMais ? fixados.lista.carregandoMais : fixados.lista.carregarMais}
              </Botao>
            </div>
          )}
        </>
      );
    }
  } else if (semConexao) {
    corpo = (
      <p className={css.aviso} role="status">
        {fixados.estados.semConexao}
      </p>
    );
  } else if (carga?.status === "erro") {
    corpo = (
      <div className={css.estado} role="alert">
        <p className={css.estadoTitulo}>{fixados.estados.erro}</p>
        <Botao variante="secundario" tamanho="sm" onClick={() => void carregarFixadas(canalId)}>
          {fixados.estados.tentarDeNovo}
        </Botao>
      </div>
    );
  } else {
    corpo = <Esqueleto />;
  }

  return (
    <PainelVidro
      como="aside"
      raio="xl"
      aria-label={fixados.painel}
      className={css.painel}
      onKeyDown={aoTeclar}
      data-testid="painel-de-fixados"
    >
      <div ref={raiz} tabIndex={-1} className={css.miolo}>
      <div className={css.cabeca}>
        <h2 className={css.titulo}>{fixados.titulo}</h2>
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<Fechar />}
          aria-label={fixados.fechar}
          title={fixados.fecharComAtalho}
          onClick={fecharFixadosDevolvendoFoco}
        />
      </div>
      <div className={css.corpo}>{corpo}</div>
      </div>
    </PainelVidro>
  );
}
