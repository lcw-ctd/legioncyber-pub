FROM golang:1.21-alpine AS nuclei-builder
RUN go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

FROM python:3.11-slim

# Install nuclei binary from builder stage
COPY --from=nuclei-builder /go/bin/nuclei /usr/local/bin/nuclei

# Install system dependencies: dnsutils for domain verification, curl for health checks
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        dnsutils \
        curl \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Update nuclei templates (community + pd templates)
RUN nuclei -update-templates -silent || true

# Create output directory for scan results
RUN mkdir -p /tmp/nuclei-output

# Copy custom templates into the image
COPY templates/ /opt/custom-templates/

WORKDIR /app

# Copy and install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app/

# Non-root user for scan execution
RUN groupadd -r scanner && useradd -r -g scanner -d /app scanner && \
    chown -R scanner:scanner /app /tmp/nuclei-output /root/.config/nuclei || true

USER scanner

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
