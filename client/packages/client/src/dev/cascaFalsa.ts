import type { Atualizacao, PonteDesktop } from "../sdk/desktop";
import { hidratarDesktop } from "../store/desktop";

/**
 * Uma casca Electron de mentira, para o arnês.
 *
 * ⚠ **Sem isto, TODA a etapa 9 seria inalcançável.** Barra de título, faixa de
 * atualização e a seção Desktop só existem quando `window.vortex` existe, e no
 * navegador ele não existe. Três telas nasceriam construídas e invisíveis — a
 * família do painel de fixadas, que passou meses sem nunca ter sido visto
 * porque não estava no preset de fábrica.
 *
 * ⚠ **Ela implementa os DEZ verbos do contrato, e isso é o teste mais barato
 * de que ele fecha.** `satisfies PonteDesktop` faz o build quebrar se a ponte
 * ganhar um verbo e esta esquecer — a mesma mecânica de `Record<PainelId, …>`,
 * aplicada à fronteira com a casca. Uma ponte de mentira parcial passaria a
 * ideia errada de que o contrato está coberto.
 *
 * ⚠ **Só existe no chunk do arnês**, que é `lazy` e só quem abre `/dev` baixa.
 * O produto não conhece este arquivo.
 */

let parar: (() => void) | undefined;

/* Quem ouve a atualização agora — os verbos falsos respondem por aqui. */
let ouvinteDaAtualizacao: ((a: Atualizacao) => void) | undefined;
const temporizadores = new Set<ReturnType<typeof setTimeout>>();

function emitirDepois(ms: number, a: Atualizacao): void {
  const id = setTimeout(() => {
    temporizadores.delete(id);
    ouvinteDaAtualizacao?.(a);
  }, ms);
  temporizadores.add(id);
}

function ciclo(ouvinte: (a: Atualizacao) => void): () => void {
  /*
    Percorre os SEIS estados, na ordem do design, e para na obrigatória — que
    é a tela de bloqueio. Um passo a cada 2 s, para dar tempo de medir cada
    superfície: a faixa (pronta, falhou), a linha de Configurações > Desktop
    (verificando, baixando) e o bloqueio.

    ⚠ **O bloqueio cobre o arnês, inclusive o botão que desliga a casca.** É o
    comportamento de produto. Para sair, F5: a casca falsa é injetada por
    JavaScript e não sobrevive ao recarregamento.
  */
  const roteiro: Atualizacao[] = [
    { estado: "em-dia", versao: undefined, progresso: 0 },
    { estado: "verificando", versao: undefined, progresso: 0 },
    { estado: "baixando", versao: "4.2.1", progresso: 0 },
    { estado: "pronta", versao: "4.2.1", progresso: 100 },
    { estado: "falhou", versao: "4.2.1", progresso: 0 },
    { estado: "obrigatoria", versao: "4.3.0", progresso: 0 },
  ];
  ouvinteDaAtualizacao = ouvinte;
  let i = 0;
  ouvinte(roteiro[0]!);
  const id = setInterval(() => {
    i = Math.min(i + 1, roteiro.length - 1);
    ouvinte(roteiro[i]!);
    if (i === roteiro.length - 1) clearInterval(id);
  }, 2000);
  return () => {
    clearInterval(id);
    for (const t of temporizadores) clearTimeout(t);
    temporizadores.clear();
    ouvinteDaAtualizacao = undefined;
  };
}

const PREFERENCIAS = new Map<string, unknown>();

const FALSA = {
  versao: "4.2.0",
  plataforma: "win32",
  electron: "32",

  janela: (o) => {
    console.info(`[casca falsa] janela: ${o}`);
    return Promise.resolve();
  },
  assinarJanela: (ouvinte) => {
    ouvinte({ maximizada: false, comFoco: true });
    /*
      O foco de verdade vem do main; aqui espelhamos o do documento, que é o
      mais perto que o navegador chega. Com cleanup — listener sem cleanup é o
      erro nº 5 do briefing, e este arnês liga e desliga a casca no clique.
    */
    const aoMudar = () =>
      ouvinte({ maximizada: false, comFoco: document.hasFocus() });
    window.addEventListener("focus", aoMudar);
    window.addEventListener("blur", aoMudar);
    return () => {
      window.removeEventListener("focus", aoMudar);
      window.removeEventListener("blur", aoMudar);
    };
  },

  /* O "em uso" fixo é o de um processo que abriu com os padrões: é o que faz
     o aviso de reinício aparecer no arnês ao mexer na aceleração ou na barra. */
  lerPreferencias: () =>
    Promise.resolve({
      barraNativaEmUso: false,
      aceleracaoEmUso: true,
      ...Object.fromEntries(PREFERENCIAS),
    }),
  gravarPreferencia: (chave, valor) => {
    PREFERENCIAS.set(chave, valor);
    return Promise.resolve();
  },

  assinarAtualizacao: ciclo,
  /* Verificar responde como a casca: consulta e volta "em dia". */
  verificarAtualizacao: () => {
    emitirDepois(0, { estado: "verificando", versao: undefined, progresso: 0 });
    emitirDepois(1500, { estado: "em-dia", versao: undefined, progresso: 0 });
    return Promise.resolve();
  },
  /*
    O pedido obrigatório percorre o caminho de FALHA — verificando, baixando,
    falhou —, porque é o único que o arnês consegue mostrar inteiro: o de
    sucesso termina num reinício que uma aba não tem como fazer.
  */
  instalarEReiniciar: (opcoes) => {
    console.info("[casca falsa] instalar e reiniciar", opcoes ?? {});
    if (opcoes?.obrigatoria) {
      emitirDepois(0, { estado: "verificando", versao: "4.3.0", progresso: 0 });
      emitirDepois(1500, { estado: "baixando", versao: "4.3.0", progresso: 0 });
      emitirDepois(3000, { estado: "falhou", versao: "4.3.0", progresso: 0 });
    }
    return Promise.resolve();
  },

  /* 1,8 GB — o número do design, para a linha de cache ter o que formatar. */
  tamanhoDoCache: () => Promise.resolve(1_800_000_000),
  limparCache: () => Promise.resolve(),
  abrirPastaDeLogs: () => {
    console.info("[casca falsa] abrir pasta de logs");
    return Promise.resolve();
  },
} satisfies PonteDesktop;

/**
 * Liga e desliga a casca falsa.
 *
 * ⚠ **Sem recarregar, e a razão é que recarregar NÃO funcionaria:** a ponte é
 * injetada por JavaScript, então um `location.reload()` a apagaria junto. A
 * casca de verdade existe antes do primeiro byte de script do app; esta não
 * pode existir, e fingir que sim seria um arnês que mente sobre a ordem de
 * inicialização.
 *
 * O que faz a interface reagir é `hidratarDesktop`, que publica no store — e
 * quem lê `naDesktop()` re-renderiza junto. A diferença para a produção é só
 * o momento; a forma das telas é a mesma.
 */
export function alternarCascaFalsa(): void {
  if (parar) {
    parar();
    parar = undefined;
  }

  const w = window as unknown as { vortex?: PonteDesktop };
  if (w.vortex) delete w.vortex;
  else w.vortex = FALSA;

  void hidratarDesktop();
}
