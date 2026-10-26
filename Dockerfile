FROM node:24-bookworm-slim AS web
WORKDIR /build
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca,target=/tmp/build-ca.pem \
    if [ -f /tmp/build-ca.pem ]; then NODE_EXTRA_CA_CERTS=/tmp/build-ca.pem npm ci --no-audit --no-fund; else npm ci --no-audit --no-fund; fi
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN --mount=type=secret,id=build_ca,target=/tmp/build-ca.pem \
    if [ -f /tmp/build-ca.pem ]; then PIP_CERT=/tmp/build-ca.pem pip install --no-cache-dir -r requirements.txt; else pip install --no-cache-dir -r requirements.txt; fi
COPY server ./server
COPY --from=web /build/dist ./dist
EXPOSE 8000
CMD ["python", "-m", "server.app"]
