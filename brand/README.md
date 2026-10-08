# Marca Vortex

## Conceito

Três braços de largura constante giram e descem em espiral até um núcleo
quadrado de cantos arredondados. O núcleo é a **tela**; os braços são as
**vozes**. Tudo converge para o centro, que é a tese do produto: voz e tela no
meio, o resto em volta. A forma é um redemoinho, e não um controle de jogo nem
uma bolha de chat. O quadrado no centro (em vez de um disco) também afasta a
leitura de "tomoe", vírgulas em volta de um ponto.

### Por que esta, e não as outras duas

1. **Vírgulas em volta de um disco** (cabeça grossa, cauda afinando). Foi
   descartada no primeiro render: lê como tomoe ou Sharingan, e a cauda
   afinando cai abaixo de 1px a 16px.
2. **V de chevrons aninhados apontando para um ponto.** É legível, mas depende
   da letra e não comunica "em volta". Também fica parecida com patente
   militar a 16px.
3. **Braços de largura constante em espiral + núcleo de tela (escolhida).**
   Nenhum traço afina, então a forma sobrevive ao favicon. O quadrado dá
   significado ao centro e torna a marca distinguível de um spinner genérico.

## Geometria (desenho em 64, viewBox `-4 -4 72 72`)

Os braços saem da caixa 0–64 (a ponta de cima chega a y = −2,9 e a da esquerda
a x = −0,4), então os SVGs ganharam 4 unidades de margem no `viewBox`; com o
`viewBox` 0 0 64 64 original a ponta era cortada em todo raster. As medidas
abaixo continuam valendo para o desenho.

- Braços com 8 unidades de largura (2px a 16px) e pontas arredondadas. Cada um
  gira 130°, do raio 31 ao raio 17.
- Núcleo de 15×15, raio 4.
- Vão mínimo de 4,4 unidades entre braços e de cerca de 4 entre o braço e o
  canto do núcleo, ou seja, cerca de 1px a 16px. Não há detalhe interno abaixo
  de 2px.

## Área de proteção

Deixe livre em volta do símbolo **¼ da largura dele** (16 unidades a 64). No
logotipo, a mesma medida vale a partir da caixa do conjunto. Nenhum texto,
borda ou outro ícone entra nessa área.

## Tamanho mínimo

- Símbolo: **16px** (favicon). Na barra de título, use 20px.
- Logotipo (símbolo + nome): **96px de largura**. Abaixo disso, use só o
  símbolo.

## Arquivos e onde usar

| Arquivo | Uso |
| --- | --- |
| `vortex-simbolo.svg` | Padrão: barra de título, favicon, avatar padrão, qualquer lugar de uma cor. Tinta `#F2F4FA` sobre fundo escuro. |
| `vortex-simbolo-cor.svg` | Momentos de marca: tela de entrada, splash, capa. Braços em `accent` (`#A99BFF`) e núcleo em `speaking` (`#5EE6D0`). |
| `vortex-logotipo.svg` | Símbolo + "Vortex" em Plus Jakarta Sans 700. ⚠ A palavra já está em contornos (`node brand/logotipo-em-contornos.mjs <fonte>`), então funciona em `<img>`. |
| `vortex-icone-app.svg` | Ícone do app (Electron, instalador, PWA) a 512×512: quadrado de raio 112, fundo `#0A0C14` com os campos teal, índigo e magenta desfocados, símbolo em `#F2F4FA`. |

Os arquivos de uma cor usam a tinta `#F2F4FA` escrita no próprio SVG, sem
`currentColor`, porque são exibidos via `<img>`. Para fundo claro, gere a
variante em `#0A0C14`. Não use filtro de inversão.

## Faça

- Use a versão monocromática por padrão; a cor é a exceção.
- Ponha o símbolo sobre o fundo escuro ou sobre o vidro, nunca sobre um campo
  de cor saturado.
- Mantenha os três braços e o núcleo juntos, na proporção do arquivo.

## Não faça

- Não gire, espelhe nem anime o símbolo. O único movimento contínuo da
  interface é o sinal de fala.
- Não troque o núcleo por um disco: o símbolo vira tomoe ou spinner.
- Não aplique gradiente, sombra ou contorno no símbolo. O gradiente fica
  apenas no fundo do ícone do app.
- Não use `live` (`#FF5C7A`) na marca, porque essa cor quer dizer "ao vivo".
- Não estique a forma nem afine os braços para "ficar mais elegante". A 16px,
  um braço mais fino some.
