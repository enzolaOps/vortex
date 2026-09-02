# ============================================
# Estágio 1: construir o cliente React
# ============================================
# ⚠ Pinado na plataforma de BUILD, não na de destino. Este estágio só produz JS
# e CSS estáticos, que são iguais em qualquer arquitetura, então ele roda nativo
# no runner amd64 mesmo quando a imagem é arm64. Sem isto, `pnpm install` e
# `vite build` rodariam sob QEMU e levariam cerca de uma hora.
#
# É o mesmo truque de `web/Dockerfile`, e a razão para ele existir está no
# CLAUDE.md: o alvo é um Raspberry Pi e repositório privado não recebe runner
# arm64 nativo. Ele funciona AQUI porque o artefato é JavaScript; não
# transferiria para um serviço Rust.
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

# `git` porque o `stoat.js` é submodule e o `pnpm` resolve caminhos dele;
# `python3/make/g++` pelo mesmo motivo do upstream — dependências nativas na
# árvore de build.
RUN apk add --no-cache git python3 make g++

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

WORKDIR /build

# ⚠ **O contexto de build é a RAIZ do repositório, não `web-react/`** — e
# descobri isso construindo, não lendo. O `vite.config.ts` tem um plugin
# (`vortex-marca`) que lê `../../../brand/mark.svg` e o emite no bundle; com o
# contexto na ilha, o arquivo fica fora e o build morre em
# `ENOENT: open '/brand/mark.svg'`.
#
# A alternativa era copiar `brand/` para dentro de `web-react/`. Recusada: o
# CLAUDE.md registra `brand/` como diretório único da raiz consumido pelas três
# ilhas (`web/`, `web-react/`, `desktop/`), e uma segunda cópia é exatamente a
# divergência que esse arranjo existe para impedir — a marca mudaria num lugar
# e não no outro, e ninguém veria até comparar as duas telas.
#
# São 32 KB. O custo real é o contexto maior, e o `.dockerignore` da raiz
# derruba tudo que não é `brand/` ou `web-react/`.
COPY brand/ brand/

WORKDIR /build/web-react

COPY web-react/package.json web-react/pnpm-workspace.yaml web-react/pnpm-lock.yaml ./
COPY web-react/packages/ packages/

RUN pnpm install --frozen-lockfile

# O SDK é TypeScript no repositório e precisa ser compilado antes do cliente.
# É o único `build:deps` desta ilha — as outras duas dependências que o
# upstream constrói (`solid-livekit-components`, `js-lingui-solid`) não
# atravessaram o port.
RUN pnpm --filter stoat.js build

# ⚠ **Sem placeholder de URL, ao contrário de `web/Dockerfile`.**
#
# O upstream constrói com `VITE_API_URL=__VITE_API_URL__` e um `inject.js`
# reescreve os placeholders no JS já compilado quando o contêiner sobe. Aqui
# isso não é necessário: `src/sdk/config.ts` resolve a API contra
# `location.origin` em runtime, e o compose serve cliente e API no MESMO
# domínio. A URL acompanha o domínio sozinha — em produção, em túnel e em
# preview — sem reescrever bundle e sem uma etapa que pode falhar em silêncio.
#
# ⚠ **NÃO declare `ARG VITE_API_URL=""` aqui.** Eu tinha declarado, "para o
# futuro", e isso derrubou o app inteiro em silêncio: o Vite substitui
# `import.meta.env.VITE_API_URL` pela string VAZIA, e `??` não cai para o
# próximo em vazio — só em `null`/`undefined`. O `baseURL` virou `""`, o SDK
# caiu no default dele (`https://api.stoat.chat`), e login e criação de conta
# passaram a ir para a instância PÚBLICA do Stoat, com a senha junto.
#
# `sdk/config.ts` agora descarta vazio, então o erro não volta por aqui. A
# variável segue sem ser declarada porque declarar não serve para nada: quem
# precisar apontar para outro domínio passa `--build-arg` e a linha entra
# junto, com o valor de verdade.
RUN pnpm --filter client build

# ============================================
# Estágio 2: runtime mínimo
# ============================================
# Este SEGUE a plataforma de destino: é a imagem que embarca. A única
# dependência é o `sirv-cli`, JavaScript puro, então a instalação abaixo é
# barata mesmo emulada.
FROM node:24-alpine

WORKDIR /app

COPY web-react/docker/package.json ./
RUN npm install --omit=dev

# ⚠ **Depois do `npm install`, e de propósito.** O servidor muda mais que a
# dependência dele; copiado antes, toda edição de uma linha aqui invalidaria a
# camada de instalação e o build refaria o `npm install` sem precisar.
COPY web-react/docker/servidor.mjs ./

COPY --from=builder /build/web-react/packages/client/dist ./dist

# 5000 é a porta que o `web` do upstream expõe, e o compose já aponta para ela.
EXPOSE 5000

CMD ["npm", "start"]
