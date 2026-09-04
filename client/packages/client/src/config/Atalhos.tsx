import { Combinacao } from "../components/ui/Tecla";
import { classes as pg, PaginaDeAjustes } from "./Pagina";
import css from "./Atalhos.module.css";

/**
 * O registro de atalhos.
 *
 * ⚠ **Notação NEUTRA, nunca o glifo.** `["mod", "K"]` e não `"⌘K"`: a tradução
 * para a plataforma é do `Combinacao`, e escrever o símbolo do Mac aqui
 * obrigaria cada consumidor a desfazê-la — o primeiro que esquecesse mostraria
 * "⌘" para quem usa Windows, e quem tenta um atalho que não funciona não tenta
 * de novo. A regra já existia no botão da paleta; aqui ela vale trinta vezes.
 *
 * ⚠ **Esta é uma tela de REFERÊNCIA, não de configuração**, e é o que a
 * referência desenha: sem botão de editar, sem gravador. Remapear é trabalho de
 * verdade — precisa de um gravador de combinação, detecção de conflito e um
 * store persistido — e um botão "Editar" inerte em trinta linhas seria o
 * defeito que o lint de `onSelect` foi instalado para matar, multiplicado por
 * trinta. Os globais têm o botão porque a tabela deles depende do Electron
 * inteiro, e ali o registro de pendências responde por um.
 *
 * A ordem dos grupos é a de quem procura: navegação primeiro, porque é o que
 * se aprende no primeiro dia.
 */
const GRUPOS = [
  {
    titulo: "Navegação",
    itens: [
      { acao: "Navegador rápido", teclas: ["mod", "K"] },
      { acao: "Servidor anterior / próximo", teclas: ["alt", "mod", "↑ / ↓"] },
      { acao: "Canal anterior / próximo", teclas: ["alt", "↑ / ↓"] },
      { acao: "Canal não lido mais antigo", teclas: ["shift", "alt", "↑"] },
      { acao: "Voltar / avançar", teclas: ["mod", "[ / ]"] },
      { acao: "Ir para DMs", teclas: ["mod", "0"] },
    ],
  },
  {
    titulo: "Mensagens",
    itens: [
      { acao: "Responder à última", teclas: ["shift", "R"] },
      { acao: "Editar a última sua", teclas: ["↑", "no composer"] },
      { acao: "Adicionar reação", teclas: ["mod", "shift", "E"] },
      { acao: "Marcar canal como lido", teclas: ["esc"] },
      { acao: "Marcar servidor como lido", teclas: ["shift", "esc"] },
      { acao: "Nova linha", teclas: ["shift", "enter"] },
      { acao: "Buscar no canal", teclas: ["mod", "F"] },
    ],
  },
  {
    titulo: "Painéis",
    itens: [
      { acao: "Lista de membros", teclas: ["mod", "U"] },
      { acao: "Mensagens fixadas", teclas: ["mod", "P"] },
      { acao: "Tópicos", teclas: ["mod", "shift", "T"] },
      { acao: "Caixa de entrada", teclas: ["mod", "I"] },
      { acao: "Seletor de emoji", teclas: ["mod", "E"] },
      { acao: "Seletor de GIF", teclas: ["mod", "G"] },
    ],
  },
  {
    titulo: "Voz e chamada",
    itens: [
      { acao: "Mutar microfone", teclas: ["shift", "mod", "M"] },
      { acao: "Ensurdecer", teclas: ["shift", "mod", "D"] },
      { acao: "Atender chamada", teclas: ["mod", "enter"] },
      { acao: "Recusar chamada", teclas: ["esc"] },
      { acao: "Sair da voz", teclas: ["shift", "mod", "backspace"] },
      { acao: "Compartilhar tela", teclas: ["mod", "shift", "S"] },
    ],
  },
] as const;

/**
 * Atalhos de teclado.
 *
 * ⚠ **Sem o teto de 840**, ao contrário das outras páginas de preferência. Ela
 * é uma grade que se reflui sozinha (`auto-fit`, mínimo 330), e o teto deixaria
 * duas colunas onde cabem três — com metade da tela vazia. O teto serve à
 * LEITURA em linha; isto é varredura: a pessoa está procurando uma tecla, não
 * lendo um texto.
 *
 * ⚠ **Nem todos funcionam ainda, e a tela diz isso no rodapé em vez de
 * marcá-los um a um.** A paleta, a caixa de entrada, os painéis e os de voz
 * existem; vários dos de navegação não. Trinta selos "em breve" seriam mais
 * ruído que informação numa tela cuja função é ser varrida — e um atalho que
 * não funciona ainda falha em silêncio, que é o comportamento correto de
 * atalho, não um alvo clicável que engana.
 */
export function Atalhos() {
  return (
    <PaginaDeAjustes cheia>
      <div className={css.grade}>
        {GRUPOS.map((g) => (
          <section key={g.titulo}>
            <h2 className={css.tituloDoGrupo}>{g.titulo}</h2>
            <div className={css.cartao}>
              {g.itens.map((i) => (
                <div key={i.acao} className={css.linha}>
                  <span className={css.acao}>{i.acao}</span>
                  <Combinacao teclas={i.teclas} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className={pg.recado}>
        As teclas aparecem como a sua plataforma as chama. Atalhos que valem com
        o app em segundo plano ficam em Voz e vídeo — esses dependem do
        aplicativo de desktop, porque o navegador não vê tecla fora da aba.
      </p>
    </PaginaDeAjustes>
  );
}
