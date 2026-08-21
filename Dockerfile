# Root Dockerfile — Render builds from repo root but the app lives in src/server.
# We copy that directory in as the build context so the existing
# src/server/Dockerfile content is reproduced here at the root path Render expects.
# Node 22 matches better-sqlite3@13's engine requirement (>=22).
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy the server sources from src/server into /app
COPY src/server/ ./

# Bundle the frontend website (repo root) so the container serves
# both the API and the site. The server reads DASH_STATIC_ROOT and serves
# index.html at "/" and all static assets/app.js/sw.js/PWA from /app/www.
COPY index.html app.html app.js offline-queue.js sw.js manifest.json \
     about.html privacy.html support.html terms.html data-deletion.html \
     docs-pwa-icon.svg googledb112fa8b7d5dd0c.html \
     /app/www/
COPY assets/ /app/www/assets/

# Force a clean build of better-sqlite3 from source so the native .node
# binary matches the container's libc/arch (avoids silent load crashes that
# make the server never bind to the port).
RUN npm install --build-from-source=better-sqlite3

ENV DASH_DATA_DIR=/app/data
ENV DASH_STATIC_ROOT=/app/www
EXPOSE 8787

# Start with a launcher that surfaces any startup error to the logs
# (better-sqlite3 load failure, db open error, etc.) instead of exiting silent.
CMD ["node", "start.js"]
