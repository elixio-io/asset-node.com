defmodule ChainiqWeb.HealthController do
  use ChainiqWeb, :controller

  alias ChainIQ.AI.Antigravity
  alias ChainIQ.Repo

  alias ChainIQ.Schema.{
    Supplier,
    PricingEntry,
    Category,
    ProcurementRequest,
    HistoricalAward,
    PolicySet
  }

  def check(conn, _params) do
    tables = %{
      suppliers: Repo.aggregate(Supplier, :count),
      pricing: Repo.aggregate(PricingEntry, :count),
      categories: Repo.aggregate(Category, :count),
      requests: Repo.aggregate(ProcurementRequest, :count),
      historical_awards: Repo.aggregate(HistoricalAward, :count),
      policy_sets: Repo.aggregate(PolicySet, :count)
    }

    json(conn, %{
      status: "ok",
      elixir_version: System.version(),
      storage: "postgresql",
      tables: tables,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  def ai_health(conn, _params) do
    case Antigravity.health_check() do
      :ok ->
        json(conn, %{status: "ok", ai_proxy: "healthy"})

      {:error, reason} ->
        conn
        |> put_status(503)
        |> json(%{status: "unavailable", message: "AI proxy not reachable: #{inspect(reason)}"})
    end
  end
end
