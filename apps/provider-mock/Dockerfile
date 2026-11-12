FROM node:24.22.2-bookworm-slim AS base

RUN npm install --global pnpm@12.19.0

WORKDIR /workspace

FROM base AS development

USER node

CMD ["pnpm", "--filter", "@tia/provider-mock", "run", "dev"]

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/provider-mock/package.json apps/provider-mock/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY tsconfig.base.json ./
COPY apps/provider-mock apps/provider-mock

RUN pnpm --filter @tia/provider-mock run build \
  && pnpm --filter @tia/provider-mock deploy --prod --legacy /opt/provider-mock

FROM node:24.22.2-bookworm-slim AS production

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

COPY --from=build --chown=node:node /opt/provider-mock ./

USER node

EXPOSE 3001

CMD ["node", "dist/main.js"]
