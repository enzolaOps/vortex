import { definirPalco } from "nucleo/store/palcoDeVoz";
import { lembrarSala } from "nucleo/store/ultimoLugar";
import {
  useCanaisDeTexto,
  useCanaisDeVoz,
  useCanalDaChamada,
  useChannel,
  usePessoasDaSala,
} from "nucleo/store/hooks";
import type { MouseEvent } from "react";

import { salas, shell } from "../../textos";
import { Avatar, PainelVidro } from "../../ui/ds";
import { Canal } from "../../ui/icones";
import css from "./Faixa.module.css";

function SalaNaFaixa({ serverId, canalId }: { serverId: string; canalId: string }) {
  const canal = useChannel(canalId);
  const pessoas = usePessoasDaSala(serverId, canalId);
  const aqui = useCanalDaChamada() === canalId;
  if (!canal) return null;
  const dito = pessoas.length === 0 ? shell.faixa.vazia : salas.naSala(pessoas.length);
  return (
    <button
      type="button"
      className={css.sala}
      data-aqui={aqui || undefined}
      aria-label={`${canal.name}, ${dito}`}
      onClick={() => {
        lembrarSala(serverId, canalId);
        if (aqui) definirPalco({ tipo: "grade" });
      }}
    >
      <Avatar nome={canal.name} id={canalId} tamanho={40} />
      <span className={css.contagem} aria-hidden="true">
        {pessoas.length}
      </span>
    </button>
  );
}

/** Leva o foco para a lista que abriu: o botão de canais é um atalho até ela. */
function irParaALista(e: MouseEvent<HTMLButtonElement>) {
  const lista = e.currentTarget.closest("[data-faixa-raiz]")?.querySelector("[data-lista-de-salas]");
  lista?.querySelector<HTMLElement>("button")?.focus();
}

/**
 * A faixa estreita do palco em tela cheia: uma sala por botão, com a contagem de
 * quem está dentro, e o atalho para os canais de texto. Receber foco em qualquer
 * um abre a lista completa (o `SalasEmFaixa` do shell cuida disso).
 */
export function FaixaDeSalas({ serverId }: { serverId: string }) {
  const emVoz = useCanaisDeVoz(serverId);
  const emTexto = useCanaisDeTexto(serverId);
  return (
    <PainelVidro como="nav" raio="xl" aria-label={shell.faixa.rotulo} className={css.faixa}>
      {emVoz.map((id) => (
        <SalaNaFaixa key={id} serverId={serverId} canalId={id} />
      ))}
      {emTexto.length > 0 && (
        <>
          <span className={css.divisoria} aria-hidden="true" />
          <button type="button" className={css.canais} aria-label={shell.faixa.canais} onClick={irParaALista}>
            <Canal tamanho={16} />
          </button>
        </>
      )}
    </PainelVidro>
  );
}
