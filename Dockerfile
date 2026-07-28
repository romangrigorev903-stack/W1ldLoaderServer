FROM node:20-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM litestream/litestream:0.5.15 AS litestream

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/w1ld_auth.db

COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server ./server
COPY public ./public
COPY storage ./storage
COPY launcher-config.json launcher-version.json ./
COPY litestream.yml /etc/litestream.yml
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data /app/logs /app/storage/clients /app/storage/news \
    && chmod +x /app/docker-entrypoint.sh && chown -R node:node /data /app

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server/server.js"]
