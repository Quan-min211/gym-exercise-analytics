FROM python:3.12-slim

WORKDIR /app

# Install system deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
COPY de_pipeline/requirements.txt ./de_pipeline/requirements.txt
RUN pip install --no-cache-dir \
    -r backend/requirements.txt \
    -r de_pipeline/requirements.txt

# Copy all source code and assets
COPY backend/ ./backend/
COPY de_pipeline/ ./de_pipeline/
COPY frontend/ ./frontend/
COPY data/ ./data/
COPY images/ ./images/
COPY videos/ ./videos/

ENV PYTHONPATH=/app

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
