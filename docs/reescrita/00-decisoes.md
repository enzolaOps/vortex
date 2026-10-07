# Reescrita da interface — decisões de partida

> Saída da sessão de interrogatório de 2026-10-06. Fonte para o PRD e os
> documentos seguintes. Cada decisão aqui foi aprovada pelo dono do produto.

## Por que reescrever

A interface atual não tem identidade própria e tem telas que prometem mais do
que entregam. A auditoria de 2026-10-06 mostrou que a causa é **falta de
decisão de produto por superfície**, não a stack nem a camada de lógica:

- texto interno de engenharia e design vazando para o usuário (Aparência,
  Avançado, Privacidade, Membros, Convites, Emojis)
- componente reaproveitado sem contexto (DM com cabeçalho vazio e
  "Buscar em #undefined", "começo do canal" numa DM, coluna de membros falando
  de servidor na casa, vazio de "Próximos" falando de eventos passados)
- estados contraditórios (a própria mensagem marcada como nova, "conexão
  ótima" junto de "não deu para entrar na chamada", dois itens ativos na
  coluna, registro de pendências desatualizado)
- visual pela metade (anel de foco duplicado, rótulos com caixa
  inconsistente, emoji como ícone, tema claro incompleto, cabeçalho cortado)
- promessa sem entrega (push no celular sem app de celular; a "sala de voz
  como lugar" abre um chat vazio)
- posicionamento indeciso ("para times" no login, modelos de jogos/estudo)

## Produto

- **Para quem:** o grupo do dono — jogam e trabalham juntos, sessões de 10h+.
  O projeto nasceu do bloqueio de compartilhamento de tela no Discord.
- **Tese:** voz e tela no centro da interface; chat como apoio.
- Abrir um servidor mostra a **última sala em que a pessoa esteve,
  expandida** (revisado na rodada de design: a grade de cartões de salas foi
  rejeitada). A lista lateral de salas mostra sempre a contagem de pessoas.
- Feedback de estilo do dono (rodada 1 de design, todas as três direções
  rejeitadas): parecia site, não app; barra de cima amontoada; texto demais,
  avatar de menos. Quer: funcional, sofisticado, intuitivo, pouca informação
  de uma vez; coluna de servidores à esquerda (com variações); referências
  Spotify, Discord, liquid glass.
- **Estrutura aprovada nas rodadas 2–5 de design** (canvas "Vortex — três
  direções visuais", artboard `Estrutura3B3`): dock de servidores flutuante à
  esquerda, lista de salas flutuante com contagem e avatares, **chat ocupando
  toda a área principal** (texto em medida de leitura) — dá para conversar
  sem entrar na voz — e a **sala vira um widget flutuante**: minimizado num
  canto, expande ao passar o mouse, pode ser preso em qualquer canto, nunca
  cobre o campo de escrever. Barra de título só com nome e botões da janela.
  Lista de membros online (rodada 6): **gaveta à direita agrupada por cargo,
  que minimiza para só os ícones, ainda divididos por cargo.**
  Na voz (revisado): o **palco ocupa a tela inteira** — sem gaveta de
  membros e sem coluna de chat; a lista de salas recolhe para uma tira que
  abre ao passar o mouse. Ao abrir um canal de texto durante a chamada, o
  canal ocupa a tela e a chamada vira um **widget com prévia da transmissão**
  e controles mínimos, com "voltar ao palco". O widget da sala vira uma
  **cápsula de controle minimalista** —
  microfone, câmera, compartilhar tela e sair; o resto (participantes,
  ensurdecer, qualidade) aparece ao passar o mouse.
- **Estilo aprovado (rodada 9): "Vidro" — liquid glass.** Fundo #0A0C14 com
  campos de cor desfocados (azul-petróleo, índigo, magenta) atrás de painéis
  translúcidos (blur + saturação, borda clara fina, reflexo no topo). Acento
  lavanda #A99BFF; ao vivo #FF5C7A; falando menta #5EE6D0; fonte Plus
  Jakarta Sans. Referência: artboard `EstiloVidro` do canvas. O palco fica
  em superfície neutra para não tingir o vídeo.
- **Design system v1 publicado** (2026-10-07): artefato "Vortex"
  (https://claude.ai/artifact/AonTvFPYv3ekcQo6tZpfrq) — 83 tokens no tema
  `vidro`, todos os pares de contraste passando sem exceção; `danger`
  (#ff7d5c) separado de `live` (#ff5c7a); marca nova (três braços convergindo
  num núcleo quadrado = a tela); 12 componentes. Canvas das rodadas:
  https://claude.ai/artifact/YShrjG98F9sRGBWNBTtvbq.
- **Telas das 7 jornadas da v1** (2026-10-07), 33 artboards em 7 páginas, no
  canvas "Vortex v1 — telas das jornadas":
  https://claude.ai/artifact/Cqgf56xbbD867sqjTbv5Sh. Em revisão.
- Entrar numa sala leva ao **palco**, com o chat da sala ao lado (no
  protocolo, canal de voz já é canal de texto com voz).
- Canal só de texto continua existindo, secundário na navegação.
- Assistir telas: foco + miniaturas por padrão, grade opcional, **PiP
  obrigatório** ao sair da sala.
- **Sucesso:** identidade própria (não se confunde com Discord) + toda tela
  completa de ponta a ponta. Paridade com o que a API oferece é desejável,
  nunca às custas de tela incompleta.

## Escopo

- **v1** (critério: passar um dia inteiro no app novo sem abrir o velho):
  login e sessão · servidores e salas · voz e tela com palco e PiP · chat
  completo (mensagem, resposta, reação, anexo, markdown) · DMs e amigos ·
  configurações essenciais (perfil, conta, dispositivos, voz e vídeo,
  aparência) · administração básica (canais, convites, cargos, moderação).
- **Ondas seguintes:** eventos, fórum, tópicos, enquete, figurinhas e efeitos
  sonoros, administração avançada, mais temas.
- **Troca:** o grupo migra quando a v1 estiver completa; o app velho sai do
  ar no mesmo dia. Preferências locais começam do zero.
- O app velho fica no ar **congelado** até lá — nem correção de bug.

## Design

- Claude Design, **design system primeiro**, um oráculo só, todos os estados
  desenhados (vazio, erro, carregando, sem permissão). Valores do design
  system precisam bater com os mockups.
- Nada do design atual, da referência `Teste` nem do Foundations antigo entra
  como fonte.
- Nome **Vortex** fica; a marca é redesenhada junto com o design system.
- v1 só tema escuro, sobre arquitetura de **N temas nomeados** (vários temas
  depois). O seletor de paleta personalizada é um tema a mais. Todo tema passa
  pela mesma validação de contraste.
- **Contraste mínimo sem exceções** (4,5:1 texto; 3:1 borda e texto grande).
- **Layout fixo.** Slots, presets de layout e reordenação de colunas saem.

## Engenharia

- Interface do zero em **pacote novo no mesmo monorepo**.
- Lógica (`sdk`, `store`, `lib`, `markdown`, `tema`, `notificacao`, `rota`,
  `som` e arquivos de lógica soltos — ~44k linhas, ~120 arquivos de teste)
  vira **pacote compartilhado**. A extração é o **primeiro PR**, verificada
  contra o app atual. Cinco arquivos de lógica moram em pastas de interface
  (`components/ui/toastStore.ts`, `voz/processamento.ts`, `voz/ruidoForte.ts`,
  `busca/filtros.ts`, `overlay/modelo.ts`) e mudam de lugar.
- Stack mantida: React + React Compiler, Radix, Tailwind v4 sobre tokens em
  CSS, TanStack Virtual.
- Leis 1–5 do briefing atual valem; **lei 6 (componente movível) cai** com o
  layout fixo. Gate do firehose continua gate de merge.
- Casca Electron mantida; interface nova roda nela.
- Back-end (`api`, `events`) pode mudar quando uma jornada exigir, com ADR.
- **Miniatura ao vivo fora da sala NÃO entra na v1:** não existe acesso ao
  LiveKit sem entrar na chamada. A visão das salas mostra quem transmite e o
  quê, com selo; a imagem aparece ao entrar. Acesso "só assistir" (back-end)
  é a primeira onda depois da v1.
- **Rota de saída de sala ENTRA na v1** (mudança no `api`, com ADR): sem ela
  o servidor só percebe a saída quando a conexão cai, e a visão das salas
  mostraria gente que já saiu.

## Qualidade e processo

- **Tela completa** = jornada escrita · estados de vazio, erro, carregando e
  sem permissão · funciona contra back-end real · nenhum controle inerte (não
  existe registro de pendências) · texto revisado para quem usa · teste E2E
  da jornada.
- Todo texto visível centralizado num lugar, com teste reprovando jargão
  interno. Português na v1.
- Turborepo com cache; Vitest só nos afetados no ciclo local; Playwright para
  jornadas; testes de navegador para invariantes de layout. Suíte atual: 26 s
  para 1.237 testes; quase todo o tempo é jsdom por arquivo.
- Agentes: uma jornada por agente em worktree próprio, no máximo três tarefas,
  teste escrito junto com a tela. Orquestração por modelo: Opus decide,
  Sonnet implementa, Haiku faz o mecânico.

## Documentação

`docs/` no repositório, nesta ordem, cada um aprovado antes do próximo:
**PRD → design (Claude Design, com link) → arquitetura e TRD → segurança.**
Decisões pontuais viram ADRs curtos. O `CLAUDE.md` novo é curto e aponta para
os documentos; histórico e medições moram fora dele.
