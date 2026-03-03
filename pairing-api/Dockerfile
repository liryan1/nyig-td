FROM python:3.14-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy project files
COPY pyproject.toml .
COPY src/ src/

# Install dependencies
RUN uv pip install --system .

# Run server
EXPOSE 8080
CMD ["uvicorn", "nyig_td_api.main:app", "--host", "0.0.0.0", "--port", "8080"]
