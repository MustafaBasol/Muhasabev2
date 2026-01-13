# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/public/assets/blog/images /app/public/assets/blog/og
RUN apk add --no-cache curl
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
