# Primitivos e bibliotecas

## Princípio de divisão

Biblioteca resolve o que é **difícil e genérico**: foco preso em modal, foco
devolvido ao lugar certo no Esc, roving tabindex em menu, posicionamento contra
a borda do viewport, leitor de tela. Isso é caro de acertar e igual em todo app.

Você escreve o que é **específico do produto**: lista de mensagens, rail,
composer, member list. Não existe em biblioteca nenhuma e nunca vai existir.

Confundir os dois é o erro nas duas direções: escrever context menu à mão
(desperdício + a11y quebrada) ou tentar achar uma "biblioteca de chat" pronta
(nunca serve e prende você).

## Primitivos: Radix, não Base UI

O shadcn passou a usar Base UI por padrão em projeto novo. **Para o Vortex, use
Radix.**

Motivo específico: Base UI ainda não tem **Context Menu, Hover Card e Toast** —
exatamente os três primitivos que um cliente de chat mais usa. Context menu em
mensagem, canal, servidor e membro; hover card de perfil; toast de notificação.
Seguir o default deixaria você escrevendo as três peças mais difíceis à mão.

Radix continua totalmente suportado pelo shadcn (`-b radix`) e não está
deprecado. Quando Base UI cobrir os três, reavalie — a migração é progressiva,
componente por componente.

## Mapa Radix → superfície do Vortex

| Primitivo | Onde |
|---|---|
| **Context Menu** | Botão direito em mensagem, canal, servidor, membro. Suporta long-press e submenu. |
| **Dropdown Menu** | Menu do servidor, menu do usuário, "..." da mensagem |
| **Hover Card** | Preview de perfil ao passar sobre avatar ou nome |
| **Dialog / Alert Dialog** | Configurações, confirmação destrutiva |
| **Popover** | Emoji picker, reaction picker, seletor de status |
| **Tooltip** | Ícones da toolbar e do composer |
| **Tabs** | Configurações de usuário e de servidor |
| **Select / Switch / Slider / Radio Group** | Configurações, volume de voz |
| **Toast** | Notificação in-app, erro de envio, reconexão |
| **Toolbar** | Barra de ações do composer |
| **Avatar / Aspect Ratio / Progress** | Perfil, mídia, upload |
| **Separator / Label / Portal / Slot / VisuallyHidden** | Utilitários |

### Scroll Area: cuidado

**Não use na lista de mensagens.** Scroll customizado conflita com virtualização
e com ancoragem — você perde o controle sobre o elemento de scroll que o
virtualizador precisa medir.

Use apenas em painel curto e não-virtualizado: lista de canais, configurações.

## Virtualização: TanStack Virtual, modo chat

Lista de chat inverte o contrato da virtualização normal: conteúdo novo aparece
no fim, histórico entra por prepend no início, e o usuário só deve seguir o fim
se já estava lá.

O TanStack Virtual passou a cobrir essa física de scroll diretamente:

```ts
useVirtualizer({
  count: messageIds.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72,
  getItemKey: (i) => messageIds[i],   // ID estável, nunca índice
  anchorTo: 'end',                    // estabilidade em prepend
  followOnAppend: true,               // segue só se já estava no fim
  scrollEndThreshold: 80,
  overscan: 6,
})
```

Ponto importante: **ordem normal, container de scroll normal.** Nada de
`flex-direction: column-reverse`, transform invertido ou compensação manual de
`scrollTop`. Todas essas gambiarras clássicas de chat deixam de ser necessárias
e cada uma delas quebra seleção de texto ou acessibilidade.

Chame `measureElement` para altura dinâmica e `scrollToEnd()` após montar.

**Alternativa:** `react-virtuoso` traz mais coisa pronta (altura variável,
scroll reverso, headers sticky) com menos controle. Escolha válida se preferir
convergir rápido; menos adequada se for customizar física de scroll.

⚠️ **Verificar antes de fechar a escolha:** houve relato de incompatibilidade
entre TanStack Virtual e o React Compiler. O React Compiler é regra deste
projeto, então isso precisa ser confirmado no spike, não depois. Se conflitar de
fato, a decisão entre TanStack e Virtuoso muda.

## Escrever à mão — não procure biblioteca

- Lista de mensagens (agrupamento por autor, divisor de data, divisor de não
  lidas, estados de envio)
- Rail de servidores com reordenação por drag
- Member list agrupada por cargo, virtualizada
- Composer: autocomplete de menção/canal/emoji, upload, draft por canal,
  edição inline
- Renderer de markdown a partir de AST
- Visualizador de mídia
- Painel de voz e indicadores de fala

Se aparecer uma "biblioteca de chat React" pronta, ela vai trazer modelo de
dados, estilo e estado próprios — os três lugares onde este projeto já tem
decisão tomada. Recusar.

## Não usar

| | Por quê |
|---|---|
| **Base UI** | Falta Context Menu, Hover Card, Toast |
| **Radix Themes** | Versão estilizada. Só os Primitives. |
| **HeroUI, MUI, Mantine, Chakra** | Opinativos demais; brigam com restyling pesado |
| **Biblioteca de chat pronta** | Traz modelo de dados e estado próprios |

## shadcn: opcional, mas o Tailwind já está decidido

**Tailwind v4 é a camada de estilo do projeto** — decisão fechada, com tokens em
CSS custom properties por baixo. Ver `styling.md`.

Isso remove o principal atrito de adotar shadcn, que era justamente o Tailwind
vir embutido. Resta a pergunta menor: usar os componentes prontos do shadcn, ou
só os primitivos Radix estilizados por você?

**Use shadcn quando** o componente é genérico e você quer convergir rápido:
dialog, tabs, select, switch, tooltip. São peças onde não há identidade a
defender.

**Vá de Radix puro quando** o componente carrega identidade do produto: context
menu de mensagem, hover card de perfil, popover de reactions. Começar do shadcn
ali significa apagar o estilo dele antes de escrever o seu.

Em ambos os casos, valem as regras de `styling.md`: nenhum arbitrary value,
nenhuma cor da escala default do Tailwind, e o componente é reestilizado pros
tokens **antes do primeiro uso** — não depois.

## Regras de integração

**Wrapper obrigatório.** Todo primitivo entra por um wrapper em `components/ui/`
e nunca é importado direto numa feature. É isso que torna possível trocar
Radix→Base UI depois, componente por componente, sem tocar em código de produto.

**Estilo por data-attribute.** Radix expõe `data-state`, `data-side`,
`data-disabled`, `data-highlighted`. Estilize por esses atributos, não por classe
condicional em JS. Menos re-render e o estado fica no DOM, onde dá pra inspecionar.

**CSS vars de posicionamento.** Radix expõe coisas como
`--radix-context-menu-trigger-width` e a altura disponível até a borda do
viewport. Use para constranger largura e altura em vez de calcular na mão.

**Radix trava o scroll** ao abrir overlay (`react-remove-scroll`). Isso interage
com a lista virtualizada: verifique que abrir um context menu sobre uma mensagem
não perde a âncora de scroll nem provoca salto ao fechar. É o tipo de bug que só
aparece com histórico longo carregado.

**Portal + Electron.** Content em portal vai pro `body`. Se a titlebar custom
tem região de arraste, confirme que overlay renderizado por cima recebe
`no-drag` — senão o menu abre e não responde a clique.

## Ícones

`@phosphor-icons/react`, weight `regular`, 20px.

`fill` reservado para estado ativo ou selecionado — é a variação semântica, não
decorativa. Nunca misturar com outro set: pesos ópticos diferentes na mesma
barra são perceptíveis mesmo para quem não sabe nomear o problema.
