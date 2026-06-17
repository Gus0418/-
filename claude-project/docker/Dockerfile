FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS build
RUN npm ci
COPY . .
RUN npx tsc --noEmit

FROM base AS runtime
COPY --from=build /app .
ENV NODE_ENV=production
EXPOSE 3000

# 預設啟動 Web 伺服器
CMD ["node", "web-server.mjs"]
