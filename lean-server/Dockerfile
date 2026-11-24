# Lean 4 checker for Agora. Deploy anywhere that runs containers (Fly.io,
# Railway, Cloud Run, a VPS) and set LEAN_SERVER_URL on the web app.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git \
 && rm -rf /var/lib/apt/lists/*

RUN useradd -m lean
USER lean
WORKDIR /home/lean

# Pin a toolchain so verdicts are reproducible.
ARG LEAN_TOOLCHAIN=leanprover/lean4:stable
RUN curl -sSfL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh \
    | sh -s -- -y --default-toolchain ${LEAN_TOOLCHAIN}
ENV PATH="/home/lean/.elan/bin:${PATH}"

COPY --chown=lean server.js ./
EXPOSE 8080
CMD ["node", "server.js"]
