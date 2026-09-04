/**
 * Quem pinta o tema no documento.
 *
 * Existe porque a primeira versão pintava de dentro do store de layout, e o
 * teste reprovou com `document is not defined` — corretamente. Store que
 * depende de DOM é store que só roda em navegador, e a metade do projeto que
 * mais precisa de teste passa a não ter nenhum.
 *
 * A saída NÃO foi um `typeof document !== "undefined"` no store: isso
 * transforma "não há documento" em silêncio, e silêncio é como um tema que
 * parou de aplicar vira bug de trinta minutos.
 *
 * Também não é um `useEffect` em algum componente. Um efeito de React roda
 * DEPOIS do commit, então haveria um frame com o store novo e a tela velha —
 * e tema é do documento, não de uma árvore de componentes.
 *
 * Um assinante module-level roda síncrono no `emitir()`, antes de o React
 * sequer saber que algo mudou. Mesma janela de tempo da versão inline, sem a
 * dependência.
 */
import { assinarLayout, lerLayout, lerSemente } from "../store/layout";
import { aplicarTema } from "./aplicar";
import type { Semente } from "./derivar";

let ultima: Semente | null = null;
let ultimoOverride: unknown;

/**
 * Liga a pintura. Idempotente, e chamada uma vez em `main.tsx`.
 *
 * Só repinta quando a SEMENTE muda: o store emite a cada arraste de slot
 * também, e reescrever vinte custom properties a cada frame de redimensiona-
 * mento seria refazer o trabalho que o modo edição inteiro foi desenhado para
 * evitar.
 */
export function iniciarPintura(): () => void {
  const pintar = () => {
    const semente = lerSemente();
    const override = lerLayout().theme;
    if (semente === ultima && override === ultimoOverride) return;
    ultima = semente;
    ultimoOverride = override;
    aplicarTema(semente, override);
  };

  pintar();
  return assinarLayout(pintar);
}
