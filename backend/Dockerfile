FROM python:3.11-slim-bookworm

# Avoid prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install essential system dependencies for PDF parsing, text extraction, and multilingual OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    tesseract-ocr-tel \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create application directory
WORKDIR /app

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create non-root user and persistent directories
RUN useradd -m -u 1000 cleardesk && \
    mkdir -p /var/data/storage /var/data/chroma_data /app/storage /app/chroma_data && \
    chown -R cleardesk:cleardesk /app /var/data

# Copy backend application source code
COPY --chown=cleardesk:cleardesk app/ ./app/

# Switch to non-root user for security
USER cleardesk

# Expose port (Render automatically maps $PORT)
EXPOSE 8000

# Healthcheck validating live FastAPI service and SQLite connectivity
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start Uvicorn dynamically with $PORT support (defaults to 8000)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
