import { ShellDoApp } from "./shell";

/**
 * Raiz do app. Hoje só o shell fixo: as jornadas (sessão, salas, chat…) entram
 * nos próximos marcos e penduram o conteúdo na área principal.
 */
export function App() {
  return <ShellDoApp />;
}
