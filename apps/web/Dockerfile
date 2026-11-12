FROM node:24.22.2-bookworm-slim AS base

RUN npm install --global pnpm@12.19.0

WORKDIR /workspace

FROM base AS development

USER node

CMD ["pnpm", "--filter", "@tia/web", "run", "dev"]

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/provider-mock/package.json apps/provider-mock/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY tsconfig.base.json ./
COPY apps/web apps/web

RUN pnpm --filter @tia/web run build

FROM nginx:1.30.6-alpine AS production

COPY apps/web/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
