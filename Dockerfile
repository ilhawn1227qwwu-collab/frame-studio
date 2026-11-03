# FRAME STUDIO: YouTube extractor with optional local-only PO token attestation.
# Pinned BgUtils v2.0.2 includes security fixes.
FROM node:24-bookworm-slim AS pot-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --single-branch --branch 2.0.2 \
    https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /src/bgutil
WORKDIR /src/bgutil/server
RUN npm ci && npx tsc

FROM node:24-bookworm-slim AS node
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_OPTIONS=--max-old-space-size=160 \
    PORT=8000
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates libstdc++6 libcairo2 libpango-1.0-0 \
    libjpeg62-turbo libgif7 librsvg2-2 && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=pot-builder /src/bgutil/server /opt/bgutil/server
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && node --version && ffmpeg -version >/dev/null
COPY server.py .
COPY static/ ./static/
COPY tools/ ./tools/
RUN useradd -m -u 10001 frameuser
USER frameuser
EXPOSE 8000
# Local-only provider is opt-in; one application worker keeps job status in memory.
CMD ["sh", "-c", "if [ \"${FRAME_POT_PROVIDER:-0}\" = \"1\" ]; then node /opt/bgutil/server/build/main.js --host 127.0.0.1 --port 4416 & fi; if [ \"${FRAME_PROBE_ON_STARTUP:-0}\" = \"1\" ]; then (sleep 6; python -u tools/probe_youtube.py) & fi; exec uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1"]
