# Cloud image: FFmpeg for video conversion; Node 24 for yt-dlp's YouTube JS challenges.
FROM node:24-bookworm-slim AS node
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && node --version && ffmpeg -version >/dev/null
COPY server.py .
COPY static/ ./static/
RUN useradd -m -u 10001 frameuser
USER frameuser
EXPOSE 8000
# One worker only: jobs and their status are stored in local process memory.
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1"]
