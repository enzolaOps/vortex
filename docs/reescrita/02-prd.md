# Vortex v1 — PRD da reescrita da interface

> Fonte: `00-decisoes.md` (decisões aprovadas, não reabertas aqui) e
> `01-inventario-da-logica.md` (o que a camada de lógica já entrega). Caminhos
> de arquivo são relativos a `client/packages/client/src`, que vira o pacote
> compartilhado no primeiro PR.

## 1. Problema e tese

**Problema.** O grupo saiu do Discord porque o compartilhamento de tela foi
bloqueado. O Vortex atual resolveu o transporte (voz e tela funcionam), mas
tem a cara de um Discord genérico e, pior, telas que prometem mais do que
entregam. A auditoria de 2026-10-06 achou a mesma causa em todos os
defeitos: superfície construída sem decisão de produto. Daí o jargão interno
na tela, o componente reaproveitado fora de contexto ("Buscar em
#undefined"), os estados que se contradizem ("conexão ótima" ao lado de "não
deu para entrar na chamada") e a "sala de voz como lugar" que abre um chat
vazio.

**Tese.** No Vortex, voz e tela ficam no centro da interface e o chat é apoio.
Na prática, a diferença para o Discord é esta:

- Abrir um servidor mostra a **visão das salas**, e não um canal de texto:
  quem está em cada sala, quem está transmitindo e o quê, com entrada em um
  clique.
- Entrar numa sala abre o **palco**: as transmissões em foco e o chat da sala
  ao lado. O chat pertence à sala, porque no protocolo o canal de voz já é um
  canal de texto com voz.
- Sair do palco para ler outro canal não derruba a tela que você assiste: ela
  segue em **PiP**, sempre.
- Canal só de texto continua existindo, mas fica em segundo plano na
  navegação.

Sucesso significa uma identidade que não se confunde com o Discord e todas as
telas completas de ponta a ponta. Paridade com a API é desejável, mas nunca
vale uma tela incompleta.

## 2. Quem usa e contexto de uso

- **Quem:** o grupo do dono, um conjunto pequeno e fechado de amigos numa
  instância privada. Todos se conhecem e convidam uns aos outros.
- **Como:** sessões de 10h ou mais, misturando jogo e trabalho. O app fica
  aberto o dia todo. Na maior parte do tempo alguém está numa sala, uma ou
  mais telas estão sendo transmitidas e o chat corre ao lado.
- **Onde:** desktop (casca Electron) e web, com a mesma interface. Telas de
  laptop até ultrawide. Celular não é plataforma.
- **Implicações:** a densidade e o baixo ruído visual valem mais que o impacto.
  O estado de voz precisa ser confiável, porque a pessoa decide entrar numa
  sala pelo que vê nela. Uma sessão longa transforma qualquer vazamento ou
  estado preso em defeito visível.

## 3. Princípios de produto

Cada princípio vem de uma falha da auditoria e precisa ser verificável.

1. **Nenhum controle sem função.** Tudo que recebe foco ou clique faz o que
   diz contra o back-end real. Não existe registro de pendências nem toast de
   "em breve". *Teste:* o E2E de cada jornada aciona todos os controles da
   tela e verifica o efeito.
2. **Texto escrito para quem usa.** Todo texto visível fica num único lugar,
   em português, e um teste reprova jargão interno (nome de token, de store,
   de fase, "protocolo", "adapter" etc.). *Teste:* lista de termos proibidos
   rodando sobre o catálogo de textos.
3. **Cada superfície sabe onde está.** Um componente reaproveitado recebe o
   contexto de forma explícita: DM não fala de servidor nem de "começo do
   canal", e a casa não mostra a coluna de membros. *Teste:* cada E2E de
   jornada confere o cabeçalho e o vazio do contexto em que está.
4. **Um estado, uma verdade.** A tela nunca afirma duas coisas incompatíveis.
   Só um item ativo por coluna, a qualidade de conexão nunca aparece junto de
   uma falha de entrada, e a própria mensagem nunca conta como nova.
   *Teste:* asserções de exclusão mútua nos E2E.
5. **Todo estado desenhado.** Vazio, carregando, erro e sem permissão existem
   no design antes da implementação. Ação sem permissão não é renderizada.
   *Teste:* o E2E força cada estado em toda tela.
6. **Não prometer o que não entrega.** Nada de push sem app de celular, de
   miniatura de transmissão que não existe ou de posicionamento ("para
   times") que não é o produto. *Teste:* revisão de texto antes do merge.
7. **Contraste sem exceção.** Mínimo de 4,5:1 para texto e 3:1 para borda e
   texto grande, em todo tema e sem lista de exceções. *Teste:* a validação de
   contraste de `tema/` reprova o build.

## 4. Jornadas da v1

Critério geral de "tela completa": jornada escrita, os quatro estados
desenhados, funcionamento contra back-end real, nenhum controle inerte, texto
revisado e E2E Playwright da jornada.

### 4.1 Entrar e manter a sessão

- **Objetivo:** entrar uma vez e continuar dentro por dias.
- **Entrada:** abrir o app sem sessão, um link de convite, de verificação ou
  de redefinição, ou o código QR.
- **Passos:** e-mail e senha → MFA por senha ou código de recuperação, quando
  houver → escolher nome no primeiro acesso → shell. Também cobre criar conta,
  verificar e-mail, reenviar, recuperar e redefinir senha.
- **Estados:** *carregando* enquanto restaura a sessão (sem piscar a tela de
  login); *erro* com motivo traduzido para credencial, rede, limite e conta
  desativada; *sem permissão* para conta desativada, que tem tela própria; o
  *vazio* não se aplica.
- **Completa quando:** o E2E entra, recarrega e continua dentro; sai e volta
  ao login; abre um link de convite sem sessão, entra e cai no servidor do
  convite.
- **Lógica:** `sdk/autenticacao.ts` (`entrar`, `responderMfa`,
  `restaurarSessao`, `sair`, `ligarLogoutDoServidor`, `concluirEntradaPorQr`),
  `sdk/conta.ts` (`criarConta`, `verificarEmail`, `escolherNome`,
  `pedirRedefinicao`, `confirmarRedefinicao`). Back-end: nenhum.

### 4.2 Chegar ao servidor e ver quem está onde

- **Objetivo:** saber, sem entrar em nada, onde o grupo está e o que está
  sendo mostrado, e então ir para lá.
- **Entrada:** escolher o servidor no rail, abrir o app (que leva ao último
  servidor; ver Perguntas abertas) ou seguir um convite.
- **Passos:**
  1. A visão das salas ocupa a área principal. Cada sala de voz mostra seu
     nome, as pessoas dentro dela (avatar, nome, mudo ou surdo, câmera) e quem
     transmite tela, com um selo e o rótulo do que é transmitido.
  2. A pessoa identifica a sala em que quer estar.
  3. Um clique entra na sala (jornada 4.3).
  4. Os canais só de texto ficam acessíveis num lugar secundário da
     navegação.
- **O que a visão NÃO mostra na v1:** a imagem da transmissão. Não há acesso
  ao LiveKit sem entrar na chamada. O selo diz quem transmite, e a imagem
  aparece ao entrar.
- **Estados:** *vazio* com servidor sem salas (convite para criar uma, se a
  pessoa puder) ou com todas as salas vazias (as salas aparecem normalmente,
  sem gente, sem tom de erro); *carregando* com o esqueleto das salas até o
  Ready; *erro* quando a conexão caiu, com aviso de que a presença pode estar
  desatualizada e sem afirmar quem está onde; *sem permissão* quando a pessoa
  não pode conectar numa sala visível, que aparece sem a ação de entrar.
- **Completa quando:** com duas contas de teste, A entra numa sala e começa a
  transmitir, e B, na visão das salas, vê A na sala certa e com o selo em até
  2 s. A sai pela interface e some da visão de B em até 2 s, sem esperar o
  socket cair.
- **Lógica:** stores de servidores, canais e voz, `vozPorCanal` (de
  `voice_states` no Ready, com flags de tela, câmera, mudo e surdo, via
  `sdk/adapter.ts` e `store/hooks.ts`), `pode(canal, ação)`.
- **Back-end:** **rota de saída de sala no `api`, com ADR** (decidido). Sem
  ela, quem sai continua "fantasma" até o socket cair, e esta tela mente.
  Também precisa de robustez na leitura de eventos de voz, porque o stoat.js
  não emite evento e o adapter observa o `ReactiveMap` (ver Riscos).

### 4.3 Entrar na sala, assistir e transmitir, e sair para ler sem perder a tela

- **Objetivo:** estar junto: falar, ver a tela de quem transmite, mostrar a
  própria, e conseguir ler outro canal sem perder a tela que se assiste.
- **Entrada:** um clique numa sala da visão das salas, ou a sala em que a
  pessoa já está.
- **Passos:**
  1. **Entrar.** O palco abre e a voz conecta. O chat da sala fica ao lado do
     palco. Os controles sempre visíveis são microfone, áudio (ensurdecer
     também silencia o microfone), câmera, compartilhar tela e sair.
  2. **Assistir.** Por padrão, a transmissão em foco fica grande e as outras
     aparecem como miniaturas (de baixa resolução, via simulcast). Clicar
     numa miniatura troca o foco. Há a opção de ver em grade. A qualidade por
     transmissão pode ser auto, alta, média ou só áudio. O volume é ajustável
     por pessoa, com teto de 100%.
  3. **Transmitir.** Escolher a fonte (no desktop, pelo seletor do Electron;
     na web, pelo do sistema), a qualidade (720p, 1080p, 1440p ou Fonte, a 15,
     30 ou 60 fps) e o áudio da tela. Ao vivo dá para pausar, trocar a fonte,
     trocar a qualidade e ver estatísticas.
  4. **Sair para ler.** Ao navegar para outro canal, servidor ou DM sem sair
     da chamada, a transmissão em foco continua em **PiP**, sempre, e a voz
     continua. Um indicador persistente mostra a chamada ativa e leva de volta
     ao palco.
  5. **Sair da sala.** O botão de sair encerra voz, transmissões e PiP, e
     chama a rota de saída.
- **Estados:** *vazio* com ninguém transmitindo (o palco mostra os
  participantes, sem buraco preto); *carregando* com "conectando" no palco,
  sem nenhum indicador de qualidade antes de conectar; *erro* com falha ao
  entrar (motivo traduzido, e a pessoa não aparece como dentro), queda durante
  a chamada (reconectando, depois falha) e permissão de microfone ou tela
  negada pelo sistema; *sem permissão* para falar, transmitir ou usar a câmera,
  com os controles correspondentes ausentes.
- **Completa quando:** com duas contas no E2E, A entra, transmite e B vê o
  vídeo de A no foco. B navega para um canal de texto, o PiP aparece com o
  vídeo ativo, B volta pelo indicador e o palco retoma o mesmo foco. A sai e
  a transmissão some de B e da visão das salas em até 2 s. O E2E roda também
  no Electron.
- **Lógica:** `sdk/chamada.ts` (`entrarNaChamada`, `sairDaChamada`,
  `alternarMudo`, `alternarSurdo`, `alternarCamera`, `alternarTela`,
  `pausarTela`, `alternarAudioDaTela`, `trocarFonteDaTela`, `assinarVideo`,
  `definirQualidadeDeStream`, `definirQualidadeDaTela`,
  `estatisticasDaTela`), `sdk/motorDeVoz.ts`, `store/palcoDeVoz.ts`,
  `store/volumesDeVoz.ts`, `store/preferenciasDeVoz.ts`, `store/popout.ts`
  (só o estado; o PiP hoje é o nativo de `<video>`, chamado no componente).
- **Back-end:** a rota de saída da 4.2.

### 4.4 Conversar (chat completo)

- **Objetivo:** escrever, responder, reagir, anexar e ler sem perder o fio,
  tanto no chat da sala quanto em canais de texto.
- **Entrada:** o chat ao lado do palco, um canal de texto, uma menção ou um
  permalink.
- **Passos:** ler o histórico paginado com a âncora no fim; escrever com
  markdown; responder a uma mensagem; reagir; anexar arquivo ou imagem;
  editar ou apagar a própria mensagem; fixar; ir para a primeira não lida e
  para a próxima menção.
- **Estados:** *vazio* com o começo do canal e o nome do contexto certo (sala,
  canal ou DM); *carregando* no histórico inicial e no prepend sem a âncora
  saltar; *erro* com mensagem falha mostrando a ação de reenviar e envio
  enfileirado sem conexão; *sem permissão* com o composer substituído por uma
  frase dizendo que a pessoa não pode escrever ali.
- **Completa quando:** o E2E envia texto com markdown, uma resposta, uma
  reação e um anexo, e a outra conta vê os quatro. A própria mensagem nunca
  aparece como nova. Uma falha simulada de rede mostra o reenvio e o reenvio
  funciona.
- **Lógica:** `sdk/adapter.ts` (envio otimista com nonce, editar, apagar,
  reagir, fixar, não lidas com ack, digitando, histórico), `sdk/anexos.ts`
  (`subirAnexo`, `tetoDeUploadTexto`), `markdown/`. Back-end: nenhum.

### 4.5 DMs e amigos

- **Objetivo:** falar com uma pessoa ou um grupo pequeno fora de um servidor,
  e gerenciar amizades.
- **Entrada:** a casa no rail, o perfil de alguém ou uma notificação.
- **Passos:** abrir uma DM; criar um grupo, renomear, trocar o ícone,
  adicionar, remover, transferir e sair; pedir, aceitar e desfazer amizade;
  bloquear e desbloquear; ver servidores em comum; denunciar.
- **Estados:** *vazio* sem conversas e sem amigos (indicando como adicionar
  alguém pelo nome); *carregando* nas listas; *erro* com pedido de amizade
  recusado pelo servidor (nome inexistente, já são amigos); *sem permissão* com
  pessoa bloqueada (sem composer e com o motivo dito).
- **Completa quando:** o E2E envia um pedido de A para B, B aceita, A abre a
  DM e as duas contas trocam mensagens. O cabeçalho mostra a pessoa, a busca
  não cita um canal inexistente e a coluna de membros de servidor não
  aparece.
- **Lógica:** `sdk/social.ts` (`abrirConversaCom`, `criarGrupo`,
  `pedirAmizade`, `aceitarAmizade`, `desfazerAmizade`, `bloquear`,
  `buscarEmComum`, `denunciarPessoa`). Back-end: nenhum. Chamada em DM existe
  na lógica (`ligar`, `atenderChamada`, `recusarChamada`), mas o escopo dela
  está em Perguntas abertas.

### 4.6 Configurações essenciais

- **Objetivo:** ajustar quem você é e como o app soa e aparece, sem texto de
  engenharia.
- **Seções:** Perfil (avatar, banner, bio, presença e recado); Conta (nome de
  usuário, e-mail, senha, excluir conta); Dispositivos (listar, renomear,
  derrubar, derrubar os outros); Voz e vídeo (entrada e saída, push-to-talk
  ou detecção de voz, supressão de ruído em três níveis, fundo de vídeo,
  câmera); Aparência (tema e paleta personalizada, todos validados por
  contraste; na v1 só existe o tema escuro).
- **Estados:** *carregando* nos dados da conta e na lista de dispositivos;
  *erro* com senha atual errada, e-mail em uso ou dispositivo sem microfone;
  *vazio* em Dispositivos com só a sessão atual; *sem permissão* não se
  aplica.
- **Completa quando:** o E2E troca o avatar e o recado e a outra conta vê a
  mudança; troca a senha e entra com a nova; derruba outro dispositivo e a
  sessão dele cai; escolhe push-to-talk e o microfone só transmite com a
  tecla.
- **Lógica:** `sdk/perfil.ts` (`salvarPerfil`, `trocarNomeDeUsuario`,
  `trocarSenha`, `trocarEmail`, `definirPresenca`, `definirStatusTexto`,
  `listarDispositivos`, `derrubarDispositivo`, `derrubarOutros`,
  `pedirExclusao`), `sdk/conta.ts` (exclusão), `store/preferenciasDeVoz.ts`,
  `store/atalhosDeVoz.ts`, `tema/`. Back-end: nenhum.

### 4.7 Administração básica

- **Objetivo:** quem cuida do servidor cria e arruma salas e canais, convida,
  dá cargos e modera, sem sair do app.
- **Escopo:** criar o servidor; canais e categorias (criar, editar, apagar,
  duplicar, mover); convites (criar, listar, revogar); cargos (criar, editar
  permissões, reordenar, apagar, aplicar a membros); moderação (expulsar,
  banir, perdoar, castigo, moderar voz, mover de sala); salvar o servidor
  (nome e imagem), sair e transferir a propriedade.
- **Estados:** *vazio* com servidor recém-criado (uma sala e um canal, com o
  convite como próxima ação), sem convites e sem banidos; *carregando* nas
  listas; *erro* quando a ação é recusada (hierarquia, limite); *sem
  permissão* com a ação ausente e não acinzentada. Para o dono, sair do
  servidor diz explicitamente que o servidor será apagado.
- **Completa quando:** o E2E cria o servidor, cria uma sala de voz, gera um
  convite, uma segunda conta entra pelo convite e recebe um cargo que
  libera transmitir, a transmissão funciona, e depois ela é expulsa e some da
  visão das salas.
- **Lógica:** `sdk/servidores.ts` (`criarServidor`, `criarCanal`,
  `duplicarCanal`, `apagarCanal`, `moverCanaisParaCategoria`,
  `criarConvite`, `listarConvites`, `revogarConvite`, `expulsar`, `banir`,
  `perdoar`, `silenciarMembro`, `transferirPropriedade`, `salvarServidor`,
  `sairDoServidor`, `souDono`), lógica de cargos com o catálogo
  `PERMISSOES`, `pode()`. Back-end: nenhum.

## 5. Fora da v1 e não-objetivos

**Ondas seguintes, nesta ordem:**

1. Acesso "só assistir" (back-end), que libera a miniatura ao vivo na visão
   das salas.
2. Eventos.
3. Fórum.
4. Tópicos.
5. Enquete.
6. Figurinhas e efeitos sonoros.
7. Administração avançada (modo de entrada, fila de pedidos, emergência,
   auditoria; a lógica já existe).
8. Mais temas.

**Não-objetivos:**

- Celular e push no celular.
- Layout customizável: slots, presets de layout, reordenar colunas.
- Miniatura ao vivo fora da sala na v1.
- TOTP. Contas só com TOTP não entram.
- Captcha.
- i18n. A v1 é só em português.
- Tema claro na v1. A arquitetura é de N temas, mas só o escuro entra.
- Migrar preferências locais do app velho, que começam do zero.
- Corrigir o app velho, que fica congelado até a troca.
- Posicionamento "para times", modelos de jogos ou de estudo.

## 6. Métricas de sucesso

| Métrica | Alvo | Como se mede |
| --- | --- | --- |
| Troca | Cada pessoa do grupo passa um dia inteiro (10h+) sem abrir o app velho; o app velho sai do ar no dia da migração | Declaração do grupo; data de desligamento |
| Controles inertes | 0 | E2E que aciona todos os controles de cada tela |
| Jornadas com E2E verde contra back-end real | 7/7 | CI com Playwright |
| Estados desenhados e implementados | 4/4 por tela | Checklist do design × E2E |
| Contraste | 0 pares abaixo do mínimo, 0 exceções | Validação de `tema/` no build |
| Jargão na tela | 0 ocorrências | Teste sobre o catálogo de textos |
| Fantasma de voz | Saída refletida na visão das salas em ≤ 2 s em 100% das saídas pela interface | E2E com duas contas |
| Performance | Gate do firehose aprovado em todo merge que toca store, lista ou linha | Gate de merge existente |
| Sessão longa | 10h com uma chamada e uma transmissão ativas sem travamento nem crescimento contínuo de memória | Sessão real do dono, com memória registrada no início e no fim |

## 7. Riscos

| Risco | Efeito | Mitigação |
| --- | --- | --- |
| Estado de voz "fantasma" | A visão das salas mostra gente que saiu e a tese perde credibilidade | Rota de saída no `api` (ADR) e E2E de ≤ 2 s; queda de socket continua como fallback |
| Eventos de voz frágeis no stoat.js (sem evento; o adapter observa o `ReactiveMap`) | Atualização perdida ou atrasada, que só aparece em uso real | Testes do caminho reativo de `vozPorCanal`; avaliar emitir evento no fork do SDK (ver Perguntas abertas) |
| PiP nativo de `<video>` limitado (um por vez, comportamento varia entre web e Electron) | O "PiP obrigatório" falha em algum ambiente | Decidir a forma do PiP na arquitetura e cobrir web e Electron no E2E |
| Uma pessoa transmitindo a 1440p/60 para o grupo num Raspberry Pi | Gargalo de rede ou CPU no servidor de mídia | Qualidade auto via simulcast por padrão; medir com o grupo antes da troca |
| Escopo da v1 grande (7 jornadas) e troca só com tudo pronto | O app velho congelado fica sem correções por muito tempo | Uma jornada por agente em worktree; ordenar as jornadas para que 4.2 e 4.3 fiquem prontas primeiro |
| Extração do pacote de lógica quebrar o app atual | Regressão no app em uso | Primeiro PR verificado contra o app atual com a suíte inteira |
| Componente reaproveitado sem contexto, de novo | Repetição dos defeitos da auditoria | Princípio 3 com asserção de contexto em cada E2E |

## 8. Decisões que fecharam as perguntas abertas

Aprovadas pelo dono do produto em 2026-10-06.

1. **PiP:** janela flutuante DENTRO do app por padrão (igual na web e no
   desktop, arrastável, com controles), mostrando a transmissão que estava em
   foco, com troca. Um botão destaca para o PiP do sistema — ou janela sempre
   no topo no Electron — para assistir com o app minimizado ou atrás de um
   jogo.
2. **Ponto de chegada** (revisado em 2026-10-06, na rodada de design): o
   último servidor com a **última sala em que a pessoa esteve, expandida** —
   quem está dentro, quem transmite, o chat da sala e "Entrar". Não uma grade
   de cartões de salas. A lista lateral mostra **sempre** a contagem de
   pessoas de cada sala. O app **nunca** conecta à voz sozinho.
3. **Canais só de texto:** decidido na fase de design, com a restrição de
   ficar a um clique da visão das salas.
4. **Entrar numa sala:** o microfone volta no último estado escolhido. Trocar
   de sala é direto, sem confirmação — exceto quando a pessoa está
   transmitindo, porque trocar derruba a transmissão.
5. **Chamada em DM entra na v1** (jornada 4.5), com o mesmo palco e PiP; o
   custo extra é a tela de chamada recebida.
6. **Notificações entram na v1** em conjunto mínimo: notificação do sistema e
   som para menção, DM e chamada recebida; silenciar por servidor e por
   canal. A tabela completa por tipo de evento é onda seguinte.
7. **Evento de voz no stoat.js:** decisão de arquitetura, vai para o TRD.
8. **Ativar MFA fica fora da v1:** sem TOTP, o único método seria código de
   recuperação, que não é segundo fator. Volta junto com o TOTP.
