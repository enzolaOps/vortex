import { lerMeuPerfil } from "nucleo/sdk/perfil";
import { useEffect, useState, useSyncExternalStore } from "react";

import { assinarPerfilMudou, avisarPerfilMudou, lerRevisaoDoPerfil } from "./perfilMudou";

/** Quanto esperar o `Ready` trazer a conta antes de dizer que não veio. */
export const ESPERA_PELA_CONTA_MS = 3000;

/**
 * Os dados da conta, com os três estados que a tela precisa mostrar: ainda
 * chegando (`eu` ausente, `falhou` falso), não chegaram (`falhou`) e prontos.
 */
export function useMeuPerfil() {
  const revisao = useSyncExternalStore(assinarPerfilMudou, lerRevisaoDoPerfil);
  const presente = useSyncExternalStore(assinarPerfilMudou, () => lerMeuPerfil() !== undefined);
  // `revisao` e `presente` entram na conta de propósito: sem eles o compilador
  // veria `lerMeuPerfil()` sem entradas e guardaria a primeira resposta para sempre.
  const eu = revisao >= 0 && presente ? lerMeuPerfil() : undefined;
  const ausente = eu === undefined;
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!ausente) return;
    const t = setTimeout(() => {
      setFalhou(true);
    }, ESPERA_PELA_CONTA_MS);
    return () => {
      clearTimeout(t);
    };
  }, [ausente, tentativa]);

  const tentarDeNovo = () => {
    setFalhou(false);
    setTentativa((n) => n + 1);
    avisarPerfilMudou();
  };

  return { eu, falhou: ausente && falhou, tentarDeNovo };
}
