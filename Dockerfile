# 1. deps: install once, reused by every other stage and by the compose dev/test services.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. test: the image cannot be built unless types, unit tests and the build all pass.
FROM deps AS test
COPY . .
RUN npm run typecheck && npm run test:coverage && npm run build

# 3. runtime: static files on nginx.
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=test /app/dist /usr/share/nginx/html
EXPOSE 80
