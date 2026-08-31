# Layout customizável e tema

**Fase 4.** Não construir antes da fundação estar pronta — sistema de layout
sobre shell quebrado herda a quebra.

Mas as **invariantes de componente** (em `design-system.md`) valem desde o
primeiro componente da fase 2. Retrofitá-las depois é reescrever os componentes;
escrever com elas desde o início custa quase nada. Este é o motivo de a decisão
estar registrada agora, e não quando a fase 4 começar.

## A ideia

Deixar o usuário reorganizar o cliente, esconder o que não usa, escolher a
paleta, e compartilhar a configuração como código. Inspirado em HUD customizável
de FiveM, adaptado às restrições de um app shell.

Demanda comprovada, não hipótese de produto: o BetterDiscord existe porque
milhões de pessoas instalam um mod de cliente só para ter tema e layout.

## Slots com docking, não posição livre

Uma HUD de jogo é um conjunto de widgets **independentes** flutuando sobre o
jogo. Nenhum afeta o outro — posição livre é natural.

Um cliente de chat é um **shell de restrições acopladas**: a largura da coluna
de mensagem depende das sidebars, o composer precisa alinhar exatamente a ela, e
a virtualização exige container de scroll com altura estável e conhecida.

Drag-anywhere quebra os três. O resultado seria um modo de edição bonito e uma
lista de mensagens perdendo âncora sempre que alguém arrastasse um painel.

**A adaptação certa não é reduzir a liberdade, é mudar a granularidade.**

```
┌────┬──────────┬─────────────────────┬──────────┐
│    │          │                     │          │
│ A  │    B     │          C          │    D     │   A, B, D = slots
│    │          │      (fixo)         │          │   C = âncora, nunca move
└────┴──────────┴─────────────────────┴──────────┘
```

- **C é âncora.** Coluna de mensagem + composer. Nunca move, nunca troca de
  lado, sempre presente. É o que protege a virtualização.
- **A, B, D são slots.** Cada um: lado, largura (dentro de limites),
  visível/oculto, e qual painel ocupa.
- **Painéis disponíveis:** rail de servidores, lista de canais, membros, thread,
  fixados, perfil, voz.
- **Slot vazio colapsa** — o que resolve de quebra o aproveitamento de ultrawide.

O usuário reordena, troca de lado, redimensiona, esconde e escolhe o conteúdo.
Sensação de liberdade quase total, zero risco para a lista.

## Tema: picker no nível do token, nunca do componente

**Color picker por componente está descartado.** Quatro motivos:

1. Destrói o sistema de tokens — é valor mágico por componente, escolhido pelo
   usuário, onde nenhum lint alcança.
2. Acessibilidade vira impossível de garantir: accent igual ao surface faz o
   texto sumir.
3. Suporte inviável: todo print de bug chega numa configuração irreproduzível.
4. Espaço combinatório não-testável — você nunca vê a maioria das combinações
   que os usuários veem.

**O que fazer em vez disso:** o usuário escolhe a **paleta** — `--surface-*`,
`--accent`, `--text-*` — e o app deriva o resto.

Dá 90% da liberdade percebida com zero quebra, porque:

- É exatamente a camada 1 de `styling.md`. Sobrescrever CSS var é o mecanismo
  nativo, não uma feature nova.
- Permite **validar contraste no momento da escolha**, avisando ou corrigindo
  com `color-mix()`/OKLCH antes de aplicar.
- Preset de tema vira compartilhável.
- O Stoat já suporta temas de usuário — isso amplia capacidade existente.

Se depois for preciso dar mais poder: **override de token em escopo de
componente**, não cor livre. `--accent` diferente no rail é seguro;
`background: #ff00ff` no message row não é.

## Preset compartilhável

Diferenciação real — o Discord não tem. Layout de comunidade compartilhável é
feature de marketing, não só de produto.

**Versão de schema desde o dia 1, sem exceção.** Você adiciona um componente na
v2 e todo preset salvo quebra. Regras:

- Versão embutida no código do preset
- Chave desconhecida é **preservada**, não descartada (preset de versão futura
  não é destruído ao abrir numa versão antiga)
- Chave ausente usa default
- Migração explícita entre versões, testada

Preset carrega layout e tema. Deve poder aplicar só um dos dois.

## Modo edição

Modo distinto com manipulação direta, não menu de configuração enterrado.

- Toggle de visibilidade por componente: rail, membros, avatares, timestamps,
  divisores de data
- Snap ao grid ao redimensionar
- Reset por painel e reset total
- Preview ao vivo — sem "aplicar" separado
- Saída sem salvar reverte

## Armadilhas técnicas

**Estado de layout nunca no store de mensagens.** Store separado, seguindo a
lei nº 1.

**Durante o drag, posição vive em ref e CSS var; commit só no drop.** Escrever no
store a cada frame re-renderiza a lista de mensagens a 60fps enquanto o usuário
arrasta. É o caso mais óbvio de update não-escopado que este projeto pode
produzir.

**Redimensionar slot muda a largura da coluna de mensagem**, o que muda a altura
das linhas, o que invalida as medidas do virtualizador. Remedir e reancorar após
o commit — nunca durante o arraste. Mecanismo: assertion em dev no wrapper do
virtualizador, ativa desde a fase 0 (ver `enforcement.md`).

**Popout de janela é a versão superior de "posição livre".** No Electron, quem
quer o painel de voz em outro monitor não quer arrastar dentro da janela — quer
uma janela de verdade. Isso já está previsto e cobre boa parte da demanda por
posicionamento livre.

**Preset não pode conter dado de sessão.** Só layout e tema. Nada de IDs de
canal, servidor ou usuário — preset compartilhado vaza informação e quebra na
conta do outro. **Isto é privacidade, não performance: preset já compartilhado
não volta atrás.** Mecanismo: tipo fechado (torna irrepresentável) + teste que
afirma ausência de ID no output serializado. Ver `enforcement.md`.
