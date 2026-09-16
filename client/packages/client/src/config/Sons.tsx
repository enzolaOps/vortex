import { useRef, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Deslizante } from "../components/ui/Deslizante";
import { ICONE, Play, Stop } from "../components/ui/icones";
import { duracaoDoAudio } from "../expressoes/duracao";
import { useSonsDoServidor, useTocando } from "../expressoes/hooks";
import { nomeDoArquivo } from "../expressoes/nomes";
import { temServidorDeMidia } from "../sdk/anexos";
import { pararLocalmente, tocarLocalmente } from "../sdk/efeitosSonoros";
import {
  apagarEfeitoSonoro,
  carregarSons,
  criarEfeitoSonoro,
  editarEfeitoSonoro,
  limitesDeExpressoes,
  podeGerenciarExpressoes,
  type EfeitoSonoro,
} from "../sdk/expressoes";
import css from "./Sons.module.css";

/**
 * Painel de efeitos sonoros.
 *
 * ⚠ **Era 1:1 com a referência e INERTE**, com "duas ausências empilhadas": o
 * conceito no protocolo e o transporte para a sala. O fork do `delta` tem as
 * duas agora — `/custom/sound` guarda, e `POST /channels/{id}/soundboard/{som}`
 * avisa a sala (ver `sdk/efeitosSonoros.ts` para por que não é faixa no
 * LiveKit). A página lista, envia, renomeia, ajusta o volume e apaga.
 *
 * ⚠ **O volume daqui é o de ORIGEM**, e é o que a nota do rodapé existe para
 * dizer: ele é o que todo mundo ouve, e o volume do painel no cliente de cada
 * pessoa multiplica em cima.
 */
export function Sons({ serverId }: { serverId: string }) {
  const lista = useSonsDoServidor(serverId);
  const seletor = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  const gerencia = podeGerenciarExpressoes(serverId);
  const temMidia = temServidorDeMidia();
  const { sons: teto } = limitesDeExpressoes();

  if (lista.estado === "falhou") {
    return (
      <div className={css.tela}>
        <Banner
          tom="perigo"
          acoes={
            <Botao variante="neutro" onClick={() => void carregarSons(serverId)}>
              Tentar de novo
            </Botao>
          }
        >
          Não deu para carregar os efeitos sonoros deste servidor.
        </Banner>
      </div>
    );
  }

  const itens = lista.estado === "pronta" ? lista.itens : [];
  const cheio = itens.length >= teto;

  function enviar(arquivo: File) {
    setEnviando(true);
    void duracaoDoAudio(arquivo)
      .then((duracaoS) =>
        criarEfeitoSonoro(serverId, arquivo, {
          nome: nomeDoArquivo(arquivo.name).slice(0, 32),
          volume: 100,
          duracaoS,
        }),
      )
      .finally(() => setEnviando(false));
  }

  return (
    <div className={css.tela}>
      <div className={css.barra}>
        <span className={css.contagem}>
          {lista.estado === "pronta"
            ? `${String(itens.length)} de ${String(teto)} sons`
            : "Carregando…"}
        </span>
        {gerencia ? (
          <>
            {/*
              No teto o botão vira "Limite atingido" DESABILITADO, como o
              design — e não some: sumir faria parecer que enviar não existe,
              quando o que falta é vaga.
            */}
            <Botao
              variante={cheio ? "neutro" : "primario"}
              disabled={cheio || enviando || !temMidia || lista.estado !== "pronta"}
              carregando={enviando}
              onClick={() => seletor.current?.click()}
            >
              {cheio ? "Limite atingido" : "Enviar som"}
            </Botao>
            <input
              ref={seletor}
              type="file"
              accept="audio/mpeg,audio/ogg,audio/wav,audio/webm"
              className={css.seletor}
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) enviar(arquivo);
              }}
            />
          </>
        ) : null}
      </div>

      {/*
        Grade e não tabela `<table>`: a coluna do meio é um controle interativo
        de largura variável, e a semântica de tabela cobraria cabeçalho de
        coluna anunciado a cada célula para uma lista que se lê por linha.
      */}
      <div className={css.grade} role="list">
        <div className={css.cabecalho} aria-hidden>
          <span />
          <span>Nome</span>
          <span>Volume</span>
          <span>Enviado por</span>
          <span />
        </div>

        {itens.map((s) => (
          <LinhaDeSom key={s.id} som={s} gerencia={gerencia} />
        ))}

        {lista.estado === "pronta" && itens.length === 0 ? (
          <p className={css.vazio} role="listitem">
            Nenhum efeito sonoro ainda.
            {gerencia ? " Envie um MP3 ou OGG de até 5 segundos." : ""}
          </p>
        ) : null}
      </div>

      <p className={css.nota}>
        O volume aqui é o de ORIGEM — o que todo mundo ouve. O volume do painel
        no cliente de cada pessoa multiplica em cima deste. A prévia toca só
        para você, mesmo estando numa sala de voz.
      </p>
    </div>
  );
}

function LinhaDeSom({ som, gerencia }: { som: EfeitoSonoro; gerencia: boolean }) {
  const tocando = useTocando(som.id);
  /*
    O volume em ARRASTO é local; o servidor só ouve quando a mão solta. Sem
    isso cada passo do deslizante seria um PATCH e um evento para todo membro
    do servidor.
  */
  const [arrastando, setArrastando] = useState<number | undefined>(undefined);
  const [editando, setEditando] = useState(false);
  const volume = arrastando ?? som.volume;

  const confirmarVolume = () => {
    if (arrastando === undefined) return;
    const v = arrastando;
    setArrastando(undefined);
    if (v !== som.volume) void editarEfeitoSonoro(som.id, { volume: v });
  };

  return (
    <div className={css.linha} role="listitem">
      <button
        type="button"
        className={css.tocar}
        data-tocando={tocando || undefined}
        aria-label={`Prévia de ${som.nome}`}
        aria-pressed={tocando}
        disabled={som.url === undefined}
        onClick={() => {
          if (tocando) pararLocalmente(som.id);
          else tocarLocalmente({ ...som, volume });
        }}
      >
        {tocando ? <Stop size={ICONE.metadado} aria-hidden /> : <Play size={ICONE.metadado} aria-hidden />}
      </button>

      {editando ? (
        <EdicaoDeNome som={som} aoFechar={() => setEditando(false)} />
      ) : (
        <div className={css.nomeCelula}>
          {gerencia ? (
            <button
              type="button"
              className={css.nomeBotao}
              aria-label={`Renomear ${som.nome}`}
              onClick={() => setEditando(true)}
            >
              <span aria-hidden className={css.emoji}>
                {som.emoji ?? "🔊"}
              </span>
              <span className={css.nome}>{som.nome}</span>
            </button>
          ) : (
            <>
              <span aria-hidden className={css.emoji}>
                {som.emoji ?? "🔊"}
              </span>
              <span className={css.nome}>{som.nome}</span>
            </>
          )}
        </div>
      )}

      {/* Captura no embrulho: o `Deslizante` é o input nativo pintado e não
          expõe "soltou" — o evento borbulha até aqui. */}
      <span
        className={css.volumeCelula}
        onPointerUp={confirmarVolume}
        onKeyUp={confirmarVolume}
        onBlur={confirmarVolume}
      >
        {gerencia ? (
          <Deslizante
            id={`volume-${som.id}`}
            valor={volume}
            min={0}
            max={100}
            passo={5}
            rotulo={`Volume de ${som.nome}`}
            texto={`${String(volume)}%`}
            aoMudar={setArrastando}
          />
        ) : null}
        <span className={css.volumeValor}>{volume}%</span>
      </span>

      <span className={css.autor}>{som.autorNome ?? "—"}</span>

      {gerencia ? (
        /* Texto 12/600 em `danger-text`, do design — um `Botao` de 34px
           numa linha de 30 esticava a linha inteira. */
        <button type="button" className={css.excluir} onClick={() => void apagarEfeitoSonoro(som)}>
          Excluir
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function EdicaoDeNome({ som, aoFechar }: { som: EfeitoSonoro; aoFechar: () => void }) {
  const [emoji, setEmoji] = useState(som.emoji ?? "");
  const [nome, setNome] = useState(som.nome);

  const salvar = () => {
    const n = nome.trim();
    if (n === "" || n.length > 32) return;
    if (n !== som.nome || emoji.trim() !== (som.emoji ?? "")) {
      void editarEfeitoSonoro(som.id, { nome: n, emoji: emoji.trim() });
    }
    aoFechar();
  };

  return (
    <form
      className={css.nomeCelula}
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          aoFechar();
        }
      }}
    >
      <input
        className={css.campoEmoji}
        value={emoji}
        maxLength={32}
        aria-label="Emoji"
        placeholder="🔊"
        onChange={(e) => setEmoji(e.target.value)}
      />
      <input
        className={css.campoNome}
        value={nome}
        maxLength={32}
        aria-label="Nome"
        autoFocus
        onChange={(e) => setNome(e.target.value)}
      />
      <Botao variante="sutil" tamanho="pequeno" type="submit">
        Salvar
      </Botao>
    </form>
  );
}
