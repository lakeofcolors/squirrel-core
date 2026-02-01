# ---------- build ----------
FROM rust:1.88.0-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    clang \
    lld \
    ca-certificates

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY .sqlx .sqlx
COPY migrations ./migrations

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release

# ---------- runtime ----------
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/squirrel-core /app/squirrel-core

ENV RUST_BACKTRACE=1
EXPOSE 8080

USER nobody

CMD ["./squirrel-core"]
