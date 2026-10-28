FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:4444
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN npm install -g http-server
COPY --from=build /app/.build/client ./client
EXPOSE 8080
CMD ["http-server", "./client", "--cors", "--port", "8080", "-P", "http://localhost:8080?"]
