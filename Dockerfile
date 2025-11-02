# ---- ビルド用ステージ ----
FROM node:22-alpine AS builder
RUN  npm install -g npm@11.6.2
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- 実行用ステージ ----
FROM node:22-alpine
RUN  npm install -g npm@11.6.2
WORKDIR /app

ENV NODE_ENV=production

# 実行に必要なファイルだけコピー
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY src/data ./default-data
COPY .env .env

RUN npm ci --omit=dev

# データ永続化ディレクトリ
VOLUME ["/app/data"]

# 起動時に /app/data が空なら初期データをコピー
ENTRYPOINT ["/bin/sh", "-c", "cp -n -r /app/default-data/* /app/data/ 2>/dev/null || true && node dist/main/index.js"]
