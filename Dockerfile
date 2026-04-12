FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

ARG REQUIREMENTS_FILE=requirements.txt
COPY ${REQUIREMENTS_FILE} /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/
