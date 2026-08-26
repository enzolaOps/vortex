# Estilização

**Decidido:** Tailwind v4 + tokens em CSS custom properties + CSS Modules como
escape hatch.

## A restrição que decidiu

O Stoat suporta **temas de usuário**, trocados em runtime, sem rebuild. Esse é o
filtro que eliminou as outras opções:

- Solução que resolve tema em **build-time** (vanilla-extract, Panda com token
  estático) exige machinery extra para tema arbitrário do usuário.
- Solução que resolve tema em **runtime JS** (styled-components, Emotion) paga
  custo por render — inaceitável numa lista virtualizada onde linhas montam e
  desmontam durante o scroll.

CSS custom properties são a única resposta natural: o navegador já faz isso
nativamente, o usuário sobrescreve a variável, tudo reflui de graça.

O Tailwind v4 é construído em torno de CSS variables — `@theme` define as
variáveis que determinam quais utilities existem, e troca de tema em runtime é
sobrescrever a var num seletor. Encaixa sem adaptação.

## As três camadas

```
1. tokens.css          CSS custom properties puras
                       :root { --surface-0: …; --accent: …; }
                       ← temas de usuário sobrescrevem AQUI

2. @theme (Tailwind)   mapeia utilities → as vars da camada 1
                       --color-surface-0: var(--surface-0);
                       gera bg-surface-0, text-1, border-subtle…

3. componentes         utilities do Tailwind
                       CSS Module onde utility fica ruim
```

**O ponto crítico: os tokens não moram no Tailwind.** Moram em CSS puro; o
Tailwind apenas projeta utilities em cima deles.

Três consequências, e são o motivo da arquitetura ser assim:

- Tema de usuário sobrescreve a camada 1. O Tailwind nem precisa saber que
  existe.
- Trocar de ferramenta de estilo no futuro não toca a camada 1. O que é caro
  (decidir a paleta semântica) fica desacoplado do que é substituível.
- `tokens.css` continua sendo fonte única, o que satisfaz a lei nº 4 sem
  depender do Tailwind se comportar.

Esqueleto de partida em `../assets/tokens.css`.

## Regras não-opcionais

Sem estas três, o sistema de tokens vira decorativo em poucas semanas. Elas são
o que transforma o Tailwind de "utilities genéricas" em "seu design system com
sintaxe de utility".

**1. Arbitrary values proibidos.** `bg-[#2b2d31]`, `p-[13px]`, `text-[13px]`.
É valor mágico com outro nome — exatamente o que a lei nº 4 bane. Lint
bloqueando, sem exceção "só nesse caso".

**2. Escala de cor default do Tailwind desativada.** `bg-zinc-800` não pode
existir. Só tokens semânticos: `bg-surface-2`, `text-2`, `border-subtle`. Cor
literal em componente quebra tema de usuário silenciosamente.

**3. Espaçamento, raio e tipo limitados às escalas do projeto.** Se 20 não está
na escala, `p-5` não existe. A escala é a decisão; o Tailwind só a expõe.

## Quando usar CSS Module

Utility resolve bem uns 90%. O critério para os outros 10%:

> Se a `className` passou de ~2 linhas, ou exigiu arbitrary value, é CSS Module.

Casos que caem aí de forma previsível:

- **Grid do shell** — `grid-template-columns` com quatro `clamp()`. Vira
  arbitrary value obrigatório.
- **Container queries com muitas regras** — o painel colapsando coordena várias
  mudanças; muito mais legível em CSS.
- **Keyframes.**
- **Estado do Radix quando fica denso** — caso simples o Tailwind cobre bem
  (`data-[state=open]:opacity-100`); menu com seis estados fica ilegível em
  `className`.

CSS Module usa os mesmos tokens da camada 1. Nunca um valor literal, nem lá.

## Composição de classes

`clsx` + `tailwind-merge` (o helper `cn()` do padrão shadcn). O React Compiler
não se importa — é string, não hook.

Variantes de componente com `cva` ou equivalente, para que o conjunto de estados
fique declarado num lugar só em vez de espalhado em ternários dentro do JSX.

## Por que não as alternativas

| | Por quê não |
|---|---|
| styled-components / Emotion | Serializa e injeta por render; é o que o `revite` legado usava. Na lista virtualizada isso é custo real. |
| vanilla-extract / Panda | Build-time; tema de usuário em runtime exige machinery extra |
| CSS global sem escopo | Colisão garantida num app deste tamanho |
| `tailwind.config.js` | Legado no v4. Use `@theme` no CSS. |

**Alternativa que seria válida:** CSS Modules puros sobre as mesmas custom
properties — camadas 1 e 3, sem a 2. Zero runtime, escopo garantido, tema de
usuário idêntico. Foi descartada por velocidade de iteração num redesign
completo, compatibilidade com shadcn/Radix, e qualidade de geração assistida por
IA, que é significativamente melhor em Tailwind. Se o Tailwind vier a atrapalhar
mais do que ajudar, essa é a saída, e ela não custa a camada 1.

## Verificação

- [ ] Nenhum arbitrary value no diff
- [ ] Nenhuma cor da escala default do Tailwind
- [ ] Valores dentro das escalas do projeto
- [ ] Token novo entrou em `tokens.css`, não direto no `@theme`
- [ ] Trocar o tema ainda funciona no componente alterado
