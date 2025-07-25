FROM rust:1.86.0-slim AS base

RUN apt-get update && apt-get install -y pkg-config libssl-dev build-essential clang lld
# RUN rustup component add clippy

RUN mkdir /app
WORKDIR /app

COPY ./.cargo ./.cargo
COPY ./src ./src
COPY Cargo.lock Cargo.toml ./


FROM base AS builder
RUN --mount=type=cache,id=scrust_1,target=/usr/local/cargo/registry \
    --mount=type=cache,id=scrust_2,target=/app/target \
    cargo build --release && cp /app/target/release/squirrel_core /app/squirrel_core

CMD ["./squirrel_core"]

# FROM builder AS clippy
# RUN --mount=type=cache,id=ksrust_1,target=/usr/local/cargo/registry \
#     --mount=type=cache,id=ksrust_2,target=/app/target \
#     cargo clippy -- -D warnings

# CMD ["echo", "ok"]

# FROM rust:1.79.0-slim AS production

# RUN mkdir /app
# WORKDIR /app
# RUN cargo install rustfilt flamegraph
# COPY --from=builder /app/keystore_v2 /app/keystore_v2
# ENV LISTEN_IP="0.0.0.0"
# ENV LISTEN_PORT="80"
# CMD ["./keystore_v2"]
