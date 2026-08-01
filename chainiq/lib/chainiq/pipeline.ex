defmodule ChainIQ.Pipeline do
  require Logger

  alias ChainIQ.{Repo, Audit}
  alias ChainIQ.Schema.{ProcurementRequest, PipelineResult}

  alias ChainIQ.Engine.{
    PolicyEngine,
    EscalationEngine,
    Validator,
    SupplierMatcher,
    SupplierRanker,
    RequestParser
  }

  def process(request) when is_map(request) do
    started_at = System.monotonic_time(:millisecond)

    validation_issues = Validator.validate(request)

    ai_enrichment = enrich_with_ai(request)

    {policy_results, violations, approval_level} = PolicyEngine.evaluate(request)

    supplier_results = SupplierMatcher.match(request)

    {ranked_suppliers, recommendation} = SupplierRanker.rank(supplier_results.pricing, request)

    escalation =
      EscalationEngine.evaluate(
        request,
        {policy_results, violations, approval_level},
        supplier_results
      )

    elapsed = System.monotonic_time(:millisecond) - started_at

    audit =
      Audit.build(request, %{
        validation: validation_issues,
        policy: policy_results,
        violations: violations,
        approval_level: approval_level,
        suppliers: supplier_results,
        ranking: ranked_suppliers,
        recommendation: recommendation,
        escalation: escalation,
        processing_time_ms: elapsed
      })

    %{
      request_id: request["request_id"],
      request_interpretation: %{
        title: request["title"],
        category: "#{request["category_l1"]}/#{request["category_l2"]}",
        quantity: request["quantity"],
        budget: request["budget_amount"],
        currency: request["currency"],
        country: request["country"],
        required_by: request["required_by_date"],
        preferred_supplier: request["preferred_supplier_mentioned"]
      },
      ai_enrichment: ai_enrichment,
      validation: %{
        issues: validation_issues,
        has_issues: length(validation_issues) > 0
      },
      policy_evaluation: %{
        results: policy_results,
        violations: violations,
        approval_level: approval_level,
        compliant: length(violations) == 0
      },
      supplier_shortlist: ranked_suppliers |> Enum.take(5) |> Enum.map(&format_supplier/1),
      suppliers_excluded: format_excluded(supplier_results.excluded),
      escalation: escalation,
      recommendation: recommendation,
      audit_trail: audit,
      processing_time_ms: elapsed
    }
  end

  def process_by_id(request_id) do
    case Repo.get_by(ProcurementRequest, request_id: request_id) do
      %ProcurementRequest{raw_data: raw_data} ->
        result = process(raw_data)

        attrs =
          result
          |> Map.put(:request_id, request_id)
          |> Map.update(:processing_time_ms, 0, fn v ->
            if is_float(v), do: round(v), else: v || 0
          end)
          |> Map.new(fn {k, v} -> {to_string(k), v} end)

        case Repo.get_by(PipelineResult, request_id: request_id) do
          nil -> %PipelineResult{}
          existing -> existing
        end
        |> PipelineResult.changeset(attrs)
        |> Repo.insert_or_update()

        {:ok, result}

      nil ->
        {:error, :not_found}
    end
  end

  def process_all do
    import Ecto.Query

    Repo.all(from(r in ProcurementRequest, select: r.raw_data))
    |> Enum.map(&process/1)
  end

  defp format_supplier(s) do
    %{
      rank: s.rank,
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      unit_price: s.unit_price,
      total_cost: s.total,
      lead_time_days: s.lead_time_days,
      scores: s.scores,
      preferred: s[:preferred] || false
    }
  end

  defp format_excluded(excluded) do
    Enum.map(excluded, fn {supplier, reason} ->
      %{
        supplier_id: supplier.supplier_id,
        supplier_name: supplier.name,
        exclusion_reason: reason
      }
    end)
  end

  defp enrich_with_ai(request) do
    text = request["request_text"] || ""

    if byte_size(text) > 10 do
      case RequestParser.enrich(request) do
        {:ok, enriched} ->
          enriched["ai_enrichment"]

        _ ->
          nil
      end
    else
      nil
    end
  rescue
    e ->
      Logger.warning("AI enrichment failed: #{inspect(e)}")
      nil
  end
end
