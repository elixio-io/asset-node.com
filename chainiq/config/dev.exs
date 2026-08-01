import Config

config :chainiq, ChainIQ.Repo,
  username: "alexander.vonhohnhorst",
  password: "",
  hostname: "localhost",
  database: "chainiq_dev",
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

config :chainiq, ChainiqWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 4000],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "dTd2sUu+s7Ah7qvuYdqxmWZFIOKAq7YlsO9zWRAp9Oa2thDdMrXmuPJZxKN6tCCi",
  watchers: []

config :chainiq, dev_routes: true

config :logger, :default_formatter, format: "[$level] $message\n"

config :phoenix, :stacktrace_depth, 20

config :phoenix, :plug_init_mode, :runtime
