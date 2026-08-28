/**
 * Onde a pessoa está: servidor e canal ativos.
 *
 * Store module-level, como todo o resto. Isto é o caso mais tentador de
 * Context que existe no app inteiro — "é só um ID, o app todo precisa dele" —
 * e é exatamente por isso que ele NÃO está em Context: Context propaga
 * tudo-ou-nada, e trocar de canal acordaria toda árvore que estivesse dentro
 * dele, incluindo painéis que não têm nada com o assunto.
 *
 * Aqui o rail assina o servidor ativo, a lista de canais assina o canal ativo,
 * e a member list não assina nenhum dos dois.
 *
 * O snapshot é uma STRING. Não há armadilha de referência a evitar — primitivo
 * compara por valor, e `assertStable` passaria de graça. É a única parte do
 * projeto onde isso vale, e vale por acidente feliz, não por projeto.
 */
import { definirCanalAberto, primeiroCanalDe } from "../sdk/adapter";

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

let servidorAtivo = "";
let canalAtivo = "";

function emitir() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarNavegacao(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerServidorAtivo(): string {
  return servidorAtivo;
}

export function lerCanalAtivo(): string {
  return canalAtivo;
}

/**
 * Abrir um canal zera as não-lidas dele.
 *
 * O empurrão vai do store para o adapter, nunca ao contrário: o handler de
 * `messageCreate` precisa saber qual canal está aberto no momento da ESCRITA,
 * e perguntar ao React de lá inverteria a direção do dado.
 */
export function selecionarCanal(channelId: string): void {
  if (canalAtivo === channelId) return;
  canalAtivo = channelId;
  definirCanalAberto(channelId);
  emitir();
}

/**
 * Trocar de servidor abre o primeiro canal de texto dele.
 *
 * Servidor sem canal nenhum é estado legítimo — servidor recém-criado, ou um
 * onde a pessoa não tem permissão de ver nada. Nesse caso o canal ativo fica
 * vazio e a coluna de conteúdo mostra o estado vazio, em vez de manter aberto
 * o canal do servidor anterior.
 */
export function selecionarServidor(serverId: string): void {
  if (servidorAtivo === serverId) return;
  servidorAtivo = serverId;

  const canal = primeiroCanalDe(serverId) ?? "";
  canalAtivo = canal;
  definirCanalAberto(canal || undefined);
  emitir();
}
