FROM docker.io/node:current AS backend_build

WORKDIR /src/backend

COPY backend .
COPY shared ../shared
RUN npm i
RUN npx tsc

FROM docker.io/node:current AS frontend_build

WORKDIR /src/frontend

COPY frontend .
COPY shared ../shared
RUN npm i
RUN npx vite build

FROM docker.io/node:current

WORKDIR /app

COPY --from=backend_build /src/backend/dist .
COPY --from=backend_build /src/backend/node_modules ./node_modules
COPY --from=backend_build /src/backend/package.json .
COPY --from=frontend_build /src/frontend/dist ./public

ENV HOST=0.0.0.0
ENV PORT=3000

CMD [ "node", "main.js" ]
