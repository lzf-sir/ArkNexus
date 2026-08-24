# Dockerfile for the email-service.
# Build context: ../backend/services/email-service
FROM python:3.13-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for aiosmtpd / aiosqlite
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY app ./app
COPY scripts ./scripts

# Default ports
EXPOSE 8000 1025

# Initialize DB then run server
CMD ["sh", "-c", "python scripts/init_db.py && python -m app.main --host 0.0.0.0 --port 8000"]