FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
ARG VITE_YANDEX_MAPS_API_KEY
ARG VITE_OWNER_NAME
ARG VITE_OWNER_PHONE
ARG VITE_OWNER_INN
ENV VITE_YANDEX_MAPS_API_KEY=$VITE_YANDEX_MAPS_API_KEY
ENV VITE_OWNER_NAME=$VITE_OWNER_NAME
ENV VITE_OWNER_PHONE=$VITE_OWNER_PHONE
ENV VITE_OWNER_INN=$VITE_OWNER_INN
RUN npm run build

FROM nginx:1.25
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/174-store.conf /etc/nginx/conf.d/
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
