# syntax=docker/dockerfile:1.7
FROM node:24.13.1-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
COPY . .
RUN corepack pnpm install --frozen-lockfile
RUN corepack pnpm --filter @pcpartcheck/reference-api... build
RUN corepack pnpm --filter @pcpartcheck/reference-api deploy --prod --legacy /deploy/reference-api

FROM node:24.13.1-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

COPY --from=build --chown=node:node /deploy/reference-api ./

USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
