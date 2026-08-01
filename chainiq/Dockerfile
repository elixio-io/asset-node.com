

FROM elixir:1.18-slim AS builder

RUN apt-get update -y && apt-get install -y build-essential git python3 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mix local.hex --force && \
    mix local.rebar --force

ENV MIX_ENV=prod

COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

COPY config/config.exs config/${MIX_ENV}.exs config/
RUN mix deps.compile

COPY priv priv
COPY lib lib

RUN mix compile

COPY config/runtime.exs config/

RUN mix release



FROM debian:trixie-slim AS app

RUN apt-get update -y && \
    apt-get install -y libstdc++6 openssl libncurses6 locales curl ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8

WORKDIR /app

RUN useradd --create-home appuser
RUN chown appuser:appuser /app
USER appuser:appuser

COPY --from=builder --chown=appuser:appuser /app/_build/prod/rel/chainiq ./

ENV HOME=/app

CMD ["sh", "-c", "bin/chainiq eval 'Chainiq.Release.migrate()' && bin/chainiq eval 'Chainiq.Release.seed()' && bin/chainiq start"]
