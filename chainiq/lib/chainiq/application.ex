defmodule Chainiq.Application do
  use Application

  @impl true
  def start(_type, _args) do
    ChainIQ.Data.Loader.load_all()

    children = [
      ChainIQ.Repo,
      {Oban, Application.fetch_env!(:chainiq, Oban)},
      ChainiqWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:chainiq, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Chainiq.PubSub},
      ChainiqWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Chainiq.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    ChainiqWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
