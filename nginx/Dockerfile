FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM nginx:1.25
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/174-store.conf /etc/nginx/conf.d/
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
