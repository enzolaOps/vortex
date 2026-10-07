import { useEffect, useState } from "react";
import { buscarConvite, type Convite } from "nucleo/sdk/servidores";

export type EstadoDoConvite =
  | { tipo: "procurando" }
  | { tipo: "pronto"; convite: Convite }
  | { tipo: "falhou"; motivo: string };

/**
 * Busca a prévia do convite pelo código. A rota do protocolo é pública, então serve
 * antes de haver sessão: mostrar o servidor antes de pedir cadastro é a ordem certa,
 * e "crie uma conta para ver aonde vai entrar" é a que faz desistir.
 *
 * O resultado é guardado junto do código a que pertence, e "procurando" é DERIVADO
 * de ele ser de outro: zerar o estado dentro do efeito seria uma renderização a mais
 * por troca de código.
 */
export function useConvite(codigo: string): EstadoDoConvite {
  const [achado, setAchado] = useState<{ codigo: string; estado: EstadoDoConvite } | undefined>();

  useEffect(() => {
    let vivo = true;
    void buscarConvite(codigo).then((r) => {
      if (!vivo) return;
      setAchado({
        codigo,
        estado: "erro" in r ? { tipo: "falhou", motivo: r.erro } : { tipo: "pronto", convite: r },
      });
    });
    return () => {
      vivo = false;
    };
  }, [codigo]);

  return achado?.codigo === codigo ? achado.estado : { tipo: "procurando" };
}
