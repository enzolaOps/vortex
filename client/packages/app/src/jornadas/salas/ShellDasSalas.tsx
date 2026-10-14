import { fecharBusca } from "nucleo/store/busca";
import { lerUltimoServidor, abrirServidor } from "nucleo/store/ultimoLugar";
import { useLocal, useProntidao, useServerIds } from "nucleo/store/hooks";
import { useEffect, useRef, type ReactNode } from "react";

import { ShellDoApp } from "../../shell";
import { useBusca } from "../busca/hooks";
import { PainelDeBusca } from "../busca/PainelDeBusca";
import { AreaConectada } from "./AreaConectada";
import { ColunaConectada } from "./ColunaConectada";
import { ConteudoDaDock } from "./DockConectada";
import { FaixaDeSalas } from "./FaixaDeSalas";
import { EsqueletoDeMembros, ListaDeMembros } from "./GavetaConectada";
import { DialogoDeTransmissao } from "../voz/DialogoDeTransmissao";
import { useSalaDoPalco } from "../voz/hooks";

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
export function ShellDasSalas({ rodapeDasSalas }: { rodapeDasSalas?: ReactNode }) {
  useChegada();
  const pronto = useProntidao();
  const local = useLocal();
  const serverId = local.tipo === "servidor" ? local.serverId : undefined;
  // O palco ocupa a área principal inteira, sem coluna à direita.
  const palcoAberto = useSalaDoPalco(serverId).aberto;
  const busca = useBusca();
  const canalAtual = local.tipo === "servidor" || local.tipo === "dm" ? local.channelId : undefined;
  // A busca é do canal em que foi aberta: trocar de canal a fecha (os resultados são dele).
  useEffect(() => {
    if (busca.aberta && busca.channelId !== canalAtual) fecharBusca();
  }, [busca.aberta, busca.channelId, canalAtual]);
  const buscaVisivel = busca.aberta && canalAtual !== undefined && busca.channelId === canalAtual && !palcoAberto;

  return (
    <>
    <ShellDoApp
      chaveDoLugar={JSON.stringify(local)}
      dock={<ConteudoDaDock />}
      salas={<ColunaConectada rodape={rodapeDasSalas} />}
      area={<AreaConectada />}
      membros={
        !pronto ? <EsqueletoDeMembros /> : serverId !== undefined ? <ListaDeMembros serverId={serverId} /> : undefined
      }
      salasEmFaixa={palcoAberto}
      faixaDeSalas={serverId !== undefined ? <FaixaDeSalas serverId={serverId} /> : undefined}
      busca={buscaVisivel && canalAtual !== undefined ? <PainelDeBusca key={canalAtual} canalId={canalAtual} servidorId={serverId ?? ""} /> : undefined}
      gavetaOculta={(pronto && serverId === undefined && !buscaVisivel) || palcoAberto}
    />
    <DialogoDeTransmissao />
    </>
  );
}