# Casca Electron

## Princípio

**Web e desktop compartilham 100% dos componentes.** O Electron adiciona uma
casca fina, não uma segunda aplicação.

Divergência acontece atrás de um flag de plataforma resolvido em um lugar só —
nunca por componente duplicado, nunca por `if (isDesktop)` espalhado pela árvore.
No momento em que existir `MessageRow.desktop.tsx`, o projeto passou a ter dois
front-ends e o design vai divergir em semanas.

Se um recurso não existe na web (badge no ícone, notificação nativa, tray), ele
vive atrás de uma capability que na web devolve no-op. O componente não sabe em
que plataforma está.

## Segurança — inegociável

Este app renderiza conteúdo enviado por qualquer pessoa. As configurações abaixo
são o que separa "XSS numa aba" de "execução de código na máquina do usuário".

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` no renderer
- Preload expõe uma **API estreita e enumerada** via `contextBridge`. Nunca
  `ipcRenderer` inteiro, nunca `require`, nunca `fs`.
- Cada canal IPC valida seu payload no lado do main. Renderer é território
  hostil por definição.
- `will-navigate` e `setWindowOpenHandler` bloqueiam navegação para fora da
  origem; link externo abre no navegador do sistema.
- CSP restritiva no renderer, sem `unsafe-inline`.

Se uma tarefa pedir para afrouxar qualquer um desses pontos por conveniência,
pare e levante a questão.

## Titlebar custom

```css
.titlebar        { -webkit-app-region: drag; }
.titlebar button,
.titlebar input,
.titlebar [role="button"] { -webkit-app-region: no-drag; }
```

Todo elemento interativo dentro da região de arraste precisa de `no-drag`
explícito — o default herda `drag` e o botão simplesmente para de responder, sem
erro.

Reserve a altura da titlebar com um token (`--titlebar-h`), zerado na web. Nunca
com margin no shell: o shell é grid de altura total e margin quebra o cálculo.

Considere `titleBarStyle: 'hidden'` com `trafficLightPosition` no macOS — os
controles nativos ali continuam funcionando de graça, e você só desenha o resto.

## Múltiplas janelas

Popout de canal, chat de voz destacado, janela de configuração.

Cada janela é um renderer novo: **boot completo do React, do store e do
websocket**. Isso multiplica memória e CPU por janela.

Decisões:

- Conexão websocket vive no processo main, compartilhada; renderers recebem
  eventos por IPC. Uma conexão por app, não por janela.
- Estado de UI (scroll, drafts, painel aberto) é por janela.
- Estado de domínio (mensagens, canais) é sincronizado a partir do main.
- Sem estado de aplicação vivendo *só* no main a menos que precise sobreviver ao
  fechamento de todas as janelas.

Popout que abre uma janela que refaz login é bug de arquitetura, não de sessão.

## Janela em background

Janela minimizada ou atrás continua processando websocket. Numa app aberta o dia
inteiro isso é a maior fonte de consumo de bateria.

Quando `document.hidden`:

- pausar animação e autoplay
- throttle mais agressivo de presença e typing
- parar decodificação de mídia
- manter recebimento de mensagem (é o ponto do app), mas adiar render

`backgroundThrottling` do Electron ajuda, mas não cobre trabalho no seu store.
Trate na fronteira do adapter.

## Integrações nativas

Cada uma atrás de capability, com no-op na web:

| Recurso | Nota |
|---|---|
| Badge de unread | macOS/Windows diferem; um adapter só |
| Notificação nativa | Não notificar canal com foco na tela |
| Tray | Fechar janela ≠ sair do app; deixar isso configurável |
| Atalho global | Push-to-talk; conflito com outros apps é comum |
| Deep link | `vortex://` — valida e sanitiza a URL antes de rotear |
| Auto-update | Nunca aplicar durante chamada de voz ativa |

## Ganhos de rodar em Chromium fixo

Sem matriz de browser, use o que a web ainda hesita em usar:

- Container queries sem fallback
- `content-visibility: auto`
- View Transitions
- `:has()`
- `dvh` sem workaround de iOS

Mas **a versão web usa os mesmos componentes.** Recurso usado sem fallback
precisa de degradação aceitável no navegador, não de código separado. Na prática:
prefira recursos onde a ausência degrada visualmente em vez de quebrar layout.

## Diferenças que NÃO justificam código separado

- Tamanho de janela → container queries resolvem
- Densidade → mesmo token nos dois
- Atalhos de teclado → mesma tabela, com modificador resolvido por plataforma
- Menu de contexto → mesmo componente; nativo só onde há ganho real

## Checklist antes de fechar tarefa que tocou a casca

- [ ] Rodou na web também, não só no Electron
- [ ] Nenhum interativo preso na região de arraste
- [ ] `--titlebar-h` zerado na web
- [ ] Nenhuma configuração de segurança afrouxada
- [ ] Canal IPC novo valida payload no main
- [ ] Comportamento verificado com janela em background
