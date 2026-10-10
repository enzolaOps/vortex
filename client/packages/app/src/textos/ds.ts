import { plural } from "nucleo/lib/plural";

/**
 * Textos dos componentes do design system (`src/ui/ds/`). Rótulos acessíveis
 * incluídos: quem usa leitor de tela ouve estes mesmos textos.
 */
export const ds = {
  avatar: {
    falando: "falando",
    transmitindo: "transmitindo",
    online: "online",
    idle: "ausente",
    dnd: "não perturbe",
    offline: "offline",
  },
  maisPessoas: (n: number) => plural(n, "pessoa a mais", "pessoas a mais"),
  naoLida: "Não lida",
  mencoes: (n: number) => plural(n, "menção", "menções"),
  voceEstaAqui: "Você está aqui",
  canalRestrito: "Canal restrito",
  modoLento: (segundos: number) =>
    `Modo lento: ${segundos >= 60 ? `${String(Math.round(segundos / 60))} min` : `${String(segundos)} s`} entre mensagens`,
  mensagem: {
    de: (autor: string) => `Mensagem de ${autor}`,
    respostaA: (autor: string) => `Resposta a ${autor}`,
    reagir: "Reagir",
    maisAcoes: "Mais ações",
    acoes: "Ações da mensagem",
    imagem: "Imagem",
  },
  digitando: {
    varios: "Várias pessoas estão digitando…",
    dois: (nomes: string) => `${nomes} estão digitando…`,
    e: "e",
  },
  campo: {
    emoji: "Inserir emoji",
    enviando: "Enviando…",
  },
} as const;
