import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ARNES_ATIVO } from "./dev/arnesAtivo";
import { ligarRota } from "./rota/rota";
import { iniciarPintura } from "./tema/pintor";
import { App } from "./App";
import { PortaoDeSessao } from "./sessao/PortaoDeSessao";
import { Toaster } from "./components/ui/Toast";
import { FaixaDeConexao } from "./conexao/FaixaDeConexao";
import { Atualizacao } from "./desktop/Atualizacao";
import { BarraDeTitulo } from "./desktop/BarraDeTitulo";
import css from "./main.module.css";
import { hidratarDesktop } from "./store/desktop";
import { TooltipProvider } from "./components/ui/Tooltip";
import "./styles/tokens.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root ausente no index.html");

iniciarPintura();

/*
  As preferências da casca, antes do primeiro render.

  ⚠ Elas decidem se a barra de título custom aparece — e aplicá-las depois
  faria o app abrir com a barra e removê-la um quadro adiante, empurrando o
  conteúdo inteiro 34px para cima na frente de quem olha. Module-level pela
  mesma razão da rota: preferência de processo não pertence a árvore de
  componente nenhuma.

  `void` e sem `await`: no navegador ela resolve na hora sem fazer nada, e
  bloquear a montagem do app por um IPC que talvez nem exista seria pagar o
  pior caso em toda abertura.
*/
void hidratarDesktop();

/*
  A rota, antes do primeiro render.

  Aplicar depois faria o app abrir na casa e SALTAR para o lugar da URL um
  quadro adiante — visível em toda abertura de link, e pior numa lista
  virtualizada, que montaria duas vezes.

  Module-level e não `useEffect`: `history` e `popstate` não pertencem a árvore
  de componente nenhuma. Mesmo padrão de `ligarAtalhoDaPaleta`.
*/
/*
  ⚠ **Não no arnês.** Ele vive em `/dev`, que não é um lugar do produto — e
  `ligarRota` abre fazendo `replaceState` para o caminho do `Local` atual, que
  para `/dev` é `/`. O rig perderia o próprio endereço em todo F5.
*/
if (!ARNES_ATIVO) ligarRota();

createRoot(root).render(
  <StrictMode>
    {/* Um Provider na raiz: ele coordena o atraso compartilhado entre
        tooltips. Um por tooltip devolveria o atraso cheio a cada ícone. */}
    <TooltipProvider delayDuration={400} skipDelayDuration={300}>
      {/*
        A barra de título e a faixa de atualização são da CASCA, e as duas
        devolvem `null` no navegador. Montadas na raiz e FORA do portão de
        sessão: minimizar e fechar a janela precisam funcionar na tela de
        login — um app que só pode ser fechado depois de autenticar é um app
        que trava a máquina de quem esqueceu a senha.
      */}
      {/*
        ⚠ **As duas faixas da casca e o conteúdo numa COLUNA FLEX.** Elas
        ocupam fluxo no topo, e antes disto a tela de entrada pedia `100dvh`
        sem saber delas: medido dentro do Electron, a janela rolava 35px e
        ganhava barra de rolagem. Flex e não grid porque as duas são
        OPCIONAIS — ver `main.module.css`.
      */}
      <div className={css.raiz}>
        <BarraDeTitulo />
        <Atualizacao />
        <div className={css.conteudo}>
      {/*
        Sem sessão não há canal, autor nem permissão: o portão vem antes do
        shell. Ver `PortaoDeSessao`.

        ⚠ **Não no arnês, pela MESMA razão que a rota logo acima.** O rig não
        é um lugar do produto: ele semeia o próprio "eu" com
        `definirUsuarioLocal` e todo o dado vem do firehose, então não há
        sessão para haver. Com o portão na frente, `/dev` passou a abrir na
        tela de login — e o arnês, que é onde este projeto MEDE, ficou
        inalcançável sem que nada falhasse. Foi assim que a tela de voz
        chegou a ser medida só pela metade.
      */}
          {ARNES_ATIVO ? (
            <App />
          ) : (
            <PortaoDeSessao>
              <App />
            </PortaoDeSessao>
          )}
        </div>
      </div>
      {/*
        ⚠ Toaster e faixa de conexão ficam FORA do grid de propósito: as duas
        são superfície flutuante — portal e `fixed` — então virariam trilhas
        de altura zero, dizendo que participam de um layout do qual não
        participam.
      */}
      {/* Montado uma vez na raiz: a viewport e a regiao aria-live que o
          leitor de tela anuncia. Os toasts vem do store, nao de props. */}
      <Toaster />
      {/* Como o Toaster: superfície global, montada uma vez, alimentada por
          store. Flutua — faixa no fluxo mudaria a altura do container da
          lista virtualizada. */}
      <FaixaDeConexao />
    </TooltipProvider>
  </StrictMode>,
);
