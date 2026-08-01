import Config

if System.get_env("PHX_SERVER") do
  config :chainiq, ChainiqWeb.Endpoint, server: true
end

config :chainiq, ChainiqWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

config :chainiq, :gemini_api_key, System.get_env("GEMINI_API_KEY")

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  config :chainiq, ChainIQ.Repo,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10")

  config :chainiq, Oban,
    repo: ChainIQ.Repo,
    queues: [pipeline: 3, enrichment: 5, backtest: 1]

  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"

  config :chainiq, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :chainiq, ChainiqWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base
end
