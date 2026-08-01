defmodule ChainiqWeb.RequestController do
  use ChainiqWeb, :controller

  import Ecto.Query
  alias ChainIQ.{Pipeline, Repo}
  alias ChainIQ.Schema.{ProcurementRequest, PipelineResult}
  alias ChainIQ.Engine.RequestParser
  alias ChainIQ.Data.ResultStore

  def process(conn, %{"request_id" => request_id}) do
    case Pipeline.process_by_id(request_id) do
      {:ok, result} ->
        json(conn, %{status: "ok", data: result})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{status: "error", message: "Request #{request_id} not found"})
    end
  end

  def process_adhoc(conn, params) do
    request =
      params
      |> Map.put_new(
        "request_id",
        "ADHOC-#{Ecto.UUID.generate() |> String.slice(0, 8) |> String.upcase()}"
      )
      |> Map.put_new("request_channel", "adhoc_api")
      |> Map.put_new("status", "new")

    result = Pipeline.process(request)

    case ResultStore.save(result) do
      {:ok, _stored} ->
        json(conn, %{status: "ok", data: result})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{status: "error", message: "Result persistence failed: #{inspect(reason)}"})
    end
  end

  def process_batch(conn, params) do
    request_ids = params["request_ids"] || []

    results =
      if request_ids == [] do
        Repo.all(from(r in ProcurementRequest, limit: 10, select: r.raw_data))
        |> Enum.map(&Pipeline.process/1)
      else
        Enum.map(request_ids, fn id ->
          case Pipeline.process_by_id(id) do
            {:ok, result} -> result
            {:error, _} -> %{request_id: id, error: "not_found"}
          end
        end)
      end

    json(conn, %{status: "ok", count: length(results), data: results})
  end

  def parse(conn, params) do
    text = params["text"] || ""
    use_ai = params["use_ai"] != false

    if byte_size(text) < 5 do
      conn
      |> put_status(400)
      |> json(%{status: "error", message: "Request text too short"})
    else
      {:ok, parsed} = RequestParser.parse(text, use_ai: use_ai)
      json(conn, %{status: "ok", data: parsed})
    end
  end

  def enrich(conn, %{"request_id" => request_id}) do
    case Repo.get_by(ProcurementRequest, request_id: request_id) do
      %ProcurementRequest{raw_data: raw_data} ->
        {:ok, enriched} = RequestParser.enrich(raw_data)
        json(conn, %{status: "ok", data: enriched})

      nil ->
        conn
        |> put_status(404)
        |> json(%{status: "error", message: "Request #{request_id} not found"})
    end
  end

  def index(conn, _params) do
    requests =
      Repo.all(from(r in ProcurementRequest, order_by: r.request_id))
      |> Enum.map(fn r ->
        text = (r.raw_data["request_text"] || "") |> to_string()

        %{
          request_id: r.request_id,
          title: r.title,
          category: "#{r.category_l1}/#{r.category_l2}",
          budget: r.budget_amount,
          currency: r.currency,
          country: r.country,
          urgency: r.raw_data["urgency"] || "standard",
          quantity: r.quantity,
          scenario_tags: r.raw_data["scenario_tags"],
          request_text:
            if(byte_size(text) > 120, do: String.slice(text, 0, 120) <> "…", else: text),
          status: r.status
        }
      end)

    json(conn, %{status: "ok", count: length(requests), data: requests})
  end

  def show(conn, %{"request_id" => request_id}) do
    case Repo.get_by(ProcurementRequest, request_id: request_id) do
      %ProcurementRequest{raw_data: raw_data} ->
        json(conn, %{status: "ok", data: raw_data})

      nil ->
        conn
        |> put_status(404)
        |> json(%{status: "error", message: "Request #{request_id} not found"})
    end
  end

  def results_index(conn, _params) do
    results = Repo.all(from(r in PipelineResult, order_by: [desc: r.inserted_at]))
    json(conn, %{status: "ok", count: length(results), data: results})
  end

  def results_show(conn, %{"request_id" => request_id}) do
    case Repo.get_by(PipelineResult, request_id: request_id) do
      %PipelineResult{} = result ->
        json(conn, %{status: "ok", data: result})

      nil ->
        conn
        |> put_status(404)
        |> json(%{status: "error", message: "No stored result for #{request_id}"})
    end
  end

  def results_delete(conn, %{"request_id" => request_id}) do
    case Repo.get_by(PipelineResult, request_id: request_id) do
      %PipelineResult{} = result -> Repo.delete(result)
      nil -> :ok
    end

    json(conn, %{status: "ok", message: "Result #{request_id} deleted"})
  end
end
