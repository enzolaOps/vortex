import { lerUltimoServidor, abrirServidor } from "nucleo/store/ultimoLugar";
import { useLocal, useProntidao, useServerIds } from "nucleo/store/hooks";
import { useEffect, useRef } from "react";

import { ShellDoApp } from "../../shell";
import { AreaConectada } from "./AreaConectada";
import { ColunaConectada } from "./ColunaConectada";
import { ConteudoDaDock } from "./DockConectada";
import { EsqueletoDeMembros, ListaDeMembros } from "./GavetaConectada";

/**
 * Chegada (PRD §8 nº 2): depois do primeiro `Ready`, e só se a pessoa ainda não
 * foi a nenhum lugar, abre o último servidor onde esteve — no último canal de
 * texto, com a última sala no widget. Nunca conecta à voz: entrar é um clique.
 */
function useChegada(): void {
  const pronto = useProntidao();
  const ids = useServerIds();
  const local = useLocal();
  const feito = useRef(false);

  useEffect(() => {
    if (!pronto || feito.current) return;
    feito.current = true;
    if (local.tipo !== "casa") return;
    const ultimo = lerUltimoServidor();
    if (ultimo !== undefined && ids.includes(ultimo)) abrirServidor(ultimo);
  }, [pronto, ids, local]);
}

/** O shell fixo ligado à jornada 4.2: dock, salas, área principal e membros. */
export function ShellDasSalas() {
  useChegada();
  const pronto = useProntidao();
  const local = useLocal();
  const serverId = local.tipo === "servidor" ? local.serverId : undefined;

  return (
    <ShellDoApp
      dock={<ConteudoDaDock />}
      salas={<ColunaConectada />}
      area={<AreaConectada />}
      membros={
        !pronto ? <EsqueletoDeMembros /> : serverId !== undefined ? <ListaDeMembros serverId={serverId} /> : undefined
      }
      gavetaOculta={pronto && serverId === undefined}
    />
  );
}
