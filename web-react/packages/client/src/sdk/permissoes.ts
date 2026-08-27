/**
 * O que a pessoa pode fazer neste canal.
 *
 * **Isto é a REGRA do briefing virando código: nunca renderizar ação que a
 * pessoa não pode executar.** Ela foi registrada assim, com a razão explícita:
 * custa zero adotada agora e é varredura em todo componente se adotada depois.
 * Este arquivo é o "agora".
 *
 * Hoje toda resposta é `true`, e isso não é um TODO — é o estado honesto de um
 * app sem sessão. O que importa é a FORMA: quando a fase 6 trouxer login, o
 * `channel.havePermission()` do SDK é ligado aqui dentro, num lugar só, e
 * nenhum componente muda. Sem isto, a mesma feature seria uma passada por cada
 * botão, menu e atalho do app, com a garantia de esquecer um.
 *
 * Mora em `src/sdk/` porque é tradução de protocolo: `havePermission` é
 * conceito do Stoat, e `Acao` é conceito do Vortex. A camada anticorrupção
 * existe exatamente para essa troca — SDK entra, domínio sai.
 *
 * A união fechada é o mecanismo. Não existe `pode(canal, "qualquer string")`:
 * ação nova precisa entrar em `Acao`, e entrar em `Acao` sem ser mapeada na
 * fase 6 é erro de compilação lá, não bug silencioso aqui.
 *
 * ⚠ **É leitura no render, não subscrição — e isso tem uma consequência que a
 * fase 6 precisa resolver no lugar certo.** `MessageRow` é `memo`, então uma
 * permissão que mudasse hoje não repintaria as linhas já montadas. Foi medido:
 * negar `reagir` em tempo de execução não mexeu em nada até a linha
 * re-renderizar por outro motivo.
 *
 * A resposta NÃO é transformar isto em hook com store: seriam três subscrições
 * por linha, para sempre, por um valor que muda quando alguém edita um cargo.
 *
 * ⚠ **E a resposta que eu havia escrito aqui — "o adapter republica o canal" —
 * estava ERRADA.** Republicar o canal troca o array de IDs, o que acorda a
 * lista; mas `MessageRow` é `memo` com a mesma prop `id`, e nenhuma linha
 * re-renderiza. O botão continuaria aparecendo depois de a pessoa perder o
 * cargo, e nada falharia.
 *
 * O que funciona está em `repensarPermissoes`, no adapter: reescrever os
 * SNAPSHOTS dos assinados. Eles são comparados por `Object.is`, então um
 * objeto novo com o mesmo conteúdo basta para acordar quem os assina — e
 * "assinados" são as linhas na tela, algumas dezenas num histórico de dez mil.
 */

/**
 * As ações que a interface oferece hoje.
 *
 * Cada uma corresponde a um alvo real na tela. Não há entrada especulativa: o
 * dia em que "banir" existir na interface é o dia em que ela entra aqui, e a
 * ausência é o que impede este arquivo de virar uma cópia otimista da tabela
 * de permissões do protocolo.
 */
export type Acao =
  /** Escrever no composer e enviar. */
  | "enviar"
  /** Responder a uma mensagem — no protocolo é o mesmo direito de enviar. */
  | "responder"
  /** Reagir com emoji. Direito próprio no Stoat: `React`. */
  | "reagir"
  /** Fixar e desafixar no canal. `ManageMessages`. */
  | "fixar"
  /** Marcar como lida. Não é permissão de servidor — é do próprio usuário. */
  | "marcarLida";

/**
 * A pessoa pode fazer isto neste canal?
 *
 * `channelId` entra mesmo sem ser usado hoje, e de propósito: a assinatura é o
 * contrato que a fase 6 vai preencher, e uma função que só ganha o parâmetro
 * depois obriga a mexer em todo chamador — que é justamente a varredura que
 * adotar a regra agora existe para evitar.
 */
export function pode(channelId: string, acao: Acao): boolean {
  void channelId;
  void acao;

  /*
    Sem sessão não há permissão para consultar, e `false` seria pior que
    `true`: esconderia a interface inteira de si mesma durante todo o
    desenvolvimento, e ninguém veria o que está construindo.

    Na fase 6 isto vira, em uma linha:
      return canalDoSdk(channelId)?.havePermission(MAPA[acao]) ?? false;
    E aí o default de "não sei" passa a ser `false`, que é o correto quando há
    um servidor para perguntar.
  */
  return true;
}
