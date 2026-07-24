FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY de_pipeline/requirements.txt ./de_pipeline/requirements.txt
RUN pip install --no-cache-dir -r de_pipeline/requirements.txt

# Copy source code
COPY de_pipeline/ ./de_pipeline/
COPY data/ ./data/

# Make the package importable
ENV PYTHONPATH=/app

CMD ["python", "-m", "de_pipeline.etl"]
