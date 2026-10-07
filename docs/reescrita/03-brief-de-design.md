# Vortex v1 — brief de design

> Fontes: `00-decisoes.md` e `02-prd.md`, aprovados e não reabertos aqui. Este
> brief alimenta três direções visuais no canvas, depois o design system novo,
> depois as telas das 7 jornadas. Nada do visual anterior entra como
> referência: paleta, fontes, marca e escalas começam do zero.

## 1. Tese visual

**Voz e tela no centro; chat como apoio.** Em hierarquia, isso quer dizer:

- A área principal nunca abre num canal de texto. Ela mostra **gente em
  salas** (visão das salas) ou **imagem ao vivo** (palco).
- O sinal mais forte da tela é sempre **"ao vivo / falando"**. Não lidas e
  menções vêm depois, em tom menor.
- O chat ocupa uma coluna lateral, de leitura, com medida limitada. Ele
  acompanha; não disputa o centro.

**O que denuncia o Discord, e o que entra no lugar:**

| Sinal do Discord | Substituto no Vortex |
| --- | --- |
| Rail de 72px com ícones redondos e pílula branca à esquerda | Seletor de servidores **com nome escrito**, na barra de título (abas ou menu); nenhum ícone redondo empilhado |
| Tríade rail · lista de canais · chat no centro | Centro = salas ou palco; chat à direita, como apoio |
| Blurple e acento azul-violeta | Acento fora da família azul-violeta (ver direções) |
| Lista de canais com `#` e alto-falante como navegação principal | Salas como cartões com ocupantes; canais de texto numa gaveta secundária |
| Anel verde em volta do avatar para "falando" | Sinal de fala com forma própria (ver §5), nunca anel verde |
| Barra de usuário com microfone e fone no canto inferior esquerdo | Doca de chamada única e persistente, que só existe quando há chamada |
| Selo vermelho redondo de menção | Contador retangular discreto, em tom diferente do sinal ao vivo |

## 2. Estrutura do shell

Layout fixo; nada reordenável.

- **Barra de título** (custom no Electron; a mesma faixa na web, sem os botões
  de janela): marca, seletor de servidores com nome, Casa (DMs e amigos),
  busca/comandos, **indicador de chamada**, notificações, avatar (perfil,
  presença, configurações). Todo interativo nela é `no-drag`.
- **Coluna de lugar (esquerda, ~240px):** cabeçalho do servidor; **Salas**
  (lista compacta com contagem de pessoas e selo ao vivo); **Canais de texto**
  logo abaixo, sempre visíveis. Daqui o canal de texto fica a um clique da
  visão das salas, cumprindo a restrição do PRD.
- **Área principal:** visão das salas · palco · canal de texto/DM.
- **Coluna de apoio (direita):** chat da sala no palco; perfil/membros no
  canal de texto; perfil da pessoa na DM. Nunca aparece na Casa sem contexto.
- **Doca de chamada:** quando há chamada e a pessoa está fora do palco, o
  indicador da barra de título mostra sala, quem fala e os controles mínimos
  (microfone, áudio, sair); clicar volta ao palco.
- **PiP no app:** janela flutuante arrastável sobre a área principal, com a
  transmissão em foco, troca de transmissão, voltar ao palco e destacar (PiP
  do sistema / janela sempre no topo). Não cobre o composer por padrão.
- **Configurações:** tela cheia sobre o shell, com navegação própria à
  esquerda e `Esc` para voltar; a chamada continua no indicador.

**Larguras.**

| Largura | Comportamento |
| --- | --- |
| 1280 | Coluna de lugar 240 · principal fluida · apoio 320. No palco, o foco ganha a maior área |
| 1440–1920 | Apoio até 360; salas em mais colunas de cartões |
| ≥ 2560 | Espaço extra vira **função**: no palco, a fileira de miniaturas vira coluna própria e o chat da sala fica fixo; no canal de texto, aparece a coluna de fixadas/perfil. Texto de mensagem nunca passa da medida de leitura; cartões de sala têm largura máxima e a grade ganha colunas, nunca esticam |

**Visão das salas**

```
┌ ◆ Vortex │ [Grupo ▾] [Trampo] [Jogo] │ Casa │ ⌘K busca │ ● Sala 2 · Ana fala │ avisos │ ◯ ┐
├──────────┬──────────────────────────────────────────────────────────────────────┤
│ GRUPO    │  Salas                                                               │
│ Salas    │  ┌─ Sala 1 ── AO VIVO ────┐ ┌─ Sala 2 ─────────────┐ ┌─ Sala 3 ──────┐ │
│  Sala 1 3│  │ Ana ▣ transmite "Jogo" │ │ Bia  Caio (mudo)     │ │ ninguém       │ │
│  Sala 2 2│  │ Davi  Eva (surdo)      │ │                      │ │               │ │
│  Sala 3  │  │            [ Entrar ]  │ │          [ Entrar ]  │ │   [ Entrar ]  │ │
│ Canais   │  └────────────────────────┘ └──────────────────────┘ └───────────────┘ │
│  geral  2│                                                                      │
│  links   │                                                                      │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

**Palco com chat da sala**

```
┌ barra de título ............................................................ ┐
├──────────┬───────────────────────────────────────────┬──────────────────────┤
│ coluna   │  ┌───────────────────────────────────────┐ │ Chat · Sala 1        │
│ de lugar │  │  transmissão em foco (Ana · "Jogo")   │ │ Davi: viu isso?      │
│          │  │                                       │ │ Ana: segura          │
│          │  └───────────────────────────────────────┘ │                      │
│          │  [mini Davi cam] [mini Eva tela] [+ grade] │                      │
│          │  Ana◉ Davi Eva · ─ mic ─ áudio ─ cam ─ tela ─ sair │ [composer]   │
└──────────┴───────────────────────────────────────────┴──────────────────────┘
```

**Canal de texto / DM (com PiP e chamada ativa)**

```
┌ barra de título ...................................... ● Sala 1 · 3 · [mic][sair] ┐
├──────────┬─────────────────────────────────────────┬───────────────────────────┤
│ coluna   │ # links            (DM: pessoa + status) │ membros / perfil          │
│ de lugar │   mensagens na medida de leitura         │                           │
│ (DM: lista│                              ┌────────┐ │                           │
│ conversas)│                              │ PiP    │ │                           │
│          │ [ composer ]                 └────────┘ │                           │
└──────────┴─────────────────────────────────────────┴───────────────────────────┘
```

Na Casa, a coluna de lugar lista conversas e Amigos; a coluna de apoio mostra
o perfil da pessoa, nunca membros de servidor.

## 3. Restrições não negociáveis

- **Só tema escuro na v1**, sobre arquitetura de **N temas nomeados**. Todo
  tema preenche os mesmos papéis (§4); a paleta personalizada é só mais um
  tema. Nenhum componente referencia cor crua.
- **Contraste sem exceção:** 4,5:1 texto; 3:1 borda, ícone funcional e texto
  grande. Sem lista de exceções, em todo tema.
- **Densidade para 10h+:** baixo ruído, poucos níveis de peso, nada pulsando
  sem motivo. O único movimento contínuo permitido é o sinal de fala.
- **Todos os estados desenhados** por tela: vazio, carregando, erro, sem
  permissão. Ação sem permissão não aparece (não fica cinza).
- **Nenhum controle inerte**; nada de "em breve".
- **Um conjunto de ícones só**, um peso, uma grade. **Emoji nunca é ícone** de
  interface (só conteúdo do usuário).
- **Texto para quem usa:** nada de nome de token, store, fase, "protocolo".
  Rótulos em caixa de frase, consistente.
- **Movimento:** só `transform` e `opacity`, ≤ 240ms; listas nunca animam
  altura; respeitar redução de movimento.
- **Medida de leitura** para o corpo da mensagem (~70–80 caracteres),
  independente da largura da janela.
- Um item ativo por coluna; foco visível com **um** anel, nunca duplicado.

## 4. Papéis de token

Cada tema define todos; nenhum valor aqui.

| Papel | Intenção |
| --- | --- |
| `surface-base` | Fundo do app e da barra de título |
| `surface-1..3` | Colunas, cartões de sala, painéis; degrau perceptível entre vizinhos |
| `surface-overlay` | Menus, popovers, PiP, diálogos |
| `stage` | Fundo do palco e das miniaturas: o mais neutro possível, para não tingir o vídeo |
| `scrim` | Véu atrás de diálogo e de configurações |
| `text-1..4` | Principal · secundário · metadado · desabilitado/placeholder (o 4 ainda passa 4,5:1 onde for informação) |
| `text-on-accent`, `text-on-danger`, `text-on-live` | Texto sobre preenchimentos de cor |
| `border-subtle`, `border-strong` | Divisória decorativa · borda de controle (3:1) |
| `accent`, `accent-hover`, `accent-press`, `accent-soft` | Marca e ação primária; seleção atual |
| `state-hover`, `state-press`, `state-selected` | Véus de interação, iguais em qualquer superfície |
| `focus-ring` | Anel de foco único, 3:1 contra qualquer superfície |
| `live` | "Transmitindo agora": selo, borda de miniatura, contagem ao vivo |
| `speaking` | "Falando agora": distinto de `live` e de `accent` |
| `muted` / `deafened` | Ícones de estado de voz, neutros mas legíveis |
| `quality-good/fair/poor` | Qualidade de conexão |
| `unread`, `mention` | Não lida (posicional) e menção (contagem); nunca confundíveis com `live`/`speaking` |
| `danger`, `warning`, `success`, `info` (+ `-soft`) | Feedback e ações destrutivas |
| `presence-online/idle/dnd/offline` | Presença; distinguível também por forma |
| `elev-1..3` | Sombra para camadas flutuantes (menu, PiP, diálogo) |
| `skeleton` | Esqueleto de carregamento |

## 5. Sinais de voz e tela

O vocabulário central. Regra: **cor nunca é o único canal**; cada sinal tem
forma própria.

- **Falando:** marca de forma própria no avatar/nome (ex.: contorno animado
  por `opacity`, barras), em `speaking`. Liga em ≤ 120ms, desliga com pequena
  persistência para não piscar a cada sílaba. É o único elemento que se mexe
  sozinho.
- **Transmitindo:** selo textual **"Ao vivo"** + ícone de tela, em `live`, com
  o rótulo do que é transmitido. Na miniatura, borda em `live`. Câmera usa
  ícone próprio, sem o selo.
- **Mudo / surdo:** ícone riscado ao lado do nome, em `muted`/`deafened`;
  surdo implica mudo e mostra só o ícone de surdo. Mudo pelo servidor tem
  variante distinta.
- **Qualidade:** três níveis por forma (barras) e rótulo no tooltip; só
  aparece **depois** de conectado; nunca ao lado de erro de entrada.
- **Você está numa chamada:** indicador persistente na barra de título com o
  nome da sala, um ponto em `speaking` quando alguém fala e os controles
  mínimos. Conectando/reconectando substituem o indicador de qualidade, com
  texto.
- **Separação de família:** `live` e `speaking` são sinais de **presença**;
  `unread` e `mention` são sinais de **leitura**. Não compartilham cor, forma
  nem posição (leitura fica na lista; presença fica em avatar, cartão e
  palco).

## 6. Marca

- Nome **Vortex** mantido; marca redesenhada a partir da tese: algo que
  converge para um centro (voz e tela no meio, o resto em volta).
- Deve funcionar a **16px** (favicon) e na barra de título a ~20px: formas
  sólidas, sem traço fino, sem detalhe interno abaixo de 2px.
- **Monocromática primeiro**; a versão em cor usa `accent`.
- Entregar: símbolo, logotipo, símbolo + nome, versão de ícone de app.
- Não pode lembrar o controle de jogo do Discord nem uma bolha de chat.

## 7. Três direções para explorar

Todas cumprem §3. As fontes são livres (OFL ou equivalente).

### A — Estúdio

Sala de transmissão: o app como mesa de corte de um estúdio de TV. Superfícies
grafite levemente quentes, hierarquia por blocos bem definidos, rótulos curtos
em caixa alta só onde são sinal. **Tipo:** Geist + Geist Mono (mono para
tempos, contagens e qualidade). **Temperatura:** quente neutra; acento
âmbar/laranja. **Assinatura:** a **luz de tally** — um retângulo de
`live` que acende no cartão, na miniatura e no indicador quando há
transmissão. **Risco:** o vermelho/âmbar do tally colidir com `danger` e
`warning`; exige separar por forma e matiz com cuidado.

### B — Correnteza

O vórtice literal: fluxo, anéis, centro. Neutros frios de tinta (não azul
saturado), máxima densidade, cantos pequenos. **Tipo:** Space Grotesk +
Space Mono. **Temperatura:** fria; acento verde-limão/chartreuse.
**Assinatura:** **anéis concêntricos** — o sinal de fala como ondas a partir
do avatar e a marca como espiral fechada; o palco tem um leve gradiente
radial para o centro. **Risco:** limão cansar em 10h e o motivo de anel
virar decoração; precisa ficar restrito a fala e marca.

### C — Noturno editorial

Calma de revista à noite: quase sem preenchimento, separação por espaço e
filetes finos, tipografia carregando a hierarquia. **Tipo:** Fraunces (só
títulos de sala e servidor) + Public Sans (interface) + Martian Mono
(dados e tempos). **Temperatura:** cinza quente de baixa saturação; acento
coral/vermelhão suave. **Assinatura:** **nome da sala em serifa grande** no
cartão e no palco, como manchete. **Risco:** sinais de voz menos
"gritados" perdem leitura de relance; serifa pode parecer lenta num app
denso.

## 8. Critérios de escolha

O dono julga as três lado a lado nas mesmas três telas (§2), com dados
reais do grupo:

1. **Não é Discord:** um print sem marca, mostrado ao grupo, não é
   reconhecido como Discord.
2. **Relance de voz:** em 2 s, dá para dizer quem está em qual sala, quem
   transmite e quem fala (jornada 4.2).
3. **Palco primeiro:** a transmissão domina o palco; o chat é legível sem
   competir (4.3).
4. **10 horas:** deixar a direção aberta uma tarde inteira sem cansaço
   visual nem ruído.
5. **Contraste:** a paleta passa 4,5:1 / 3:1 em todos os pares sem exceção.
6. **Sinais distintos:** `live`, `speaking`, `unread`, `mention`, `danger`
   nunca se confundem, inclusive em escala de cinza.
7. **Escala para N temas:** os papéis de §4 sobrevivem a trocar o matiz do
   acento sem quebrar o caráter.
8. **Marca:** legível a 16px e reconhecível em monocromático.
