FROM docker.io/node:current AS backend_build

WORKDIR /src

COPY backend .
RUN npm i
RUN npx tsc

FROM docker.io/node:current AS frontend_build

WORKDIR /src

COPY frontend .
RUN npm i
RUN npx vite build

FROM docker.io/node:current

WORKDIR /app

COPY --from=backend_build /src/dist .
COPY --from=backend_build /src/node_modules ./node_modules
COPY --from=backend_build /src/package.json .
COPY --from=frontend_build /src/dist ./public

RUN ls

ENV HOST=0.0.0.0
ENV PORT=3000

CMD [ "node", "main.js" ]
