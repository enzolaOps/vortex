# Build Stage
#
# ⚠ **Parametrizado no fork, e no upstream ele NÃO era.** O workflow de lá
# passa `build-args: BASE_IMAGE=...`, mas este arquivo trazia
# `FROM ghcr.io/stoatchat/base:latest` literal — e o Docker só substitui com
# `ARG` declarado. O argumento era inerte: toda imagem saía da base do
# upstream, independentemente do que o workflow mandasse.
#
# Aqui isso importa porque a base é construída no NOSSO registro. Sem o `ARG`,
# a imagem publicada como `enzolaops/vortex-api` conteria binários compilados
# do código de outra pessoa — que é o oposto do motivo de existir um fork.
ARG BASE_IMAGE=ghcr.io/stoatchat/base:latest
FROM ${BASE_IMAGE} AS builder
FROM debian:13 AS debian

# Bundle Stage
FROM gcr.io/distroless/cc-debian13:nonroot
COPY --from=builder /home/rust/src/target/release/revolt-bonfire ./
COPY --from=debian /usr/bin/uname /usr/bin/uname

EXPOSE 14703
USER nonroot
CMD ["./revolt-bonfire"]
