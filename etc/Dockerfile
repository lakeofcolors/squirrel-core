FROM rust:1.86.0-slim AS base

RUN apt-get update && apt-get install -y pkg-config libssl-dev build-essential clang lld
RUN cargo install sqlx-cli --no-default-features --features postgres

RUN mkdir /app
WORKDIR /app

COPY ./src ./src
COPY Cargo.toml .

ENV DATABASE_URL=postgresql://hotfrog:@db:5432/belka
RUN cargo sqlx prepare


FROM base AS production
RUN --mount=type=cache,id=scrust_1,target=/usr/local/cargo/registry \
    --mount=type=cache,id=scrust_2,target=/app/target \
    cargo build --release && cp /app/target/release/squirrel_core /app/squirrel_core

CMD ["./squirrel_core"]
