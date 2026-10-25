# Satyaseva Sisters — Google Cloud Run Container
FROM python:3.11-slim

# Avoid writing .pyc files and buffer stdout/stderr for immediate Cloud Logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

# Copy website and backend scripts
COPY site /app/site
COPY scripts /app/scripts

# Ensure data and upload directories exist with write permissions
RUN mkdir -p /app/scripts/data /app/site/images/communities && \
    chmod -R 775 /app/scripts/data /app/site/images/communities

# Expose default Cloud Run port
EXPOSE 8080

# Start server (reads $PORT and binds to 0.0.0.0 automatically)
CMD ["python3", "scripts/serve.py"]
