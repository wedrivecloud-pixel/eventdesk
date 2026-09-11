# Build and migration images use the same locked source and schema.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM build AS migrate
CMD ["npm","run","db:migrate"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/dist/standalone ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.js"]
