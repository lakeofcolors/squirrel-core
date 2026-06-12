# --- build ---
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime ---
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

# опционально кастомный nginx
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
