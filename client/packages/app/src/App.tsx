/**
 * Raiz do app. O shell de verdade (barra de título, dock, coluna de salas, área
 * principal, gaveta) entra nas próximas tarefas do M1; aqui só existe o ponto
 * de montagem que o resto pendura.
 */
export function App() {
  return (
    <div data-testid="shell" className="bg-surface-base text-text-1">
      Vortex
    </div>
  );
}
