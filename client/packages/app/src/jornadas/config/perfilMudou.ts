/**
 * "O perfil mudou": um contador que quem desenha a própria identidade assina.
 *
 * O SDK atualiza o objeto do usuário por dentro e `lerMeuPerfil()` é uma leitura
 * síncrona do cache; sem um aviso, o nome na navegação das configurações só
 * mudaria na próxima abertura. O contador é um número (referência estável por
 * valor) e vive fora do React, como os outros stores do app.
 */
let revisao = 0;
const ouvintes = new Set<() => void>();

export function assinarPerfilMudou(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerRevisaoDoPerfil(): number {
  return revisao;
}

export function avisarPerfilMudou(): void {
  revisao += 1;
  for (const o of ouvintes) o();
}
