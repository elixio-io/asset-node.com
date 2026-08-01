defmodule ChainIQ.Data.ResultStore do
  import Ecto.Query
  alias ChainIQ.Repo
  alias ChainIQ.Schema.PipelineResult
  require Logger

  def save(result) when is_map(result) do
    request_id = result[:request_id] || result["request_id"]

    if request_id do
      attrs =
        result
        |> Map.new(fn {k, v} -> {to_string(k), v} end)
        |> Map.put("request_id", request_id)

      case Repo.get_by(PipelineResult, request_id: request_id) do
        nil ->
          %PipelineResult{}
          |> PipelineResult.changeset(attrs)
          |> Repo.insert()

        existing ->
          existing
          |> PipelineResult.changeset(attrs)
          |> Repo.update()
      end
    else
      {:error, :missing_request_id}
    end
  end

  def get(request_id) do
    case Repo.get_by(PipelineResult, request_id: request_id) do
      nil ->
        {:error, :not_found}

      %PipelineResult{} = res ->
        map =
          res
          |> Map.from_struct()
          |> Map.drop([:__meta__, :inserted_at, :updated_at, :id])

        {:ok, map}
    end
  end

  def list do
    Repo.all(from(r in PipelineResult, order_by: [desc: r.inserted_at]))
    |> Enum.map(fn result ->
      %{
        request_id: result.request_id,
        title: get_in(result.request_interpretation || %{}, ["title"]),
        category: get_in(result.request_interpretation || %{}, ["category"]),
        budget: get_in(result.request_interpretation || %{}, ["budget"]),
        recommendation: result.recommendation,
        processing_time_ms: result.processing_time_ms,
        stored_at: result.inserted_at |> DateTime.to_iso8601(),
        has_ai: result.ai_enrichment != nil,
        escalated: result.escalation != nil and result.escalation != %{}
      }
    end)
  end

  def delete(request_id) do
    case Repo.get_by(PipelineResult, request_id: request_id) do
      nil -> :ok
      res -> Repo.delete(res)
    end
  end

  def count do
    Repo.aggregate(PipelineResult, :count, :id)
  end

  def clear do
    Repo.delete_all(PipelineResult)
  end
end
