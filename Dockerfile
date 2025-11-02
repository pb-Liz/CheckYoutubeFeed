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
COPY src/data ./dist/data
COPY .env .env

RUN npm ci --omit=dev

# データ保存用ディレクトリ（永続化対象）
VOLUME ["/app/data"]

CMD ["node", "dist/main/index.js"]
