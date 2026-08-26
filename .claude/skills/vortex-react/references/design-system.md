# Sistema de design

## Princípio

Ferramenta que a pessoa deixa aberta 8h por dia. Legibilidade e baixo ruído
visual ganham de impacto. A interface some; o conteúdo aparece.

Isso não é desculpa para ser genérico. Personalidade num app denso vem de
tipografia bem calibrada, densidade consistente e um elemento de assinatura —
não de gradiente e blur.

## Tokens

**Nenhum hex, nenhum px avulso, nenhuma sombra literal dentro de componente.**
O Stoat suporta temas de usuário; hardcodar cor quebra isso sem erro visível.

Tokens semânticos, nunca literais. `--surface-2`, não `--gray-800`. O nome
descreve o papel, para que trocar o tema não exija renomear nada.

Eles vivem em `tokens.css` como CSS custom properties; o Tailwind apenas projeta
utilities em cima. A arquitetura completa, as regras de lint e o critério
utility-vs-CSS-Module estão em `styling.md` — leia antes de escrever CSS.

```
Superfície   --surface-0..3          (0 = mais fundo)
Texto        --text-1..3             (1 = primário)
Borda        --border-subtle, --border-strong
Ação         --accent, --accent-hover, --on-accent
Semântico    --danger, --warning, --success
Presença     --status-online, --status-idle, --status-dnd, --status-offline
```

**Profundidade em dark UI vem de camada de superfície, não de sombra.** Sombra em
fundo escuro é quase invisível e custa pintura. Empilhe `--surface-N`.

### Escalas

```
Espaço       4 · 8 · 12 · 16 · 24 · 32
Raio         4 · 8 · 12 · 16
Tipo         12 · 13 · 14 · 16 · 20 · 24
Line-height  1.375 em mensagem · 1.2 em título
```

Valor fora da escala precisa de justificativa no PR.

## Shell — o layout raiz

CSS Grid. Nunca flex aninhado improvisado — foi isso que produziu o
comportamento atual de ultrawide.

```css
.shell {
  display: grid;
  grid-template-columns:
    72px                          /* rail de servidores, fixo */
    clamp(240px, 18vw, 320px)     /* canais */
    minmax(0, 1fr)                /* conteúdo */
    clamp(0px, 20vw, 340px);      /* membros, colapsável */
  block-size: 100dvh;
}
```

**`minmax(0, 1fr)` não é opcional.** O default de `1fr` é `minmax(auto, 1fr)`,
e `auto` respeita o `min-content` do filho — uma URL longa ou um bloco de código
empurra a coluna e estoura o grid. Mesma regra para filhos flex: `min-width: 0`.

Esse é o bug de ultrawide na origem.

## Ultrawide

O problema não é o app não preencher a tela. É a linha de texto ficando
ilegível em 3000px de largura.

```css
.message-column {
  max-inline-size: 1100px;   /* teto de linha legível */
  margin-inline: 0;          /* alinhado à esquerda, não centralizado */
}
```

O composer segue exatamente a mesma largura da coluna de mensagem. Desalinhar os
dois é o erro visual mais perceptível na tela principal.

**Acima de ~2560px, o espaço extra vira função, não vazio.** Painel secundário
opcional: thread aberta, mensagens fixadas, perfil do usuário selecionado. Nunca
esticar texto, nunca deixar buraco morto.

### Container queries, não viewport

Painéis reagem ao **próprio tamanho**, não ao da janela. A lista de membros
colapsa quando ela encolhe — não quando a janela encolhe. Isso é o que faz o
mesmo componente funcionar em janela pequena, ultrawide e popout de janela
separada sem código condicional espalhado.

```css
.panel { container-type: inline-size; }
@container (inline-size < 240px) { /* estado compacto */ }
```

Media query de viewport fica reservada para o shell inteiro.

### Scroll

```css
scrollbar-gutter: stable;      /* sem shift ao aparecer a barra */
overscroll-behavior: contain;  /* scroll não vaza pro container pai */
```

## Estados

Todo componente interativo entrega os oito:

`default · hover · active · focus-visible · disabled · loading · empty · error`

Não é burocracia — é o que separa protótipo de produto. Componente sem estado de
erro definido ganha um genérico feio no pior momento possível.

**Empty state** é convite para agir: uma linha de texto e a ação primária. Sem
ilustração genérica, sem texto de consolo.

**Erro** explica o que aconteceu e como resolver, na voz da interface. Erro não
pede desculpa e nunca é vago. "Não foi possível enviar. Tentar de novo" — não
"Ops, algo deu errado".

## Acessibilidade

Piso, não extra:

- Contraste 4.5:1 em texto, 3:1 em borda de controle. Vale para `--text-3` sobre
  `--surface-3`, que é onde costuma falhar.
- `focus-visible` sempre visível — ring com offset. Nunca `outline: none` sem
  substituto.
- Lista de mensagens: `role="log"` com `aria-live` discreto. Não anunciar cada
  mensagem em canal movimentado.
- Navegação por teclado no shell inteiro: trocar canal, trocar servidor, focar
  composer, abrir busca.
- `prefers-reduced-motion: reduce` respeitado — sem exceção "essa animação é
  sutil".
- Presença nunca comunicada só por cor. Cor + forma no ícone de status.

## Movimento

120–180ms, `ease-out`. Apenas `transform` e `opacity`.

Sem spring, sem bounce, sem stagger em UI de produtividade. Animação aqui existe
para explicar de onde algo veio, não para chamar atenção. Numa app que a pessoa
usa milhares de vezes por dia, o que encanta na primeira semana irrita na
terceira.

## Tipografia

Uma família para a interface. Uma mono para código e blocos.

Mensagem em 14–16px com line-height 1.375. Timestamp e metadata em 12px com
`--text-3`. Nome de usuário em 14px com peso maior — a hierarquia dentro da linha
de mensagem é o detalhe tipográfico que mais afeta legibilidade em rolagem
rápida.

Sem emoji em heading de interface.

## Ícones

Phosphor, weight `regular`, 20px. Um único set.

`fill` reservado para estado ativo/selecionado — é a variação semântica, não
decorativa. Nunca misturar Phosphor com outro set: pesos ópticos diferentes na
mesma barra são imediatamente perceptíveis mesmo para quem não sabe nomear o
problema.

## Densidade

Alvo: linha de mensagem compacta o suficiente para caber muito histórico, com
respiro suficiente para agrupar por autor de forma legível.

Mensagens consecutivas do mesmo autor dentro de uma janela curta agrupam sem
repetir avatar e nome. Isso é o que faz a lista parecer conversa em vez de log.

## As quatro invariantes de componente

O layout será customizável pelo usuário (slots com docking, fase 4). Isso não se
constrói agora, **mas todo componente escrito a partir de agora precisa nascer
com estas quatro propriedades.** Retrofitá-las depois é reescrever os
componentes; escrever com elas custa quase nada.

1. **Dirigido por container query.** Reage ao próprio tamanho, nunca ao da
   janela.
2. **Sem premissa sobre irmãos.** Não assume o que está ao lado, nem que existe
   algo ao lado.
3. **Sem premissa de lado.** Funciona à esquerda e à direita. Nada de margin,
   borda ou raio assumindo posição fixa — use propriedades lógicas
   (`padding-inline-start`, `border-inline-end`).
4. **Sem dimensão fixa e com estado independente da posição na árvore.** O
   estado do painel vem do store, não de onde ele está montado. Mover um painel
   não pode resetá-lo.

→ `layout-customization.md`

## Verificação de layout

Toda mudança de layout confere três larguras:

| Largura | O que verificar |
|---|---|
| `<1440px` | Painel de membros colapsa, nada corta |
| `1440–2560px` | Uso natural, sem vazio estranho |
| `>2560px` | Texto não estica, espaço extra tem função |

E um caso patológico: mensagem com URL de 400 caracteres sem espaço. Se ela
estourar o grid, o `minmax(0, 1fr)` ou o `min-width: 0` está faltando em algum
lugar.
