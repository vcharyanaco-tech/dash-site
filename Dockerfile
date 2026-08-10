# Root Dockerfile — Railway builds from repo root but the app lives in src/server.
# We copy that directory in as the build context so the existing
# src/server/Dockerfile content is reproduced here at the root path Railway expects.
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy the server sources from src/server into /app
COPY src/server/ ./

RUN npm install

ENV DASH_DATA_DIR=/app/data
EXPOSE 8787

CMD ["sh", "-c", "node seed.js || true; node index.js"]
