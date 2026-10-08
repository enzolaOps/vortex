/** Textos do shell fixo: regiões, estados vazios e controles da gaveta e da barra de título. */
export const shell = {
  barraDeTitulo: {
    rotulo: "Barra de título",
    minimizar: "Minimizar a janela",
    maximizar: "Maximizar a janela",
    fechar: "Fechar a janela",
  },
  dock: {
    rotulo: "Servidores",
    vazio: "Nenhum servidor ainda.",
  },
  salas: {
    rotulo: "Salas e canais",
    vazio: "Escolha um servidor para ver as salas.",
  },
  faixa: {
    rotulo: "Salas",
    canais: "Canais de texto",
    vazia: "vazia",
  },
  principal: {
    rotulo: "Conversa",
    vazio: "Escolha uma sala para começar a conversar.",
  },
  gaveta: {
    rotulo: "Membros online",
    titulo: "Online",
    vazio: "Ninguém online agora.",
    offline: "Offline",
    carregando: "Carregando os membros",
    desatualizada: "Presença desatualizada",
    mostrarIcones: "Mostrar só os ícones",
    mostrarLista: "Mostrar a lista",
  },
} as const;
