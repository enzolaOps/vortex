import { Gif as IconeGif, ICONE, Star } from "../components/ui/icones";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Girador } from "../components/ui/Girador";
import { aindaNao } from "../pendente/pendencias";
import type { FonteDeGifs } from "../sdk/fonteDeGifs";
import {
  provedorDaFonte,
  type ConsultaDeGif,
  type Gif,
  type ProvedorDeGif,
} from "../sdk/gifs";
import type { MontarInsercao } from "../composer/FerramentasDoComposer";
import { isolar } from "../composer/isolar";
import { CascaDeSeletor } from "./CascaDeSeletor";
import css from "./Seletores.module.css";
import gifCss from "./SeletorDeGif.module.css";

/**
 * As categorias que o design desenha na tira acima do grid.
 *
 * Rótulos de PRODUTO, não do provedor: "Deu ruim" é como se procura um GIF
 * numa conversa de trabalho, e nenhuma API de GIF tem uma categoria com esse
 * nome. Cada uma vira uma consulta — "Em alta" é a lista em alta do provedor,
 * as outras são busca pelo próprio rótulo (o locale é pt_BR, então o termo em
 * português acha o que se espera).
 */
const CATEGORIAS = ["Em alta", "Reações", "Comemoração", "Deu ruim"] as const;
type Categoria = (typeof CATEGORIAS)[number];

/** Espera de digitação antes de buscar — uma requisição por palavra, não por tecla. */
const ESPERA_DA_BUSCA_MS = 300;

function consultaDe(termo: string, categoria: Categoria): ConsultaDeGif {
  if (termo !== "") return { tipo: "busca", termo };
  return categoria === "Em alta"
    ? { tipo: "emAlta" }
    : { tipo: "busca", termo: categoria };
}

/**
 * Acrescenta uma página sem repetir GIF.
 *
 * O provedor devolve o mesmo item em páginas vizinhas às vezes, e ID repetido
 * vira `key` repetida no React — duas caixas trocando de vídeo entre si.
 */
export function juntarPaginas(
  atuais: readonly Gif[],
  novos: readonly Gif[],
): readonly Gif[] {
  const vistos = new Set(atuais.map((g) => g.id));
  const soNovos = novos.filter((g) => !vistos.has(g.id) && vistos.add(g.id));
  return soNovos.length === 0 ? atuais : [...atuais, ...soNovos];
}

function chaveDe(c: ConsultaDeGif): string {
  return c.tipo === "emAlta" ? "emAlta" : `busca:${c.termo}`;
}

/**
 * O resultado guarda PARA QUAL consulta ele é.
 *
 * "Carregando" é derivado de a chave não bater, e não um `setState` no começo
 * do efeito: estado em cascata dentro de `useEffect` é reprovado pelo lint do
 * projeto, e guardar o alvo resolve o mesmo problema sem render extra — é o
 * padrão de Convites e Banimentos.
 */
type Resultado =
  | {
      readonly para: string;
      readonly tipo: "ok";
      readonly gifs: readonly Gif[];
      readonly proxima: string | undefined;
      readonly carregandoMais: boolean;
    }
  | { readonly para: string; readonly tipo: "erro" };

/**
 * O seletor de GIF.
 *
 * ⚠ **O provedor mora atrás de `sdk/gifs.ts`, e o cliente nunca vê chave.** A
 * instância que configurou o `gifbox` recebe GIFs por ele; a que não
 * configurou vê um estado vazio DIZENDO isso — o botão não some (sumir faria
 * parecer que o app não tem GIF) e nenhuma chamada sai.
 *
 * Masonry em `columns` porque as alturas variam — o próprio design explica que
 * emoji e figurinha usam grid fixo "para o alvo ser previsível" e o GIF não
 * pode. A altura de cada item é RESERVADA pela proporção que o provedor manda,
 * antes do vídeo chegar: sem isso as colunas se reorganizariam a cada GIF que
 * termina de carregar, debaixo do ponteiro de quem está escolhendo.
 */
export function SeletorDeGif({
  fonte,
  aoEnviar,
  aoInserir,
}: {
  /**
   * De onde vêm os GIFs. Chega por prop, e não por import, porque lê o
   * `client` — ver `sdk/fonteDeGifs.ts`.
   */
  fonte: () => FonteDeGifs | undefined;
  aoEnviar: (url: string) => void;
  /**
   * O shift+clique do rodapé do design: põe o link no rascunho em vez de
   * mandar, com espaço onde ele encostaria numa palavra (`isolar`).
   */
  aoInserir: (montar: MontarInsercao) => void;
}) {
  /*
    Lido uma vez por montagem: o seletor só monta quando abre, e a configuração
    da instância não muda enquanto o painel está aberto.
  */
  const [provedor] = useState(() => provedorDaFonte(fonte()));

  if (!provedor) {
    return (
      <CascaDeSeletor
        rotulo="GIF"
        busca={{ valor: "", aoMudar: () => {}, placeholder: "Buscar GIF" }}
        desabilitarBusca
      >
        <EstadoVazio
          icone={<IconeGif size={ICONE.calha} aria-hidden />}
          titulo="Esta instância não configurou GIFs"
          detalhe="Quem administra o servidor precisa ligar o serviço de GIFs."
        />
      </CascaDeSeletor>
    );
  }

  return <Galeria provedor={provedor} aoEnviar={aoEnviar} aoInserir={aoInserir} />;
}

function Galeria({
  provedor,
  aoEnviar,
  aoInserir,
}: {
  provedor: ProvedorDeGif;
  aoEnviar: (url: string) => void;
  aoInserir: (montar: MontarInsercao) => void;
}) {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [categoria, setCategoria] = useState<Categoria>(CATEGORIAS[0]);
  const [resultado, setResultado] = useState<Resultado | undefined>(undefined);
  const [tentativa, setTentativa] = useState(0);

  /* A busca espera a digitação parar. O vazio aplica na hora: apagar o campo
     e esperar 300ms para ver "Em alta" de volta pareceria travado. */
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), busca.trim() === "" ? 0 : ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(t);
  }, [busca]);

  const consulta = consultaDe(termo, categoria);
  const chave = `${chaveDe(consulta)}#${tentativa}`;

  useEffect(() => {
    const controle = new AbortController();
    provedor.buscar(consultaDe(termo, categoria), undefined, controle.signal).then(
      (p) =>
        setResultado({
          para: chave,
          tipo: "ok",
          gifs: p.gifs,
          proxima: p.proxima,
          carregandoMais: false,
        }),
      () => {
        if (!controle.signal.aborted) setResultado({ para: chave, tipo: "erro" });
      },
    );
    return () => controle.abort();
  }, [provedor, chave, termo, categoria]);

  const atual = resultado?.para === chave ? resultado : undefined;

  /*
    A próxima página, em DOIS efeitos.

    O observador só marca `carregandoMais`; quem busca é o segundo efeito, que
    depende do cursor MARCADO. Num efeito só, marcar `carregandoMais` mudaria
    as dependências, a limpeza rodaria e abortaria a própria requisição que
    acabou de sair. E a marca é o que impede o observador de pedir a mesma
    página de novo a cada quadro em que a sentinela continua visível.
  */
  const sentinela = useRef<HTMLDivElement>(null);
  const livre = atual?.tipo === "ok" && !atual.carregandoMais ? atual.proxima : undefined;
  useEffect(() => {
    const el = sentinela.current;
    if (!el || livre === undefined) return;
    const obs = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      setResultado((r) =>
        r?.para === chave && r.tipo === "ok" ? { ...r, carregandoMais: true } : r,
      );
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [chave, livre]);

  const marcado = atual?.tipo === "ok" && atual.carregandoMais ? atual.proxima : undefined;
  useEffect(() => {
    if (marcado === undefined) return;
    const controle = new AbortController();
    provedor.buscar(consultaDe(termo, categoria), marcado, controle.signal).then(
      (p) =>
        setResultado((r) =>
          r?.para === chave && r.tipo === "ok"
            ? {
                ...r,
                gifs: juntarPaginas(r.gifs, p.gifs),
                proxima: p.proxima,
                carregandoMais: false,
              }
            : r,
        ),
      () => {
        if (controle.signal.aborted) return;
        /* Falha na página seguinte não apaga as que já estão na tela: só
           para de pedir. */
        setResultado((r) =>
          r?.para === chave && r.tipo === "ok"
            ? { ...r, proxima: undefined, carregandoMais: false }
            : r,
        );
      },
    );
    return () => controle.abort();
  }, [provedor, chave, marcado, termo, categoria]);

  function escolher(e: MouseEvent, gif: Gif) {
    if (e.shiftKey) aoInserir((valor, a, b) => isolar(valor, a, b, gif.url));
    else aoEnviar(gif.url);
  }

  return (
    <CascaDeSeletor
      rotulo="GIF"
      busca={{ valor: busca, aoMudar: setBusca, placeholder: "Buscar GIF" }}
      acaoDaBusca={
        <button
          type="button"
          className={css.acaoQuadrada}
          aria-label="Favoritos"
          onClick={aindaNao("gifFavoritos")}
        >
          <Star aria-hidden />
        </button>
      }
      rodape={
        <span className={css.previaOrigem}>
          Enter envia direto · shift+clique só insere no composer
        </span>
      }
    >
      <div className={css.tiras}>
        {CATEGORIAS.map((c) => (
          <button
            key={c}
            type="button"
            className={css.tira}
            aria-pressed={termo === "" && c === categoria}
            onClick={() => {
              setCategoria(c);
              setBusca("");
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {atual === undefined ? (
        <div className={gifCss.estadoDoGif}>
          <Girador tamanho={20} rotulo="Buscando GIFs" />
        </div>
      ) : atual.tipo === "erro" ? (
        <EstadoVazio
          compacto
          titulo="Não deu para buscar GIFs"
          detalhe="O serviço de GIFs da instância não respondeu."
          acao={{ rotulo: "Tentar de novo", aoClicar: () => setTentativa((n) => n + 1) }}
        />
      ) : atual.gifs.length === 0 ? (
        <EstadoVazio
          compacto
          titulo={consulta.tipo === "busca" ? `Nenhum GIF para “${consulta.termo}”` : "Nenhum GIF em alta agora"}
        />
      ) : (
        <>
          <div className={gifCss.masonry}>
            {atual.gifs.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`${css.gif} ${gifCss.caixa}`}
                style={{ aspectRatio: `${g.largura} / ${g.altura}` }}
                aria-label="Enviar GIF"
                onClick={(e) => escolher(e, g)}
              >
                <video
                  className={gifCss.midia}
                  src={g.previa}
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <div ref={sentinela} className={gifCss.sentinela}>
            {atual.carregandoMais ? <Girador rotulo="Carregando mais GIFs" /> : null}
          </div>
        </>
      )}
    </CascaDeSeletor>
  );
}
