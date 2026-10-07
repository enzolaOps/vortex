import { useEffect, useState } from "react";

/**
 * Segundos que faltam para liberar um reenvio. `reiniciar` volta ao total.
 *
 * O intervalo existe só enquanto há o que contar: parado em zero não gasta timer, e
 * desmontar a tela o desfaz. A espera protege de duas coisas, e só uma é o servidor:
 * apertar de novo antes de o e-mail chegar é o reflexo de todo mundo, e cada pedido
 * pode invalidar o link anterior.
 */
export function useContagem(total: number): { restante: number; reiniciar: () => void } {
  const [restante, setRestante] = useState(total);
  const contando = restante > 0;

  useEffect(() => {
    if (!contando) return;
    const id = setInterval(() => {
      setRestante((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [contando]);

  return {
    restante,
    reiniciar: () => {
      setRestante(total);
    },
  };
}
