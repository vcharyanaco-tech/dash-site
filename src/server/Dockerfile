# India Post Dashboard — Node/SQLite server
# Free-tier friendly: builds the native better-sqlite3 module at image build.
FROM node:20-bookworm-slim

WORKDIR /app

# Install build toolchain needed for better-sqlite3 native compilation.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false

COPY . .

# Persist the SQLite DB + uploads outside the container layer.
# On Render mount a volume at /app/data, or use the host path below.
ENV DASH_DATA_DIR=/app/data
ENV PORT=8787
EXPOSE 8787

# Seed demo data on first run only (skips if records already exist), then start.
CMD ["sh", "-c", "node seed.js || true; node index.js"]
