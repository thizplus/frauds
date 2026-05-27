FROM python:3.12-slim

RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    libgomp1 libglib2.0-0 build-essential python3-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3002

CMD ["uvicorn", "interfaces.api.main:app", "--host", "0.0.0.0", "--port", "3002"]
