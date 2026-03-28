# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build
WORKDIR /app

ARG VUE_APP_API_BASE_URL=/api/v1
ARG VUE_APP_USE_MOCK_API=false

ENV VUE_APP_API_BASE_URL=${VUE_APP_API_BASE_URL}
ENV VUE_APP_USE_MOCK_API=${VUE_APP_USE_MOCK_API}

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm npm ci

COPY public/ public/
COPY src/ src/
COPY babel.config.js jsconfig.json vue.config.js ./

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
