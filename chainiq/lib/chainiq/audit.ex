defmodule ChainIQ.Audit do
  def build(request, results) do
    %{
      request_id: request["request_id"],
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
      steps: [
        %{
          step: 1,
          action: "request_received",
          detail: "Request '#{request["title"]}' received via #{request["request_channel"]}",
          data_sources: ["requests.json"]
        },
        %{
          step: 2,
          action: "validation",
          detail: "#{length(results.validation)} issues detected",
          issues: results.validation,
          data_sources: ["categories.csv", "suppliers.csv"]
        },
        %{
          step: 3,
          action: "policy_evaluation",
          detail: "#{length(results.violations)} policy violations found",
          approval_level: format_approval(results.approval_level),
          violations:
            Enum.map(results.violations, fn v ->
              %{
                rule_id: v[:rule_id] || "unknown",
                description:
                  v[:description] || v[:restriction_reason] || v[:message] || "Policy violation"
              }
            end),
          data_sources: ["policies.json"]
        },
        %{
          step: 4,
          action: "supplier_matching",
          detail:
            "#{length(results.suppliers.included)} suppliers matched, #{length(results.suppliers.excluded)} excluded",
          matched_count: length(results.suppliers.included),
          excluded_count: length(results.suppliers.excluded),
          data_sources: ["suppliers.csv", "pricing.csv"]
        },
        %{
          step: 5,
          action: "supplier_ranking",
          detail: "#{length(results.ranking)} suppliers ranked by composite score",
          top_supplier:
            case results.ranking do
              [top | _] -> "#{top.supplier_name} (score: #{top.scores.composite})"
              _ -> "none"
            end,
          data_sources: ["pricing.csv"]
        },
        %{
          step: 6,
          action: "escalation_check",
          detail:
            if(results.escalation.escalation_required,
              do:
                "#{length(results.escalation.triggered_rules)} escalation(s) triggered → #{inspect(results.escalation.escalation_targets)}",
              else: "No escalation required"
            ),
          data_sources: ["policies.json"]
        },
        %{
          step: 7,
          action: "recommendation",
          detail: results.recommendation[:reason] || "Complete",
          data_sources: []
        }
      ],
      processing_time_ms: results.processing_time_ms,
      data_sources_used: [
        "requests.json",
        "suppliers.csv",
        "pricing.csv",
        "categories.csv",
        "policies.json"
      ]
    }
  end

  defp format_approval(nil), do: nil

  defp format_approval(level) do
    %{
      approver: level.approver,
      threshold: level.threshold_value,
      currency: level.threshold_currency
    }
  end
end
