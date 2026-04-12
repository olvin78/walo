FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
COPY requirements.prod.txt /app/requirements.prod.txt

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.prod.txt

COPY . /app/