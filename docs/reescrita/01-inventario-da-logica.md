# Inventário da camada de lógica por jornada da v1

> Levantado em 2026-10-06 em `client/packages/client/src` (arquivos em `sdk/`
> salvo indicação), por leitura de exports e comentários — sem execução.
> Serve ao PRD: o que a interface nova encontra pronto, e o que falta.

## 1. Login, sessão, conta
- `autenticacao.ts`: entrar, MFA por senha ou código de recuperação, restaurar
  sessão, sair, logout vindo do servidor. Login feito direto na API porque o
  `client.login()` do stoat.js é quebrado.
- `conta.ts`: criar conta (com convite), verificar e-mail, reenviar,
  recuperar e redefinir senha, escolher nome, excluir conta.
- `qr.ts` + `lib/qr.ts`: entrar por código QR (rotas do fork).
- Fora por decisão: TOTP (backend tem; conta só-TOTP não entra) e captcha.
  Não há tela para ATIVAR MFA nem gerar códigos de recuperação.

## 2. Servidores e salas
- `servidores.ts`: criar, convite (buscar, entrar), sair, dono,
  transferir propriedade, salvar, trocar imagem.
- Stores: servidores, canais, texto, voz, categorias, membros, `vozPorCanal`.
- **Quem está em cada sala antes de entrar: existe** (`vozPorCanal`, com
  flags de tela, câmera, mudo, surdo), vindo de `voice_states` no Ready.
- `chamada.ts`: entrar e sair.
- Frágil: o stoat.js não emite evento de voz (`// todo: event` no upstream);
  o adapter observa o `ReactiveMap` do Solid. O protocolo não tem rota de
  saída: quem sai pode ficar "fantasma" até o socket cair.

## 3. Voz e tela (`motorDeVoz.ts`, `chamada.ts`)
- Mudo, surdo (implica mudo), câmera; push-to-talk e detecção de voz.
- Supressão de ruído em 3 níveis (RNNoise no forte), fundo de vídeo.
- Compartilhar tela: pausar, áudio da tela, trocar fonte, presets 720p /
  1080p / 1440p / Fonte × 15 / 30 / 60 fps, troca de qualidade ao vivo,
  estatísticas. Seletor de tela do Electron com fallback do sistema.
- Assistir: `assinarVideo` sob demanda (`autoSubscribe: false`), qualidade
  `auto | alta | media | soAudio` via simulcast — **miniatura de baixa
  resolução é possível para quem está NA SUA sala**.
- Volume por pessoa (teto 100%).
- PiP: só o nativo de `<video>`, chamado em componentes; a lógica guarda só o
  estado (`store/popout.ts`).
- **Não existe miniatura de transmissão para quem está FORA da sala** — nem
  no cliente, nem rota no servidor.

## 4. Chat (`adapter.ts`)
- Envio otimista com nonce e fila de falha; editar, apagar, reagir, fixar,
  figurinha.
- Anexos (`anexos.ts`), GIFs, enquetes, tópicos, embeds.
- Markdown com cache, realce de código, menções e navegação por menção.
- Não lidas com cursor do servidor e ack; digitando; histórico paginado;
  busca no canal e no servidor; fixadas; exportação.

## 5. DMs e amigos (`social.ts`)
- Abrir DM, grupos (criar, renomear, ícone, adicionar, remover, transferir,
  sair), amizade (pedir, aceitar, desfazer), bloquear, em comum, denunciar,
  chamada em DM (ligar, atender, recusar).

## 6. Configurações (`perfil.ts`, `seguranca.ts`)
- Perfil (avatar, banner, bio), nome de usuário, senha, e-mail, presença e
  recado; dispositivos (listar, renomear, derrubar); excluir conta.
- Perfil por servidor, privacidade, preferências de voz e vídeo.
- Tema: derivação, pares e validação de contraste, paletas (`tema/`).
- Notificações (`notificacao/`, `sdk/push.ts`), silêncio, efeitos sonoros.

## 7. Administração
- Canais e categorias (criar, editar, apagar, duplicar, mover, permissões,
  sincronizar com categoria).
- Convites (criar, listar, revogar, pausar).
- Cargos (criar, salvar, reordenar, apagar, aplicar em lote, permissões
  padrão, alcance) com catálogo `PERMISSOES`; `pode(canal, ação)`.
- Moderação: expulsar, banir, perdoar, castigo, moderar voz, mover de sala.
- Já pronto além da v1: modo de entrada, fila de pedidos, emergência,
  auditoria.

## Mudanças de back-end com evidência
1. **Miniatura de transmissão fora da sala** — não existe rota. Afeta a
   "visão das salas" da tese.
2. **Rota de saída de sala** — hoje só pela queda do socket.
3. **Evento de voz no stoat.js** — hoje depende do `ReactiveMap`.
4. TOTP — back-end pronto, cliente fora por decisão.
