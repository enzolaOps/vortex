# Ponte stoat.js → React

A peça mais crítica do projeto. `stoat.js` foi desenhado para Solid: os objetos
do modelo (`Message`, `Channel`, `User`, `Member`) carregam reatividade fina
embutida. Em Solid, `message.content` num JSX atualiza sozinho.

Em React isso não existe. Ler um objeto do SDK direto num componente produz um
componente que **não atualiza** — ou pior, que atualiza às vezes, quando algum
outro re-render passa por ali. Bug fantasma clássico.

A ponte não é overhead. É a camada onde a granularidade de update é decidida, e
portanto onde a performance do app é definida.

## Arquitetura

Três camadas, nessa ordem:

```
stoat.js (signals Solid)
   ↓  adapter — assina o SDK, normaliza, emite por ID
store externo (Map<id, snapshot> + emitters)
   ↓  useSyncExternalStore(subscribe, getSnapshot)
componentes React
```

O store vive em módulo, fora da árvore React. Isso resolve três problemas de
uma vez: `StrictMode` double-invoke vira inofensivo (subscrição com refcount é
idempotente), o dado sobrevive a desmontagem de componente, e a granularidade
fica sob seu controle em vez do controle do reconciliador.

## Regra de granularidade

**Coleção assina lista de IDs. Entidade assina a si mesma.**

- `useChannelMessageIds(channelId)` → `string[]`. Muda só quando entra ou sai
  mensagem.
- `useMessage(messageId)` → snapshot daquela mensagem. Muda só quando aquela
  mensagem muda.

Consequência: editar uma mensagem, adicionar reaction, resolver um upload — nada
disso toca a lista. Toca uma linha. Mensagem nova re-renderiza a lista, mas a
lista só renderiza IDs; as linhas existentes têm as mesmas keys e não remontam.

O mesmo padrão vale para membros, canais, servidores e presença.

## A armadilha do getSnapshot

`useSyncExternalStore` chama `getSnapshot` a cada render e compara por
`Object.is`. Se você montar o objeto ali dentro, cada chamada devolve referência
nova, o React acha que mudou, re-renderiza, chama de novo, e você tem loop
infinito — que se manifesta como aba travando, não como erro claro.

**O snapshot precisa ser um objeto cacheado, substituído apenas quando a
entidade realmente muda.** O adapter constrói o snapshot novo quando o SDK
emite; `getSnapshot` só devolve o que está no Map.

Corolário: nada de `.map()`, `.filter()`, `JSON.parse` ou spread dentro de
`getSnapshot`. Derivação acontece no adapter (uma vez, na escrita) ou no
componente com o resultado memoizado, nunca no getter.

## Estado efêmero de alta frequência

Typing indicator, presença piscando, indicador de quem está falando em voz,
posição de scroll, estado de drag. Volume alto, superfície visual minúscula.

Isso **não entra no store de mensagens**. Store separado, com throttle na
fronteira do adapter — não no componente. Um servidor grande pode emitir
centenas de eventos de presença por segundo; coalescer em janelas de ~100–200ms
é invisível para o usuário e derruba o custo em uma ordem de grandeza.

Regra prática: se um evento pode chegar mais de 10x por segundo e a mudança
visual cabe num badge, ele vive em store efêmero com throttle.

## Context: para que serve aqui

Context é aceitável apenas para valores **estáveis por sessão**:

- instância do client
- tema resolvido
- i18n
- funções de dispatch (referência estável)

Nunca para: mensagem, canal, membro, presença, lista de qualquer coisa,
contadores de unread. Context propaga para todos os consumidores sempre que o
value muda — não existe subscrição parcial. Colocar dado de entidade ali é
importar o pior comportamento do React de propósito.

## Escrita (mutações)

Fluxo: componente chama ação → ação chama o SDK → SDK emite → adapter atualiza
store → componente re-renderiza pelo caminho normal.

Nunca escreva no store direto a partir de um componente. O store é derivado do
SDK; escrever nos dois lugares cria divergência que só aparece em reconexão.

**Optimistic update**, quando necessário, é responsabilidade do adapter: marca a
entidade com estado `pending`, guarda o valor anterior, reconcilia ou reverte na
resposta. Nunca espalhado em componente.

## Reconexão

Websocket cai o tempo todo em cliente de desktop (sleep, troca de rede, VPN). O
adapter precisa tratar:

- resubscrição idempotente — sem duplicar listener
- reconciliação de gap: mensagens perdidas durante o offline
- invalidação de presença: presença antiga é mentira, não estado

Se esse caminho não estiver coberto, o app fica "quase certo" — que é pior que
quebrado, porque ninguém reporta.

## Tipos — o app é dono do seu modelo

O Vortex não é um cliente Stoat com outra cara. É outro produto, com features
que o Stoat não tem. **O `stoat.js` é o transporte de hoje, não a espinha do
app.**

Por isso os tipos de snapshot são **declarados pelo app**, nunca derivados dos
tipos do SDK. Derivar — `type Message = Omit<SDKMessage, "x">` — parece economia
e é acoplamento: a forma do SDK vaza para todo componente que lê um snapshot, e
qualquer movimento depois (campo do Vortex que o protocolo não tem, fork do
backend, troca de SDK) vira refactor do app inteiro.

O adapter é uma **camada anticorrupção**: SDK entra, domínio sai. É o único
lugar do código que sabe que o `stoat.js` existe.

```
stoat.js  →  adapter (mapeia)  →  tipos de domínio do Vortex  →  componentes
             ^^^^^^^^^^^^^^^^
             única fronteira que importa `stoat.js`
```

Os tipos do SDK valem **dentro** do adapter, na entrada — é lá que eles impedem
`any` de propagar. `any` nessa fronteira mata a única rede de segurança que o
port tem.

Campo que o Vortex tem e o protocolo não tem entra no tipo de domínio **desde
já**, preenchido pelo adapter com default. Não espere o backend para modelar o
produto — é o adapter que absorve a diferença, e é exatamente para isso que ele
existe.

Mecanismo: lint de boundary confinando `stoat.js` ao diretório do adapter. Ver
`enforcement.md`. Sem ele, a desvinculação é intenção, e o primeiro
`import { Message } from "stoat.js"` dentro de um componente a desfaz sem que
ninguém perceba.

## Checklist para qualquer PR que toque a ponte

- [ ] `getSnapshot` devolve referência cacheada, sem alocação
- [ ] Subscrição é por entidade, não por coleção
- [ ] Nenhum dado de entidade entrou em Context
- [ ] Estado efêmero está em store separado, com throttle
- [ ] Subscrição é idempotente sob `StrictMode`
- [ ] Caminho de reconexão considerado
- [ ] Sem `any` na fronteira do SDK
- [ ] Nenhum tipo do SDK fora de `src/sdk/` — snapshot é tipo de domínio do Vortex
