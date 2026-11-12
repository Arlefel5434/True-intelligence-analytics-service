FROM node:24.22.2-bookworm-slim AS base

RUN apt-get update \
  && apt-get install --yes --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global pnpm@12.19.0

WORKDIR /workspace

FROM base AS development

USER node

CMD ["pnpm", "--filter", "@tia/api", "run", "dev"]

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/provider-mock/package.json apps/provider-mock/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY tsconfig.base.json ./
COPY apps/api apps/api

RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @tia/api run build \
  && pnpm --filter @tia/api deploy --prod --legacy /opt/api

FROM dependencies AS database

COPY tsconfig.base.json ./
COPY apps/api apps/api

RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @tia/api run prisma:generate

USER node

FROM node:24.22.2-bookworm-slim AS production

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /opt/api ./

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
