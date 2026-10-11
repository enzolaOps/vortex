import { carregarHistorico } from "nucleo/sdk/adapter";
import { pode } from "nucleo/sdk/permissoes";
import { useChannel } from "nucleo/store/hooks";

import { chat } from "../../textos";
import { Botao } from "../../ui/ds";
import css from "./Estados.module.css";

/** Placeholders sem identidade: nomeados à mão, porque `key` não pode ser índice. */
const LINHAS_DO_ESQUELETO = [
  { id: "a", curto: true, duas: false },
  { id: "b", curto: false, duas: true },
  { id: "c", curto: true, duas: false },
  { id: "d", curto: false, duas: true },
  { id: "e", curto: true, duas: false },
  { id: "f", curto: false, duas: true },
] as const;

/**
 * Histórico a caminho: um esqueleto com a forma das linhas, não um giro.
 * `aria-busy` + região de status para o leitor de tela saber que há espera.
 */
export function CarregandoHistorico() {
  return (
    <div className={css.carregando} role="status" aria-busy="true" aria-label={chat.carregandoMensagens}>
      {LINHAS_DO_ESQUELETO.map((l) => (
        <div key={l.id} className={css.esqueleto} aria-hidden="true">
          <span className={css.avatar} />
          <span className={css.linhas}>
            <span className={css.nome} />
            <span className={css.texto} data-curto={l.curto || undefined} />
            {l.duas && <span className={css.texto} data-curto="" />}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A primeira carga falhou: diz o que houve e oferece a saída. */
export function FalhaNoHistorico({ canalId }: { canalId: string }) {
  return (
    <div className={css.estado} role="alert">
      <p className={css.titulo}>{chat.falhaAoCarregar}</p>
      <Botao
        variante="secundario"
        tamanho="sm"
        onClick={() => {
          void carregarHistorico(canalId);
        }}
      >
        {chat.tentarDeNovo}
      </Botao>
    </div>
  );
}

/**
 * O canal existe e não tem nenhuma mensagem: o começo dele, com o nome do
 * contexto certo (sala, canal ou conversa), encostado no lugar onde a primeira
 * mensagem vai nascer.
 */
export function ComecoDoCanal({ canalId }: { canalId: string }) {
  const canal = useChannel(canalId);
  const nome = canal?.name ?? "";
  const titulo =
    canal === undefined
      ? chat.comecoDoCanal
      : canal.tipo === "voz"
        ? chat.comecoDaSala(nome)
        : canal.tipo === "dm" || canal.tipo === "grupo"
          ? chat.comecoDaConversa(nome)
          : canal.tipo === "notas"
            ? chat.comecoDasNotas
            : chat.comecoDoCanalDe(nome);
  const podeEscrever = canal !== undefined && pode(canalId, "enviar");

  return (
    <div className={css.estado}>
      <p className={css.titulo}>{titulo}</p>
      {canal?.topico !== undefined && canal.topico !== "" && <p className={css.topico}>{canal.topico}</p>}
      <p className={css.dica}>{podeEscrever ? chat.dicaDoComeco : chat.dicaDoComecoSemPermissao}</p>
    </div>
  );
}
