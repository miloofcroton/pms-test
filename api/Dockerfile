FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/drizzle ./drizzle
ENV NODE_ENV=production
EXPOSE 4444
CMD ["node", ".output/server/index.mjs"]
