import Config

config :chainiq,
  ecto_repos: [ChainIQ.Repo],
  generators: [timestamp_type: :utc_datetime]

config :chainiq, Oban,
  repo: ChainIQ.Repo,
  queues: [pipeline: 3, enrichment: 5, backtest: 1]

config :chainiq, ChainiqWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: ChainiqWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Chainiq.PubSub,
  live_view: [signing_salt: "6s6y1MDc"]

config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
