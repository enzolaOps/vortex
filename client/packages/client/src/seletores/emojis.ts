/**
 * Os emojis do seletor.
 *
 * ⚠ **É um conjunto CURADO, não o Unicode inteiro, e a diferença está dita
 * porque ela é visível para quem usa.** O padrão tem cerca de 3.800 emojis com
 * nome, alias e ordenação por categoria; trazê-los exigiria uma dependência de
 * dados (`emojibase`, `emoji-datasource`) de algumas centenas de kB — decisão
 * de dependência, que neste projeto precisa de justificativa própria e não
 * entra de carona numa tela.
 *
 * O que está aqui cobre o que se usa de fato numa conversa de trabalho, com
 * nome em português para a busca funcionar no idioma do app. A lista completa
 * é trabalho de dataset, e o dia em que ela entrar o que muda é este arquivo —
 * o seletor não sabe de onde os dados vêm.
 *
 * ⚠ **NÃO é uma entrada de `pendencias.ts`, e já foi.** O registro é de
 * CONTROLE desenhado que ainda não faz nada; aqui não há o que clicar — nada
 * na tela promete os 3.800 e falha. Entrada sem controle é dívida invisível na
 * tela, e uma guarda passou a reprovar o build por causa dela.
 *
 * A ordem dentro de cada categoria é a de USO, não a do Unicode: quem abre a
 * aba de rostos quer 🙂 antes de 🫠, e o padrão ordena por ponto de código.
 */

export type Emoji = {
  readonly glifo: string;
  /** O nome curto, em português. É o que a busca casa e o rodapé mostra. */
  readonly nome: string;
};

export type CategoriaDeEmoji = {
  readonly id: string;
  /** O glifo do rail. */
  readonly icone: string;
  readonly titulo: string;
  readonly emojis: readonly Emoji[];
};

export const CATEGORIAS: readonly CategoriaDeEmoji[] = [
  {
    id: "rostos",
    icone: "🙂",
    titulo: "Rostos e pessoas",
    emojis: [
      { glifo: "🙂", nome: "sorriso" },
      { glifo: "😄", nome: "alegre" },
      { glifo: "😅", nome: "alívio" },
      { glifo: "🤣", nome: "gargalhada" },
      { glifo: "😍", nome: "apaixonado" },
      { glifo: "😎", nome: "estiloso" },
      { glifo: "🤔", nome: "pensando" },
      { glifo: "🫡", nome: "continência" },
      { glifo: "🙃", nome: "de cabeça para baixo" },
      { glifo: "😴", nome: "dormindo" },
      { glifo: "🥲", nome: "sorriso com lágrima" },
      { glifo: "😭", nome: "chorando" },
      { glifo: "😤", nome: "bufando" },
      { glifo: "🤯", nome: "explodindo" },
      { glifo: "🥶", nome: "congelando" },
      { glifo: "🤝", nome: "aperto de mão" },
      { glifo: "🙏", nome: "por favor" },
      { glifo: "👀", nome: "olhos" },
      { glifo: "👋", nome: "tchau" },
      { glifo: "👍", nome: "joia" },
      { glifo: "👎", nome: "não curti" },
      { glifo: "💪", nome: "força" },
      { glifo: "🧠", nome: "cérebro" },
      { glifo: "🫶", nome: "coração com as mãos" },
    ],
  },
  {
    id: "natureza",
    icone: "🐶",
    titulo: "Animais e natureza",
    emojis: [
      { glifo: "🐶", nome: "cachorro" },
      { glifo: "🐱", nome: "gato" },
      { glifo: "🦊", nome: "raposa" },
      { glifo: "🐻", nome: "urso" },
      { glifo: "🐼", nome: "panda" },
      { glifo: "🦆", nome: "pato" },
      { glifo: "🐧", nome: "pinguim" },
      { glifo: "🦉", nome: "coruja" },
      { glifo: "🐝", nome: "abelha" },
      { glifo: "🐛", nome: "bug" },
      { glifo: "🦋", nome: "borboleta" },
      { glifo: "🐙", nome: "polvo" },
      { glifo: "🐢", nome: "tartaruga" },
      { glifo: "🌱", nome: "broto" },
      { glifo: "🌳", nome: "árvore" },
      { glifo: "🌵", nome: "cacto" },
      { glifo: "🌊", nome: "onda" },
      { glifo: "🔥", nome: "fogo" },
      { glifo: "⚡", nome: "raio" },
      { glifo: "❄️", nome: "neve" },
      { glifo: "🌙", nome: "lua" },
      { glifo: "⭐", nome: "estrela" },
      { glifo: "🌈", nome: "arco-íris" },
      { glifo: "☀️", nome: "sol" },
    ],
  },
  {
    id: "comida",
    icone: "🍔",
    titulo: "Comida e bebida",
    emojis: [
      { glifo: "☕", nome: "café" },
      { glifo: "🍺", nome: "cerveja" },
      { glifo: "🍕", nome: "pizza" },
      { glifo: "🍔", nome: "hambúrguer" },
      { glifo: "🍟", nome: "batata frita" },
      { glifo: "🌮", nome: "taco" },
      { glifo: "🍜", nome: "lámen" },
      { glifo: "🍣", nome: "sushi" },
      { glifo: "🥐", nome: "croissant" },
      { glifo: "🍞", nome: "pão" },
      { glifo: "🧀", nome: "queijo" },
      { glifo: "🍎", nome: "maçã" },
      { glifo: "🍌", nome: "banana" },
      { glifo: "🍉", nome: "melancia" },
      { glifo: "🍫", nome: "chocolate" },
      { glifo: "🍰", nome: "bolo" },
      { glifo: "🍪", nome: "biscoito" },
      { glifo: "🍦", nome: "sorvete" },
      { glifo: "🥤", nome: "refrigerante" },
      { glifo: "🍷", nome: "vinho" },
      { glifo: "🧉", nome: "chimarrão" },
      { glifo: "🥑", nome: "abacate" },
      { glifo: "🌶️", nome: "pimenta" },
      { glifo: "🧊", nome: "gelo" },
    ],
  },
  {
    id: "atividades",
    icone: "⚽",
    titulo: "Atividades",
    emojis: [
      { glifo: "⚽", nome: "futebol" },
      { glifo: "🏀", nome: "basquete" },
      { glifo: "🏐", nome: "vôlei" },
      { glifo: "🎾", nome: "tênis" },
      { glifo: "🏓", nome: "pingue-pongue" },
      { glifo: "🥋", nome: "luta" },
      { glifo: "🏆", nome: "troféu" },
      { glifo: "🥇", nome: "primeiro lugar" },
      { glifo: "🎯", nome: "alvo" },
      { glifo: "🎲", nome: "dado" },
      { glifo: "🕹", nome: "joystick" },
      { glifo: "🎮", nome: "videogame" },
      { glifo: "🎧", nome: "fone" },
      { glifo: "🎸", nome: "guitarra" },
      { glifo: "🥁", nome: "tambor" },
      { glifo: "🎺", nome: "trompete" },
      { glifo: "🎨", nome: "arte" },
      { glifo: "🎬", nome: "cinema" },
      { glifo: "🎤", nome: "microfone" },
      { glifo: "📣", nome: "megafone" },
      { glifo: "🎉", nome: "festa" },
      { glifo: "🎊", nome: "confete" },
      { glifo: "🧩", nome: "quebra-cabeça" },
      { glifo: "🪄", nome: "varinha" },
    ],
  },
  {
    id: "viagem",
    icone: "🚗",
    titulo: "Viagem e lugares",
    emojis: [
      { glifo: "🚗", nome: "carro" },
      { glifo: "🚕", nome: "táxi" },
      { glifo: "🚌", nome: "ônibus" },
      { glifo: "🚲", nome: "bicicleta" },
      { glifo: "🛵", nome: "scooter" },
      { glifo: "✈️", nome: "avião" },
      { glifo: "🚀", nome: "foguete" },
      { glifo: "🛸", nome: "disco voador" },
      { glifo: "⛵", nome: "veleiro" },
      { glifo: "🚂", nome: "trem" },
      { glifo: "🗺", nome: "mapa" },
      { glifo: "🏔", nome: "montanha" },
      { glifo: "🏖", nome: "praia" },
      { glifo: "🏕", nome: "acampamento" },
      { glifo: "🏙", nome: "cidade" },
      { glifo: "🌍", nome: "mundo" },
      { glifo: "🗼", nome: "torre" },
      { glifo: "🏠", nome: "casa" },
      { glifo: "🏢", nome: "escritório" },
      { glifo: "⛺", nome: "barraca" },
      { glifo: "🌉", nome: "ponte" },
      { glifo: "🚩", nome: "bandeira" },
      { glifo: "🧭", nome: "bússola" },
      { glifo: "🌅", nome: "amanhecer" },
    ],
  },
  {
    id: "objetos",
    icone: "💡",
    titulo: "Objetos",
    emojis: [
      { glifo: "💡", nome: "ideia" },
      { glifo: "🛠", nome: "ferramentas" },
      { glifo: "🔧", nome: "chave inglesa" },
      { glifo: "🧱", nome: "tijolo" },
      { glifo: "📦", nome: "caixa" },
      { glifo: "📌", nome: "alfinete" },
      { glifo: "📎", nome: "clipe" },
      { glifo: "✂️", nome: "tesoura" },
      { glifo: "📐", nome: "esquadro" },
      { glifo: "🧪", nome: "experimento" },
      { glifo: "🔬", nome: "microscópio" },
      { glifo: "💻", nome: "computador" },
      { glifo: "🖥", nome: "monitor" },
      { glifo: "⌨️", nome: "teclado" },
      { glifo: "🖱", nome: "mouse" },
      { glifo: "📱", nome: "celular" },
      { glifo: "🔋", nome: "bateria" },
      { glifo: "🔌", nome: "tomada" },
      { glifo: "📷", nome: "câmera" },
      { glifo: "🔒", nome: "cadeado" },
      { glifo: "🔑", nome: "chave" },
      { glifo: "💰", nome: "dinheiro" },
      { glifo: "📚", nome: "livros" },
      { glifo: "🗑", nome: "lixeira" },
    ],
  },
  {
    id: "simbolos",
    icone: "🚩",
    titulo: "Símbolos",
    emojis: [
      { glifo: "✅", nome: "aprovado" },
      { glifo: "❌", nome: "errado" },
      { glifo: "⚠️", nome: "atenção" },
      { glifo: "❓", nome: "dúvida" },
      { glifo: "❗", nome: "importante" },
      { glifo: "💬", nome: "conversa" },
      { glifo: "🧵", nome: "tópico" },
      { glifo: "⏱", nome: "cronômetro" },
      { glifo: "📈", nome: "subindo" },
      { glifo: "📉", nome: "caindo" },
      { glifo: "🔁", nome: "repetir" },
      { glifo: "➡️", nome: "seta direita" },
      { glifo: "⬅️", nome: "seta esquerda" },
      { glifo: "♻️", nome: "reciclar" },
      { glifo: "🚫", nome: "proibido" },
      { glifo: "💯", nome: "cem" },
      { glifo: "❤️", nome: "coração" },
      { glifo: "💔", nome: "coração partido" },
      { glifo: "✨", nome: "brilho" },
      { glifo: "🎁", nome: "presente" },
      { glifo: "🏳️", nome: "bandeira branca" },
      { glifo: "🏴", nome: "bandeira preta" },
      { glifo: "🔔", nome: "sino" },
      { glifo: "🔕", nome: "sino silenciado" },
    ],
  },
];

/**
 * O índice plano, para a busca.
 *
 * Montado UMA vez no módulo, e não a cada tecla: são ~170 entradas hoje e
 * milhares quando o dataset completo entrar. Um `flatMap` por caractere
 * digitado é o erro nº 4 do briefing com outra roupa.
 */
export const TODOS: readonly Emoji[] = CATEGORIAS.flatMap((c) => c.emojis);

/** Casa `q` contra o nome. Vazio devolve nada — quem não busca vê categorias. */
export function buscar(q: string): readonly Emoji[] {
  const alvo = q.trim().toLowerCase();
  if (!alvo) return [];
  return TODOS.filter((e) => e.nome.includes(alvo));
}
