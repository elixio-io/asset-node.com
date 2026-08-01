defmodule ChainIQ.Data.Policies do
  import Ecto.Query
  alias ChainIQ.Repo
  alias ChainIQ.Schema.PolicySet

  def get do
    case Repo.one(from(p in PolicySet, where: p.active == true, limit: 1)) do
      %PolicySet{data: data} when is_map(data) -> data
      _ -> get_cached()
    end
  rescue
    _ -> get_cached()
  end

  defp get_cached do
    try do
      :persistent_term.get(:chainiq_policies, %{})
    rescue
      _ -> %{}
    end
  end

  def approval_thresholds, do: get()["approval_thresholds"] || []
  def preferred_suppliers, do: get()["preferred_suppliers"] || %{}
  def restricted_suppliers, do: get()["restricted_suppliers"] || []
  def category_rules, do: get()["category_rules"] || []
  def geography_rules, do: get()["geography_rules"] || []
  def escalation_rules, do: get()["escalation_rules"] || []
end
