FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_PUSH_API_URL=""
ENV VITE_PUSH_API_URL=$VITE_PUSH_API_URL
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/build ./build
COPY server ./server
USER node
EXPOSE 8080
CMD ["node", "server/index.mjs"]
