# wifi.et server image. Build context is the repository root so miniapp/ can be served too.
FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/src ./src
COPY miniapp /app/miniapp
RUN mkdir -p data keys && chown -R node:node /app
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3100/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
