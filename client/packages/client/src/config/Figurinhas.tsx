import { useRef, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { useFigurinhasDoServidor } from "../expressoes/hooks";
import { temServidorDeMidia } from "../sdk/anexos";
import {
  apagarFigurinha,
  carregarFigurinhas,
  criarFigurinha,
  editarFigurinha,
  limitesDeExpressoes,
  podeGerenciarExpressoes,
  type Figurinha,
} from "../sdk/expressoes";
import { nomeDoArquivo } from "../expressoes/nomes";
import css from "./Figurinhas.module.css";

/**
 * Figurinhas do servidor.
 *
 * ⚠ **Era 1:1 com a referência e INERTE — o Stoat não tinha o conceito.** O
 * fork do `delta` passou a ter (`/custom/sticker`, `/servers/{id}/stickers`),
 * e a página deixou de ser exemplo: lista, envia, renomeia e apaga de verdade.
 * O layout é o mesmo que o `pnpm confronto` já tinha acertado.
 *
 * O envio sobe o arquivo e cria a figurinha com o nome derivado do arquivo; o
 * cartão novo já nasce aberto em edição, porque o nome derivado é palpite e a
 * descrição e o emoji relacionado não têm de onde sair sozinhos.
 */
export function Figurinhas({ serverId }: { serverId: string }) {
  const lista = useFigurinhasDoServidor(serverId);
  const seletor = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<string | undefined>(undefined);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  const gerencia = podeGerenciarExpressoes(serverId);
  const temMidia = temServidorDeMidia();
  const { figurinhas: teto } = limitesDeExpressoes();

  if (lista.estado === "falhou") {
    return (
      <div className={css.tela}>
        <Banner
          tom="perigo"
          acoes={
            <Botao variante="neutro" onClick={() => void carregarFigurinhas(serverId)}>
              Tentar de novo
            </Botao>
          }
        >
          Não deu para carregar as figurinhas deste servidor.
        </Banner>
      </div>
    );
  }

  const itens = lista.estado === "pronta" ? lista.itens : [];
  const vagas = Math.max(0, teto - itens.length);

  function enviar(arquivo: File) {
    setEnviando(true);
    void criarFigurinha(serverId, arquivo, { nome: nomeDoArquivo(arquivo.name) })
      .then((f) => {
        if (f) setEditando(f.id);
      })
      .finally(() => setEnviando(false));
  }

  const podeEnviar = !enviando && vagas > 0 && temMidia && lista.estado === "pronta";

  return (
    <div className={css.tela}>
      {/*
        A contagem e o botão do topo são do design E da referência ("12 de 15"
        e "Enviar figurinha" no cabeçalho). O cabeçalho da casca de
        configurações só tem título e subtítulo estáticos, então eles moram
        numa barra logo abaixo — o mesmo arranjo da página de sons.
      */}
      <div className={css.barra}>
        <span className={css.contagem} aria-live="polite">
          {lista.estado === "pronta"
            ? `${String(itens.length)} de ${String(teto)}`
            : "Carregando figurinhas…"}
        </span>
        {gerencia ? (
          <Botao
            variante="primario"
            disabled={!podeEnviar}
            carregando={enviando}
            onClick={() => seletor.current?.click()}
          >
            Enviar figurinha
          </Botao>
        ) : null}
      </div>

      {gerencia ? (
        <input
          ref={seletor}
          type="file"
          accept="image/png,image/apng,image/gif,image/webp"
          className={css.seletor}
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo) enviar(arquivo);
          }}
        />
      ) : null}

      <ul className={css.lista}>
        {itens.map((f) =>
          editando === f.id ? (
            <CartaoEmEdicao key={f.id} figurinha={f} aoFechar={() => setEditando(undefined)} />
          ) : (
            <li key={f.id} className={css.item}>
              <Quadro figurinha={f} />
              <div className={css.corpo}>
                <div className={css.textos}>
                  <span className={css.nome}>
                    {f.emoji ? (
                      <span aria-hidden className={css.emojiDoNome}>
                        {f.emoji}
                      </span>
                    ) : null}
                    {f.nome}
                  </span>
                  {f.descricao ? (
                    <span className={css.descricao}>{f.descricao}</span>
                  ) : null}
                </div>
                {gerencia ? (
                  <div className={css.acoesDeTexto}>
                    {/* Texto e não botão com caixa: 11/600 com gap 12, do
                        design — dois `Botao` de 34px dobravam o cartão. */}
                    <button type="button" className={css.acao} onClick={() => setEditando(f.id)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className={css.acaoPerigo}
                      onClick={() => void apagarFigurinha(f)}
                    >
                      Excluir
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ),
        )}

        {/*
          ⚠ **O `button` É o ladrilho, e não um filho dele** — ver o CSS. A
          vaga some para quem não administra: um ladrilho de envio que o
          servidor recusaria é ação que a pessoa não pode executar.
        */}
        {gerencia && lista.estado === "pronta" ? (
          <li className={css.vaga}>
            <button
              type="button"
              className={css.vagaBotao}
              disabled={!podeEnviar}
              onClick={() => seletor.current?.click()}
            >
              <span className={css.mais} aria-hidden>
                ＋
              </span>
              <span className={css.vagaTitulo}>
                {enviando ? "Enviando…" : "Enviar figurinha"}
              </span>
              <span className={css.vagaContagem}>
                {!temMidia
                  ? "este servidor não tem onde guardar arquivos"
                  : vagas === 0
                    ? `limite de ${String(teto)} atingido`
                    : `${String(vagas)} ${vagas === 1 ? "vaga restante" : "vagas restantes"}`}
              </span>
            </button>
          </li>
        ) : null}
      </ul>

      {lista.estado === "pronta" && itens.length === 0 && !gerencia ? (
        <p className={css.recado}>Este servidor ainda não tem figurinhas.</p>
      ) : null}
    </div>
  );
}

/** A mídia do cartão — ou o emoji, quando a instância não serve arquivos. */
function Quadro({ figurinha }: { figurinha: Figurinha }) {
  return (
    <span className={css.quadro}>
      {figurinha.url ? (
        <img className={css.imagem} src={figurinha.url} alt={figurinha.nome} />
      ) : (
        <span aria-hidden>{figurinha.emoji ?? "🖼️"}</span>
      )}
    </span>
  );
}

function CartaoEmEdicao({
  figurinha,
  aoFechar,
}: {
  figurinha: Figurinha;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(figurinha.nome);
  const [descricao, setDescricao] = useState(figurinha.descricao ?? "");
  const [emoji, setEmoji] = useState(figurinha.emoji ?? "");
  const [salvando, setSalvando] = useState(false);
  const nomeValido = nome.trim().length > 0 && nome.trim().length <= 30;

  return (
    <li className={css.item}>
      <Quadro figurinha={figurinha} />
      <form
        className={css.corpo}
        onSubmit={(e) => {
          e.preventDefault();
          if (!nomeValido) return;
          setSalvando(true);
          /* String VAZIA apaga no servidor — é assim que "tirar a descrição"
             se diz no protocolo, e por isso ela vai mesmo vazia. */
          void editarFigurinha(figurinha.id, {
            nome: nome.trim(),
            descricao: descricao.trim(),
            emoji: emoji.trim(),
          })
            .then((ok) => {
              if (ok) aoFechar();
            })
            .finally(() => setSalvando(false));
        }}
      >
        <Campo
          rotulo="Nome"
          value={nome}
          maxLength={30}
          autoFocus
          erro={nomeValido ? undefined : "De 1 a 30 caracteres."}
          onChange={(e) => setNome(e.target.value)}
        />
        <Campo
          rotulo="Descrição"
          value={descricao}
          maxLength={100}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <Campo
          rotulo="Emoji relacionado"
          value={emoji}
          maxLength={32}
          dica="É o que a busca do seletor encontra."
          onChange={(e) => setEmoji(e.target.value)}
        />
        <div className={css.acoes}>
          <Botao variante="primario" type="submit" carregando={salvando} disabled={!nomeValido}>
            Salvar
          </Botao>
          <Botao variante="sutil" type="button" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </li>
  );
}
