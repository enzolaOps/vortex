# Vortex v1: segurança da reescrita da interface

> Fontes: `00-decisoes.md`, `02-prd.md` e `04-arquitetura-trd.md`. Nada aqui
> reabre decisão desses documentos. Os fatos do repositório foram conferidos
> em 2026-10-07 na branch `integracao/desktop-voz`. Caminhos de cliente são
> relativos a `client/packages/client/src` (que vira `nucleo/` no M0) e caminhos
> de casca, a `desktop/src`. O `pi-infra` (Caddy, TLS, compose)
> **não está neste repositório** e não foi lido. Todo controle que depende dele
> está marcado com "pi-infra".

## 1. Contexto e modelo de ameaça

O Vortex é uma instância privada para um grupo pequeno e fechado. Isso diminui
o número de atacantes, mas não o tipo de dano. Todo membro de um servidor
escreve conteúdo que vai parar na tela dos outros (mensagem, nome, recado,
bio, nome de cargo, cor de cargo, embed), e a casca Electron executa esse
conteúdo dentro de um Chromium com acesso a teclado global, áudio do sistema e
captura de tela.

### Ativos

| Ativo | Por que importa |
| --- | --- |
| Token de sessão (`vortex.sessao` em `localStorage`) | É a credencial inteira: quem tem o token é a pessoa, sem prazo de validade, até alguém derrubar a sessão em Dispositivos |
| Mídia de voz e tela (LiveKit) | Tela compartilhada mostra o que está no monitor: senhas, DMs, outras janelas |
| Mensagens e DMs | Conteúdo privado do grupo |
| A máquina de quem usa o desktop | A casca tem hook global de teclado (`uiohook-napi`), captura de áudio por processo, mixer de volume do sistema e `shell.openExternal` |
| Integridade da distribuição | Imagens do cliente e do `delta`/`bonfire` no GHCR, instalador e atualização do desktop via GitHub Releases |

### Atores

| Ator | Capacidade realista |
| --- | --- |
| Membro malicioso de um servidor (inclusive conta comprometida de um amigo) | Escreve markdown, nome, bio, cor de cargo (se administra), anexos, links, convites; entra em salas de voz conforme o cargo |
| Quem manda link ou anexo malicioso | Link com texto enganoso, URL `javascript:`, SVG ou HTML disfarçado de imagem, página que tenta ser aberta dentro do app |
| Atacante de rede | Wi-Fi público, proxy; só vence se faltar TLS em algum salto (API, WebSocket, LiveKit, autumn) |
| Dependência comprometida | Pacote npm, crate, action do GitHub ou o gitlink `stoat.js` trocado; roda no build, no navegador ou no main do Electron |
| Processo local na mesma máquina | Fora do modelo principal (já tem a conta do usuário), mas não deve ganhar a ponte do Electron de graça |

### Fronteiras de confiança

```
 ┌──────────────── máquina de quem usa ─────────────────────────────────────┐
 │  Electron main (Node, privilegiado)                                      │
 │   registroDeIpc: janela + frame + origem + payload                       │
 │        ▲ IPC enumerado              ▲ MessagePort                        │
 │  ══════╪════════════════ F1 ════════╪═══════════════════════════════════ │
 │  janela principal (renderer)   overlay (sandbox, sessão em memória)      │
 │   app React + nucleo            só desenha o que a principal publica     │
 │   token em localStorage         rede só para assets do app               │
 │        │  ═══ F2: conteúdo de terceiro (markdown, nome, embed) ═══       │
 │        │  iframe de atividade (sandbox="allow-scripts", origem opaca)    │
 └────────┼─────────────────────────────────────────────────────────────────┘
   ═══════╪══════════ F3: rede (TLS no Caddy, pi-infra) ═════════════════════
          ▼
   Caddy ── /api delta ── /ws bonfire ── autumn (arquivos) ── january (proxy)
                 │ JWT LiveKit (10 s, sala = canal)
                 ▼
            LiveKit (WebRTC) ◄── webhook assinado ── voice-ingress
   ═══════════════════ F4: cadeia de suprimento ═════════════════════════════
   npm (pnpm-lock) · crates · GitHub Actions · gitlink stoat.js @ 30b8505
```

F1 é a fronteira mais cara: um XSS que a atravesse sai do navegador e chega à
máquina. F2 é onde o XSS nasceria. Por isso os controles abaixo se concentram
em impedir o XSS (F2) e em limitar o que ele alcança se acontecer (F1 e token).

## 2. Ameaças e controles

Legenda da coluna "Verificação": **T** teste unitário, **L** lint, **E** E2E
Playwright, **CI** verificação no pipeline, **M** conferência manual.

### 2.1 XSS e renderização de conteúdo

| Ameaça | Estado atual (conferido) | Lacuna | Controle exigido na v1 | Verificação |
| --- | --- | --- | --- | --- |
| Script via markdown | `markdown/analisar.ts` traduz para árvore de domínio renderizada como elementos React. Não existe `dangerouslySetInnerHTML`, `innerHTML`, `rehype-raw`, `katex` nem `codeToHtml` em `src/` (grep vazio). HTML cru vira texto | Nenhuma regra de lint proíbe `dangerouslySetInnerHTML`; hoje a ausência é acidental | Portar o pipeline sem mudança. Lint `react/no-danger` e `no-restricted-properties` contra `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` nos três pacotes, sem exceção | L, T (os 32 testes de `markdown/` migram para o `nucleo`) |
| Link `javascript:`/`data:` | `hrefSeguro` aceita só `http:`, `https:` e `mailto:`, com `new URL` **sem base** (relativo vira texto) | Nenhuma | Manter; todo `href` vindo de dado passa por `hrefSeguro` (markdown, embed, bio, convite) | T |
| Imagem de markdown vazando IP | `![](url)` vira link, nunca `<img>` | Nenhuma | Manter | T |
| Texto do link mentindo sobre o destino | `list/AvisoDeLink.tsx` intercepta o clique simples e endurece quando o texto é uma URL diferente do destino; `noopener,noreferrer` | Embeds (`list/Embeds.tsx`) não passam pelo aviso, por decisão (o título vem do servidor) | Portar o aviso para o `app`; mesma regra para links em bio e recado | E |
| Miniatura de embed | `sdk/map.ts` usa `e.image?.url`, a URL **crua** do site, e não `proxiedURL` (`january`). A CSP (`img-src` sem `https:`) a bloqueia hoje | Se alguém abrir `img-src` para "consertar" a miniatura, cada mensagem com link passa a entregar o IP de quem lê ao site | Usar `proxiedURL` (via `january`, mesma origem); `img-src` continua sem `https:` | T (mapeamento), CI (teste que lê a CSP gerada) |
| Nome, bio, nome de cargo, recado | Renderizados como texto pelo React (escape automático) | Nenhuma | Proibir montar HTML a partir desses campos (coberto pelo lint acima) | L |
| Cor de cargo e cor de embed como vetor de CSS | `tema/cargo.ts` reconstrói o CSS a partir de números e hex validados; recusa `var()`, `url()`, `rgb()` no gradiente | Nenhuma | Portar com os testes; nunca passar a string `colour` crua para `style` | T |
| Iframe de atividade | `sandbox="allow-scripts"` sem `allow-same-origin`, servido de `/atividades/` com CSP própria por hash | Nenhuma na v1 (atividades não estão nas jornadas) | Se voltar, mesma regra | M |
| Clickjacking | CSP por `<meta>` não consegue `frame-ancestors` (comentário em `vite.config.ts`) | Depende do Caddy | Cabeçalho `Content-Security-Policy: frame-ancestors 'none'` (ou `X-Frame-Options: DENY`) no Caddy (pi-infra) | M, `curl -I` no checklist de deploy |

**CSP atual** (`client/packages/client/vite.config.ts`, plugin `cspDoVortex`,
injetada como `<meta>`): `default-src 'self'`; `script-src 'self'
'wasm-unsafe-eval'` em produção (só o dev server aceita `'unsafe-inline'`);
`style-src 'self' 'unsafe-inline'`; `img-src`/`media-src 'self' data: blob:` +
origem da API; `connect-src` derivado de `VITE_API_URL` (+ `ws(s)` e
`gifbox`); `frame-src 'self'`; `object-src 'none'`; `base-uri 'self'`;
`form-action 'self'`. O `app` novo herda o plugin **sem afrouxar nada**. A
fonte embarcada (`@fontsource`, ADR-006) cabe em `font-src 'self' data:`.

**Trusted Types.** Com zero sinks de HTML no código, `require-trusted-types-for
'script'` é viável e transforma o lint em garantia de runtime. O risco está em
dependências (Radix, LiveKit, TanStack) que toquem `innerHTML`. Recomendação em
§5.

### 2.2 Token de sessão

A decisão de guardar o token em `localStorage` **se mantém** (`store/sessao.ts`
registra o motivo: o protocolo entrega o token no corpo, cookie `httpOnly`
exige back-end próprio, `sessionStorage` perde a sessão por aba). O token vai
no cabeçalho `X-Session-Token` (stoat.js e `sdk/anexos.ts`), nunca em URL.

| Controle compensatório | Estado | Exigido na v1 | Verificação |
| --- | --- | --- | --- |
| Não haver XSS | §2.1 | Todo o §2.1 | L, T |
| CSP sem script inline em produção | existe | Teste de CI que lê o `index.html` construído e reprova `unsafe-inline`/`unsafe-eval` em `script-src` e `https:`/`*` em `img-src` | CI |
| Overlay sem acesso ao token | sessão própria em memória (`PARTICAO_DO_OVERLAY`), rede só para assets (`privilegioModelo.ts`) | Manter; a janela destacada (§2.3) também não pode ter preload | T (já existe) |
| Revogação | Dispositivos (jornada 4.6): listar, derrubar, derrubar os outros | E2E: derrubar outra sessão faz ela cair no próximo pedido | E |
| Sair limpa tudo | `sair` existe | `sair` revoga a sessão no servidor **e** apaga a chave local, mesmo com rede caída (apaga local primeiro) | T |
| Token nunca em log, URL ou mensagem de erro | não verificado | Teste que procura o padrão do token na saída de `console` durante o E2E da 4.1; avisos tipados (ADR-009) não carregam o token | E |
| Rotação | o protocolo não rotaciona; o token vale até ser derrubado | Fora da v1 (§4) | — |

### 2.3 Electron

**Estado conferido.**

| Item | Fato | Arquivo |
| --- | --- | --- |
| Janela principal | `contextIsolation: true`, `nodeIntegration: false`, **sem `sandbox` explícito** (o Electron 44 já liga por padrão quando não há `nodeIntegration`) | `native/window.ts` |
| Overlay | `sandbox: true`, preload próprio (`preloadDoOverlay.js`), sessão em memória, rede só para assets, nenhuma permissão, nenhuma navegação nem janela nova | `native/overlay.ts`, `native/privilegioModelo.ts` |
| Navegação | `will-navigate` só aceita a origem de `BUILD_URL`; `setWindowOpenHandler` sempre devolve `deny` e manda `http/https/mailto` para o navegador do sistema | `main.ts`, `privilegioModelo.ts` |
| IPC | Um registro único (`native/registroDeIpc.ts`); cada canal declara `quem`, `validar` e `executar`. Quatro portões: janela com papel, frame principal, origem do app e payload validado. Um teste reprova `ipcMain` fora do registro | `registroDeIpcModelo.ts` (+ teste) |
| Preload | Pontes estreitas: `native`, `desktopConfig`, `vortexTela`, `vortexAudioDeJanela`, `vortexControles`, `vortexNotificacoes`, `vortexOverlay`, `vortexReinicio`, `vortexAtenuacao`, `vortex`. Nenhuma devolve objeto do Electron nem registra callback do renderer direto no `ipcRenderer` | `world/window.ts`, `world/config.ts` |
| Seletor de tela | `setDisplayMediaRequestHandler` recusa sem uma escolha "armada" por `telaEscolher`; `id` validado por regex `^(screen|window):`; janela nunca leva `loopback` | `native/telaCompartilhada.ts` |
| Permissões da sessão principal | **Nenhum `setPermissionRequestHandler`/`setPermissionCheckHandler` na `defaultSession`**; o padrão do Electron concede tudo (microfone, câmera, notificação, geolocalização) | grep em `src/` |
| Atalhos globais | `uiohook-napi` no main; o renderer cadastra combinações e recebe só o comando, nunca teclas | `native/controles.ts` |
| Fuses | `RunAsNode` off, `NodeOptions` off, `NodeCliInspect` off, `EmbeddedAsarIntegrityValidation` on, `OnlyLoadAppFromAsar` on, cookie criptografado | `forge.config.ts` |
| Atualização | `update-electron-app` → `update.electronjs.org` → GitHub Releases públicas; Windows via Squirrel; **assinatura opcional** (sem certificado o pacote sai sem assinatura); Linux via Flatpak | `native/atualizacao.ts`, `forge.config.ts` |
| Origem carregada | `VORTEX_APP_URL` no build, ou `--force-server` na linha de comando, **também em build empacotado** | `native/enderecoDoApp.ts` |

**Controles da v1.**

| Ameaça | Lacuna | Controle | Verificação |
| --- | --- | --- | --- |
| Renderer comprometido escapa | `sandbox` implícito | `sandbox: true` explícito na principal e em toda janela nova; teste de modelo que reprova `BrowserWindow` sem os três campos | T |
| XSS liga microfone ou câmera sem aviso | Sessão principal concede tudo | `setPermissionRequestHandler` e `setPermissionCheckHandler` na `defaultSession` com lista fechada: `media` (só da origem do app e só do frame principal), `notifications`, `fullscreen`, `clipboard-sanitized-write`, `display-capture`. O resto é negado (`geolocation`, `midi*`, `hid`, `serial`, `usb`, `openExternal`, `idle-detection`…). Decisão em função pura com teste, como `privilegioModelo.ts` | T, E (4.3 no Electron) |
| Janela destacada (ADR-005) vira porta dos fundos | Hoje `setWindowOpenHandler` nega tudo; o TRD precisa abrir uma exceção | Exceção estreita: só `url === "about:blank"` **e** `frameName === "vortex-destacada"` **e** remetente = frame principal da janela principal; no máximo uma por vez (a segunda pedida foca a existente). `overrideBrowserWindowOptions`: `frame: false`, `parent` = principal (fecha junto), `webPreferences` com `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` e **sem preload** (a filha de `window.open` herda o preload da mãe se não for sobrescrito). Na filha: `will-navigate` e `will-frame-navigate` negam tudo, `setWindowOpenHandler` nega tudo. Ela não recebe papel no registro de IPC, então nenhum canal a aceita | T (modelo da decisão), E (spike do M2 e E2E 4.3) |
| Canal `alwaysOnTop` abusado | Canal novo | Canal `vortexDestacadaNoTopo`, `via: "invoke"`, `quem: ["principal"]`, validador aceita só `boolean`; age só sobre a janela registrada como destacada e só com o nível normal (decisão nº 3 do TRD: sem `screen-saver` na v1); sem janela destacada é no-op | T |
| Navegação para fora da origem | Coberto | Manter; estender o teste para `will-frame-navigate` na principal | T |
| `--force-server` entrega a ponte a outra origem | Vale em build empacotado | Ver §5 (o endereço de pré-visualização depende disso) | T |
| Atualização adulterada | Squirrel sem assinatura confia só no HTTPS e na conta do GitHub | Assinatura Authenticode obrigatória no build de release do Windows (o job falha sem certificado); Flatpak com hash publicado. Ver §5 | CI |
| Hook global de teclado vira keylogger | Só comando atravessa | Manter; teste de que `vortexComandoDeVoz` nunca carrega código de tecla | T |
| Captura de tela sem consentimento | Só com escolha armada pelo seletor | Manter; o seletor do app é a única entrada; o E2E da 4.3 confirma que `getDisplayMedia` sem escolha rejeita | T, E |

### 2.4 Voz e tela

| Ameaça | Estado (conferido) | Controle v1 | Verificação |
| --- | --- | --- | --- |
| Entrar em sala sem permissão | `voice_join.rs` exige `Connect`; teto de pessoas respeitado salvo `ManageChannel` | Manter; a interface não renderiza "Entrar" sem `Connect` (PRD 4.2) | E |
| Token LiveKit reaproveitado | `voice_client.rs`: JWT com TTL de **10 s**, `room` = id do canal, `identity` = id do usuário, `can_publish_sources` limitado pelas permissões, `can_subscribe` = `Listen`, `can_publish_data: false` | O cliente nunca guarda nem registra o token; usa uma vez em `connect` | T, M |
| Quem assina o quê | Toda faixa da sala pode ser assinada por qualquer participante com `Listen`; não há ACL por faixa | Aceito: estar na sala é o consentimento do grupo. A visão das salas mostra quem está dentro (PRD 4.2) | E |
| Permissão retirada no meio da chamada | `member_edit.rs`, `roles_edit.rs`, `permissions_set*.rs`, `member_remove.rs` e `ban_create.rs` tocam o estado de voz | E2E da 4.7: expulsar remove da sala e a transmissão some em ≤ 2 s | E |
| Webhook forjado | `voice-ingress` valida com `WebhookReceiver` e `TokenVerifier` | Manter | M |
| Transmitir a tela errada | Seletor próprio com miniaturas; janela sem `loopback` | Indicador "ao vivo" sempre visível enquanto transmite; parar a partir da cápsula; pausa (PRD 4.3) | E |
| Overlay e janela destacada vazando conteúdo | O overlay desenha nomes, quem fala e mensagens por cima do jogo; se a pessoa compartilha a **tela inteira**, tudo isso entra na transmissão. Não há `setContentProtection` | Ver §5. Mínimo da v1: o overlay não mostra conteúdo de DM | M |
| Fantasma após sair | Não há rota de saída; o servidor espera o webhook | Ver §2.6 | E |

### 2.5 Arquivos e anexos

| Ameaça | Estado (conferido) | Controle v1 | Verificação |
| --- | --- | --- | --- |
| SVG/HTML executando na origem do app | `autumn` (`api.rs`) serve o **original** com `Content-Disposition: attachment` e a miniatura como `image/webp` `inline`. O tipo é inferido por assinatura; texto com `.svg` vira `image/svg+xml` | Original nunca renderizado como documento: o app mostra imagem só por `<img>` (SVG em `<img>` não executa script) e abre o original por download (`sdk/baixar.ts`). Pedir ao Caddy `X-Content-Type-Options: nosniff` e `Content-Security-Policy: sandbox` nas rotas do autumn (pi-infra) | M, `curl -I` |
| Download automático | `baixar.ts` só baixa no clique | Manter; nenhum anexo é buscado sem a linha estar visível (`loading="lazy"`) | E |
| Executável disfarçado | `.exe`/`.apk` com tipo forçado no servidor | O cartão de arquivo mostra nome e extensão reais; nada é aberto pelo app, só salvo | E |
| IP de quem lê vazando para terceiros | Mídia vem do autumn (mesma origem); embed deveria vir do january | `proxiedURL` no embed (§2.1) | T |
| Upload enorme ou tipo proibido | `tetoDeUploadTexto` lê o limite do servidor; o autumn impõe | Mostrar erro traduzido; o servidor é a autoridade | E |

### 2.6 Rota nova `leave_call` (ADR-002)

`POST /channels/{target}/leave_call` ainda não existe (grep vazio em
`server/crates`). Requisitos de segurança para ela:

| Requisito | Por quê | Verificação |
| --- | --- | --- |
| Autenticada pelo guard `User` do Rocket, como `voice_join.rs` | Sem sessão, `401` | Teste Rust |
| Age **só sobre o próprio usuário**: sem corpo e sem parâmetro de usuário | Ninguém derruba outra pessoa por ela; derrubar alguém é moderação, com permissão própria | Teste Rust: dois usuários na sala, A chama, B continua |
| Idempotente: ausente → `204`, sem vazar se o canal existe para quem não pode vê-lo | Canal invisível responde como `NotFound`, igual ao resto da API | Teste Rust |
| Não exige `Connect` | Quem perdeu a permissão ainda precisa conseguir sair | Teste Rust |
| Bucket de rate limit `channels` (15) já cobre | Evita laço de entra-e-sai gerando eventos | M |
| O evento `VoiceChannelLeave` publicado só no canal afetado | Não anunciar presença de voz fora de quem vê o canal | Teste Rust |
| O cliente desconecta do LiveKit mesmo com a rota falhando | Falha da rota não pode deixar o microfone aberto | T (`sairDaChamada`) |

### 2.7 Autenticação e limites

A 4.1 usa só rotas existentes do `delta`, que limita por balde
(`util/ratelimits.rs`: `auth` 15, `channels` 15, `servers` 5). Requisito: o
balde `auth` precisa ver o IP real atrás do Caddy; contando o IP do proxy, o
limite vira um só para todos e não contém força bruta (pi-infra: proxy
confiável e cabeçalho encaminhado).

### 2.8 Cadeia de suprimento e CI

| Item | Estado (conferido) | Controle v1 | Verificação |
| --- | --- | --- | --- |
| Lockfile | `client/pnpm-lock.yaml`; o `Dockerfile` usa `pnpm install --frozen-lockfile` | Mesmo no `app` e no `nucleo`; CI falha se o lock mudar sem o `package.json` | CI |
| Scripts de instalação | `allowBuilds: { esbuild: true }` em `pnpm-workspace.yaml` | Lista mantida explícita; dependência nova com build script exige justificativa no PR | CI, M |
| Dependência nova | regra do projeto: justificativa | Lucide, `@fontsource-variable/*`, Turborepo, Playwright entram no ADR que as decide | M |
| Gitlink `stoat.js` | aponta para o upstream `stoatchat/javascript-client-sdk` @ `30b8505` | Mudar o gitlink só em PR próprio, com o diff do SDK lido | M |
| Actions | Imagens do cliente e do servidor: actions fixadas por SHA, `permissions` por job (`contents: read`, `packages: write`). **`vortex-desktop.yml` usa `@v7` sem SHA** num job com `contents: write` e com os segredos do certificado | Fixar por SHA no workflow do desktop; Renovate (`renovate.json` já existe) atualiza os SHAs | CI (grep que reprova `uses: …@v` sem SHA) |
| Proveniência | `provenance: false` nas duas imagens | Ver §5 | — |
| Segredos | `GITHUB_TOKEN`, `CI_APP_*` (token de app), `WINDOWS_CERTIFICATE_*`; deploy key só-leitura do `pi-infra` para o E2E (TRD §9) | Nenhum segredo em job disparado por `pull_request` de fork; nada de `pull_request_target` | CI |

### 2.9 Privacidade

| Item | Estado | v1 |
| --- | --- | --- |
| Telemetria | Nenhuma (grep sem Sentry, PostHog, analytics) | Continua sem. Erros ficam no console local e no log da casca (`vortexAbrirPastaDeLogs`) |
| Logs da casca | `config` registra a configuração recebida (`console.info`) | Nunca registrar token, mensagem nem título de janela das fontes de tela |
| Endereço de pré-visualização | Decidido no TRD §12 nº 1 (subdomínio privado a partir do M4) | O nome aparece nos logs públicos de certificado (Certificate Transparency); "privado" só por obscuridade. Ver §5. Origem diferente = `localStorage` separado, então é preciso entrar de novo lá, e o token fica num segundo lugar |

## 3. Requisitos de segurança da v1 (definição de pronto)

Cada item tem um verificador. A v1 não sai sem todos.

1. Nenhum `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`,
   `insertAdjacentHTML`, `document.write`, `eval` ou `new Function` em
   `app`, `nucleo` e na casca: lint que reprova.
2. Todo `href`/`src` derivado de dado passa por `hrefSeguro` ou é URL de mídia
   da própria instância; teste do mapeamento de mensagem, embed e perfil.
3. Miniatura de embed usa `proxiedURL`; teste em `sdk/map`.
4. O `index.html` construído do `app` tem a CSP do `cspDoVortex` e um teste de
   CI reprova `unsafe-inline`/`unsafe-eval` em `script-src` e `https:`/`*` em
   `img-src`, `media-src` e `connect-src`.
5. Os 32 testes de `markdown/` e os de `tema/cargo.ts` passam no `nucleo`
   (inclusive os verificados por mutação).
6. `AvisoDeLink` portado; E2E da 4.4 clica num link cujo texto é outra URL e
   confirma o aviso endurecido.
7. `sair` apaga a chave local e revoga no servidor; teste unitário com rede
   caída.
8. E2E da 4.6 derruba outra sessão e ela cai no pedido seguinte.
9. Nenhum token aparece no console durante o E2E da 4.1 (padrão procurado na
   saída capturada).
10. Janela principal com `sandbox: true` explícito; teste de modelo que
    reprova `BrowserWindow` sem `sandbox`, `contextIsolation` e
    `nodeIntegration: false`.
11. `setPermissionRequestHandler` e `setPermissionCheckHandler` na
    `defaultSession` com lista fechada, em função pura testada.
12. Exceção do `setWindowOpenHandler` para a janela destacada exatamente como
    em §2.3 (about:blank + nome + frame principal + uma por vez + sem preload +
    sandbox + navegação negada); teste de modelo e E2E da 4.3 no Electron.
13. Canal `vortexDestacadaNoTopo` no registro com `quem: ["principal"]` e
    validador booleano; teste de recusa por janela, frame, origem e payload.
14. `ipcMain` só dentro do registro (teste atual mantido) e todo canal novo com
    validador não trivial quando recebe argumento.
15. Rota `leave_call`: autenticada, só o próprio usuário, idempotente, não
    exige `Connect`, sem oráculo de existência de canal; testes Rust dos cinco
    pontos.
16. `sairDaChamada` desconecta o LiveKit mesmo quando a rota falha; teste no
    `nucleo`.
17. E2E da 4.7: membro expulso sai da sala e a transmissão dele some em ≤ 2 s.
18. Actions de todos os workflows fixadas por SHA; verificação no CI.
19. Release do desktop para Windows assinada (o job falha sem certificado),
    conforme a decisão em §5.
20. Cabeçalhos no Caddy conferidos com `curl -I` no checklist de deploy
    (pi-infra): `frame-ancestors 'none'`, `nosniff`, HSTS, e `sandbox` nas
    rotas do autumn.
21. Revisão humana de segurança no PR que toca `world/*.ts`,
    `registroDeIpc*`, `privilegioModelo.ts`, `cspDoVortex` ou `hrefSeguro`
    (CODEOWNERS).

## 4. Fora da v1 (riscos aceitos)

| Risco | Por que se aceita |
| --- | --- |
| Token em `localStorage` e sem rotação | Decisão registrada; o protocolo entrega token no corpo e não rotaciona. Compensado pelo §2.2. Reabrir se o Vortex sair do uso privado |
| Sem TOTP; MFA só senha ou código de recuperação | Decisão de produto (PRD §5). Recuperação continua como saída de quem ativou TOTP em outro cliente |
| Sem captcha | Instância privada; com captcha ligado no servidor, criar conta e recuperar senha falham (já documentado) |
| `style-src 'unsafe-inline'` | Os atributos `style` (gradiente, cor de cargo) não existem sem ele; injeção de estilo desfigura mas não rouba token. `script-src` continua fechado |
| Qualquer participante da sala assina qualquer faixa | É o modelo do produto: estar na sala é ver |
| Token LiveKit vale a sessão inteira depois de conectar | O TTL de 10 s cobre só a entrada; mudança de permissão no meio da chamada é aplicada pelo servidor (§2.4) |
| Acesso "só assistir" | Primeira onda depois da v1; muda o modelo de assinatura e terá seção própria |

> **Decisões da §5 fechadas em 2026-10-07: todas as recomendações aprovadas**
> (assinatura obrigatória no Windows; lista fechada de origens no lugar do
> `--force-server`; autenticação básica na pré-visualização, desligada no
> cutover; Trusted Types em relatório no M1 e bloqueando após os E2E;
> `setContentProtection` no overlay e na janela destacada; proveniência das
> imagens e digest fixo no pi-infra).

## 5. Decisões para o dono

1. **Assinatura do instalador e da atualização no Windows.** Hoje é opcional,
   e uma release sem assinatura é aceita pelo Squirrel; quem controlar a conta
   do GitHub ou o workflow entrega código para todas as máquinas do grupo.
   *Recomendo* tornar a assinatura obrigatória no job de release (certificado
   de assinatura de código; o custo anual é o preço) e, enquanto ele não
   existir, proteger a branch e as tags de release e exigir 2FA na
   organização.
2. **`--force-server` em build empacotado.** Ele entrega a ponte inteira do
   Electron a qualquer origem passada na linha de comando, e o endereço de
   pré-visualização (TRD §12 nº 1) precisa de algo parecido. *Recomendo* trocar
   o argumento livre por uma lista fechada no build (produção e o subdomínio de
   pré-visualização), e manter o livre só quando `!app.isPackaged`.
3. **Endereço de pré-visualização.** Ele aparece nos logs de certificado e
   fala com a mesma API de produção. *Recomendo* autenticação básica ou lista
   de IPs no Caddy para esse subdomínio enquanto ele existir, e desligá-lo no
   dia do cutover.
4. **Trusted Types.** *Recomendo* ligar `require-trusted-types-for 'script'`
   no M1, em modo report-only até o E2E das sete jornadas passar sem violação,
   e então em modo de bloqueio. Se alguma dependência (Radix, LiveKit) violar
   e não tiver contorno, fica só o lint.
5. **Proteção contra captura no overlay e na janela destacada.**
   `setContentProtection(true)` tira a janela da captura de tela no Windows,
   evitando que nomes, quem fala e mensagens vazem quando alguém compartilha a
   tela inteira; o custo é a pessoa não conseguir transmitir essas janelas de
   propósito. *Recomendo* ligar no overlay e na janela destacada, e não na
   principal.
6. **Proveniência das imagens.** `provenance: false` nas imagens do cliente e
   do servidor. *Recomendo* ligar a atestação (`attest-build-provenance`) e
   fazer o `pi-infra` fixar as imagens por digest em vez de tag. O custo é uma
   linha no workflow e outra no compose.
