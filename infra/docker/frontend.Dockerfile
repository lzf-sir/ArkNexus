# Frontend Dockerfile: build with Node 22, serve with Nginx.
# Build context: ../frontend
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-fund --no-audit

COPY . .
ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY ../infra/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80