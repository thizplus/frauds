FROM python:3.12-slim

RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    libgomp1 libglib2.0-0 build-essential python3-dev wget && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 app
USER app

EXPOSE 3002

CMD ["gunicorn", "interfaces.api.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:3002", \
     "--timeout", "300", \
     "--graceful-timeout", "30"]
