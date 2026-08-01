import Config

config :chainiq, ChainIQ.Repo,
  username: "alexander.vonhohnhorst",
  password: "",
  hostname: "localhost",
  database: "chainiq_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

config :chainiq, Oban, testing: :inline

config :chainiq, ChainiqWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "mONQcMKUnU7xMHi8H0xrmRsj8luUDngOm465DIN3UrkNhbQ6P+PE91TJS+3GYZvi",
  server: false

config :logger, level: :warning

config :phoenix, :plug_init_mode, :runtime

config :phoenix,
  sort_verified_routes_query_params: true
