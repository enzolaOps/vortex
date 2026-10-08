import {
  useCanaisDeTexto,
  useCanaisDeVoz,
  useCategorias,
  useChannel,
  useNomesDosCanais,
  usePessoasDaSala,
} from "nucleo/store/hooks";
import type { MouseEvent } from "react";

import { salas, shell } from "../../textos";
import { Avatar, PainelVidro } from "../../ui/ds";
import { siglasDeSalas } from "../../ui/ds/tom";
import { Canal } from "../../ui/icones";
import css from "./Faixa.module.css";
import { useEntradaNaSala } from "./useEntradaNaSala";

function SalaNaFaixa({
  serverId,
  canalId,
  sigla,
}: {
  serverId: string;
  canalId: string;
  sigla: string;
}) {
  const canal = useChannel(canalId);
  const pessoas = usePessoasDaSala(serverId, canalId);
  const { aqui, motivo, clicar } = useEntradaNaSala(serverId, canalId);
  if (!canal) return null;
  const dito =
    pessoas.length === 0 ? shell.faixa.vazia : salas.naSala(pessoas.length);
  return (
    <button
      type="button"
      className={css.sala}
      data-aqui={aqui || undefined}
      aria-label={
        motivo === undefined
          ? `${canal.name}, ${dito}`
          : `${canal.name}, ${dito}. ${motivo}`
      }
      aria-disabled={motivo !== undefined || undefined}
      title={motivo ?? canal.name}
      // Primeiro clique entra sem palco; na sala em que já está, abre o palco.
      onClick={clicar}
    >
      <Avatar nome={canal.name} id={canalId} iniciais={sigla} tamanho={40} />
      <span className={css.contagem} aria-hidden="true">
        {pessoas.length}
      </span>
    </button>
  );
}

/** Leva o foco para a lista que abriu: o botão de canais é um atalho até ela. */
function irParaALista(e: MouseEvent<HTMLButtonElement>) {
  const lista = e.currentTarget
    .closest("[data-faixa-raiz]")
    ?.querySelector("[data-lista-de-salas]");
  lista?.querySelector<HTMLElement>("button")?.focus();
}

/**
 * A faixa estreita do palco em tela cheia: uma sala por botão, com a contagem de
 * quem está dentro, e o atalho para os canais de texto. Receber foco em qualquer
 * um abre a lista completa (o `SalasEmFaixa` do shell cuida disso).
 */
function useVozNaOrdem(serverId: string): readonly string[] {
  const cats = useCategorias(serverId);
  const emVoz = useCanaisDeVoz(serverId);
  if (cats.length === 0) return emVoz;
  const voz = new Set(emVoz);
  return cats.flatMap((c) => c.canais.filter((id) => voz.has(id)));
}

export function FaixaDeSalas({ serverId }: { serverId: string }) {
  const emVoz = useVozNaOrdem(serverId);
  const emTexto = useCanaisDeTexto(serverId);
  const nomes = useNomesDosCanais(emVoz);
  const siglas = siglasDeSalas(nomes);
  return (
    <PainelVidro
      como="nav"
      raio="xl"
      aria-label={shell.faixa.rotulo}
      className={css.faixa}
    >
      {emVoz.map((id, i) => (
        <SalaNaFaixa key={id} serverId={serverId} canalId={id} sigla={siglas[i] ?? ""} />
      ))}
      {emTexto.length > 0 && (
        <>
          <span className={css.divisoria} aria-hidden="true" />
          <button
            type="button"
            className={css.canais}
            aria-label={shell.faixa.canais}
            onClick={irParaALista}
          >
            <Canal tamanho={16} />
          </button>
        </>
      )}
    </PainelVidro>
  );
}
