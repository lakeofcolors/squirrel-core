FROM rust:1.86.0-slim AS base

RUN apt-get update && apt-get install -y pkg-config libssl-dev build-essential clang lld
RUN cargo install sqlx-cli --no-default-features --features postgres

RUN mkdir /app
WORKDIR /app

COPY ./src ./src
COPY Cargo.toml .
COPY .sqlx .sqlx
COPY migrations ./migrations


FROM base AS dev
# RUN cargo sqlx prepare
RUN --mount=type=cache,id=scrust_1,target=/usr/local/cargo/registry \
    --mount=type=cache,id=scrust_2,target=/app/target \
    cargo build --release && cp /app/target/release/squirrel-core /app/squirrel-core

ENV RUST_BACKTRACE=1
# RUN "sqlx migrate run"
CMD ["./squirrel-core"]
