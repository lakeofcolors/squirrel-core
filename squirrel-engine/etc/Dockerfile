FROM rust:1.88.0-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    clang \
    lld \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml .
COPY Cargo.lock .
COPY src ./src
COPY .sqlx .sqlx
COPY migrations ./migrations

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && \
    cp /app/target/release/squirrel-core /app/squirrel-core


FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/squirrel-core /app/squirrel-core

EXPOSE 9221

ENV RUST_BACKTRACE=1
ENV RUST_LOG=info

CMD ["./squirrel-core"]
